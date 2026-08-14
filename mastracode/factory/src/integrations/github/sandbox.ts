/**
 * Repo materialization for GitHub-backed repositories.
 *
 * A GitHub repo is never cloned onto the server host. Instead each project gets
 * its own isolated sandbox (provisioned by the fleet in `../sandbox/fleet`) and
 * the repo is cloned *inside* that sandbox. The agent's file tools and command
 * tools then operate entirely against the remote checkout.
 *
 * - `ensureProjectSandbox(row)` / `teardownProjectSandbox(row)` bind the fleet's
 *   provision/reattach/teardown lifecycle to the per-(project,user) sandbox row.
 * - `materializeRepo(row, token)` runs `git clone` (first open) or `git pull`
 *   (re-open) inside the sandbox, using a short-lived installation token that is
 *   scrubbed from the git remote afterwards so it never persists in the VM.
 *
 * This module owns everything git/GitHub: clone/pull, commit/push, worktrees,
 * and `gh pr create`. Sandbox provisioning, budgets, and workdir layout live in
 * the fleet module.
 */

import { createHash } from 'node:crypto';
import { reportProgress } from '../../sandbox/fleet.js';
import type {
  MaterializationSandbox,
  ProgressFn,
  SandboxBindingStore,
  SandboxCommandResult,
  SandboxFleet,
} from '../../sandbox/fleet.js';
import type {
  ProjectRepositorySandbox,
  SourceControlStorageHandle,
} from '../../storage/domains/source-control/base.js';
import { timedPhase } from '../../timing.js';

type SourceControlSandboxStorage = SourceControlStorageHandle['sandboxes'];
type MaterializationStore = Pick<SourceControlSandboxStorage, 'markMaterialized'>;

interface RepoMaterializationBinding {
  id: string;
  sandboxWorkdir: string;
  materializedAt: Date | null;
}

/** Adapt a per-(project,user) sandbox binding row to the fleet's persistence seam. */
function bindingStore(
  row: ProjectRepositorySandbox,
  storage: SourceControlSandboxStorage,
  seedCheckpointName?: string,
): SandboxBindingStore {
  return {
    sandboxId: row.sandboxId,
    // Boot-only fallback: fresh provisions seed from the repo base checkpoint
    // (when the builder has produced one) so materialization pulls instead of
    // cloning. Snapshots never write here.
    ...(seedCheckpointName ? { seedCheckpointName } : {}),
    setSandboxId: id =>
      id === null ? storage.clearBinding({ id: row.id }) : storage.setSandboxId({ id: row.id, sandboxId: id }),
    clear: () => storage.clearBinding({ id: row.id }),
  };
}

/**
 * Provision a new sandbox (persisting its provider id on first open) or
 * reattach to the stored one. Returns a started, live sandbox.
 */
export async function ensureProjectSandbox(options: {
  fleet: SandboxFleet;
  row: ProjectRepositorySandbox;
  storage: SourceControlSandboxStorage;
  token: string;
  onProgress?: ProgressFn;
  /** Repo base checkpoint to seed a fresh provision from (boot-only). */
  seedCheckpointName?: string;
}): Promise<MaterializationSandbox> {
  const { fleet, row, storage, token, onProgress, seedCheckpointName } = options;
  return fleet.ensureSandbox(bindingStore(row, storage, seedCheckpointName), { GH_TOKEN: token }, onProgress, {
    actingUserId: row.userId,
  });
}

/**
 * Tear down a user's sandbox for a project: stop the live VM (best-effort) and
 * clear the persisted `sandboxId`/`materializedAt` on the per-(project,user)
 * binding row so the next open re-provisions cleanly.
 *
 * @param row     the per-(project,user) sandbox binding to tear down
 * @param sandbox an already-reattached live sandbox to stop, when available
 */
