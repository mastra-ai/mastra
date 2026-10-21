/**
 * Sha-tagged repo templates.
 *
 * A repo template is an E2B template with the repository already cloned and
 * its dependencies installed at a known commit. Sessions started from it only
 * need `git fetch` + checkout of their actual ref plus setup drift, instead
 * of a cold clone + full install.
 *
 * There is exactly ONE template per (repo, setup command, repoDir): the
 * template name is a deterministic `mastra-repo-<hash>` over those inputs,
 * and the commit sha rides as a docker-style TAG on that name
 * (`mastra-repo-<hash>:sha-<sha>`). A moved default branch produces a new
 * tag via a rebuild-in-place of the same template — old sha tags remain as
 * prunable build history instead of accumulating stale template names.
 * Builds are lazy: the first `E2BSandbox.start()` that resolves a missing
 * tag triggers the build; nothing pre-builds templates for idle repos.
 *
 * Credential invariant: a build credential may enter the template
 * DEFINITION (via `setEnvs`, visible to build steps but not persisted into
 * runtime sandbox environments) and the build process — never the image
 * filesystem. Clones authenticate through an in-shell computed
 * `http.extraheader`, so no tokened remote URL or credential file can land
 * in a captured layer. Callers must supply a short-lived credential (a
 * GitHub App installation token, which self-expires); never a long-lived
 * PAT. Without a credential the clone is plain tokenless HTTPS — public
 * repos build fine; a private repo's build fails and the sandbox falls back
 * to the fallback template, with the session's runtime setup performing the
 * full clone using its runtime-injected credential instead.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import {
  WORKSPACE_SETUP_MARKER_PATH,
  guardedSetupCommand,
  repoCloneCommand,
  repoSetupMarkerPath,
  setupMarkerCommand,
  setupMarkerContent,
} from '@internal/workspace';

import { Template } from 'e2b';
import type { ConnectionOpts, TemplateClass } from 'e2b';

import { createDefaultMountableTemplate, DEFAULT_CPU_COUNT, DEFAULT_MEMORY_MB } from './template';
import type { DeferredNamedTemplateSpec, NamedTemplateSpec } from './template';

const execFileAsync = promisify(execFile);

// Monotonic; never reuse a retired value. v4 added the machine resources
// (cpuCount, memoryMB) to the identity hash — resources are baked into the
// built template, so a resize must produce a new template rather than
// silently reusing one built at the old size. v5 picked up the v3 default
// mountable base (pinned current Node LTS + corepack) — base contents are
// not part of this hash, so the bump is what forces existing repo
// templates to rebuild on the new base.
const ALIAS_VERSION = 'v5';

/**
 * Stable tag assigned to every successful repo-template build. Points at the
 * latest build regardless of sha, so a moved head can boot from the previous
 * build (`name:current`) while the fresh sha builds in the background.
 */
const CURRENT_TAG = 'current';

/**
 * Env var carrying the repository credential during the build. The same
 * name a session installs before running setup, so a setup command sees the
 * same environment in both places. Set via `setEnvs`; the git auth header is
 * computed from it too.
 */
const BUILD_TOKEN_ENV = 'GH_TOKEN';

/**
 * Clone URLs interpolate into build shell commands, so constrain them to
 * https plus plain host/path characters. This rejects shell metacharacters
 * outright rather than escaping them. Every regex here is a single anchored
 * character class, so matching stays linear on adversarial input; the
 * structural checks (scheme, host, path segments) go through WHATWG URL
 * parsing instead of one big backtracking pattern.
 */
