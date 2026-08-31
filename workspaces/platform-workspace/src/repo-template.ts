import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Template, type SandboxTemplateBuilder } from './template.js';

const execFileAsync = promisify(execFile);
type GitExec = (
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string }>;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const BUILD_TOKEN_ENV = 'MASTRA_REPOSITORY_ACCESS_TOKEN';

/**
 * Clone URLs interpolate into the template's build commands, so constrain
 * them to https plus plain host/path characters. Every regex here is a
 * single anchored character class, so matching stays linear on adversarial
 * input; the structural checks go through WHATWG URL parsing instead of one
 * big backtracking pattern.
 */
const CLONE_URL_ALLOWED_CHARS = /^[a-z0-9:/._-]+$/i;
const CLONE_URL_HOST_PATTERN = /^[a-z0-9.-]+$/i;
const CLONE_URL_SEGMENT_PATTERN = /^[\w.-]+$/;

/**
 * Structurally matches the repository access resolver a Factory sandbox
 * context carries, so a host can pass its context straight through.
 */
export interface PlatformRepositoryAccess {
  /** https clone URL, e.g. `https://github.com/acme/widgets.git`. */
  cloneUrl: string;
  /**
   * Short-lived credential for private repositories. The token is used for
   * head resolution and sent as a transient template build environment value;
   * it is excluded from the serialized definition, content identity, and
   * persistent template record.
   */
  authorization?: { scheme: 'bearer'; token: string };
}

export interface PlatformRepoTemplateOptions {
  /**
   * Resolves the repository's clone URL and, for private repositories, a
   * short-lived credential. Absent — the session has no repository — makes
   * `createRepoTemplate` return `undefined`, which asks PlatformSandbox for
   * the provider default without a conditional at the call site.
   */
  getRepositoryAccess: (() => Promise<PlatformRepositoryAccess | undefined>) | undefined;
  /**
   * Setup command run inside the checkout during the provider build. An
   * array runs each entry as its own build step, so a failure is attributed
   * to the exact command and completed steps stay layer-cached — pass
   * `['pnpm i', 'pnpm build']` instead of `'pnpm i && pnpm build'` when the
   * phases are worth separating.
   */
  setupCommand?: string | string[];
  /**
   * vCPU count for the template build and the sandboxes created from it.
   * Identity-bearing: a different count builds a different template, and the
   * platform namespaces warm family fallbacks by size so a resized request
   * can never boot on a differently-sized filesystem. Omitted uses the
   * provider default.
   */
  cpuCount?: number;
  /** Memory in MB. Same identity and fallback semantics as `cpuCount`. */
  memoryMB?: number;
  /**
   * Absolute directory the repository is cloned into: the checkout lands at
   * `<workingDirectory>/<repo>`, and the template bakes it as the runtime
   * default cwd (`setWorkdir`), so sandboxes created from the template
   * start where the repo lives instead of the base image's workdir. Must be
   * an absolute literal path — the value is baked without shell expansion,
   * so `~` and `$HOME` are rejected. Part of the template family key: a
   * different working directory lays out a different filesystem. Omitted
   * keeps the provider layout (`$HOME/<repo>`, no baked workdir).
   */
  workingDirectory?: string;
  /**
   * Environment variables available to the build steps (for example turbo
   * remote-cache credentials for a `pnpm build` setup command). Sent as
   * transient build envs like the repository token: they never enter the
   * serialized definition or template identity, so rotating a value does
   * not rebuild the template. Meant for credentials — env that changes
   * build output belongs in `setupCommand`, where it participates in
   * identity. Not baked into sandboxes created from the template — pass
   * runtime env on the sandbox itself.
   */
  buildEnv?: Record<string, string>;
  /** Test/integration seam for resolving the default-branch head. */
  resolveHead?: (cloneUrl: string, token?: string) => Promise<string | undefined>;
}

export type PlatformRepoTemplateResolver = () => Promise<SandboxTemplateBuilder | undefined>;

