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
  /** Setup command run inside the checkout during the provider build. */
  setupCommand?: string;
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
    const access = await getRepositoryAccess().catch(() => undefined);
    if (!access?.cloneUrl) return undefined;
    const cloneUrl = normalizeCloneUrl(access.cloneUrl);
    if (!isValidCloneUrl(cloneUrl)) return undefined;

    const token = access.authorization?.token;
    const sha = await (token ? resolveHead(cloneUrl, token) : resolveHead(cloneUrl)).catch(() => undefined);
    if (!sha || !SHA_PATTERN.test(sha)) return undefined;

    const workdir = defaultWorkdir(cloneUrl);
    const auth = token ? `${gitAuthFlag()} ` : '';
    const steps = [
      `git ${auth}clone ${cloneUrl} "${workdir}"`,
      `git -C "${workdir}" ${auth}fetch origin ${sha}`,
      `git -C "${workdir}" checkout ${sha}`,
      ...(options.setupCommand ? [`cd "${workdir}" && ${options.setupCommand}`] : []),
    ];

    // Commit-independent family key that groups every commit of the same
    // repo+workdir together. The platform uses it to find a prior build in
    // the same family so new commits boot on a warm filesystem while the
    // exact template continues to build in the background.
    const family = `repo:${cloneUrl}:${workdir}`;
    let template = Template();
    if (token) template = template.setEnvs({ [BUILD_TOKEN_ENV]: token }, { ephemeral: true });
    if (options.cpuCount !== undefined) template = template.cpuCount(options.cpuCount);
    if (options.memoryMB !== undefined) template = template.memoryMB(options.memoryMB);
    return template.runCmd(steps).withFamily(family);
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

function defaultWorkdir(cloneUrl: string): string {
  const repo = normalizeCloneUrl(cloneUrl).split('/').at(-1) ?? '';
  const name = repo.replace(/[^\w.-]/g, '-').replace(/^\.+/, '') || 'repo';
  return `$HOME/${name}`;
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
