/**
 * Repo materialization for GitHub-backed repositories.
 *
 * A GitHub repo is never cloned onto the server host. The repo is cloned
 * *inside* the session's sandbox, so the agent's file tools and command tools
 * operate entirely against the remote checkout.
 *
 * - `materializeRepo(row, token)` clones the repo inside the sandbox when no
 *   checkout exists yet (a base-image boot, a wiped disk), using a short-lived
 *   installation token that is scrubbed from the git remote afterwards so it
 *   never persists in the VM. A checkout that is already there, from a repo
 *   template image or an earlier start, is left exactly as it is.
 *
 * This module owns everything git/GitHub: clone, commit/push, setup/teardown commands,
 * and `gh pr create`. Workdir layout lives in `../sandbox/workdir`.
 */

import { repoCloneCommand } from '@internal/workspace';
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
 * Run a shell script in the sandbox via `sh -c`, bounded by a hang guard.
 * Transient transport-level 5xx failures (proxy hiccups while the VM boots)
 * are retried with a short backoff; every script routed through here is safe
 * to re-run. Hang-guard timeouts are NOT retried — the budget applies to the
 * command as a whole.
 */
export async function sh(
  sandbox: ExecutableSandbox,
  script: string,
  options: ShOptions = {},
): Promise<SandboxCommandResult> {
  // One budget for the command as a whole: each attempt only gets the time
  // remaining, so transport retries can never multiply the hang guard.
  const deadlineMs = Date.now() + (options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    const started = performance.now();
    try {
      const result = await shOnce(sandbox, script, { ...options, timeoutMs: Math.max(deadlineMs - Date.now(), 1) });
      // Phased commands are the session start path; report each so a slow
      // start names the command that took the time rather than the phase.
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

/** Single `sh -c` execution attempt, bounded by the hang guard. */
async function shOnce(
  sandbox: ExecutableSandbox,
  script: string,
  options: ShOptions,
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
    // Forward the budget to the provider too so it can terminate the wedged
    // process; the race stays as the outer guard for providers that ignore it.
    return await Promise.race([sandbox.executeCommand('sh', ['-c', script], { timeout: timeoutMs }), hangGuard]);
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
  script: string,
  options: ShOptions & { beforeRetry?: (attempt: number) => Promise<void> } = {},
): Promise<SandboxCommandResult> {
  const { beforeRetry, ...shOptions } = options;
  const deadlineMs = Date.now() + (shOptions.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    const result = await sh(sandbox, script, {
      ...shOptions,
      timeoutMs: Math.max(deadlineMs - Date.now(), 1),
    });
    if (result.exitCode === 0 || attempt >= GIT_TRANSFER_RETRIES || !isTransientGitFailure(result)) return result;
    process.stderr.write(`[factory:timing] git ${shOptions.phase ?? 'transfer'} retrying after attempt ${attempt + 1}\n`);
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

/**
 * Build the token-auth clone/pull URL for a repo. The token lives only inside
 * this URL and is scrubbed from the remote after the operation.
 */
function tokenUrl(repoFullName: string, token: string): string {
  return `https://x-access-token:${token}@github.com/${repoFullName}.git`;
}

function cleanUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}.git`;
}

/** Repo metadata needed to materialize, read from the org-owned project row. */
export interface RepoMaterializeInfo {
  repoFullName: string;
  defaultBranch: string;
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

/**
 * Materialize the repo inside the user's sandbox: clone when no checkout of
 * this repo exists, otherwise nothing. Scrubs the install token from the
 * remote after a clone and sets `materialized_at` on the per-user sandbox
 * binding row.
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
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new MaterializeError(`Refusing to materialize: invalid repo full name '${repo}'.`, 'clone-failed');
  }
  if (!/^[A-Za-z0-9_./-]+$/.test(repoInfo.defaultBranch)) {
    throw new MaterializeError(
      `Refusing to materialize: invalid default branch '${repoInfo.defaultBranch}'.`,
      'clone-failed',
    );
  }

  // 1. Preflight: git must be installed in the sandbox template.
  const gitVersion = await sh(sandbox, 'git --version');
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
  const existing = await existingCheckoutRemote(sandbox, workdir, repo);
  if (existing !== null) {
    // A token an earlier start failed to scrub must not outlive it; the
    // remote already carries the plain URL otherwise, so this costs nothing
    // on the common path.
    if (/\/\/[^/]*@/.test(existing)) await scrubRemote(sandbox, workdir, repo, true);
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
    await sh(
      sandbox,
      `mkdir -p ${shellQuote(workdir)} && find ${shellQuote(workdir)} -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +`,
    );
    let tokenInRemote = false;
    try {
      const clone = await gitTransfer(
        sandbox,
        repoCloneCommand({ cloneUrl: tokenUrl(repo, token), destination: workdir, branch: repoInfo.defaultBranch }),
        {
          phase: 'repository clone',
          beforeRetry: async () => {
            // A clone that died partway leaves the destination non-empty, which
            // git refuses to clone into. Clear its contents so the retry starts
            // clean without removing LocalSandbox's process cwd.
            await sh(
              sandbox,
              `mkdir -p ${shellQuote(workdir)} && find ${shellQuote(workdir)} -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +`,
            );
          },
        },
      );
      if (clone.exitCode !== 0) {
        // git can fail after creating the checkout ("Clone succeeded, but
        // checkout failed") with the tokenized origin persisted: probe the
        // disk instead of assuming the failed clone left nothing behind.
        tokenInRemote = await hasGitDir(sandbox, workdir);
        throw classifyGitFailure(clone, 'clone-failed');
      }
      tokenInRemote = true;
    } catch (primary) {
      // 3a. The clone failed: still scrub the token from the VM's git config.
      // The scrub must never hide the actionable failure, but once the token
      // reached the remote its own failure can't stay silent either: report
      // both, primary cause and classification first.
      throw await scrubbedFailure(sandbox, workdir, repo, tokenInRemote, primary, 'clone-failed');
    }

    // 3b. Success: the token is in the remote and the workdir has a `.git`, so
    // a failed scrub means the token may still be persisted: surface it.
    await scrubRemote(sandbox, workdir, repo, tokenInRemote);
  }

  // 4. Mark materialized.
  await storage.markMaterialized({ id: sandboxRow.id });
}

/** Check out a session's branch inside its isolated repository clone. */
export async function checkoutSessionBranch(
  sandbox: ExecutableSandbox,
  workdir: string,
  options: { branch: string; baseBranch: string; token: string; repoFullName: string },
): Promise<void> {
  return timedPhase('workspace.checkout', () => checkoutSessionBranchImpl(sandbox, workdir, options));
}

async function checkoutSessionBranchImpl(
  sandbox: ExecutableSandbox,
  workdir: string,
  {
    branch,
    baseBranch,
    token,
    repoFullName,
  }: { branch: string; baseBranch: string; token: string; repoFullName: string },
): Promise<void> {
  if (!isValidGitRef(branch) || !isValidGitRef(baseBranch)) {
    throw new MaterializeError('Refusing to create a session from an invalid branch name.', 'clone-failed');
  }

  const current = await sh(sandbox, `git -C ${shellQuote(workdir)} branch --show-current`);
  if (current.exitCode === 0 && current.stdout.trim() === branch) return;

  const local = await sh(
    sandbox,
    `git -C ${shellQuote(workdir)} show-ref --verify --quiet refs/heads/${shellQuote(branch)}`,
  );
  if (local.exitCode === 0) {
    const checkout = await sh(sandbox, `git -C ${shellQuote(workdir)} checkout ${shellQuote(branch)}`);
    if (checkout.exitCode !== 0) {
      // The session's agent may have switched branches itself (e.g. `gh pr
      // checkout`) and left uncommitted work in the tree. Git refuses to
      // switch back over those files — that work must win. The checkout is
      // intact and usable on its current branch; keep it as-is rather than
      // fail the workspace open, and never reset or stash to force the
      // switch through.
      if (isBlockedByLocalWork(checkout)) return;
      throw classifyGitFailure(checkout, 'clone-failed');
    }
    return;
  }

  const authUrl = tokenUrl(repoFullName, token);
  try {
    const setUrl = await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(authUrl)}`, {
      phase: 'branch checkout remote',
    });
    if (setUrl.exitCode !== 0) throw classifyGitFailure(setUrl, 'pull-failed');
    const fetch = await sh(
      sandbox,
      `git -C ${shellQuote(workdir)} fetch origin ${shellQuote(baseBranch)} && git -C ${shellQuote(workdir)} checkout -b ${shellQuote(branch)} FETCH_HEAD`,
      { timeoutMs: CHECKOUT_COMMAND_TIMEOUT_MS, phase: 'branch checkout' },
    );
    if (fetch.exitCode !== 0) {
      // Same rule as above: uncommitted work in the tree blocks the switch
      // to the new branch. Leave the checkout on its current branch.
      if (isBlockedByLocalWork(fetch)) return;
      if (!isBranchCollision(fetch)) throw classifyGitFailure(fetch, 'clone-failed');
      // The branch exists even though the show-ref probe missed it: either a
      // concurrent materialization of this session created it between the
      // probe and `checkout -b` (adopt it), or a reused sandbox carries a
      // broken loose ref the probe cannot resolve (replace it and retry —
      // "already exists" means the fetch half succeeded, so FETCH_HEAD is
      // set).
      const adopt = await sh(sandbox, `git -C ${shellQuote(workdir)} checkout ${shellQuote(branch)}`);
      if (adopt.exitCode === 0 || isBlockedByLocalWork(adopt)) return;
      const drop = await sh(
        sandbox,
        // `--no-deref` so a broken symref is deleted itself instead of git
        // following it to some other branch. `update-ref -d` can still refuse
        // a broken ref; fall back to removing the loose ref file (branch
        // passed isValidGitRef, so the interpolation inside the double quotes
        // is inert).
        `git -C ${shellQuote(workdir)} update-ref --no-deref -d refs/heads/${shellQuote(branch)} || rm -f -- "$(git -C ${shellQuote(workdir)} rev-parse --absolute-git-dir)/refs/heads/${branch}"`,
      );
      if (drop.exitCode !== 0) throw classifyGitFailure(fetch, 'clone-failed');
      const retry = await sh(sandbox, `git -C ${shellQuote(workdir)} checkout -b ${shellQuote(branch)} FETCH_HEAD`, {
        timeoutMs: CHECKOUT_COMMAND_TIMEOUT_MS,
        phase: 'branch checkout retry',
      });
      if (retry.exitCode !== 0) {
        if (isBlockedByLocalWork(retry)) return;
        throw classifyGitFailure(retry, 'clone-failed');
      }
    }
  } finally {
    await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(cleanUrl(repoFullName))}`);
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
 * The `origin` URL of a checkout of this exact repo in the workdir, or null
 * when there is none. Matches both the clean and token-auth URL forms; any
 * other remote (or no git dir at all) sends materialize down the clone path.
 */
async function existingCheckoutRemote(
  sandbox: ExecutableSandbox,
  workdir: string,
  repoFullName: string,
): Promise<string | null> {
  const result = await sh(sandbox, `git -C ${shellQuote(workdir)} remote get-url origin`);
  if (result.exitCode !== 0) return null;
  const url = result.stdout.trim();
  return isRemoteForRepo(url, repoFullName) ? url : null;
}

/** True only for `https://github.com/<repo>[.git]`, with or without embedded credentials. */
function isRemoteForRepo(url: string, repoFullName: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') return false;
  if (parsed.port !== '' || parsed.search !== '' || parsed.hash !== '') return false;
  return parsed.pathname.replace(/\.git$/, '').toLowerCase() === `/${repoFullName.toLowerCase()}`;
}

/** Probed without `git -C` so a missing workdir returns false instead of throwing. */
async function hasGitDir(sandbox: ExecutableSandbox, workdir: string): Promise<boolean> {
  const probe = await sh(sandbox, `test -d ${shellQuote(`${workdir}/.git`)}`).catch(() => null);
  return probe?.exitCode === 0;
}

/**
 * Reset the git remote back to the tokenless URL. Strict when the token
 * reached the remote: any failure — a non-zero exit or a provider throw —
 * means the token may still be persisted, so it is thrown for the caller to
 * surface. Best-effort when it never did: the workdir may not exist (e.g. a
 * failed clone), which makes providers that spawn with `cwd` throw rather
 * than return a non-zero exit code; both outcomes are tolerated so neither
 * masks the primary failure.
 */
async function scrubRemote(
  sandbox: ExecutableSandbox,
  workdir: string,
  repoFullName: string,
  tokenInRemote: boolean,
): Promise<void> {
  const scrub = `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(cleanUrl(repoFullName))}`;
  if (!tokenInRemote) {
    await sh(sandbox, scrub).catch(() => undefined);
    return;
  }
  let failure: string;
  try {
    const result = await sh(sandbox, scrub);
    if (result.exitCode === 0) return;
    failure = result.stderr.trim() || result.stdout.trim();
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  throw new MaterializeError(`Failed to scrub installation token from git remote: ${failure}`, 'pull-failed');
}

/**
 * Scrub after `primary` already failed and return the error to throw. A failed
 * scrub is appended to `primary` rather than replacing it, so the caller gets
 * the error it would have had without the scrub — same class, same `code` —
 * carrying the leaked-token warning in its message.
 */
async function scrubbedFailure(
  sandbox: ExecutableSandbox,
  workdir: string,
  repoFullName: string,
  tokenInRemote: boolean,
  primary: unknown,
  fallback: MaterializeError['code'],
): Promise<unknown> {
  try {
    await scrubRemote(sandbox, workdir, repoFullName, tokenInRemote);
    return primary;
  } catch (scrubError) {
    const scrubMessage = scrubError instanceof Error ? scrubError.message : String(scrubError);
    if (!(primary instanceof Error)) {
      return new MaterializeError(`${String(primary)} — additionally: ${scrubMessage}`, fallback);
    }
    primary.message = `${primary.message} — additionally: ${scrubMessage}`;
    return primary;
  }
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
// token is short-lived, minted per-operation server-side, injected only into
// the temporary remote URL inside the sandbox, and always scrubbed afterwards
// so it never persists in `.git/config`.
// ---------------------------------------------------------------------------

/**
 * Validate a git ref (branch) name. Server-side defense-in-depth: only allow a
 * conservative character set so a branch can never be built into a shell
 * command in a way that escapes quoting. Mirrors the route-layer check.
 */
export function isValidGitRef(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    // Reject leading-dash refs (e.g. `--mirror`) so the value can never be
    // parsed as a git option when interpolated into a command.
    !value.startsWith('-') &&
    /^[A-Za-z0-9_./-]+$/.test(value)
  );
}

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

/**
 * Configure `user.name` / `user.email` for the given repo working tree inside
 * the sandbox so commits are authored correctly. Values are shell-quoted.
 */
export async function configureGitIdentity(
  sandbox: ExecutableSandbox,
  workdir: string,
  identity: GitIdentity,
): Promise<void> {
  const { name, email } = resolveGitIdentity(identity);
  const setName = await sh(sandbox, `git -C ${shellQuote(workdir)} config user.name ${shellQuote(name)}`);
  if (setName.exitCode !== 0) {
    throw new MaterializeError(`Failed to set git user.name: ${setName.stderr.trim()}`, 'commit-failed');
  }
  const setEmail = await sh(sandbox, `git -C ${shellQuote(workdir)} config user.email ${shellQuote(email)}`);
  if (setEmail.exitCode !== 0) {
    throw new MaterializeError(`Failed to set git user.email: ${setEmail.stderr.trim()}`, 'commit-failed');
  }
}

/**
 * Temporarily rewrite `origin` to a tokenized URL, run `fn` (e.g. a push), and
 * **always** scrub the remote back to the tokenless URL afterwards. The token
 * therefore only ever lives in the remote URL for the duration of the
 * operation and is never left in the VM's git config.
 *
 * Once the tokenized URL is installed a failed scrub may leave the token
 * persisted, so it is always surfaced: on its own after a successful `fn`,
 * appended to `fn`'s own error otherwise — `fn`'s error is never replaced.
 * Only a failed set-url (the token never reached the remote) downgrades the
 * scrub to best-effort.
 */
export async function withInstallToken<T>(
  sandbox: ExecutableSandbox,
  workdir: string,
  repoFullName: string,
  token: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repoFullName)) {
    throw new MaterializeError(`Refusing to push: invalid repo full name '${repoFullName}'.`, 'push-failed');
  }

  const setUrl = await sh(
    sandbox,
    `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(tokenUrl(repoFullName, token))}`,
  );
  if (setUrl.exitCode !== 0) {
    // Best-effort scrub even though set-url failed, then surface the failure.
    await scrubRemote(sandbox, workdir, repoFullName, false);
    throw new MaterializeError(`Failed to set git remote: ${setUrl.stderr.trim()}`, 'push-failed');
  }

  let result: T;
  try {
    result = await fn();
  } catch (primary) {
    throw await scrubbedFailure(sandbox, workdir, repoFullName, true, primary, 'push-failed');
  }
  // Restore the tokenless remote. The workdir has a `.git` (we just rewrote
  // its remote) so a scrub failure means the token may still persist — surface it.
  await scrubRemote(sandbox, workdir, repoFullName, true);
  return result;
}