/**
 * Create a lazy repository template definition for PlatformSandbox, mirroring
 * `@mastra/e2b`'s `createRepoTemplate`: pass the sandbox context through and a
 * repo-less session boots the provider default.
 *
 * The resolver performs no work until a fresh sandbox starts. It clones the
 * URL `getRepositoryAccess` resolves — the only source of the clone URL, so
 * what gets cloned and what the template is identified by can't drift — and
 * pins repositories to their current default-branch commit. Private repository
 * credentials are used for head resolution and sent to the provider as
 * transient build envs; they never enter the serialized definition. If the
 * head cannot be resolved, the resolver returns undefined so PlatformSandbox
 * boots from the provider default and the caller's runtime setup materializes
 * the checkout instead.
 */
export function createRepoTemplate(options: PlatformRepoTemplateOptions): PlatformRepoTemplateResolver | undefined {
  const getRepositoryAccess = options.getRepositoryAccess;
  if (!getRepositoryAccess) return undefined;
  const resolveHead = options.resolveHead ?? resolveDefaultBranchHead;

  return async () => {
    // Every bail below means the sandbox boots the provider default template
    // (base image, default resources) instead of the repo template — warn so
    // the downgrade is diagnosable instead of silent.
    let accessError: unknown;
    const access = await getRepositoryAccess().catch(error => {
      accessError = error;
      return undefined;
    });
    if (!access?.cloneUrl) {
      console.warn('[platform-workspace] repo template skipped: repository access unavailable', {
        error: accessError instanceof Error ? accessError.message : accessError,
      });
      return undefined;
    }
    const cloneUrl = normalizeCloneUrl(access.cloneUrl);
    if (!isValidCloneUrl(cloneUrl)) {
      console.warn('[platform-workspace] repo template skipped: clone URL failed validation', { cloneUrl });
      return undefined;
    }

    const token = access.authorization?.token;
    let headError: unknown;
    const sha = await (token ? resolveHead(cloneUrl, token) : resolveHead(cloneUrl)).catch(error => {
      headError = error;
      return undefined;
    });
    if (!sha || !SHA_PATTERN.test(sha)) {
      console.warn('[platform-workspace] repo template skipped: could not resolve default-branch head', {
        cloneUrl,
        sha,
        error: headError instanceof Error ? headError.message : headError,
      });
      return undefined;
    }

    const workingDirectory =
      options.workingDirectory === undefined ? undefined : assertWorkingDirectory(options.workingDirectory);
    const repoDir = workingDirectory
      ? `${trimTrailingSlashes(workingDirectory)}/${repoDirName(cloneUrl)}`
      : defaultRepoDir(cloneUrl);
    const auth = token ? `${gitAuthFlag()} ` : '';
    // Blank entries dropped: a blank command would render as
    // `cd "<repoDir>" && ` — a shell syntax error that fails the whole
    // build — and an empty UI input is the common way to produce one.
    const setupCommands = (
      options.setupCommand === undefined
        ? []
        : Array.isArray(options.setupCommand)
          ? options.setupCommand
          : [options.setupCommand]
    ).filter(command => command.trim() !== '');
    // One step per operation below: each becomes its own provider build
    // layer, so a failure names the exact command and the steps before it
    // stay cached instead of re-running on the next attempt.
    const steps = [
      // An explicit workingDirectory may not exist in the base image;
      // creating it first keeps the clone from failing on a fresh path.
      ...(workingDirectory ? [`mkdir -p "${repoDir}"`] : []),
      `git ${auth}clone ${cloneUrl} "${repoDir}"`,
      `git -C "${repoDir}" ${auth}fetch origin ${sha}`,
      `git -C "${repoDir}" checkout ${sha}`,
      // Each step runs in a fresh shell, so `cd` cannot carry across steps —
      // every setup entry gets its own prefix.
      ...setupCommands.map(command => `cd "${repoDir}" && ${command}`),
    ];

    // Commit-independent family key that groups every commit of the same
    // repo+repoDir together. The platform uses it to find a prior build in
    // the same family so new commits boot on a warm filesystem while the
    // exact template continues to build in the background.
    const family = `repo:${cloneUrl}:${repoDir}`;
    let template = Template();
    const buildEnv = { ...options.buildEnv, ...(token ? { [BUILD_TOKEN_ENV]: token } : {}) };
    if (Object.keys(buildEnv).length > 0) template = template.setEnvs(buildEnv, { ephemeral: true });
    if (options.cpuCount !== undefined) template = template.cpuCount(options.cpuCount);
    if (options.memoryMB !== undefined) template = template.memoryMB(options.memoryMB);
    for (const step of steps) template = template.runCmd(step);
    if (workingDirectory) {
      // Baked as the runtime default cwd, overriding the provider base
      // image's workdir (e.g. /workspace), so sandboxes created from this
      // template start in the directory repos live in and a `pwd`-based
      // derivation (`<pwd>/<repo>`) lands exactly on the baked checkout.
      // Literal path only — setWorkdir does no shell expansion, which is
      // why the option requires an absolute path.
      template = template.setWorkdir(workingDirectory);
    }
    return template.withFamily(family);
  };
}

