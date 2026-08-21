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

const ALIAS_VERSION = 'v2';

/**
 * Stable tag assigned to every successful repo-template build. Points at the
 * latest build regardless of sha, so a moved head can boot from the previous
 * build (`name:current`) while the fresh sha builds in the background.
 */
const CURRENT_TAG = 'current';

/** Env var the build's git auth header is computed from. Value set via `setEnvs`. */
const BUILD_TOKEN_ENV = 'MASTRA_BUILD_GH_TOKEN';

const REPO_FULL_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
// Workdirs are constrained beneath /workspace so the build's root prep step
// only ever creates and chowns the /workspace tree — never an arbitrary
// top-level directory (a workdir of `/` or `/home` would otherwise derive a
// recursive chown over it).
const WORKDIR_PATTERN = /^\/workspace\/[\w./-]+$/;

export interface RepoTemplateOptions {
  /** GitHub `owner/repo` slug. */
  repoFullName: string;
  /**
   * Commit sha the template is pinned to (typically the default-branch
   * head). Becomes the template's tag. Omit when unknown — the sha is then
   * resolved live at template-resolution time (see {@link createRepoTemplate}).
   */
  sha?: string;
  /**
   * Setup command run inside the checkout during the build (e.g.
   * `pnpm install`). Hashed into the template name so a changed setup
   * command produces a new template.
   */
  setupCommand?: string;
  /**
   * Absolute path the repo is cloned to inside the image. Must sit under
   * `/workspace` (the build preps and chowns that root for the sandbox
   * user). Defaults to `/workspace/<owner>/<repo>`, matching factory's
   * deterministic remote workdir.
   */
  workdir?: string;
  /**
   * Mints a fresh, SHORT-LIVED credential (e.g. a GitHub App installation
   * token) for private-repo access. Called once per template resolution:
   * the token authenticates the head lookup and, when a build is needed,
   * the build's clone (via `setEnvs` + an in-shell `http.extraheader` — it
   * never touches the image filesystem, and probing confirms `setEnvs`
   * values do not persist into runtime sandbox environments). Never pass a
   * long-lived PAT: the value enters the template definition, where only
   * its expiry bounds the exposure. A rejection degrades to tokenless
   * behavior.
   */
  getAuthToken?: () => Promise<string | undefined>;
  /**
   * Override how the default-branch head sha is resolved for the deferred
   * (sha-less) form. Receives the auth token when {@link getAuthToken}
   * produced one. Return undefined when unknown; the template ref then
   * degrades to the untagged form. Defaults to `git ls-remote <url> HEAD`
   * (authenticated via `http.extraheader` when a token is available).
   */
  resolveHead?: (repoFullName: string, token?: string) => Promise<string | undefined>;
}

/**
 * Compute the deterministic template ref for a set of repo template inputs
 * without constructing the builder: `mastra-repo-<hash>` named over
 * (repo, setup command, workdir), tag-qualified with `:sha-<sha>` when the
 * sha is known. Exposed so callers (and proofs) can predict which ref a
 * sandbox will resolve.
 */
export function repoTemplateAlias(options: RepoTemplateOptions): string {
  const name = repoTemplateName(options);
  // The sha-less degrade also pins a tag (`current`) rather than the bare
  // name: `Template.exists(name)` is true whenever ANY tagged build exists,
  // but creating from a bare name resolves its `default` tag — which
  // sha-tagged builds never assign — so an untagged ref could pass the
  // exists check and still 404 on create.
  return options.sha ? `${name}:${shaTag(options.sha)}` : `${name}:${CURRENT_TAG}`;
}

