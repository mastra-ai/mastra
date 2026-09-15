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
import { repoCloneCommand, setupMarkerCommand, setupMarkerContent } from '@internal/workspace';

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
   * {@link createRepoTemplate} then returns undefined.
   */
  getRepositoryAccess: (() => Promise<RepositoryAccess | undefined>) | undefined;
  /**
   * Setup command(s) run inside the checkout and hashed into the template name.
   * Array entries run as separate cached build steps.
   */
  setupCommand?: string | string[];
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
  return identity.sha ? `${name}:${shaTag(identity.sha)}` : `${name}:${CURRENT_TAG}`;
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
  if (!options.getRepositoryAccess) return undefined;
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
async function resolveSpecAtHead(options: RepoTemplateOptions): Promise<{ spec: NamedTemplateSpec; sha?: string }> {
  const access = options.getRepositoryAccess ? await options.getRepositoryAccess().catch(() => undefined) : undefined;
  const cloneUrl = access?.cloneUrl;
  if (!cloneUrl) {
    throw new Error('Repo template has no clone URL: repository access returned none.');
  }
  assertCloneUrl(cloneUrl);
  const token = access?.authorization?.token;
  const buildEnv = typeof options.buildEnv === 'function' ? await options.buildEnv() : options.buildEnv;

  const resolved = await resolveDefaultBranchHead(cloneUrl, token).catch(() => undefined);
  const sha = resolved && SHA_PATTERN.test(resolved) ? resolved : undefined;

  const identity: RepoTemplateIdentity = {
    cloneUrl,
    ...(sha ? { sha } : {}),
    // Kept in its original shape (string vs array) so existing string-form
    // templates keep their hashes; omitted entirely when nothing would run.
    ...(normalizeSetupCommands(options.setupCommand).length > 0 ? { setupCommand: options.setupCommand } : {}),
    ...(buildEnv ? { buildEnv } : {}),
    ...(options.cpuCount !== undefined ? { cpuCount: options.cpuCount } : {}),
    ...(options.memoryMB !== undefined ? { memoryMB: options.memoryMB } : {}),
    ...(options.workingDirectory !== undefined
      ? { workingDirectory: trimTrailingSlashes(assertWorkingDirectory(options.workingDirectory)) }
      : {}),
  };
  return { spec: buildRepoTemplateSpec(identity, token), ...(sha ? { sha } : {}) };
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
function gitAuthFlag(): string {
  return `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${BUILD_TOKEN_ENV}" | base64 -w0)"`;
}

function buildRepoTemplateSpec(identity: RepoTemplateIdentity, token?: string): NamedTemplateSpec {
  const { sha, setupCommand, buildEnv, workingDirectory } = identity;
  const cloneUrl = normalizeCloneUrl(identity.cloneUrl);
  // Relative to the build cwd, which `setWorkdir` (or the base image) also
  // makes the runtime cwd, so the checkout sits at `<cwd>/<repo>` either way.
  const repoDir = repoDirName(cloneUrl);

  const auth = token ? `${gitAuthFlag()} ` : '';

  let template = createDefaultMountableTemplate().template;
  const env: Record<string, string> = { ...buildEnv };
  if (token) env[BUILD_TOKEN_ENV] = token;
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
  // Each command gets its own cached build layer. Same shallow clone Factory
  // makes at session start when no image provided one, so both paths yield
  // the same checkout.
  template = template.runCmd(
    repoCloneCommand({ cloneUrl, destination: repoDir, ...(token ? { tokenEnv: BUILD_TOKEN_ENV } : {}) }),
  );
  if (sha) {
    // GitHub serves fetches of reachable shas, so pinning after a default
    // clone is reliable without full-history flags.
    template = template
      .runCmd(`git -C "${repoDir}" ${auth}fetch origin ${sha}`)
      .runCmd(`git -C "${repoDir}" checkout ${sha}`);
  }
  // Build steps use fresh shells, so each setup command needs its own `cd`.
  const setupCommands = normalizeSetupCommands(setupCommand);
  for (const command of setupCommands) {
    template = template.runCmd(`cd "${repoDir}" && ${command}`);
  }
  // Last, so it only exists in images where every step above succeeded.
  template = template.runCmd(setupMarkerCommand(setupMarkerContent(setupCommands)));

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