const CLONE_URL_ALLOWED_CHARS = /^[a-z0-9:/._-]+$/i;
const CLONE_URL_HOST_PATTERN = /^[a-z0-9.-]+$/i;
const CLONE_URL_SEGMENT_PATTERN = /^[\w.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

function isValidCloneUrl(cloneUrl: string): boolean {
  // The RAW string is what reaches shell commands, so allowlist it directly:
  // URL normalization (backslash folding, percent-decoding) must not be able
  // to launder characters the raw string carries.
  if (cloneUrl.length > 2048 || !CLONE_URL_ALLOWED_CHARS.test(cloneUrl)) return false;
  let url: URL;
  try {
    url = new URL(cloneUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return false;
  if (!CLONE_URL_HOST_PATTERN.test(url.hostname)) return false;
  // At least one path segment, none empty — rejects bare hosts and
  // trailing slashes, exactly as the previous single-pattern check did.
  const segments = url.pathname.split('/').slice(1);
  return segments.length > 0 && segments.every(segment => CLONE_URL_SEGMENT_PATTERN.test(segment));
}

/**
 * Repository clone target plus an optional credential for it.
 *
 * Structurally identical to the factory capability of the same name, and
 * declared here so this package carries no factory dependency: a host can
 * pass its context accessor straight through.
 */
export interface RepositoryAccess {
  /** https clone URL, e.g. `https://github.com/acme/widgets.git`. */
  cloneUrl: string;
  /**
   * Credential for private repositories. `scheme` describes the credential
   * itself; git over https accepts only basic auth, so a bearer token is
   * presented as `x-access-token:<token>` (see {@link gitAuthFlag}).
   */
  authorization?: { scheme: 'bearer'; token: string };
}

/** One repository of a multi-repository template. */
export interface RepoTemplateRepository {
  /**
   * Resolves this repository's clone URL and, for private repositories, a
   * SHORT-LIVED credential, exactly as
   * {@link RepoTemplateOptions.getRepositoryAccess} does for one repository.
   * Each entry mints its own: installation tokens expire and one token
   * rarely covers every repository.
   */
  getRepositoryAccess: () => Promise<RepositoryAccess | undefined>;
  /** Setup command(s) run inside this repository's checkout; see {@link RepoTemplateOptions.setupCommand}. */
  setupCommand?: string | string[];
}

export interface RepoTemplateOptions {
  /**
   * Resolves the clone URL and, for private repositories, a SHORT-LIVED
   * credential (e.g. a GitHub App installation token). Called once per
   * template resolution: the credential authenticates the head lookup and,
   * when a build is needed, the build's clone (via `setEnvs` plus an
   * in-shell `http.extraheader` — it never touches the image filesystem,
   * and probing confirms `setEnvs` values do not persist into runtime
   * sandbox environments). Never supply a long-lived PAT: the value enters
   * the template definition, where only its expiry bounds the exposure. A
   * rejection degrades to tokenless behavior.
   *
   * Sole source of the clone URL, so what gets cloned and what the template
   * is identified by can never disagree. A public repository needs no
   * credential: `async () => ({ cloneUrl })`.
   *
   * The key is required so that passing a host context whose field was
   * renamed fails to compile instead of silently producing no template.
   * `undefined` means the session has no repository, and
   * {@link createRepoTemplate} then returns undefined (unless `repos` is set).
   */
  getRepositoryAccess?: (() => Promise<RepositoryAccess | undefined>) | undefined;
  /**
   * Setup command(s) run inside the checkout and hashed into the template name.
   * Array entries run as separate cached build steps.
   */
  setupCommand?: string | string[];
  /**
   * Several repositories in one template, each with its own access resolver
   * and setup command, cloned to `<workingDirectory>/<repo>` in this order.
   * Public repositories (no `authorization`) are built before private ones in
   * caller order within each group, the same layout the platform and Docker
   * templates use; on E2B every build env is one step ahead of every clone,
   * so a rotated token still rebuilds all of them. Each repository writes `.mastra-sandbox/repos/<repo>`
   * (`setupMarkerContent` of its commands) once every step for it ran.
   *
   * Every credential enters the template definition as a build env visible to
   * every build step (`GH_TOKEN_<n>`, `n` = position in this list), so any
   * repository's setup command can read the other repositories' tokens: only
   * list repositories whose setup commands are trusted together.
   *
   * Mutually exclusive with `getRepositoryAccess`. If any entry's access
   * cannot be resolved the whole resolution rejects and the sandbox falls
   * back to its default template, as the single form does: a sandbox missing
   * one repository is worse than one missing all of them. Two entries that
   * would clone into the same directory reject the same way. An empty array
   * behaves like no repository.
   */
  repos?: RepoTemplateRepository[];
  /**
   * `repos` only. Command(s) run at the working directory after every
   * repository is set up (install a shared toolchain, link packages). A
   * failure fails the build. `.mastra-sandbox/workspace-setup` records the
   * digest of the commands that ran, even when there were none.
   */
  workspaceSetupCommand?: string | string[];
  /**
   * `repos` only. When true a failing per-repository setup command records
   * that repository's directory name in `.mastra-sandbox/setup-failed` (one
   * line per repository) and the build continues; clone, pin, workspace and
   * marker steps still fail the build. Default
   * false: any failure fails the build.
   */
  continueOnSetupFailure?: boolean;
  /**
   * Extra environment for the build, available to every build step
   * including {@link RepoTemplateOptions.setupCommand}. Use it for the
   * credentials a setup command needs (registry tokens, private index
   * URLs) so the build reaches the same state a runtime setup would.
   *
   * Hashed into the template name (keys and values), because env that
   * changes what setup installs changes the image just as the setup command
   * does. Rotating a value therefore forces a rebuild — put credentials
   * that rotate often in {@link RepoTemplateOptions.getRepositoryAccess}
   * instead, which is excluded from identity.
   *
   * Values reach the template definition, so they must be short-lived or
   * non-secret.
   */
  buildEnv?: Record<string, string> | (() => Promise<Record<string, string>>);
  /**
   * vCPUs allocated to sandboxes created from this template. Resources are
   * a property of the built template, not of an individual sandbox, so this
   * is hashed into the template name — a resize builds a new template
   * instead of silently reusing one built at the old size. Defaults to the
   * SDK default (2). Account tier caps the maximum.
   */
  cpuCount?: number;
  /**
   * Memory in MB allocated to sandboxes created from this template. Hashed
   * into the template name for the same reason as {@link cpuCount}.
   * Defaults to the SDK default (1024).
   */
  memoryMB?: number;
  /**
   * Absolute parent for the checkout. Created by the build user, so its parent
   * must already be writable by that user. Becomes the build cwd, the runtime
   * cwd, and part of template identity; the repo lands at `<workingDirectory>/<repo>`.
   * Omit to use the base image's working directory for all of the above.
   */
  workingDirectory?: string;
}

/**
 * Identity inputs for a repo template, already resolved. Separate from
 * {@link RepoTemplateOptions} because identity must be computable without
 * awaiting anything, while the clone URL and credential arrive from an
 * async accessor.
 */
export interface RepoTemplateIdentity {
  /** https clone URL. Host is part of the identity. */
  cloneUrl: string;
  /** Resolved head sha. Becomes the template's tag. */
  sha?: string;
  setupCommand?: string | string[];
  buildEnv?: Record<string, string>;
  cpuCount?: number;
  memoryMB?: number;
  workingDirectory?: string;
  /**
   * Multi-repository form: every entry in caller order. `cloneUrl`/`sha`/
   * `setupCommand` above then describe the first entry (the readable slug);
   * the tag hashes every entry's sha.
   */
  repos?: RepoTemplateIdentityRepository[];
  workspaceSetupCommand?: string | string[];
  continueOnSetupFailure?: boolean;
}

export interface RepoTemplateIdentityRepository {
  cloneUrl: string;
  sha?: string;
  setupCommand?: string | string[];
}

/**
 * Compute the deterministic template ref for a set of repo template inputs
 * without constructing the builder: `mastra-repo-<hash>` named over
 * (clone URL, setup command, build env), tag-qualified with `:sha-<sha>`
 * when the sha is known. Exposed so callers (and proofs) can predict which
 * ref a sandbox will resolve.
 */
export function repoTemplateRef(identity: RepoTemplateIdentity): string {
  const name = repoTemplateName(identity);
  // The sha-less degrade also pins a tag (`current`) rather than the bare
  // name: `Template.exists(name)` is true whenever ANY tagged build exists,
  // but creating from a bare name resolves its `default` tag — which
  // sha-tagged builds never assign — so an untagged ref could pass the
  // exists check and still 404 on create.
  if (identity.repos) {
    // Every repository must be pinned for the tag to name a commit set.
    const shas = identity.repos.map(repo => repo.sha);
    return shas.every(Boolean) ? `${name}:${shaTag(listSha(shas as string[]))}` : `${name}:${CURRENT_TAG}`;
  }
  return identity.sha ? `${name}:${shaTag(identity.sha)}` : `${name}:${CURRENT_TAG}`;
}

/** One digest over every repository's pinned sha, in caller order. */
function listSha(shas: string[]): string {
  return createHash('sha256')
    .update(shas.map(sha => sha.toLowerCase()).join(','))
    .digest('hex');
}

// `sha` is excluded at the type level: the name is sha-independent by
// design (the sha rides the tag), and the signature is what enforces it —
// making the name sha-dependent would collapse every commit into its own
// template and kill warm reuse.
function repoTemplateName(identity: Omit<RepoTemplateIdentity, 'sha'>): string {
  const cloneUrl = normalizeCloneUrl(identity.cloneUrl);
  // Fixed key order, so a plain stringify is already canonical. Not a
  // replacer array: that filters keys at every level, which would drop the
  // build env's own keys from the hash.
  const config = [
    ALIAS_VERSION,
    cloneUrl,
    identity.setupCommand ?? null,
    // Sorted, since key order isn't identity. Values participate: env that
    // changes what setup installs changes the image.
    identity.buildEnv ? Object.entries(identity.buildEnv).sort(([a], [b]) => a.localeCompare(b)) : null,
    // Normalized to the defaults, so "absent" and "explicitly default" are
    // the same template.
    identity.cpuCount ?? DEFAULT_CPU_COUNT,
    identity.memoryMB ?? DEFAULT_MEMORY_MB,
    // Appended only when set, so templates predating the option keep their
    // existing names (and warm builds) instead of all rebuilding.
    ...(identity.workingDirectory !== undefined ? [identity.workingDirectory] : []),
    // The list form appends its members (caller order) so it never collides
    // with the single form of its first repository.
    ...(identity.repos
      ? [
          'repos',
          identity.repos.map(repo => [normalizeCloneUrl(repo.cloneUrl), repo.setupCommand ?? null]),
          normalizeSetupCommands(identity.workspaceSetupCommand),
          identity.continueOnSetupFailure ?? false,
        ]
      : []),
  ];
  const hash = createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 8);
  // Readable name: the repo slug is right in the template name; the short
  // hash suffix keeps host/setup-command variants and sanitization
  // collisions distinct.
  const { owner, repo } = parseCloneUrl(cloneUrl);
  const slug = [owner, repo]
    .map(part =>
      (part ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        // The previous replace collapsed runs, so at most one leading and
        // one trailing dash exist — no `+` needed, which keeps the pattern
        // linear on dash-heavy input.
        .replace(/^-/, '')
        .replace(/-$/, '')
        .slice(0, 24),
    )
    .filter(Boolean)
    .join('-');
  return `mastra-repo-${slug}-${hash}`;
}

function shaTag(sha: string): string {
  return `sha-${sha.slice(0, 12).toLowerCase()}`;
}

/**
 * Create a sha-tagged repo template spec for `E2BSandbox`.
 *
 * Returns undefined when {@link RepoTemplateOptions.getRepositoryAccess} is
 * absent, which is how a session with no repository asks for no template —
 * so a host can write `template: createRepoTemplate(ctx)` without a
 * conditional.
 *
 * Resolution is deferred: right before the exists-then-build check it
 * resolves the clone URL and credential, resolves the repository's current
 * default-branch head (`git ls-remote`, ~100ms, no clone), and keys the
 * template ref as `mastra-repo-<hash>:sha-<head>` — so a moved default
 * branch produces a fresh tagged build of the SAME template on the next new
 * session (rebuild-in-place), and an unmoved head reuses the existing
 * tagged build. When the head cannot be resolved the ref degrades to the
 * untagged name and the build clones whatever the default branch is at
 * build time.
 *
 * When the build itself fails — inaccessible repo, registry flake — the
 * sandbox falls back to its fallback template and the session's runtime
 * setup performs the full clone, so a broken build never wedges a session.
 */
export function createRepoTemplate(options: RepoTemplateOptions): DeferredNamedTemplateSpec | undefined {
  if (options.getRepositoryAccess && options.repos) {
    throw new TypeError('createRepoTemplate: pass either getRepositoryAccess or repos, not both');
  }
  // The guard and the workspace steps have no meaning for one repository, and
  // the single-form marker must keep meaning "every setup command succeeded".
  if (!options.repos && (options.workspaceSetupCommand !== undefined || options.continueOnSetupFailure !== undefined)) {
    throw new TypeError('createRepoTemplate: workspaceSetupCommand and continueOnSetupFailure require repos');
  }
  if (!options.getRepositoryAccess && !options.repos?.length) return undefined;
  return {
    resolveSpec: async () => (await resolveSpecAtHead(options)).spec,
  };
}

/**
 * Resolve the clone URL and credential, resolve the current default-branch
 * head, and produce the concrete sha-tagged spec. Shared by the deferred
 * spec form and {@link refreshRepoTemplate}.
 *
 * A failed access call leaves no clone URL and throws, which the sandbox
 * turns into its default-template fallback rather than a failed start.
 */
export async function resolveSpecAtHead(
  options: RepoTemplateOptions,
): Promise<{ spec: NamedTemplateSpec; sha?: string }> {
  const isList = options.repos !== undefined;
  const entries: RepoTemplateRepository[] = options.repos
    ? options.repos
    : options.getRepositoryAccess
      ? [{ getRepositoryAccess: options.getRepositoryAccess, setupCommand: options.setupCommand }]
      : [];
  if (entries.length === 0) {
    throw new Error('Repo template has no clone URL: repository access returned none.');
  }
  const buildEnv = typeof options.buildEnv === 'function' ? await options.buildEnv() : options.buildEnv;

  const repos: ResolvedRepository[] = [];
  const seenDirs = new Map<string, string>();
  for (const [index, entry] of entries.entries()) {
    const access = await entry.getRepositoryAccess().catch(() => undefined);
    const cloneUrl = access?.cloneUrl;
    if (!cloneUrl) {
      throw new Error(
        `Repo template has no clone URL: repository access returned none${isList ? ` (repos[${index}])` : ''}.`,
      );
    }
    assertCloneUrl(cloneUrl);
    const repoDir = repoDirName(normalizeCloneUrl(cloneUrl));
    const other = seenDirs.get(repoDir);
    if (other) {
      throw new Error(`Repo template: repositories ${other} and ${cloneUrl} would both clone into "${repoDir}"`);
    }
    seenDirs.set(repoDir, cloneUrl);
    const token = access?.authorization?.token;
    const resolved = await resolveDefaultBranchHead(cloneUrl, token).catch(() => undefined);
    const sha = resolved && SHA_PATTERN.test(resolved) ? resolved : undefined;
    repos.push({
      cloneUrl,
      repoDir,
      token,
      // The single form keeps its historical env name; list entries are
      // numbered by caller position so public/private reordering never
      // renames one.
      tokenEnv: token ? (isList ? `${BUILD_TOKEN_ENV}_${index}` : BUILD_TOKEN_ENV) : undefined,
      sha,
      setupCommand: entry.setupCommand,
    });
  }

  const first = repos[0]!;
  const identity: RepoTemplateIdentity = {
    cloneUrl: first.cloneUrl,
    ...(first.sha ? { sha: first.sha } : {}),
    // Kept in its original shape (string vs array) so existing string-form
    // templates keep their hashes; omitted entirely when nothing would run.
    ...(normalizeSetupCommands(first.setupCommand).length > 0 ? { setupCommand: first.setupCommand } : {}),
    ...(buildEnv ? { buildEnv } : {}),
    ...(options.cpuCount !== undefined ? { cpuCount: options.cpuCount } : {}),
    ...(options.memoryMB !== undefined ? { memoryMB: options.memoryMB } : {}),
    ...(options.workingDirectory !== undefined
      ? { workingDirectory: trimTrailingSlashes(assertWorkingDirectory(options.workingDirectory)) }
      : {}),
    ...(isList
      ? {
          repos: repos.map(repo => ({
            cloneUrl: repo.cloneUrl,
            ...(repo.sha ? { sha: repo.sha } : {}),
            ...(normalizeSetupCommands(repo.setupCommand).length > 0 ? { setupCommand: repo.setupCommand } : {}),
          })),
          ...(options.workspaceSetupCommand !== undefined
            ? { workspaceSetupCommand: options.workspaceSetupCommand }
            : {}),
          ...(options.continueOnSetupFailure !== undefined
            ? { continueOnSetupFailure: options.continueOnSetupFailure }
            : {}),
        }
      : {}),
  };
  const spec = buildRepoTemplateSpec(identity, repos, options.continueOnSetupFailure ?? false);
  const sha = isList ? (repos.every(repo => repo.sha) ? listSha(repos.map(repo => repo.sha!)) : undefined) : first.sha;
  return { spec, ...(sha ? { sha } : {}) };
}

/** One repository with its access resolved, ready to be laid into build steps. */
interface ResolvedRepository {
  cloneUrl: string;
  repoDir: string;
  token?: string;
  tokenEnv?: string;
  sha?: string;
  setupCommand?: string | string[];
}

/** Result of a {@link refreshRepoTemplate} call. */
export interface RefreshRepoTemplateResult {
  /** Template ref (`name:tag`) that is now current. */
  ref: string;
  /** Whether an up-to-date build already existed or a fresh build ran. */
  action: 'reused' | 'built';
  /** Resolved head sha, when it could be determined. */
  sha?: string;
}

/**
 * Ensure the repo template is built at the repository's current
 * default-branch head, building it (and moving the `current` tag) when it
 * is not. This is the same resolution the lazy sandbox-start path performs
 * — exposed standalone so template warming can be driven externally: call
 * it from a scheduled workflow (cron) or a merge-to-main event handler and
 * the next session boots warm instead of paying the build.
 *
 * The build is awaited; a build failure rejects so callers can observe it.
 * An unresolvable head degrades to the sha-less `name:current` form, same
 * as the lazy path.
 */
export async function refreshRepoTemplate(
  options: RepoTemplateOptions,
  connection?: ConnectionOpts,
): Promise<RefreshRepoTemplateResult> {
  const { spec, sha } = await resolveSpecAtHead(options);
  const shaField = sha ? { sha } : {};
  if (await Template.exists(spec.ref, connection)) {
    return { ref: spec.ref, action: 'reused', ...shaField };
  }
  await Template.build(spec.template as TemplateClass, spec.ref, {
    ...connection,
    ...(spec.buildTags?.length ? { tags: spec.buildTags } : {}),
    ...spec.buildResources,
  });
  return { ref: spec.ref, action: 'built', ...shaField };
}

/**
 * The clone URL is the only untrusted input that reaches a build command,
 * so it is checked before it can be interpolated into one. The repoDir is
 * derived from it rather than supplied, so it needs no separate guard.
 */

function assertCloneUrl(cloneUrl: string): void {
  if (!isValidCloneUrl(cloneUrl)) {
    throw new Error(`Invalid cloneUrl '${cloneUrl}': expected an https URL with a plain host and path`);
  }
  if (parseCloneUrl(cloneUrl).repo === '') {
    throw new Error(`Invalid cloneUrl '${cloneUrl}': expected a repository path such as https://host/owner/repo.git`);
  }
}

/**
 * In-shell git auth flag: computes a basic-auth header from the build env
 * var at execution time. The stored command contains only the env-var
 * REFERENCE — the token value never appears in the command string, and no
 * credential is written to the build filesystem.
 */
function gitAuthFlag(tokenEnv: string): string {
  return `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${tokenEnv}" | base64 -w0)"`;
}

function buildRepoTemplateSpec(
  identity: RepoTemplateIdentity,
  repos: ResolvedRepository[],
  continueOnFailure: boolean,
): NamedTemplateSpec {
  const { buildEnv, workingDirectory } = identity;
  const isList = identity.repos !== undefined;

  let template = createDefaultMountableTemplate().template;
  const env: Record<string, string> = { ...buildEnv };
  for (const repo of repos) if (repo.tokenEnv && repo.token) env[repo.tokenEnv] = repo.token;
  if (Object.keys(env).length > 0) {
    // Visible to build steps; probed to NOT persist into runtime sandbox
    // environments. Values must be short-lived — they stay in the template
    // definition until the next rebuild.
    template = template.setEnvs(env);
  }
  if (workingDirectory) {
    // Created by the build user so it is writable; `setWorkdir` then makes
    // it the cwd for the steps below and the runtime default, without
    // shell expansion.
    const dir = trimTrailingSlashes(workingDirectory);
    template = template.runCmd(`mkdir -p "${dir}"`).setWorkdir(dir);
  }
  // Public repositories first, caller order within each group: the same
  // layout as the other templates (no cache benefit here, every build env is
  // one step ahead of every clone).
  const ordered = [...repos.filter(repo => !repo.token), ...repos.filter(repo => repo.token)];
  for (const repo of ordered) {
    const { repoDir, sha, tokenEnv } = repo;
    const cloneUrl = normalizeCloneUrl(repo.cloneUrl);
    const auth = tokenEnv ? `${gitAuthFlag(tokenEnv)} ` : '';
    const setupCommands = normalizeSetupCommands(repo.setupCommand);
    // Each command gets its own cached build layer. Same shallow clone Factory
    // makes at session start when no image provided one, so both paths yield
    // the same checkout.
    template = template.runCmd(repoCloneCommand({ cloneUrl, destination: repoDir, ...(tokenEnv ? { tokenEnv } : {}) }));
    if (sha) {
      // GitHub serves fetches of reachable shas, so pinning after a default
      // clone is reliable without full-history flags.
      template = template
        .runCmd(`git -C "${repoDir}" ${auth}fetch origin ${sha}`)
        .runCmd(`git -C "${repoDir}" checkout ${sha}`);
    }
    // Build steps use fresh shells, so each setup command needs its own `cd`.
    for (const command of setupCommands) {
      template = template.runCmd(guardedSetupCommand({ repoDir, command, continueOnFailure }));
    }
    // Last for this repository, so it only exists once every step above ran.
    const content = setupMarkerContent(setupCommands);
    template = template.runCmd(
      isList ? setupMarkerCommand(content, repoSetupMarkerPath(repoDir)) : setupMarkerCommand(content),
    );
  }
  if (isList) {
    const workspaceCommands = normalizeSetupCommands(identity.workspaceSetupCommand);
    for (const command of workspaceCommands) template = template.runCmd(command);
    template = template.runCmd(setupMarkerCommand(setupMarkerContent(workspaceCommands), WORKSPACE_SETUP_MARKER_PATH));
  }

  return {
    ref: repoTemplateRef(identity),
    template,
    // A failed repo build degrades to the default mountable template; the
    // session's runtime cold clone into `$HOME` keeps working.
    //
    // Every successful build also moves the stable `current` tag; when a
    // moved head means the exact sha tag doesn't exist yet, the sandbox
    // boots from `name:current` immediately (runtime setup fast-forwards
    // the checkout) while the fresh sha builds in the background.
    staleRef: `${repoTemplateName(identity)}:${CURRENT_TAG}`,
    buildTags: [CURRENT_TAG],
    // Always explicit, so what gets built matches what got hashed.
    buildResources: {
      cpuCount: identity.cpuCount ?? DEFAULT_CPU_COUNT,
      memoryMB: identity.memoryMB ?? DEFAULT_MEMORY_MB,
    },
  };
}

/**
 * `owner/repo` for a github.com clone URL, else undefined. Only the public
 * host is API-resolvable: GitHub Enterprise and other forges keep the git
 * path.
 */
function parseGithubRepo(cloneUrl: string): { owner: string; repo: string } | undefined {
  let url: URL;
  try {
    url = new URL(cloneUrl);
  } catch {
    return undefined;
  }
  if (url.hostname.toLowerCase() !== 'github.com') return undefined;
  const [owner, repo, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo || rest.length > 0) return undefined;
  return { owner, repo: repo.replace(/\.git$/i, '') };
}

/**
 * Resolve the repository's current default-branch head without cloning.
 * github.com repositories go through the REST API so resolution works
 * wherever the host runs, including images without a git binary; other
 * hosts use `git ls-remote <url> HEAD`, authenticated via an in-process
 * `http.extraheader` when a token is provided. Returns undefined when the
 * head cannot be resolved (inaccessible repo, offline, no git binary);
 * callers degrade to the untagged template ref.
 */
async function resolveDefaultBranchHead(cloneUrl: string, token?: string): Promise<string | undefined> {
  const github = parseGithubRepo(cloneUrl);
  if (github) {
    try {
      const response = await fetch(`https://api.github.com/repos/${github.owner}/${github.repo}/commits/HEAD`, {
        headers: {
          Accept: 'application/vnd.github.sha',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'mastra-e2b',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return undefined;
      const sha = (await response.text()).trim();
      return SHA_PATTERN.test(sha) ? sha : undefined;
    } catch {
      return undefined;
    }
  }
  try {
    const authArgs = token
      ? ['-c', `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`]
      : [];
    // `--` makes the URL position unambiguous to git: even a hostile value
    // can never be read as an option such as `--upload-pack`.
    const { stdout } = await execFileAsync('git', [...authArgs, 'ls-remote', '--', cloneUrl, 'HEAD'], {
      timeout: 10_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    const sha = stdout.split(/\s/, 1)[0];
    return sha && SHA_PATTERN.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Canonical form used for identity and for the build's clone: lowercase
 * host, no trailing `.git` or slash. Two spellings of one repository must
 * not produce two templates.
 */
function normalizeCloneUrl(cloneUrl: string): string {
  // Avoid regex backtracking on long trailing-slash runs.
  let end = cloneUrl.length;
  while (end > 0 && cloneUrl[end - 1] === '/') end--;
  const withoutSuffix = cloneUrl.slice(0, end).replace(/\.git$/i, '');
  return withoutSuffix.replace(/^(https:\/\/)([^/]+)/i, (_match, scheme: string, host: string) => {
    return `${scheme.toLowerCase()}${host.toLowerCase()}`;
  });
}

/**
 * Split a normalized clone URL into its host and trailing owner/repo pair.
 * Hosts that nest groups (GitLab subgroups) keep only the last two path
 * segments as owner/repo; the full URL still drives identity.
 */
function parseCloneUrl(cloneUrl: string): { host: string; owner: string; repo: string } {
  const withoutScheme = normalizeCloneUrl(cloneUrl).replace(/^https:\/\//i, '');
  const [host = '', ...segments] = withoutScheme.split('/');
  const repo = segments.at(-1) ?? '';
  const owner = segments.length > 1 ? (segments.at(-2) ?? '') : '';
  return { host, owner, repo };
}

/** Normalize setup commands and drop blank entries that would produce invalid shell steps. */
function normalizeSetupCommands(setupCommand: string | string[] | undefined): string[] {
  const list = setupCommand === undefined ? [] : Array.isArray(setupCommand) ? setupCommand : [setupCommand];
  return list.filter(command => command.trim() !== '');
}

function repoDirName(cloneUrl: string): string {
  const { repo } = parseCloneUrl(cloneUrl);
  return repo.replace(/[^\w.-]/g, '-').replace(/^\.+/, '') || 'repo';
}

// Avoid regex backtracking on long trailing-slash runs.
function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 1 && path[end - 1] === '/') end--;
  return path.slice(0, end);
}

/** Validate a literal absolute path before embedding it in shell build steps. */
function assertWorkingDirectory(dir: string): string {
  const valid = /^\/[A-Za-z0-9._/-]*$/.test(dir) && !dir.split('/').includes('..');
  if (!valid) {
    throw new Error(
      `Repo template workingDirectory must be an absolute path of plain path characters (got ${JSON.stringify(dir)}); ~ and $HOME are not expanded.`,
    );
  }
  return dir;
}