export async function teardownProjectSandbox(options: {
  fleet: SandboxFleet;
  row: ProjectRepositorySandbox;
  storage: SourceControlSandboxStorage;
  sandbox?: MaterializationSandbox;
}): Promise<void> {
  const { fleet, row, storage, sandbox } = options;
  return fleet.teardownSandbox(bindingStore(row, storage), sandbox);
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
const DEFAULT_COMMAND_TIMEOUT_MS = 15 * 60_000;
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
  sandbox: MaterializationSandbox,
  script: string,
  options: ShOptions = {},
): Promise<SandboxCommandResult> {
  // One budget for the command as a whole: each attempt only gets the time
  // remaining, so transport retries can never multiply the hang guard.
  const deadlineMs = Date.now() + (options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    try {
      return await shOnce(sandbox, script, { ...options, timeoutMs: Math.max(deadlineMs - Date.now(), 1) });
    } catch (error) {
      if (attempt >= SH_RETRIES || !isTransientTransportError(error)) throw error;
      const delayMs = SH_RETRY_DELAY_MS * (attempt + 1);
      if (deadlineMs - Date.now() <= delayMs) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/** Single `sh -c` execution attempt, bounded by the hang guard. */
async function shOnce(
  sandbox: MaterializationSandbox,
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
  sandbox: MaterializationSandbox,
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
  /** The per-(project,user) sandbox binding (provisioned via `ensureProjectSandbox`). */
  row: RepoMaterializationBinding;
  /** Repo metadata from the org-owned project row. */
  repoInfo: RepoMaterializeInfo;
  /** The live sandbox to run git inside. */
  sandbox: MaterializationSandbox;
  /** A freshly minted, short-lived installation access token. */
  token: string;
  storage: MaterializationStore;
  onProgress?: ProgressFn;
  /**
   * Skip the default-branch `git pull --ff-only` when the workdir already
   * holds a checkout. Set when the checkout was just seeded from a fresh base
   * checkpoint (rebuilt on every default-branch push), where the pull is
   * redundant network cost: session work happens on a branch that
   * `checkoutSessionBranch` fetches fresh regardless.
   */
  skipPullOnExistingCheckout?: boolean;
}

/**
 * Materialize the repo inside the user's sandbox. Clones on first open, pulls on
 * re-open. Always scrubs the install token from the remote afterwards and sets
 * `materialized_at` on the per-user sandbox binding row.
 *
 */
export async function materializeRepo(options: MaterializeRepoOptions): Promise<void> {
  return timedPhase('workspace.materialize', () => materializeRepoImpl(options));
}

async function materializeRepoImpl(options: MaterializeRepoOptions): Promise<void> {
  const { row: sandboxRow, repoInfo, sandbox, token, storage, onProgress, skipPullOnExistingCheckout } = options;
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

  const authUrl = tokenUrl(repo, token);

  // The DB's `materializedAt` can drift from disk in both directions: a fresh
  // binding row over an already-populated workdir (local dev DB resets,
  // repaired rows, earlier flows) must pull instead of failing `git clone` on
  // the non-empty directory, and a stale `materializedAt` over an empty
  // sandbox (an expired/recreated VM whose disk was wiped) must re-clone
  // instead of running `git -C <workdir>` against a directory that no longer
  // exists. Disk is the source of truth: detect the checkout instead of
  // trusting the row.
  const alreadyMaterialized = await hasExistingCheckout(sandbox, workdir, repo);
  process.stderr.write(
    `[factory:timing] workspace.materialize.path ${!alreadyMaterialized ? 'clone' : skipPullOnExistingCheckout ? 'seeded-skip' : 'pull'}\n`,
  );

  let tokenInRemote = false;
  try {
    if (!alreadyMaterialized) {
      // 2a. First open: shallow-clone the default branch into the workdir. A
      // shallow single-branch clone is dramatically faster for large repos; the
      // later re-open uses `git pull --ff-only`, which works on shallow clones.
      reportProgress(onProgress, {
        phase: 'cloning',
        message: `Cloning ${repo} (first open can take a minute)…`,
      });
      // The workdir holds no usable checkout of this repo, but it may not be
      // empty: a checkpoint seed or a clone that died partway (a crashed or
      // OOM-killed server) leaves a partial tree behind, and `git clone`
      // refuses a non-empty destination with a non-retryable fatal. Nothing
      // here is recoverable — `hasExistingCheckout` already ruled out a
      // checkout of this repo — so clear it before cloning, exactly as the
      // retry path does.
      await sh(sandbox, `rm -rf ${shellQuote(workdir)}`);
      const clone = await gitTransfer(
        sandbox,
        `git clone --depth=1 --single-branch --branch ${shellQuote(repoInfo.defaultBranch)} ${shellQuote(authUrl)} ${shellQuote(workdir)}`,
        {
          phase: 'repository clone',
          beforeRetry: async attempt => {
            reportProgress(onProgress, {
              phase: 'cloning',
              message: `Lost the connection to github.com — retrying the clone (attempt ${attempt + 1})…`,
            });
            // A clone that died partway leaves the destination non-empty, which
            // git refuses to clone into. Clear it so the retry starts clean.
            await sh(sandbox, `rm -rf ${shellQuote(workdir)}`);
          },
        },
      );
      if (clone.exitCode !== 0) {
        // git can fail after creating the checkout ("Clone succeeded, but
        // checkout failed") with the tokenized origin persisted — probe the
        // disk instead of assuming the failed clone left nothing behind.
        tokenInRemote = await hasGitDir(sandbox, workdir);
        throw classifyGitFailure(clone, 'clone-failed');
      }
      tokenInRemote = true;
    } else if (skipPullOnExistingCheckout) {
      // 2b'. Checkpoint-seeded checkout: the base checkpoint is rebuilt on
      // every default-branch push, so the seeded default branch is already at
      // (or minutes behind) HEAD. Skip the network pull — the session branch
      // is fetched fresh by `checkoutSessionBranch` right after — but still
      // point origin at the token URL so that fetch can authenticate.
      const setUrl = await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(authUrl)}`);
      if (setUrl.exitCode !== 0) {
        throw new MaterializeError(`Failed to set git remote: ${setUrl.stderr}`, 'pull-failed');
      }
      tokenInRemote = true;
    } else {
      // 2b. Re-open: refresh remote to the token URL and fast-forward pull.
      reportProgress(onProgress, { phase: 'pulling', message: `Updating ${repo} to the latest changes…` });
      const setUrl = await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(authUrl)}`);
      if (setUrl.exitCode !== 0) {
        throw new MaterializeError(`Failed to set git remote: ${setUrl.stderr}`, 'pull-failed');
      }
      tokenInRemote = true;
      const pull = await gitTransfer(sandbox, `git -C ${shellQuote(workdir)} pull --ff-only`, {
        phase: 'repository pull',
        beforeRetry: async attempt =>
          reportProgress(onProgress, {
            phase: 'pulling',
            message: `Lost the connection to github.com — retrying the update (attempt ${attempt + 1})…`,
          }),
      });
      if (pull.exitCode !== 0) {
        if (!isBenignNonFastForward(pull)) {
          throw classifyGitFailure(pull, 'pull-failed');
        }
        // The workdir was left on a session's working branch that can't be
        // fast-forwarded (diverged from upstream, no upstream, or detached
        // HEAD), or its configured upstream ref was deleted after merge.
        // That checkout still holds usable work — never rebase or reset it
        // here. Leave it as-is and let the session reconcile with the remote
        // itself.
        reportProgress(onProgress, {
          phase: 'pulling',
          message: isDeletedUpstreamRef(pull)
            ? 'Workspace could not be updated from its remote — keeping the existing checkout as-is.'
            : 'Workspace has local changes that diverge from the remote — keeping them as-is.',
        });
      }
    }
  } catch (primary) {
    // 3a. The clone/pull failed — still scrub the token from the VM's git
    // config. The scrub must never hide the actionable failure, but once the
    // token reached the remote its own failure can't stay silent either:
    // report both, primary cause and classification first.
    throw await scrubbedFailure(sandbox, workdir, repo, tokenInRemote, primary, 'pull-failed');
  }

  // 3b. Success — the token is in the remote and the workdir has a `.git`, so
  // a failed scrub means the token may still be persisted: surface it.
  await scrubRemote(sandbox, workdir, repo, tokenInRemote);

  // 4. Mark materialized.
  reportProgress(onProgress, { phase: 'finalizing', message: 'Finalizing workspace…' });
  await storage.markMaterialized({ id: sandboxRow.id });
}

/**
 * Reset a pooled workdir that a new session just claimed: the previous
 * session's branch and dirty state must not leak into the new session, so
 * force-checkout the default branch and drop all local modifications. When
 * the claimed VM was reaped and re-provisioned there is no checkout yet and
 * this is a no-op (the clone path handles it). A wedged checkout falls back
 * to wiping the workdir so `materializeRepo` re-clones inside the same VM
 * instead of permanently failing the session.
 */
export async function recycleClaimedWorkdir(
  sandbox: MaterializationSandbox,
  workdir: string,
  defaultBranch: string,
): Promise<void> {
  if (!/^[A-Za-z0-9_./-]+$/.test(defaultBranch)) {
    throw new MaterializeError(`Refusing to recycle: invalid default branch '${defaultBranch}'.`, 'clone-failed');
  }
  const w = shellQuote(workdir);
  const inspect = await sh(sandbox, `git -C ${w} rev-parse --is-inside-work-tree`);
  if (inspect.exitCode !== 0) return;
  const recycle = await sh(
    sandbox,
    // `-x` also drops gitignored files (.env, build caches) so no session
    // state survives into the next claim.
    `git -C ${w} checkout -f ${shellQuote(defaultBranch)} && git -C ${w} reset --hard && git -C ${w} clean -fdx`,
    { phase: 'claimed workdir recycle' },
  );
  if (recycle.exitCode === 0) return;
  const wipe = await sh(sandbox, `rm -rf ${w}`);
  if (wipe.exitCode !== 0) {
    throw new MaterializeError(`Failed to recycle claimed sandbox workdir: ${recycle.stderr}`, 'clone-failed');
  }
}

/** Check out a session's branch inside its isolated repository clone. */
export async function checkoutSessionBranch(
  sandbox: MaterializationSandbox,
  workdir: string,
  options: { branch: string; baseBranch: string; token: string; repoFullName: string },
): Promise<void> {
  return timedPhase('workspace.checkout', () => checkoutSessionBranchImpl(sandbox, workdir, options));
}

async function checkoutSessionBranchImpl(
  sandbox: MaterializationSandbox,
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
    const setUrl = await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(authUrl)}`);
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
      throw classifyGitFailure(fetch, 'clone-failed');
    }
  } finally {
    await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(cleanUrl(repoFullName))}`);
  }
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
 * True when the workdir already holds a git checkout whose `origin` points at
 * this exact repo. Matches both the clean and token-auth URL forms; any other
 * remote (or no git dir at all) falls back to the clone path.
 */
