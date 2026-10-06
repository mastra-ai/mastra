import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import {
  WORKSPACE_SETUP_MARKER_PATH,
  guardedSetupCommand,
  normalizeSetupCommands,
  repoCloneCommand,
  repoSetupMarkerPath,
  setupMarkerCommand,
  setupMarkerContent,
} from '@internal/workspace';

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

/** One repository of a multi-repository template (`repos`). */
export interface PlatformRepoTemplateRepository {
  /**
   * Same contract as the top-level option: clone URL plus, for private
   * repositories, a short-lived credential. Resolved when the build runs, so
   * each repository can mint its own installation token.
   */
  getRepositoryAccess: () => Promise<PlatformRepositoryAccess | undefined>;
  /**
   * Setup command(s) run inside this repository's clone, as separate cached
   * build steps, before and after the commit pin.
   */
  setupCommand?: string | string[];
}

export interface PlatformRepoTemplateOptions {
  /**
   * Resolves the repository's clone URL and, for private repositories, a
   * short-lived credential. Absent — the session has no repository — makes
   * `createRepoTemplate` return `undefined`, which asks PlatformSandbox for
   * the provider default without a conditional at the call site.
   *
   * Single-repository form; mutually exclusive with `repos`.
   */
  getRepositoryAccess?: (() => Promise<PlatformRepositoryAccess | undefined>) | undefined;
  /**
   * Setup command(s) run inside the checkout. Array entries run as separate
   * cached build steps. Each command runs twice: once right after the clone,
   * so the install layer caches independently of the commit, and again after
   * the checkout is pinned to the resolved head, so the image matches that
   * commit. Commands must be safe to repeat in the same checkout. (This ordering replaced clone → pin → setup; templates built
   * before the change rebuild once, then reuse their clone and install layers
   * across commits.)
   */
  setupCommand?: string | string[];
  /**
   * Several repositories in one template. Each lands at
   * `<workingDirectory>/<repo>` and runs its own `setupCommand` inside its
   * clone, with the same twice-around-the-pin layering as the single form.
   * Public repositories (no `authorization`) are built before private ones in
   * caller order within each group, so their layers can outlive credential
   * rotation. Each repository writes `.mastra-sandbox/repos/<repo>`
   * (`setupMarkerContent` of its commands) once every step for it ran.
   *
   * Every credential is a build env visible to every build step, so any
   * repository's setup command can read the other repositories' tokens: only
   * list repositories whose setup commands are trusted together.
   *
   * Mutually exclusive with `getRepositoryAccess`. If any entry's access
   * cannot be resolved the whole template degrades to resources-only: a
   * sandbox missing one repository is worse than one missing all of them.
   * Two entries that would clone into the same directory make the resolver
   * reject (PlatformSandbox then logs and boots the provider default). An
   * empty array behaves like no repository.
   */
  repos?: PlatformRepoTemplateRepository[];
  /**
   * Command(s) run once at the working directory after every repository is
   * set up (`repos` only). Failures fail the build. Writes
   * `.mastra-sandbox/workspace-setup` afterwards, even for an empty list.
   */
  workspaceSetupCommand?: string | string[];
  /**
   * `repos` only. When true a failing per-repository setup command records
   * that repository's directory name in `.mastra-sandbox/setup-failed` (one
   * line per repository, whichever passes failed) and the build continues; clone, pin, workspace and marker steps still fail
   * the build. A per-repository marker then means "every step ran", so
   * consumers check the failure list first. Default false: any failure fails
   * the build, as in the single form.
   */
  continueOnSetupFailure?: boolean;
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
   * Absolute parent for the checkout. Created by the build user, so its parent
   * must already be writable by that user. Becomes the build cwd, the runtime
   * cwd, and part of the template family; the repo lands at `<workingDirectory>/<repo>`.
   * Omit to use the base image's working directory for all of the above.
   */
  workingDirectory?: string;
  /**
   * Build-only environment, excluded from template identity and runtime sandboxes.
   * Use for credentials; output-changing inputs belong in `setupCommand`.
   */
  buildEnv?: Record<string, string>;
  /** Test/integration seam for resolving the default-branch head. */
  resolveHead?: (cloneUrl: string, token?: string) => Promise<string | undefined>;
}