/**
 * Push a branch back to GitHub from inside the sandbox using a short-lived
 * installation token. The branch is ref-validated, the token is injected only
 * into the remote URL via `withInstallToken`, and egress failures are
 * classified into actionable errors.
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

  await withInstallToken(sandbox, workdir, repoFullName, token, async () => {
    const push = await sh(sandbox, `git -C ${shellQuote(workdir)} push -u origin ${shellQuote(branch)}`);
    if (push.exitCode !== 0) {
      throw classifyGitFailure(push, 'push-failed');
    }
  });
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
 * @param message  the commit message (quoted; arbitrary text is safe)
 * @param identity authorship identity for the commit
 */
export async function commitAll(
  sandbox: ExecutableSandbox,
  workdir: string,
  message: string,
  identity: GitIdentity,
): Promise<CommitResult> {
  await configureGitIdentity(sandbox, workdir, identity);

  const add = await sh(sandbox, `git -C ${shellQuote(workdir)} add -A`);
  if (add.exitCode !== 0) {
    throw new MaterializeError(`git add failed: ${add.stderr.trim() || add.stdout.trim()}`, 'commit-failed');
  }

  // Nothing staged → nothing to commit. `git diff --cached --quiet` exits 1 when
  // there are staged changes, 0 when the index is clean.
  const staged = await sh(sandbox, `git -C ${shellQuote(workdir)} diff --cached --quiet`);
  if (staged.exitCode === 0) {
    return { committed: false };
  }

  const commit = await sh(sandbox, `git -C ${shellQuote(workdir)} commit -m ${shellQuote(message)}`);
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

export async function runSetupCommand(
  sandbox: ExecutableSandbox,
  workdir: string,
  command: string,
): Promise<void> {
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
  const version = await sh(sandbox, 'gh --version');
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
 * process (never persisted), all arguments are shell-quoted, and the resulting
 * PR URL is parsed from stdout.
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

  // GH_TOKEN is prefixed inline so it is exported only to the single `gh`
  // process and never to the wider shell session, git config, or VM env. `gh`
  // is run from inside the checkout so it targets the correct repo/head branch.
  const ghCommand = [
    `GH_TOKEN=${shellQuote(token)} gh pr create`,
    `--base ${shellQuote(base)}`,
    `--head ${shellQuote(head)}`,
    `--title ${shellQuote(title)}`,
    `--body ${shellQuote(body ?? '')}`,
  ].join(' ');
  const script = `cd ${shellQuote(workdir)} && ${ghCommand}`;

  const result = await sh(sandbox, script);
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