export async function hasExistingCheckout(
  sandbox: MaterializationSandbox,
  workdir: string,
  repoFullName: string,
): Promise<boolean> {
  const result = await sh(sandbox, `git -C ${shellQuote(workdir)} remote get-url origin`);
  if (result.exitCode !== 0) return false;
  const url = result.stdout.trim().toLowerCase();
  const suffix = `github.com/${repoFullName.toLowerCase()}`;
  return url.endsWith(`${suffix}.git`) || url.endsWith(suffix);
}

/** Probed without `git -C` so a missing workdir returns false instead of throwing. */
async function hasGitDir(sandbox: MaterializationSandbox, workdir: string): Promise<boolean> {
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
  sandbox: MaterializationSandbox,
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
  sandbox: MaterializationSandbox,
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
 * True when a failed `git pull --ff-only` on re-open just means the current
 * branch can't be fast-forwarded — not that anything is broken. The shared
 * workdir is routinely left on a session's working branch, which may have
 * local commits diverging from upstream, no upstream at all (session branches
 * are created from `FETCH_HEAD`), or a detached HEAD. A checkout can also
 * hold uncommitted or untracked files (a build or script run left residue,
 * or an older session worked directly in the shared checkout), which makes
 * git refuse the merge outright. A checkout carrying `pull.rebase` in its git
 * config refuses for the same reason but says so in rebase's words instead of
 * merge's. After a PR merges with branch auto-delete, the configured upstream
 * ref may also be gone (`no such ref was fetched` / `couldn't find remote ref`);
 * there is nothing to pull and the checkout is still intact. In all of these
 * cases materialization must keep it as-is rather than fail the workspace open
 * — and must never discard the local state to force the pull through.
 */
function isDeletedUpstreamRef(result: SandboxCommandResult): boolean {
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  return /no such ref was fetched|couldn't find remote ref/i.test(output);
}

function isBenignNonFastForward(result: SandboxCommandResult): boolean {
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  return (
    isDeletedUpstreamRef(result) ||
    /Not possible to fast-forward|Diverging branches can't be fast-forwarded|no tracking information for the current branch|You are not currently on a branch|Your local changes to the following files would be overwritten by merge|untracked working tree files would be overwritten by merge|cannot pull with rebase|cannot rebase: You have unstaged changes|Your index contains uncommitted changes/i.test(
      output,
    )
  );
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
  sandbox: MaterializationSandbox,
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
  sandbox: MaterializationSandbox,
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
  sandbox: MaterializationSandbox,
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
 * @param workdir  the worktree (or repo) path to commit in
 * @param message  the commit message (quoted; arbitrary text is safe)
 * @param identity authorship identity for the commit
 */
export async function commitAll(
  sandbox: MaterializationSandbox,
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
// Phase 2 — worktree / branch lifecycle
//
// Each unit of work gets its own branch + working tree inside the same sandbox
// as the base checkout. The worktree path is always computed server-side from a
// sanitized branch name; client input never reaches a filesystem path.
// ---------------------------------------------------------------------------

/** Error raised when a worktree cannot be created/reused inside the sandbox. */
export class WorktreeError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-branch' | 'worktree-failed' | 'setup-failed',
  ) {
    super(message);
    this.name = 'WorktreeError';
  }
}