export type PlatformRepoTemplateResolver = () => Promise<SandboxTemplateBuilder | undefined>;

/** One repository after access and head resolution. */
interface ResolvedRepository {
  /** Position in the caller's list; names the token env so reordering never renames it. */
  index: number;
  cloneUrl: string;
  repoDir: string;
  token?: string;
  tokenEnv?: string;
  /** Undefined when the head could not be resolved: the clone is left unpinned. */
  sha?: string;
  setupCommands: string[];
}

/** Last default-branch head resolved per clone URL, shared across resolvers in this process. */
const lastKnownHeads = new Map<string, string>();
const MAX_LAST_KNOWN_HEADS = 1000;

function rememberHead(cloneUrl: string, sha: string): void {
  // Re-insert so the map stays in recency order and the oldest URL is evicted first.
  lastKnownHeads.delete(cloneUrl);
  lastKnownHeads.set(cloneUrl, sha);
  if (lastKnownHeads.size > MAX_LAST_KNOWN_HEADS) {
    lastKnownHeads.delete(lastKnownHeads.keys().next().value!);
  }
}

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
 * transient build envs; they never enter the serialized definition. A failed
 * head lookup reuses the last head resolved for the same clone URL in this
 * process. If the repository cannot be resolved, or no head has been resolved
 * yet, the resolver keeps `cpuCount` and
 * `memoryMB` in a resources-only template so the sandbox still boots at the
 * requested size, and the caller's runtime setup materializes the checkout.
 */
