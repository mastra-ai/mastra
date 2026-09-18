/**
 * Repo materialization for GitHub-backed repositories.
 *
 * A GitHub repo is never cloned onto the server host. The repo is cloned
 * *inside* the session's sandbox, so the agent's file tools and command tools
 * operate entirely against the remote checkout.
 *
 * - `materializeRepo(row, token)` clones the repo inside the sandbox when no
 *   checkout exists yet (a base-image boot, a wiped disk), supplying the
 *   short-lived token only in that Git process's environment. A checkout that
 *   is already there, from a repo template image or an earlier start, is left
 *   exactly as it is.
 *
 * This module owns everything git/GitHub: clone, commit/push, setup/teardown commands,
 * and `gh pr create`. Workdir layout lives in `../sandbox/workdir`.
 */

import type { RepositoryAccess } from '../../capabilities/version-control.js';
import { isValidGitRef } from '../../sandbox/git-ref.js';
import type { ExecutableSandbox, SandboxCommandResult } from '../../sandbox/materialization.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import { timedPhase } from '../../timing.js';

type MaterializationStore = Pick<SourceControlStorageHandle['sessions'], 'markMaterialized'>;

interface RepoMaterializationBinding {
  id: string;
  sandboxWorkdir: string;
  materializedAt: Date | null;
}

/**
 * Single-quote a string for safe POSIX shell interpolation. Wraps the value in
 * single quotes and escapes any embedded single quote using the canonical
 * close-quote / escaped-quote / reopen-quote sequence (`'\''`). This is the
 * standard POSIX-safe construction and prevents the quoted string from being
 * terminated early.
 */
export function shellQuote(value: string): string {
  // Replace each ' with the four-character sequence: ' \ ' '
  return `'` + value.split(`'`).join(`'\\''`) + `'`;
}

/**
 * Default hang guard for sandbox shell commands. Generous by design — large
 * clones and dependency installs legitimately take minutes; the guard exists
 * so a wedged sandbox surfaces a failure instead of hanging the request that
 * triggered materialization forever.
 */
export const DEFAULT_COMMAND_TIMEOUT_MS = 15 * 60_000;
/** Branch checkout only fetches one ref — a much tighter budget applies. */
export const CHECKOUT_COMMAND_TIMEOUT_MS = 5 * 60_000;

interface ShOptions {
  /** Override the hang-guard budget for this command. */
  timeoutMs?: number;
  /** Human-readable phase name included in the timeout error. */
  phase?: string;
}

interface CommandOptions extends ShOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

/**
 * A thrown transport-level failure that is worth retrying: remote sandbox

 * providers (e.g. the platform workspace proxy) surface transient 5xx errors
 * as exceptions carrying an HTTP `status` — typically while a freshly
 * provisioned VM is still coming up. Command failures are NOT exceptions
 * (they resolve with a non-zero exit code), so retrying here never re-runs a
 * command that the sandbox already executed and rejected.
 */
function isTransientTransportError(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' && status >= 500;
}

const SH_RETRIES = 2;
const SH_RETRY_DELAY_MS = 2000;

/**
 * Run a shell script in the sandbox via `sh -c`. This is reserved for the
 * explicitly configured repository lifecycle hooks; programmatic commands use
 * {@link execute} with an argv array.
 */
export async function sh(
  sandbox: ExecutableSandbox,
  script: string,
  options: ShOptions = {},
): Promise<SandboxCommandResult> {
  return execute(sandbox, 'sh', ['-c', script], options);
}

/**
 * Execute one program with an argv array, bounded by a hang guard. Transient
 * sandbox transport failures are retried without ever interpolating arguments
 * into a shell command.
 */