/**
 * Reduce a (already ref-validated) branch name to a filesystem-safe directory
 * segment for the worktree path: slashes/dots/unsafe chars collapsed to `-`.
 * This only affects the *directory name*, never the git branch itself.
 *
 * Sanitization is lossy (e.g. `feat/a` and `feat-a` both reduce to `feat-a`),
 * so an 8-char hash of the original branch is appended whenever the sanitized
 * form differs from the input. That keeps clean names (`main`) readable while
 * guaranteeing distinct branches never share a worktree directory.
 */
export function safeBranchDir(branch: string): string {
  const sanitized =
    branch
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/\/+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 100) || 'work';
  if (sanitized === branch) return sanitized;
  const hash = createHash('sha256').update(branch).digest('hex').slice(0, 8);
  return `${sanitized}-${hash}`;
}

/**
 * Compute the absolute worktree path for a branch, server-side only. Worktrees
 * live alongside the repo checkout under a sibling `worktrees/` directory so the
 * repo's `.git` is shared. Never derived from client-supplied paths.
 */
export function computeWorktreePath(repoWorkdir: string, branch: string): string {
  const parent = repoWorkdir.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || '';
  return `${parent}/worktrees/${safeBranchDir(branch)}`;
}

export interface EnsureWorktreeResult {
  worktreePath: string;
  branch: string;
  baseBranch: string;
  /** True when an existing worktree was reused rather than freshly created. */
  reused: boolean;
}