export function createRepoTemplate(options: PlatformRepoTemplateOptions): PlatformRepoTemplateResolver | undefined {
  if (options.getRepositoryAccess && options.repos) {
    throw new TypeError('createRepoTemplate: pass either getRepositoryAccess or repos, not both');
  }
  // The guard and the workspace steps have no meaning for one repository, and
  // the single-form marker must keep meaning "every setup command succeeded".
  if (!options.repos && (options.workspaceSetupCommand !== undefined || options.continueOnSetupFailure !== undefined)) {
    throw new TypeError('createRepoTemplate: workspaceSetupCommand and continueOnSetupFailure require repos');
  }
  const isList = options.repos !== undefined;
  const entries: PlatformRepoTemplateRepository[] = options.repos
    ? options.repos
    : options.getRepositoryAccess
      ? [{ getRepositoryAccess: options.getRepositoryAccess, setupCommand: options.setupCommand }]
      : [];
  const resourcesOnly = () => {
    if (options.cpuCount === undefined && options.memoryMB === undefined) return undefined;
    return withResources(Template(), options);
  };
  if (entries.length === 0) {
    const template = resourcesOnly();
    return template ? async () => template : undefined;
  }
  const resolveHead = options.resolveHead ?? resolveDefaultBranchHead;
  const continueOnFailure = options.continueOnSetupFailure ?? false;

  return async () => {
    const repos: ResolvedRepository[] = [];
    for (const [index, entry] of entries.entries()) {
      // Warn when the sandbox falls back to the provider default template.
      let accessError: unknown;
      const access = await entry.getRepositoryAccess().catch(error => {
        accessError = error;
        return undefined;
      });
      if (!access?.cloneUrl) {
        console.warn('[platform-workspace] repo template skipped: repository access unavailable', {
          ...(isList ? { index } : {}),
          error: redactSecrets(accessError),
        });
        return resourcesOnly();
      }
      const cloneUrl = normalizeCloneUrl(access.cloneUrl);
      if (!isValidCloneUrl(cloneUrl)) {
        console.warn('[platform-workspace] repo template skipped: clone URL failed validation', {
          ...(isList ? { index } : {}),
          cloneUrl: redactSecrets(cloneUrl),
        });
        return resourcesOnly();
      }

      const token = access.authorization?.token;
      let headError: unknown;
      const resolved = await (token ? resolveHead(cloneUrl, token) : resolveHead(cloneUrl)).catch(error => {
        headError = error;
        return undefined;
      });
      let sha: string | undefined;
      if (resolved && SHA_PATTERN.test(resolved)) {
        sha = resolved;
        rememberHead(cloneUrl, sha);
      } else {
        // A transient lookup failure (rate limit, timeout) must not drop the
        // repo steps: an older pin still boots a warm family image, and the
        // caller's checkout fetches the current tip regardless of the pin.
        const lastKnown = lastKnownHeads.get(cloneUrl);
        if (lastKnown) {
          console.warn('[platform-workspace] repo template pinned to the last known default-branch head', {
            cloneUrl,
            sha: lastKnown,
            resolved,
            error: redactSecrets(headError),
          });
          sha = lastKnown;
        } else if (isList) {
          // In a list, dropping one repository would leave a sandbox without
          // it; clone the default branch unpinned instead and keep the rest.
          console.warn('[platform-workspace] repo template clones unpinned: could not resolve default-branch head', {
            cloneUrl,
            sha: resolved,
            error: redactSecrets(headError),
          });
        } else {
          console.warn('[platform-workspace] repo template skipped: could not resolve default-branch head', {
            cloneUrl,
            sha: resolved,
            error: redactSecrets(headError),
          });
          return resourcesOnly();
        }
      }

      // Relative to the build cwd, which `setWorkdir` (or the base image) also
      // makes the runtime cwd, so the checkout sits at `<cwd>/<repo>` either way.
      const repoDir = repoDirName(cloneUrl);
      repos.push({
        index,
        cloneUrl,
        repoDir,
        token,
        // The single form keeps its historical env name; list entries are
        // numbered by caller position so public/private reordering never
        // renames one.
        tokenEnv: token ? (isList ? `${BUILD_TOKEN_ENV}_${index}` : BUILD_TOKEN_ENV) : undefined,
        sha,
        // Blank commands would produce invalid shell steps.
        setupCommands: normalizeSetupCommands(entry.setupCommand),
      });
    }

    const seenDirs = new Map<string, string>();
    for (const repo of repos) {
      const other = seenDirs.get(repo.repoDir);
      if (other) {
        throw new Error(
          `createRepoTemplate: repositories ${other} and ${repo.cloneUrl} would both clone into "${repo.repoDir}"`,
        );
      }
      seenDirs.set(repo.repoDir, repo.cloneUrl);
    }

    const workingDirectory =
      options.workingDirectory === undefined
        ? undefined
        : trimTrailingSlashes(assertWorkingDirectory(options.workingDirectory));
    // Commit-independent family key that groups every commit of the same
    // repo+layout together. The platform uses it to find a prior build in
    // the same family so new commits boot on a warm filesystem while the
    // exact template continues to build in the background. A list hashes
    // its members in caller order (the family cap is 200 chars).
    const family = isList
      ? `repos:${createHash('sha256')
          .update(JSON.stringify([workingDirectory ?? '', repos.map(repo => [repo.cloneUrl, repo.repoDir])]))
          .digest('hex')
          .slice(0, 32)}`
      : `repo:${repos[0]!.cloneUrl}:${workingDirectory ?? ''}/${repos[0]!.repoDir}`;
    let template = Template();
    const buildEnv: Record<string, string> = { ...options.buildEnv };
    for (const repo of repos) if (repo.tokenEnv && repo.token) buildEnv[repo.tokenEnv] = repo.token;
    if (Object.keys(buildEnv).length > 0) template = template.setEnvs(buildEnv, { ephemeral: true });
    template = withResources(template, options);
    if (workingDirectory) {
      // Created by the build user so it is writable; `setWorkdir` then makes
      // it the cwd for the steps below and the runtime default, without
      // shell expansion.
      template = template.runCmd(`mkdir -p "${workingDirectory}"`).setWorkdir(workingDirectory);
    }
    // Public repositories first so their layers sit below the credential
    // layer once the platform positions ephemeral envs; caller order within
    // each group.
    const ordered = [...repos.filter(repo => !repo.token), ...repos.filter(repo => repo.token)];
    for (const repo of ordered) {
      const { repoDir, sha, tokenEnv, setupCommands } = repo;
      const auth = tokenEnv ? `${gitAuthFlag(tokenEnv)} ` : '';
      // Build steps use fresh shells, so each setup command needs its own `cd`.
      const setupSteps = setupCommands.map(command => guardedSetupCommand({ repoDir, command, continueOnFailure }));
      // Each operation gets its own cached provider build step. Same shallow
      // clone Factory makes at session start when no image provided one, so
      // both paths yield the same checkout. The clone carries no commit, so
      // it and the first setup pass cache across commits; the pin and the
      // second pass are the only per-commit layers.
      template = template.runCmd(
        repoCloneCommand({ cloneUrl: repo.cloneUrl, destination: repoDir, ...(tokenEnv ? { tokenEnv } : {}) }),
      );
      for (const step of setupSteps) template = template.runCmd(step);
      if (sha) {
        template = template
          .runCmd(`git -C "${repoDir}" ${auth}fetch origin ${sha}`)
          .runCmd(`git -C "${repoDir}" checkout ${sha}`);
      }
      for (const step of setupSteps) template = template.runCmd(step);
      // Last for this repository, so it only exists once every step above ran.
      const content = setupMarkerContent(setupCommands);
      template = template.runCmd(
        isList ? setupMarkerCommand(content, repoSetupMarkerPath(repoDir)) : setupMarkerCommand(content),
      );
    }
    if (isList) {
      const workspaceCommands = normalizeSetupCommands(options.workspaceSetupCommand);
      for (const command of workspaceCommands) template = template.runCmd(command);
      template = template.runCmd(
        setupMarkerCommand(setupMarkerContent(workspaceCommands), WORKSPACE_SETUP_MARKER_PATH),
      );
    }
    return template.withFamily(family);
  };
}

