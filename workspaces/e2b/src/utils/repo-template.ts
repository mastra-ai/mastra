/**
 * Sha-tagged repo templates.
 *
 * A repo template is an E2B template with the repository already cloned and
 * its dependencies installed at a known commit. Sessions started from it only
 * need `git fetch` + checkout of their actual ref plus setup drift, instead
 * of a cold clone + full install.
 *
 * There is exactly ONE template per (repo, setup command, workdir): the
 * template name is a deterministic `mastra-repo-<hash>` over those inputs,
 * and the commit sha rides as a docker-style TAG on that name
 * (`mastra-repo-<hash>:sha-<sha>`). A moved default branch produces a new
 * tag via a rebuild-in-place of the same template — old sha tags remain as
 * prunable build history instead of accumulating stale template aliases.
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

import { Template } from 'e2b';
import type { ConnectionOpts, TemplateClass } from 'e2b';

import { createDefaultMountableTemplate } from './template';
import type { DeferredNamedTemplateSpec, NamedTemplateSpec } from './template';

const execFileAsync = promisify(execFile);

const ALIAS_VERSION = 'v3';

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
 * outright rather than escaping them.
 */
const CLONE_URL_PATTERN = /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[\w.-]+)+$/i;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

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
   * Setup command run inside the checkout during the build (e.g.
   * `pnpm install`). Hashed into the template name so a changed setup
   * command produces a new template.
   */
  setupCommand?: string;
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
  setupCommand?: string;
  buildEnv?: Record<string, string>;
}

/**
 * Compute the deterministic template ref for a set of repo template inputs
 * without constructing the builder: `mastra-repo-<hash>` named over
 * (clone URL, setup command, build env), tag-qualified with `:sha-<sha>`
 * when the sha is known. Exposed so callers (and proofs) can predict which
 * ref a sandbox will resolve.
 */
export function repoTemplateAlias(identity: RepoTemplateIdentity): string {
  const name = repoTemplateName(identity);
  // The sha-less degrade also pins a tag (`current`) rather than the bare
  // name: `Template.exists(name)` is true whenever ANY tagged build exists,
  // but creating from a bare name resolves its `default` tag — which
  // sha-tagged builds never assign — so an untagged ref could pass the
  // exists check and still 404 on create.
  return identity.sha ? `${name}:${shaTag(identity.sha)}` : `${name}:${CURRENT_TAG}`;
}

function repoTemplateName(identity: RepoTemplateIdentity): string {
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
        .replace(/^-+|-+$/g, '')
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
    ...(options.setupCommand ? { setupCommand: options.setupCommand } : {}),
    ...(buildEnv ? { buildEnv } : {}),
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
  if (await Template.exists(spec.alias, connection)) {
    return { ref: spec.alias, action: 'reused', ...shaField };
  }
  await Template.build(spec.template as TemplateClass, spec.alias, {
    ...connection,
    ...(spec.buildTags?.length ? { tags: spec.buildTags } : {}),
  });
  return { ref: spec.alias, action: 'built', ...shaField };
}

/**
 * The clone URL is the only untrusted input that reaches a build command,
 * so it is checked before it can be interpolated into one. The workdir is
 * derived from it rather than supplied, so it needs no separate guard.
 */
function assertCloneUrl(cloneUrl: string): void {
  if (!CLONE_URL_PATTERN.test(cloneUrl)) {
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
  const { sha, setupCommand, buildEnv } = identity;
  const cloneUrl = normalizeCloneUrl(identity.cloneUrl);
  const workdir = defaultWorkdir(cloneUrl);

  const auth = token ? `${gitAuthFlag()} ` : '';

  // Double quotes so a `$HOME`-relative workdir expands in the build shell.
  const steps: string[] = [`git ${auth}clone ${cloneUrl} "${workdir}"`];
  if (sha) {
    // GitHub serves fetches of reachable shas, so pinning after a default
    // clone is reliable without full-history flags.
    steps.push(`git -C "${workdir}" ${auth}fetch origin ${sha}`, `git -C "${workdir}" checkout ${sha}`);
  }
  if (setupCommand) {
    steps.push(`cd "${workdir}" && ${setupCommand}`);
  }

  // Build steps run as the sandbox `user` in its own home directory, so the
  // default `$HOME/<repo>` clone needs no directory prep and keeps runtime
  // file ownership right.
  let template = createDefaultMountableTemplate().template;
  const env: Record<string, string> = { ...buildEnv };
  if (token) env[BUILD_TOKEN_ENV] = token;
  if (Object.keys(env).length > 0) {
    // Visible to build steps; probed to NOT persist into runtime sandbox
    // environments. Values must be short-lived — they stay in the template
    // definition until the next rebuild.
    template = template.setEnvs(env);
  }
  template = template.runCmd(steps);

  return {
    alias: repoTemplateAlias(identity),
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
  };
}

/**
 * Resolve the repository's current default-branch head over HTTPS
 * (`git ls-remote <url> HEAD` — no clone; authenticated via an in-process
 * `http.extraheader` when a token is provided). Returns undefined when the
 * head cannot be resolved (inaccessible repo, offline, no git binary);
 * callers degrade to the untagged template ref.
 */
async function resolveDefaultBranchHead(cloneUrl: string, token?: string): Promise<string | undefined> {
  try {
    const authArgs = token
      ? ['-c', `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`]
      : [];
    const { stdout } = await execFileAsync('git', [...authArgs, 'ls-remote', cloneUrl, 'HEAD'], {
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
  const withoutSuffix = cloneUrl.replace(/\/+$/, '').replace(/\.git$/i, '');
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

function defaultWorkdir(cloneUrl: string): string {
  const { repo } = parseCloneUrl(cloneUrl);
  const name = repo.replace(/[^\w.-]/g, '-').replace(/^\.+/, '') || 'repo';
  return `$HOME/${name}`;
}