async function execute(
  sandbox: ExecutableSandbox,
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<SandboxCommandResult> {
  const deadlineMs = Date.now() + (options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    try {
      const result = await executeOnce(sandbox, command, args, {
        ...options,
        timeoutMs: Math.max(deadlineMs - Date.now(), 1),
      });
      if (options.phase) {
        process.stderr.write(
          `[factory:timing] ${options.phase} attempt=${attempt + 1} exit=${result.exitCode} ${Math.round(performance.now() - started)}ms\n`,
        );
      }
      return result;
    } catch (error) {
      if (options.phase) {
        process.stderr.write(
          `[factory:timing] ${options.phase} attempt=${attempt + 1} threw after ${Math.round(performance.now() - started)}ms: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
      if (attempt >= SH_RETRIES || !isTransientTransportError(error)) throw error;
      const delayMs = SH_RETRY_DELAY_MS * (attempt + 1);
      if (deadlineMs - Date.now() <= delayMs) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/** Single structured command execution attempt, bounded by the hang guard. */
async function executeOnce(
  sandbox: ExecutableSandbox,
  command: string,
  args: string[],
  options: CommandOptions,
): Promise<SandboxCommandResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hangGuard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const phase = options.phase ? ` during ${options.phase}` : '';
      reject(new Error(`Sandbox command timed out after ${Math.round(timeoutMs / 1000)}s${phase}.`));
    }, timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([
      sandbox.executeCommand(command, args, {
        timeout: timeoutMs,
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        ...(options.env !== undefined ? { env: options.env } : {}),
      }),
      hangGuard,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const GIT_TRANSFER_RETRIES = 2;
const GIT_TRANSFER_RETRY_DELAY_MS = 2000;

/**
 * True when a git transfer died mid-flight rather than being refused.
 *
 * `sh` already retries transport errors the sandbox provider *throws*, but a
 * git command that reaches the network and then loses it exits non-zero
 * instead — so a single HTTP/2 framing glitch or dropped connection to
 * github.com would otherwise permanently fail opening a workspace. These
 * patterns all mean "the bytes stopped arriving", which says nothing about
 * whether the operation would succeed if attempted again.
 *
 * Deliberately narrow: a refusal (bad credentials, missing repo, blocked
 * egress) is terminal and must surface immediately rather than be retried into
 * a slow failure.
 */
function isTransientGitFailure(result: SandboxCommandResult): boolean {
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  return /HTTP2 framing layer|RPC failed; curl|RPC failed; HTTP 5\d\d|the remote end hung up unexpectedly|early EOF|unexpected disconnect|connection reset by peer|Recv failure|Send failure|GnuTLS recv error|TLS connection was non-properly terminated|502 Bad Gateway|503 Service Unavailable/i.test(
    output,
  );
}

/**
 * Run a git command that only *reads* from the remote, retrying it when the
 * transfer dies mid-flight. Restricted to read-only transfers on purpose:
 * re-running a clone or a fetch is free, whereas re-running a push could
 * duplicate work already accepted by the remote before the connection dropped.
 *
 * `beforeRetry` lets a call site clear whatever the aborted attempt left
 * behind — a half-written clone directory blocks the next `git clone` outright.
 */
async function gitTransfer(
  sandbox: ExecutableSandbox,
  args: string[],
  options: CommandOptions & { beforeRetry?: (attempt: number) => Promise<void> } = {},
): Promise<SandboxCommandResult> {
  const { beforeRetry, ...commandOptions } = options;
  const deadlineMs = Date.now() + (commandOptions.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    const result = await execute(sandbox, 'git', args, {
      ...commandOptions,
      timeoutMs: Math.max(deadlineMs - Date.now(), 1),
    });
    if (result.exitCode === 0 || attempt >= GIT_TRANSFER_RETRIES || !isTransientGitFailure(result)) return result;
    process.stderr.write(
      `[factory:timing] git ${commandOptions.phase ?? 'transfer'} retrying after attempt ${attempt + 1}\n`,
    );
    const delayMs = GIT_TRANSFER_RETRY_DELAY_MS * (attempt + 1);
    if (deadlineMs - Date.now() <= delayMs) return result;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await beforeRetry?.(attempt + 1);
  }
}

/** Error raised when the sandbox cannot materialize the repo (actionable). */
export class MaterializeError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'git-missing'
      | 'egress-blocked'
      | 'clone-failed'
      | 'pull-failed'
      | 'push-failed'
      | 'commit-failed'
      | 'gh-missing'
      | 'pr-failed',
  ) {
    super(message);
    this.name = 'MaterializeError';
  }
}

function cleanUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}.git`;
}

function credentialScope(
  cloneUrl: string,
  code: 'clone-failed' | 'pull-failed' | 'push-failed' = 'clone-failed',
): string {
  let url: URL;
  try {
    url = new URL(cloneUrl);
  } catch {
    throw new MaterializeError('Refusing to configure credentials for an invalid repository clone URL.', code);
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new MaterializeError('Refusing to configure credentials for an invalid repository clone URL.', code);
  }
  const repositoryPath = url.pathname.replace(/\/+$/, '');
  if (!repositoryPath || repositoryPath === '/') {
    throw new MaterializeError('Refusing to configure credentials for an invalid repository clone URL.', code);
  }
  return url.origin + repositoryPath;
}

/**
 * Provide HTTP Basic credentials to one Git process without putting a secret
 * in argv, a remote URL, or persistent git config. Git reads the URL-scoped
 * extra header from its process environment and discards it on exit.
 */
function gitAuthenticationEnvironment(
  cloneUrl: string,
  token: string,
  username: string,
  code: 'clone-failed' | 'pull-failed' | 'push-failed' = 'clone-failed',
): Record<string, string> {
  const scope = credentialScope(cloneUrl, code);
  if (!token || !username) {
    throw new MaterializeError('Repository access did not include usable credentials.', code);
  }
  const authorization = Buffer.from(`${username}:${token}`, 'utf8').toString('base64');
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.${scope}.extraHeader`,
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${authorization}`,
    GIT_TERMINAL_PROMPT: '0',
  };
}

function normalizedRemoteUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !url.hostname || url.search || url.hash) return null;
  const pathname = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
  const repositoryPath = url.hostname.toLowerCase() === 'github.com' ? pathname.toLowerCase() : pathname;
  return 'https://' + url.host.toLowerCase() + repositoryPath;
}

/** Repo metadata needed to materialize, read from the org-owned project row. */
export interface RepoMaterializeInfo {
  repoFullName: string;
  defaultBranch: string;
  /** Provider-supplied, credential-free HTTPS clone URL. */
  cloneUrl?: string;
  /** Username paired with the bearer token for git-over-HTTPS. */
  authUsername?: string;
}

/** Options for {@link materializeRepo}. */
export interface MaterializeRepoOptions {
  /** The per-(project,user) sandbox binding whose workdir this materializes into. */
  row: RepoMaterializationBinding;
  /** Repo metadata from the org-owned project row. */
  repoInfo: RepoMaterializeInfo;
  /** The live sandbox to run git inside. */
  sandbox: ExecutableSandbox;
  /** A freshly minted, short-lived installation access token. */
  token: string;
  storage: MaterializationStore;
}

async function clearWorkdir(sandbox: ExecutableSandbox, workdir: string): Promise<void> {
  const mkdir = await execute(sandbox, 'mkdir', ['-p', workdir]);
  if (mkdir.exitCode !== 0) throw classifyGitFailure(mkdir, 'clone-failed');
  const clear = await execute(sandbox, 'find', [
    workdir,
    '-mindepth',
    '1',
    '-maxdepth',
    '1',
    '-exec',
    'rm',
    '-rf',
    '--',
    '{}',
    '+',
  ]);
  if (clear.exitCode !== 0) throw classifyGitFailure(clear, 'clone-failed');
}
/**
 * Materialize the repo inside the user's sandbox: clone when no checkout of
 * this repo exists, otherwise nothing. Credentials are process-scoped and the
 * stored remote remains credential-free. Sets `materialized_at` on the
 * per-user sandbox binding row.
 */
export async function materializeRepo(options: MaterializeRepoOptions): Promise<void> {
  return timedPhase('workspace.materialize', () => materializeRepoImpl(options));
}

async function materializeRepoImpl(options: MaterializeRepoOptions): Promise<void> {
  const { row: sandboxRow, repoInfo, sandbox, token, storage } = options;
  const workdir = sandboxRow.sandboxWorkdir;
  const repo = repoInfo.repoFullName;

  // 0. Defense in depth: never build a git command from values that aren't
  // strictly shaped, even if a malformed row reached the DB. Inputs are also
  // validated at the route boundary before storage.
  if (!/^[\w.-]+(?:\/[\w.-]+)+$/.test(repo)) {
    throw new MaterializeError(`Refusing to materialize: invalid repo full name '${repo}'.`, 'clone-failed');
  }
  if (!/^[A-Za-z0-9_./-]+$/.test(repoInfo.defaultBranch)) {
    throw new MaterializeError(
      `Refusing to materialize: invalid default branch '${repoInfo.defaultBranch}'.`,
      'clone-failed',
    );
  }

  // 1. Preflight: git must be installed in the sandbox template.
  const gitVersion = await execute(sandbox, 'git', ['--version']);
  if (gitVersion.exitCode !== 0) {
    throw new MaterializeError(
      'git is not installed in the sandbox. The sandbox template must include git.',
      'git-missing',
    );
  }

  // The DB's `materializedAt` can drift from disk in both directions: a fresh
  // binding row over an already-populated workdir (a repo template image,
  // local dev DB resets, repaired rows) must not fail `git clone` on the
  // non-empty directory, and a stale `materializedAt` over an empty sandbox
  // (an expired/recreated VM whose disk was wiped) must re-clone instead of
  // running `git -C <workdir>` against a directory that no longer exists.
  // Disk is the source of truth: detect the checkout instead of trusting the
  // row. An existing checkout is left as it is, whatever it is on: a template
  // image sits detached at its pinned commit, a resumed session on its
  // branch. Syncing with the remote is the session's business; the branch
  // checkout that follows fetches the base branch it needs.
  const cleanCloneUrl = repoInfo.cloneUrl ?? cleanUrl(repo);
  const existing = await existingCheckoutRemote(sandbox, workdir, cleanCloneUrl);
  if (existing !== null) {
    // A token an earlier start failed to scrub must not outlive it; the
    // remote already carries the plain URL otherwise, so this costs nothing
    // on the common path.
    if (/\/\/[^/]*@/.test(existing)) await scrubRemote(sandbox, workdir, repo, cleanCloneUrl);
  } else {
    // 2. First open: shallow-clone the default branch into the workdir, the
    // same clone a repo template bakes into its image. The workdir holds no
    // usable checkout of this repo, but it may not be empty: a checkpoint
    // seed or a clone that died partway (a crashed or OOM-killed server)
    // leaves a partial tree behind, and `git clone` refuses a non-empty
    // destination with a non-retryable fatal. Nothing here is recoverable,
    // the probe above already ruled out a checkout of this repo, so
    // clear its contents before cloning, exactly as the retry path does. Keep
    // the workdir itself because LocalSandbox runs commands with this
    // directory as the child process cwd.
    const authEnv = gitAuthenticationEnvironment(
      cleanCloneUrl,
      token,
      repoInfo.authUsername ?? 'x-access-token',
      'clone-failed',
    );
    await clearWorkdir(sandbox, workdir);
    const clone = await gitTransfer(
      sandbox,
      ['clone', '--depth=1', '--single-branch', '--branch', repoInfo.defaultBranch, '--', cleanCloneUrl, workdir],
      {
        env: authEnv,
        phase: 'repository clone',
        beforeRetry: async () => {
          // A clone that died partway leaves the destination non-empty, which
          // git refuses to clone into. Clear its contents so the retry starts
          // clean without removing LocalSandbox's process cwd.
          await clearWorkdir(sandbox, workdir);
        },
      },
    );
    if (clone.exitCode !== 0) throw classifyGitFailure(clone, 'clone-failed');
  }

  // 4. Mark materialized.
  await storage.markMaterialized({ id: sandboxRow.id });
}

export interface SessionBranchOptions {
  branch: string;
  baseBranch: string;
  token: string;
  repoFullName: string;
  cloneUrl?: string;
  authUsername?: string;
  /** A pull-request card's session starts on the PR head instead of the base tip. */
  pullRequestNumber?: number;
}

/**
 * Past file contents of a blob-less history load on demand; git asks gh, which
 * answers from the session's `GH_TOKEN`, so no credential is ever written.
 */
const GH_CREDENTIAL_HELPER = '!gh auth git-credential';

async function fetchStartPoint(
  sandbox: ExecutableSandbox,
  workdir: string,
  { baseBranch, pullRequestNumber }: Pick<SessionBranchOptions, 'baseBranch' | 'pullRequestNumber'>,
  shallowClone: boolean,
  env: Record<string, string>,
): Promise<SandboxCommandResult> {
  const baseArgs = [
    '-C',
    workdir,
    'fetch',
    ...(pullRequestNumber !== undefined && shallowClone ? ['--unshallow'] : []),
    ...(pullRequestNumber !== undefined ? ['--filter=blob:none'] : []),
    'origin',
    baseBranch,
  ];
  const base = await gitTransfer(sandbox, baseArgs, {
    env,
    timeoutMs: CHECKOUT_COMMAND_TIMEOUT_MS,
    phase: 'branch checkout fetch',
  });
  if (base.exitCode !== 0 || pullRequestNumber === undefined) return base;
  return gitTransfer(
    sandbox,
    ['-C', workdir, 'fetch', '--filter=blob:none', 'origin', `refs/pull/${pullRequestNumber}/head`],
    {
      env,
      timeoutMs: CHECKOUT_COMMAND_TIMEOUT_MS,
      phase: 'pull request head fetch',
    },
  );
}

/** Check out a session's branch inside its isolated repository clone. */
export async function checkoutSessionBranch(
  sandbox: ExecutableSandbox,
  workdir: string,
  options: SessionBranchOptions,
): Promise<void> {
  return timedPhase('workspace.checkout', () => checkoutSessionBranchImpl(sandbox, workdir, options));
}

async function checkoutSessionBranchImpl(
  sandbox: ExecutableSandbox,
  workdir: string,
  options: SessionBranchOptions,
): Promise<void> {
  const { branch, baseBranch, token, repoFullName, pullRequestNumber, cloneUrl, authUsername } = options;
  if (!isValidGitRef(branch) || !isValidGitRef(baseBranch)) {
    throw new MaterializeError('Refusing to create a session from an invalid branch name.', 'clone-failed');
  }

  const pullRequestSession = pullRequestNumber !== undefined;
  // GitHub delegates later authenticated operations to `gh`. Other providers
  // deliberately receive no persistent credential helper. Remove the legacy
  // helper when reopening an older checkout so a stale sandbox cannot retain
  // credentials injected by an earlier implementation.
  const cleanCloneUrl = cloneUrl ?? cleanUrl(repoFullName);
  const credentialKey = authUsername ? 'credential.' + credentialScope(cleanCloneUrl) + '.helper' : 'credential.helper';
  if (authUsername) {
    await execute(sandbox, 'git', ['-C', workdir, 'config', '--unset-all', credentialKey]);
  } else {
    const configured = await execute(sandbox, 'git', ['-C', workdir, 'config', credentialKey, GH_CREDENTIAL_HELPER]);
    if (configured.exitCode !== 0) throw classifyGitFailure(configured, 'pull-failed');
  }

  const current = await execute(sandbox, 'git', ['-C', workdir, 'branch', '--show-current']);
  if (current.exitCode === 0 && current.stdout.trim() === branch) return;

  const local = await execute(sandbox, 'git', [
    '-C',
    workdir,
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ]);
  if (local.exitCode === 0) {
    const checkout = await execute(sandbox, 'git', ['-C', workdir, 'checkout', branch]);
    if (checkout.exitCode !== 0) {
      if (isBlockedByLocalWork(checkout)) return;
      throw classifyGitFailure(checkout, 'clone-failed');
    }
    return;
  }

  const shallowClone =
    pullRequestSession &&
    (await execute(sandbox, 'git', ['-C', workdir, 'rev-parse', '--is-shallow-repository'])).stdout.trim() === 'true';
  const authEnv = gitAuthenticationEnvironment(cleanCloneUrl, token, authUsername ?? 'x-access-token', 'pull-failed');
  const fetch = await fetchStartPoint(sandbox, workdir, options, shallowClone, authEnv);
  if (fetch.exitCode !== 0) throw classifyGitFailure(fetch, 'pull-failed');

  const create = await execute(sandbox, 'git', ['-C', workdir, 'checkout', '-b', branch, 'FETCH_HEAD'], {
    timeoutMs: CHECKOUT_COMMAND_TIMEOUT_MS,
    phase: 'branch checkout',
  });
  if (create.exitCode === 0 || isBlockedByLocalWork(create)) return;
  if (!isBranchCollision(create)) throw classifyGitFailure(create, 'clone-failed');

  // The branch exists even though the show-ref probe missed it: either another
  // materialization created it concurrently (adopt it), or the sandbox carries
  // a broken loose ref (remove it and retry).
  const adopt = await execute(sandbox, 'git', ['-C', workdir, 'checkout', branch]);
  if (adopt.exitCode === 0 || isBlockedByLocalWork(adopt)) return;

  let drop = await execute(sandbox, 'git', ['-C', workdir, 'update-ref', '--no-deref', '-d', `refs/heads/${branch}`]);
  if (drop.exitCode !== 0) {
    const gitDir = await execute(sandbox, 'git', ['-C', workdir, 'rev-parse', '--absolute-git-dir']);
    if (gitDir.exitCode !== 0 || !gitDir.stdout.trim()) throw classifyGitFailure(create, 'clone-failed');
    drop = await execute(sandbox, 'rm', ['-f', '--', `${gitDir.stdout.trim()}/refs/heads/${branch}`]);
  }
  if (drop.exitCode !== 0) throw classifyGitFailure(create, 'clone-failed');

  const retry = await execute(sandbox, 'git', ['-C', workdir, 'checkout', '-b', branch, 'FETCH_HEAD'], {
    timeoutMs: CHECKOUT_COMMAND_TIMEOUT_MS,
    phase: 'branch checkout retry',
  });
  if (retry.exitCode !== 0) {
    if (isBlockedByLocalWork(retry)) return;
    throw classifyGitFailure(retry, 'clone-failed');
  }
}

/**
 * True when `git checkout -b` failed only because the branch ref already
 * exists — the collision Factory hits when a pooled sandbox carries a ref the
 * show-ref probe could not see (broken loose ref) or a concurrent
 * materialization created the branch after the probe ran.
 */
function isBranchCollision(result: SandboxCommandResult): boolean {
  return /a branch named .* already exists/i.test(`${result.stderr || ''}\n${result.stdout || ''}`);
}

/**
 * True when a failed `git checkout` just means uncommitted or untracked files
 * in the working tree would be clobbered by the branch switch. Those files are
 * a session's work in progress — the switch must yield to them, never the
 * other way around.
 */
function isBlockedByLocalWork(result: SandboxCommandResult): boolean {
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  return /Your local changes to the following files would be overwritten by checkout|untracked working tree files would be overwritten by checkout/i.test(
    output,
  );
}

/**
 * Return the origin URL when the workdir contains this repository, including a
 * legacy checkout whose remote still embeds credentials.
 */
async function existingCheckoutRemote(
  sandbox: ExecutableSandbox,
  workdir: string,
  cloneUrl: string,
): Promise<string | null> {
  const result = await execute(sandbox, 'git', ['-C', workdir, 'remote', 'get-url', 'origin']);
  if (result.exitCode !== 0) return null;
  const url = result.stdout.trim();
  const actual = normalizedRemoteUrl(url);
  const expected = normalizedRemoteUrl(cloneUrl);
  return actual !== null && expected !== null && actual === expected ? url : null;
}

/** Remove credentials persisted by an older implementation from origin. */
async function scrubRemote(
  sandbox: ExecutableSandbox,
  workdir: string,
  repoFullName: string,
  cloneUrl: string = cleanUrl(repoFullName),
): Promise<void> {
  let failure: string;
  try {
    const result = await execute(sandbox, 'git', ['-C', workdir, 'remote', 'set-url', 'origin', cloneUrl]);
    if (result.exitCode === 0) return;
    failure = result.stderr.trim() || result.stdout.trim();
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  throw new MaterializeError(`Failed to scrub installation token from git remote: ${failure}`, 'pull-failed');
}

/**
 * Turn a failed git command into an actionable error, detecting the common
 * "cannot reach github.com" egress failure.
 */
function classifyGitFailure(
  result: SandboxCommandResult,
  fallback: 'clone-failed' | 'pull-failed' | 'push-failed',
): MaterializeError {
  const stderr = result.stderr || '';
  if (/could not resolve host|failed to connect|network is unreachable|Connection timed out/i.test(stderr)) {
    return new MaterializeError(
      'The sandbox could not reach github.com. The sandbox network must allow outbound egress to github.com.',
      'egress-blocked',
    );
  }
  const verb = fallback === 'clone-failed' ? 'clone' : fallback === 'pull-failed' ? 'pull' : 'push';
  return new MaterializeError(`git ${verb} failed: ${stderr}`, fallback);
}

// ---------------------------------------------------------------------------
// Phase 1 — git identity + token-scoped push primitive
//
// These helpers let the sandbox author and push commits safely. The install
// token is short-lived, minted per-operation server-side, and supplied only to
// the Git process through its environment. It never enters argv or persistent
// repository configuration.
// ---------------------------------------------------------------------------

export { isValidGitRef };

/** Identity used to author commits inside the sandbox. */
export interface GitIdentity {
  name?: string | null;
  email?: string | null;
  /** GitHub login, used to derive a stable noreply identity when name/email are absent. */
  login?: string | null;
}

/**
 * Resolve a concrete `{ name, email }` for git authorship from a possibly-sparse
 * identity. Falls back to a GitHub-style noreply identity so commits are never
 * authored with an empty or host-derived identity.
 */
export function resolveGitIdentity(identity: GitIdentity): { name: string; email: string } {
  const login = (identity.login || '').trim();
  const name = (identity.name || '').trim() || login || 'Mastra Code';
  const email =
    (identity.email || '').trim() ||
    (login ? `${login}@users.noreply.github.com` : 'mastra-code@users.noreply.github.com');
  return { name, email };
}

/** Configure repository-local commit identity through direct Git argv calls. */
export async function configureGitIdentity(
  sandbox: ExecutableSandbox,
  workdir: string,
  identity: GitIdentity,
): Promise<void> {
  const { name, email } = resolveGitIdentity(identity);
  const setName = await execute(sandbox, 'git', ['-C', workdir, 'config', 'user.name', name]);
  if (setName.exitCode !== 0) {
    throw new MaterializeError(`Failed to set git user.name: ${setName.stderr.trim()}`, 'commit-failed');
  }
  const setEmail = await execute(sandbox, 'git', ['-C', workdir, 'config', 'user.email', email]);
  if (setEmail.exitCode !== 0) {
    throw new MaterializeError(`Failed to set git user.email: ${setEmail.stderr.trim()}`, 'commit-failed');
  }
}

async function pushAuthenticatedBranch(
  sandbox: ExecutableSandbox,
  workdir: string,
  branch: string,
  cloneUrl: string,
  token: string,
  username: string,
): Promise<void> {
  const env = gitAuthenticationEnvironment(cloneUrl, token, username, 'push-failed');
  const push = await execute(sandbox, 'git', ['-C', workdir, 'push', '-u', 'origin', branch], { env });
  if (push.exitCode !== 0) throw classifyGitFailure(push, 'push-failed');
}

/**
 * Push a branch back to GitHub with credentials scoped to the Git process.
 * The token never enters argv, a repository URL, or persistent configuration.
 */
export async function pushBranch(
  sandbox: ExecutableSandbox,
  workdir: string,
  branch: string,
  token: string,
  repoFullName: string,
): Promise<void> {
  if (!isValidGitRef(branch)) {
    throw new MaterializeError(`Refusing to push: invalid branch name '${branch}'.`, 'push-failed');
  }
  if (!/^[\w.-]+(?:\/[\w.-]+)+$/.test(repoFullName)) {
    throw new MaterializeError(`Refusing to push: invalid repo full name '${repoFullName}'.`, 'push-failed');
  }
  await pushAuthenticatedBranch(sandbox, workdir, branch, cleanUrl(repoFullName), token, 'x-access-token');
}

/**
 * Push the active session branch through the provider-neutral repository
 * access contract without persisting or exposing provider credentials.
 */
export async function pushRepositoryBranch(
  sandbox: ExecutableSandbox,
  workdir: string,
  branch: string,
  access: RepositoryAccess,
  repoFullName: string,
): Promise<void> {
  if (!isValidGitRef(branch)) {
    throw new MaterializeError(`Refusing to push: invalid branch name '${branch}'.`, 'push-failed');
  }
  if (!/^[\w.-]+(?:\/[\w.-]+)+$/.test(repoFullName)) {
    throw new MaterializeError(`Refusing to push: invalid repo full name '${repoFullName}'.`, 'push-failed');
  }
  const authorization = access.authorization;
  if (!authorization?.token) {
    throw new MaterializeError('Repository access did not include push credentials.', 'push-failed');
  }
  await pushAuthenticatedBranch(
    sandbox,
    workdir,
    branch,
    access.cloneUrl,
    authorization.token,
    authorization.username ?? 'x-access-token',
  );
}

export interface CommitResult {
  /** True when a commit was created; false when there was nothing to commit. */
  committed: boolean;
}

/**
 * Stage every change in the working tree and create a commit inside the
 * sandbox. The git identity is configured first so authorship is correct. When
 * there is nothing to commit this is a no-op (`committed: false`) rather than an
 * error, so callers can safely commit-then-push without first diffing.
 *
 * @param sandbox  the live sandbox containing the checkout
 * @param workdir  the session workdir to commit in
 * @param message  the commit message (passed as one argv value)
 * @param identity authorship identity for the commit
 */
export async function commitAll(
  sandbox: ExecutableSandbox,
  workdir: string,
  message: string,
  identity: GitIdentity,
): Promise<CommitResult> {
  await configureGitIdentity(sandbox, workdir, identity);

  const add = await execute(sandbox, 'git', ['-C', workdir, 'add', '-A']);
  if (add.exitCode !== 0) {
    throw new MaterializeError(`git add failed: ${add.stderr.trim() || add.stdout.trim()}`, 'commit-failed');
  }

  // Nothing staged → nothing to commit. `git diff --cached --quiet` exits 1 when
  // there are staged changes, 0 when the index is clean.
  const staged = await execute(sandbox, 'git', ['-C', workdir, 'diff', '--cached', '--quiet']);
  if (staged.exitCode === 0) {
    return { committed: false };
  }

  const commit = await execute(sandbox, 'git', ['-C', workdir, 'commit', '-m', message]);
  if (commit.exitCode !== 0) {
    throw new MaterializeError(`git commit failed: ${commit.stderr.trim() || commit.stdout.trim()}`, 'commit-failed');
  }

  return { committed: true };
}

// ---------------------------------------------------------------------------
// Phase 2 — setup / teardown lifecycle commands
//
// The org-configured setup and teardown shell commands run in the session's
// materialized workdir. The workdir is always resolved server-side from the
// live sandbox; client input never reaches a filesystem path.
// ---------------------------------------------------------------------------

/** Error raised when the org's setup or teardown command fails in the sandbox. */
export class SetupCommandError extends Error {
  constructor(
    message: string,
    readonly code: 'setup-failed' | 'teardown-failed',
  ) {
    super(message);
    this.name = 'SetupCommandError';
  }
}

/**
 * Run the project's setup command (e.g. `pnpm i && pnpm build`) inside the
 * freshly materialized session workdir. Called before the checkout is handed
 * to any agent run so it is ready to build/test. A non-zero exit is a hard
 * error — starting agent work in a half-set-up tree is worse than failing the
 * request.
 *
 * Security model: the command is intentionally arbitrary shell — that is the
 * feature (install deps, build, seed fixtures). It is only configurable by
 * authenticated org members (the settings route is gated by
 * `resolveOrgTenant` + org-scoped project lookup, with length and
 * control-character validation), and it executes exclusively inside the
 * project's isolated sandbox — the same environment where org members already
 * run arbitrary shell via the agent's command tool. It never runs on the web
 * server host, so it grants no privilege beyond what sandbox access already
 * provides.
 *
 * @param sandbox  live sandbox containing the checkout
 * @param workdir  the server-resolved session workdir the command runs in
 * @param command  the org-configured setup shell command
 */
async function runLifecycleCommand(
  sandbox: ExecutableSandbox,
  workdir: string,
  command: string,
  options: { phase: 'setup' | 'teardown'; timeoutMs?: number },
): Promise<void> {
  const result = await sh(sandbox, `cd ${shellQuote(workdir)} && { ${command}\n}`, {
    phase: `${options.phase} command`,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  });
  if (result.exitCode !== 0) {
    const detail = (result.stderr.trim() || result.stdout.trim()).slice(-1800);
    const label = options.phase === 'setup' ? 'Setup' : 'Teardown';
    throw new SetupCommandError(
      `${label} command failed (exit ${result.exitCode}): ${detail}`,
      options.phase === 'setup' ? 'setup-failed' : 'teardown-failed',
    );
  }
}

export async function runSetupCommand(sandbox: ExecutableSandbox, workdir: string, command: string): Promise<void> {
  return runLifecycleCommand(sandbox, workdir, command, { phase: 'setup' });
}

/**
 * Run the repository's best-effort teardown command from the materialized
 * session workdir. Callers own lifecycle policy: this helper reports failures
 * so the retirement coordinator can log them while still continuing with
 * scrub, pooling/destruction, cache invalidation, and row deletion.
 */
export async function runTeardownCommand(
  sandbox: ExecutableSandbox,
  workdir: string,
  command: string,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  return runLifecycleCommand(sandbox, workdir, command, {
    phase: 'teardown',
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  });
}

export interface CreatePullRequestArgs {
  /** Short-lived installation token, injected only into the `gh` process env. */
  token: string;
  /** Base branch the PR merges into. Ref-validated. */
  base: string;
  /** Head branch the PR is opened from. Ref-validated. */
  head: string;
  /** PR title. */
  title: string;
  /** PR body (optional). */
  body?: string;
}

export interface CreatePullRequestResult {
  /** The PR URL parsed from `gh pr create` stdout. */
  url: string;
}

/**
 * Preflight that `gh` is installed in the sandbox. Only called on the PR path so
 * a missing `gh` never blocks clone/open. Surfaces an actionable error naming
 * the sandbox template requirement.
 */
async function assertGhAvailable(sandbox: ExecutableSandbox): Promise<void> {
  const version = await execute(sandbox, 'gh', ['--version']);
  if (version.exitCode !== 0) {
    throw new MaterializeError(
      'The GitHub CLI (gh) is not installed in the sandbox. The sandbox template must include gh to open pull requests.',
      'gh-missing',
    );
  }
}

/** Match the first GitHub PR URL in `gh pr create` output. */
function parsePullRequestUrl(stdout: string): string | undefined {
  const match = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
  return match?.[0];
}

/**
 * Open a pull request from inside the sandbox via `gh pr create`. The token is
 * passed only through a per-invocation `GH_TOKEN` env scoped to the single `gh`
 * process (never persisted), all arguments are passed as structured argv, and
 * the resulting PR URL is parsed from stdout.
 *
 * @param sandbox live sandbox containing the checkout
 * @param workdir the worktree (or repo) path the PR head branch is checked out in
 */
export async function createPullRequest(
  sandbox: ExecutableSandbox,
  workdir: string,
  { token, base, head, title, body }: CreatePullRequestArgs,
): Promise<CreatePullRequestResult> {
  if (!isValidGitRef(base)) {
    throw new MaterializeError(`Refusing to open PR: invalid base branch '${base}'.`, 'pr-failed');
  }
  if (!isValidGitRef(head)) {
    throw new MaterializeError(`Refusing to open PR: invalid head branch '${head}'.`, 'pr-failed');
  }

  await assertGhAvailable(sandbox);

  const result = await execute(
    sandbox,
    'gh',
    ['pr', 'create', '--base', base, '--head', head, '--title', title, '--body', body ?? ''],
    { cwd: workdir, env: { GH_TOKEN: token } },
  );
  if (result.exitCode !== 0) {
    const classified = classifyGitFailure(result, 'push-failed');
    if (classified.code === 'egress-blocked') {
      throw classified;
    }
    throw new MaterializeError(`gh pr create failed: ${result.stderr.trim() || result.stdout.trim()}`, 'pr-failed');
  }

  const url = parsePullRequestUrl(result.stdout);
  if (!url) {
    throw new MaterializeError(
      `gh pr create succeeded but no PR URL was found in its output: ${result.stdout.trim()}`,
      'pr-failed',
    );
  }

  return { url };
}