function withResources(
  template: SandboxTemplateBuilder,
  options: Pick<PlatformRepoTemplateOptions, 'cpuCount' | 'memoryMB'>,
): SandboxTemplateBuilder {
  if (options.cpuCount !== undefined) template = template.cpuCount(options.cpuCount);
  if (options.memoryMB !== undefined) template = template.memoryMB(options.memoryMB);
  return template;
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
  // Avoid regex backtracking on long trailing-slash runs.
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

// Avoid regex backtracking on long trailing-slash runs. Keeps a bare `/`.
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

/**
 * Render a caught value for a warning without leaking credentials: URL
 * userinfo, HTTP authorization values, and GitHub token shapes are masked.
 */
export function redactSecrets(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = value instanceof Error ? value.message : typeof value === 'string' ? value : String(value);
  return text
    .replace(/\/\/[^/@\s]+@/g, '//***@')
    .replace(/\b(bearer|basic)\s+[^\s"']+/gi, '$1 ***')
    .replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, '$1***');
}

function gitAuthFlag(tokenEnv: string): string {
  return `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${tokenEnv}" | base64 -w0)"`;
}

/**
 * `owner/repo` for a github.com clone URL, else undefined. Only the public
 * host is API-resolvable: GitHub Enterprise and other forges keep the git
 * path below.
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
 * Resolve the default-branch head. github.com repositories go through the
 * REST API so resolution works wherever the host runs, including deployed
 * images without a git binary; other hosts shell out to `git ls-remote`.
 * Throws with a redaction-safe message when the head cannot be resolved.
 */
export async function resolveDefaultBranchHead(
  cloneUrl: string,
  token?: string,
  execute: GitExec = execFileAsync as GitExec,
  fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> {
  const github = parseGithubRepo(cloneUrl);
  if (github) {
    const response = await fetchImpl(`https://api.github.com/repos/${github.owner}/${github.repo}/commits/HEAD`, {
      headers: {
        Accept: 'application/vnd.github.sha',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'mastra-platform-workspace',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    }).catch((error: unknown) => {
      throw new Error(`GitHub head lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (!response.ok) {
      throw new Error(`GitHub head lookup failed: ${response.status} ${response.statusText}`.trim());
    }
    const sha = (await response.text()).trim();
    return SHA_PATTERN.test(sha) ? sha : undefined;
  }
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
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const detail = typeof stderr === 'string' && stderr.trim() ? stderr.trim() : String(error);
    throw new Error(`git ls-remote failed: ${detail}`);
  }
}