function repoTemplateName(options: RepoTemplateOptions): string {
  const workdir = options.workdir ?? defaultWorkdir(options.repoFullName);
  const config = {
    version: ALIAS_VERSION,
    repoFullName: options.repoFullName,
    setupCommand: options.setupCommand ?? null,
    workdir,
  };
  const hash = createHash('sha256')
    .update(JSON.stringify(config, Object.keys(config).sort()))
    .digest('hex')
    .slice(0, 8);
  // Readable name: the repo slug is right in the template name; the short
  // hash suffix keeps setup-command/workdir variants and sanitization
  // collisions distinct.
  const [owner, name] = options.repoFullName.split('/', 2);
  const slug = [owner, name]
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
 * The normal form is deferred: right before the exists-then-build check it
 * mints the auth token (when {@link RepoTemplateOptions.getAuthToken} is
 * configured), resolves the repository's current default-branch head
 * (`git ls-remote`, ~100ms, no clone), and keys the template ref as
 * `mastra-repo-<hash>:sha-<head>` — so a moved default branch produces a
 * fresh tagged build of the SAME template on the next new session
 * (rebuild-in-place), and an unmoved head reuses the existing tagged build.
 * When the head cannot be resolved the ref degrades to the untagged name
 * and the build clones whatever the default branch is at build time.
 *
 * With an explicit `sha` and no auth, returns a plain
 * {@link NamedTemplateSpec} pinned to that tag (backwards-compatible sync
 * form).
 *
 * When the build itself fails — inaccessible repo, registry flake — the
 * sandbox falls back to its fallback template and the session's runtime
 * setup performs the full clone, so a broken build never wedges a session.
 */
export function createRepoTemplate(options: RepoTemplateOptions): NamedTemplateSpec | DeferredNamedTemplateSpec {
  validateRepoTemplateOptions(options);
  if (options.sha && !options.getAuthToken) {
    return buildRepoTemplateSpec(options);
  }
  return {
    resolveSpec: async () => (await resolveSpecAtHead(options)).spec,
  };
}

/**
 * Mint the auth token (when configured), resolve the current default-branch
 * head, and produce the concrete sha-tagged spec. Shared by the deferred
 * spec form and {@link refreshRepoTemplate}.
 */
async function resolveSpecAtHead(options: RepoTemplateOptions): Promise<{ spec: NamedTemplateSpec; sha?: string }> {
  const token = options.getAuthToken ? await options.getAuthToken().catch(() => undefined) : undefined;
  let sha = options.sha;
  if (!sha) {
    const resolve = options.resolveHead ?? resolveDefaultBranchHead;
    const resolved = await resolve(options.repoFullName, token).catch(() => undefined);
    sha = resolved && SHA_PATTERN.test(resolved) ? resolved : undefined;
  }
  return { spec: buildRepoTemplateSpec(sha ? { ...options, sha } : options, token), ...(sha ? { sha } : {}) };
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
  validateRepoTemplateOptions(options);
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

function validateRepoTemplateOptions(options: RepoTemplateOptions): void {
  const { repoFullName, sha } = options;
  if (!REPO_FULL_NAME_PATTERN.test(repoFullName)) {
    throw new Error(`Invalid repoFullName '${repoFullName}': expected 'owner/repo'`);
  }
  if (sha !== undefined && !SHA_PATTERN.test(sha)) {
    throw new Error(`Invalid sha '${sha}': expected a 7-40 char hex commit sha`);
  }
  const workdir = options.workdir ?? defaultWorkdir(repoFullName);
  if (!WORKDIR_PATTERN.test(workdir) || workdir.includes('..')) {
    throw new Error(`Invalid workdir '${workdir}': expected an absolute path under /workspace with no traversal`);
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

function buildRepoTemplateSpec(options: RepoTemplateOptions, token?: string): NamedTemplateSpec {
  const { repoFullName, sha, setupCommand } = options;
  const workdir = options.workdir ?? defaultWorkdir(repoFullName);

  const cloneUrl = `https://github.com/${repoFullName}.git`;
  const auth = token ? `${gitAuthFlag()} ` : '';

  const steps: string[] = [`git ${auth}clone ${cloneUrl} ${workdir}`];
  if (sha) {
    // GitHub serves fetches of reachable shas, so pinning after a default
    // clone is reliable without full-history flags.
    steps.push(`git -C ${workdir} ${auth}fetch origin ${sha}`, `git -C ${workdir} checkout ${sha}`);
  }
  if (setupCommand) {
    steps.push(`cd ${workdir} && ${setupCommand}`);
  }

  // The default mountable base preps a user-writable /workspace, so the
  // clone (which creates its own leading directories) runs directly as the
  // sandbox `user`, keeping runtime file ownership right.
  let template = createDefaultMountableTemplate().template;
  if (token) {
    // Visible to build steps; probed to NOT persist into runtime sandbox
    // environments. Must be short-lived — it stays in the template
    // definition until the next rebuild.
    template = template.setEnvs({ [BUILD_TOKEN_ENV]: token });
  }
  template = template.runCmd(steps);

  return {
    alias: repoTemplateAlias(sha ? { ...options, sha } : options),
    template,
    // A failed repo build degrades to the default mountable template, whose
    // writable /workspace keeps the session's runtime cold clone working.
    //
    // Every successful build also moves the stable `current` tag; when a
    // moved head means the exact sha tag doesn't exist yet, the sandbox
    // boots from `name:current` immediately (runtime setup fast-forwards
    // the checkout) while the fresh sha builds in the background.
    staleRef: `${repoTemplateName(options)}:${CURRENT_TAG}`,
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
async function resolveDefaultBranchHead(repoFullName: string, token?: string): Promise<string | undefined> {
  try {
    const authArgs = token
      ? ['-c', `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`]
      : [];
    const { stdout } = await execFileAsync(
      'git',
      [...authArgs, 'ls-remote', `https://github.com/${repoFullName}.git`, 'HEAD'],
      {
        timeout: 10_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      },
    );
    const sha = stdout.split(/\s/, 1)[0];
    return sha && SHA_PATTERN.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

function defaultWorkdir(repoFullName: string): string {
  return `/workspace/${repoFullName}`;
}