/**
 * Create (or reuse) a git worktree + branch inside the sandbox for a unit of
 * work. Idempotent: if a worktree already exists at the computed path it is
 * reused. The branch is created from the freshly fetched `origin/<baseBranch>`
 * — never the sandbox's possibly stale local ref — so new worktrees always
 * start from the latest remote state.
 *
 * @param sandbox       live sandbox containing the base checkout
 * @param repoWorkdir   the base repo checkout path inside the sandbox
 * @param branch        the feature branch (ref-validated server-side)
 * @param baseBranch    the branch to fork from (ref-validated; defaults to the repo's default branch)
 * @param token         short-lived installation token used only for the base-branch fetch
 * @param repoFullName  `owner/repo` used to build the tokenized remote URL
 */
export async function ensureWorktree(
  sandbox: MaterializationSandbox,
  repoWorkdir: string,
  {
    branch,
    baseBranch,
    token,
    repoFullName,
  }: { branch: string; baseBranch: string; token: string; repoFullName: string },
): Promise<EnsureWorktreeResult> {
  if (!isValidGitRef(branch)) {
    throw new WorktreeError(`Invalid branch name '${branch}'.`, 'invalid-branch');
  }
  if (!isValidGitRef(baseBranch)) {
    throw new WorktreeError(`Invalid base branch name '${baseBranch}'.`, 'invalid-branch');
  }

  const worktreePath = computeWorktreePath(repoWorkdir, branch);

  // Idempotent reuse: a worktree already checked out at this path has a `.git`
  // file (worktrees use a gitfile, not a directory). Reuse it as-is.
  const exists = await sh(sandbox, `test -e ${shellQuote(`${worktreePath}/.git`)}`);
  if (exists.exitCode === 0) {
    return { worktreePath, branch, baseBranch, reused: true };
  }

  // Fetch the latest base ref from origin before forking. The explicit refspec
  // updates `refs/remotes/origin/<base>` even when the checkout was created as
  // a single-branch clone. The fetch needs the install token (the resting
  // remote is tokenless), and a failure is a hard error — silently forking a
  // stale local ref is worse than failing the request.
  const baseRef = `origin/${baseBranch}`;
  await withInstallToken(sandbox, repoWorkdir, repoFullName, token, async () => {
    const fetch = await sh(
      sandbox,
      `git -C ${shellQuote(repoWorkdir)} fetch origin ${shellQuote(`+refs/heads/${baseBranch}:refs/remotes/${baseRef}`)}`,
    );
    if (fetch.exitCode !== 0) {
      throw classifyGitFailure(fetch, 'pull-failed');
    }
  });

  // Create the worktree. If the branch already exists, check it out into the
  // worktree; otherwise create it from the fetched base. `git worktree add -B`
  // creates-or-resets the branch to the base, which keeps this idempotent for a
  // fresh worktree while still working when the branch already exists remotely.
  // `--no-track` keeps the feature branch from tracking origin/<base>; pushes
  // set their own upstream via `push -u`.
  const add = await sh(
    sandbox,
    `git -C ${shellQuote(repoWorkdir)} worktree add --no-track -B ${shellQuote(branch)} ${shellQuote(worktreePath)} ${shellQuote(baseRef)}`,
  );
  if (add.exitCode !== 0) {
    throw new WorktreeError(`git worktree add failed: ${add.stderr.trim() || add.stdout.trim()}`, 'worktree-failed');
  }

  return { worktreePath, branch, baseBranch, reused: false };
}