function isValidCloneUrl(cloneUrl: string): boolean {
  // The raw string is what reaches the build's shell commands, so allowlist
  // it directly: URL normalization must not be able to launder characters
  // the raw string carries.
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
  // trailing slashes.
  const segments = url.pathname.split('/').slice(1);
  return segments.length > 0 && segments.every(segment => CLONE_URL_SEGMENT_PATTERN.test(segment));
}

/**
 * Canonical form used for identity, the family key, and the build's clone:
 * lowercase host, no trailing `.git` or slash. Two spellings of one
 * repository must not produce two templates.
 */
function normalizeCloneUrl(cloneUrl: string): string {
  // Trailing slashes are trimmed with a scan, not an end-anchored `\/+$`
  // regex, which backtracks quadratically on slash runs.
  let end = cloneUrl.length;
  while (end > 0 && cloneUrl[end - 1] === '/') end--;
  const withoutSuffix = cloneUrl.slice(0, end).replace(/\.git$/i, '');
  return withoutSuffix.replace(/^(https:\/\/)([^/]+)/i, (_match, scheme: string, host: string) => {
    return `${scheme.toLowerCase()}${host.toLowerCase()}`;
  });
}

function repoDirName(cloneUrl: string): string {
  const repo = normalizeCloneUrl(cloneUrl).split('/').at(-1) ?? '';
  return repo.replace(/[^\w.-]/g, '-').replace(/^\.+/, '') || 'repo';
}

function defaultRepoDir(cloneUrl: string): string {
  return `$HOME/${repoDirName(cloneUrl)}`;
}

// A scan, not an end-anchored `\/+$` regex, which backtracks quadratically
// on slash runs.
function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') end--;
  return path.slice(0, end);
}

/**
 * The workingDirectory is interpolated into shell build steps and baked as
 * a literal runtime workdir, so it must be an absolute path made of plain
 * path characters: no shell metacharacters, no `~`/`$HOME` (never
 * expanded), no `..` traversal.
 */
function assertWorkingDirectory(dir: string): string {
  const valid = /^\/[A-Za-z0-9._/-]*$/.test(dir) && !dir.split('/').includes('..');
  if (!valid) {
    throw new Error(
      `Repo template workingDirectory must be an absolute path of plain path characters (got ${JSON.stringify(dir)}); ~ and $HOME are not expanded.`,
    );
  }
  return dir;
}

function gitAuthFlag(): string {
  return `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${BUILD_TOKEN_ENV}" | base64 -w0)"`;
}

export async function resolveDefaultBranchHead(
  cloneUrl: string,
  token?: string,
  execute: GitExec = execFileAsync as GitExec,
): Promise<string | undefined> {
  try {
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    if (token) {
      env.GIT_CONFIG_COUNT = '1';
      env.GIT_CONFIG_KEY_0 = 'http.extraheader';
      env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
    }
    // `--` makes the URL position unambiguous to git: even a hostile value
    // can never be read as an option such as `--upload-pack`. Git config is
    // supplied through the child environment so the token never appears in
    // the process argument list. GIT_TERMINAL_PROMPT=0 makes an inaccessible
    // repository fail fast instead of hanging on a credential prompt.
    const { stdout } = await execute('git', ['ls-remote', '--', cloneUrl, 'HEAD'], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      env,
    });
    const sha = stdout.trim().split(/\s+/, 1)[0];
    return sha && SHA_PATTERN.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}