/**
 * Run the project's setup command (e.g. `pnpm i && pnpm build`) inside a
 * freshly created worktree. Called before the worktree is handed to any agent
 * run so the checkout is ready to build/test. A non-zero exit is a hard error —
 * starting agent work in a half-set-up tree is worse than failing the request.
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
 * @param sandbox       live sandbox containing the worktree
 * @param worktreePath  the server-computed worktree path the command runs in
 * @param command       the org-configured setup shell command
 */
export async function runWorktreeSetup(
  sandbox: MaterializationSandbox,
  worktreePath: string,
  command: string,
): Promise<void> {
  const result = await sh(sandbox, `cd ${shellQuote(worktreePath)} && { ${command}\n}`, { phase: 'worktree setup' });
  if (result.exitCode !== 0) {
    const detail = (result.stderr.trim() || result.stdout.trim()).slice(-2000);
    throw new WorktreeError(`Setup command failed (exit ${result.exitCode}): ${detail}`, 'setup-failed');
  }
}

/**
 * Remove a worktree (and its local feature branch) from the sandbox. The
 * checkout is removed with `--force` — the caller owns confirming that any
 * uncommitted work in it can be discarded. Idempotent: a worktree whose
 * directory is already gone only has its metadata pruned.
 *
 * @param sandbox       live sandbox containing the base checkout
 * @param repoWorkdir   the base repo checkout path inside the sandbox
 * @param branch        the worktree's feature branch (ref-validated)
 * @param worktreePath  the persisted, server-computed worktree path
 */
export async function removeWorktree(
  sandbox: MaterializationSandbox,
  repoWorkdir: string,
  { branch, worktreePath }: { branch: string; worktreePath: string },
): Promise<void> {
  if (!isValidGitRef(branch)) {
    throw new WorktreeError(`Invalid branch name '${branch}'.`, 'invalid-branch');
  }

  const remove = await sh(
    sandbox,
    `git -C ${shellQuote(repoWorkdir)} worktree remove --force ${shellQuote(worktreePath)}`,
  );
  if (remove.exitCode !== 0) {
    // Tolerate a checkout that's already gone (e.g. a fresh sandbox after
    // re-provisioning): prune stale metadata and only fail when the directory
    // still exists, meaning git genuinely refused to remove it.
    await sh(sandbox, `git -C ${shellQuote(repoWorkdir)} worktree prune`);
    const exists = await sh(sandbox, `test -e ${shellQuote(worktreePath)}`);
    if (exists.exitCode === 0) {
      throw new WorktreeError(
        `git worktree remove failed: ${remove.stderr.trim() || remove.stdout.trim()}`,
        'worktree-failed',
      );
    }
  }

  // Best-effort local branch cleanup; the branch may not exist locally anymore
  // or may still be pushed remotely — neither should fail the removal.
  await sh(sandbox, `git -C ${shellQuote(repoWorkdir)} branch -D ${shellQuote(branch)}`);
}

// ---------------------------------------------------------------------------
// Phase 3 — `gh` CLI pull-request creation primitive
//
// PRs are opened from inside the sandbox with the GitHub CLI. `gh` must be
// present in the sandbox template (preflighted only on the PR path so clone /
// open still work when it is absent). The token is passed to `gh` via a
// per-invocation `GH_TOKEN` env that is scoped to the single `gh` process and
// never written to git config, a shell rc, or the VM's environment.
// ---------------------------------------------------------------------------

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
async function assertGhAvailable(sandbox: MaterializationSandbox): Promise<void> {
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
  sandbox: MaterializationSandbox,
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
