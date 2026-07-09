/**
 * Sandbox provisioning + repo materialization for GitHub-backed projects.
 *
 * A GitHub repo is never cloned onto the server host. Instead each project gets
 * its own isolated cloud sandbox (a `MastraSandbox`, e.g. a Railway VM) and the
 * repo is cloned *inside* that sandbox. The agent's file tools and command tools
 * then operate entirely against the remote checkout.
 *
 * - `ensureProjectSandbox(row)` provisions a new sandbox (persisting its provider
 *   id so re-opens reattach) or reattaches to the stored one.
 * - `materializeRepo(row, token)` runs `git clone` (first open) or `git pull`
 *   (re-open) inside the sandbox, using a short-lived installation token that is
 *   scrubbed from the git remote afterwards so it never persists in the VM.
 *
 * The Railway sandbox is constructed behind a swappable factory so tests can
 * inject a fake sandbox and other providers can be added later.
 */

import { createHash } from 'node:crypto';
import { RailwaySandbox } from '@mastra/railway';
import { eq } from 'drizzle-orm';
import { getAppDb } from './db';
import { getLocalSandboxRoot, LocalSandbox } from './local-sandbox';
import { githubProjectSandboxes } from './schema';
import type { GithubProjectSandboxRow } from './schema';

/** Minimal command result shape we depend on. */
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Minimal live-sandbox surface this module needs: an id, a way to start it, a
 * way to learn the provider's reattach id, and command execution.
 */
export interface MaterializationSandbox {
  readonly id: string;
  start(): Promise<void>;
  getInfo(): Promise<{ metadata?: Record<string, unknown> }>;
  executeCommand(command: string, args?: string[], options?: { timeout?: number }): Promise<SandboxCommandResult>;
  /** Tear down the underlying VM. Optional: providers without it are no-ops. */
  stop?(): Promise<void>;
}

/**
 * A coarse-grained step of the sandbox-preparation flow, reported as it happens
 * so the UI can show the user what the server is doing instead of a static
 * "Preparing…" toast. `phase` is a stable machine token; `message` is
 * user-facing copy.
 */
export interface PrepareProgress {
  phase: 'reattaching' | 'provisioning' | 'preparing-workspace' | 'cloning' | 'pulling' | 'finalizing' | 'done';
  message: string;
}

/** Callback invoked with each preparation step. Best-effort; never throws. */
export type ProgressFn = (event: PrepareProgress) => void;

function reportProgress(onProgress: ProgressFn | undefined, event: PrepareProgress): void {
  if (!onProgress) return;
  try {
    onProgress(event);
  } catch {
    // Progress reporting must never break the actual work.
  }
}

/**
 * Factory that builds a (not-yet-started) sandbox. When `providerSandboxId` is
 * provided the sandbox should reattach to that existing VM instead of
 * provisioning a new one.
 */
export type SandboxFactory = (opts: {
  providerSandboxId?: string;
  env?: Record<string, string>;
  /** Idle teardown window (minutes). The provider stops the VM after this idle period. */
  idleTimeoutMinutes?: number;
}) => MaterializationSandbox;

/**
 * Resolve the active sandbox provider. An explicit `MASTRACODE_SANDBOX_PROVIDER`
 * always wins. Otherwise we pick automatically: Railway when a Railway token is
 * configured, else the local host-process provider. This means a repo can
 * always be opened — Railway in a configured cloud deploy, local in dev — with
 * no extra env wiring.
 */
export function getSandboxProvider(): string {
  const explicit = process.env.MASTRACODE_SANDBOX_PROVIDER;
  if (explicit) return explicit;
  return process.env.RAILWAY_API_TOKEN ? 'railway' : 'local';
}

/**
 * True when a sandbox provider is usable. The local provider is always usable
 * (it runs git on the host process), so this is only false when an explicit
 * provider is misconfigured (e.g. `railway` selected without a token, or an
 * unknown provider name).
 */
export function isSandboxEnabled(): boolean {
  const provider = getSandboxProvider();
  if (provider === 'railway') {
    return Boolean(process.env.RAILWAY_API_TOKEN);
  }
  if (provider === 'local') {
    return true;
  }
  return false;
}

/**
 * Compute the in-sandbox working directory for a repo. Server-side only; never
 * derived from client input.
 */
export function computeSandboxWorkdir(repoFullName: string): string {
  const base = process.env.MASTRACODE_SANDBOX_WORKDIR;
  const repoName = repoFullName.split('/').pop() || 'repo';
  if (base) {
    // If the configured base already ends with the repo name, use it as-is.
    return base.endsWith(`/${repoName}`) ? base : `${base.replace(/\/$/, '')}/${repoName}`;
  }
  // The local provider runs on the host filesystem, where `/workspace` is not
  // writable; check out under the local sandbox root instead.
  if (getSandboxProvider() === 'local') {
    return `${getLocalSandboxRoot().replace(/\/$/, '')}/${repoName}`;
  }
  return `/workspace/${repoName}`;
}

/**
 * Idle teardown window for provisioned sandboxes, in minutes. Read from
 * `MASTRACODE_SANDBOX_IDLE_MINUTES`; defaults to 30. The provider stops an idle
 * VM after this window so abandoned sandboxes don't linger (GC). A re-open
 * detects the stopped VM and re-provisions cleanly.
 */
export function getSandboxIdleMinutes(): number | undefined {
  const raw = process.env.MASTRACODE_SANDBOX_IDLE_MINUTES;
  if (raw === undefined || raw === '') return 30;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.floor(parsed);
}

/**
 * Per-replica cap on concurrently *provisioned* sandboxes. Reads
 * `MASTRACODE_MAX_SANDBOXES`; 0 / unset means unlimited. This is a lightweight
 * per-process budget to keep a single replica from exhausting provider quota —
 * it is not a global, cross-replica scheduler (that is a deferred follow-up).
 */
export function getMaxSandboxes(): number {
  const raw = process.env.MASTRACODE_MAX_SANDBOXES;
  if (raw === undefined || raw === '') return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

/**
 * Count of sandboxes this replica has freshly provisioned and not yet torn
 * down. Reattaches to existing VMs do not count (they reuse an already-billed
 * sandbox). Used to enforce `getMaxSandboxes()`.
 */
let liveSandboxCount = 0;

/** Current live (freshly provisioned, not torn down) sandbox count. */
export function getLiveSandboxCount(): number {
  return liveSandboxCount;
}

/** For tests: reset the live-sandbox counter to a known state. */
export function __resetLiveSandboxCount(value = 0): void {
  liveSandboxCount = value;
}

/** Raised when provisioning would exceed the per-replica sandbox budget. */
export class SandboxBudgetError extends Error {
  readonly code = 'sandbox-budget-exceeded' as const;
  constructor(readonly max: number) {
    super(
      `Sandbox budget exceeded: this server already has ${max} active sandbox(es) ` +
        `(MASTRACODE_MAX_SANDBOXES=${max}). Close an existing project's sandbox and try again.`,
    );
    this.name = 'SandboxBudgetError';
  }
}

/** Railway-backed sandbox, optionally reattaching by id. */
const railwayFactory: SandboxFactory = ({ providerSandboxId, env, idleTimeoutMinutes }) =>
  new RailwaySandbox({
    ...(providerSandboxId ? { sandboxId: providerSandboxId } : {}),
    ...(env ? { env } : {}),
    ...(idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes } : {}),
  });

/** Local host-process sandbox (single-user dev; no tenant isolation). */
const localFactory: SandboxFactory = ({ providerSandboxId }) =>
  new LocalSandbox(providerSandboxId ? { sandboxId: providerSandboxId } : {});

/**
 * Default factory: dispatch on the configured provider. Resolved per call so
 * `MASTRACODE_SANDBOX_PROVIDER` is honored without re-importing the module.
 */
const defaultFactory: SandboxFactory = opts =>
  getSandboxProvider() === 'local' ? localFactory(opts) : railwayFactory(opts);

let sandboxFactory: SandboxFactory = defaultFactory;

/** Override the sandbox factory (tests / alternative providers). */
export function setSandboxFactory(factory: SandboxFactory): void {
  sandboxFactory = factory;
}

/** Reset to the default provider-dispatching factory. */
export function resetSandboxFactory(): void {
  sandboxFactory = defaultFactory;
}

/**
 * The provider's reattach id for a started sandbox. For Railway this is the
 * underlying `railwaySandboxId` in `getInfo().metadata`.
 */
async function readProviderSandboxId(sandbox: MaterializationSandbox): Promise<string | undefined> {
  const info = await sandbox.getInfo();
  const id = info.metadata?.railwaySandboxId ?? info.metadata?.sandboxId;
  return typeof id === 'string' ? id : undefined;
}

/**
 * Provision a new sandbox (persisting its provider id on first open) or
 * reattach to the stored one. Returns a started, live sandbox.
 */
export async function ensureProjectSandbox(
  row: GithubProjectSandboxRow,
  onProgress?: ProgressFn,
): Promise<MaterializationSandbox> {
  const idleTimeoutMinutes = getSandboxIdleMinutes();

  // Reattach path: if we have a stored sandbox id, try to reattach. The VM may
  // have been torn down by the provider's idle GC (or otherwise died), in which
  // case `start()` fails. Recover by clearing the stale id and provisioning a
  // fresh sandbox so the next open succeeds instead of being permanently wedged.
  if (row.sandboxId) {
    reportProgress(onProgress, { phase: 'reattaching', message: 'Reconnecting to your sandbox…' });
    const reattached = sandboxFactory({ providerSandboxId: row.sandboxId, idleTimeoutMinutes });
    try {
      await reattached.start();
      return reattached;
    } catch {
      await getAppDb()
        .update(githubProjectSandboxes)
        .set({ sandboxId: null })
        .where(eq(githubProjectSandboxes.id, row.id));
      // fall through to fresh provision below
    }
  }

  // Fresh provision: enforce the per-replica budget before spending quota.
  const max = getMaxSandboxes();
  if (max > 0 && liveSandboxCount >= max) {
    throw new SandboxBudgetError(max);
  }

  reportProgress(onProgress, { phase: 'provisioning', message: 'Provisioning a new sandbox…' });
  const sandbox = sandboxFactory({ idleTimeoutMinutes });
  await sandbox.start();
  liveSandboxCount += 1;

  const providerSandboxId = await readProviderSandboxId(sandbox);
  if (providerSandboxId) {
    await getAppDb()
      .update(githubProjectSandboxes)
      .set({ sandboxId: providerSandboxId })
      .where(eq(githubProjectSandboxes.id, row.id));
  }

  return sandbox;
}

/**
 * Tear down a user's sandbox for a project: stop the live VM (best-effort) and
 * clear the persisted `sandboxId`/`materializedAt` on the per-(project,user)
 * binding row so the next open re-provisions cleanly. Decrements the
 * per-replica live-sandbox counter.
 *
 * @param row     the per-(project,user) sandbox binding to tear down
 * @param sandbox an already-reattached live sandbox to stop, when available
 */
export async function teardownProjectSandbox(
  row: GithubProjectSandboxRow,
  sandbox?: MaterializationSandbox,
): Promise<void> {
  if (sandbox?.stop) {
    try {
      await sandbox.stop();
    } catch {
      // Best-effort: the VM may already be gone (idle GC). Still clear the row.
    }
  }
  if (row.sandboxId) {
    if (liveSandboxCount > 0) liveSandboxCount -= 1;
    await getAppDb()
      .update(githubProjectSandboxes)
      .set({ sandboxId: null, materializedAt: null })
      .where(eq(githubProjectSandboxes.id, row.id));
  }
}

/**
 * Reattach to an already-provisioned sandbox by its provider id and start it.
 * Used by the workspace seam when opening a GitHub project that was already
 * materialized (sandbox id + workdir carried on controller state), so no DB
 * round-trip is needed.
 */
export async function reattachProjectSandbox(providerSandboxId: string): Promise<MaterializationSandbox> {
  const sandbox = sandboxFactory({ providerSandboxId, idleTimeoutMinutes: getSandboxIdleMinutes() });
  await sandbox.start();
  return sandbox;
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

/** Run a shell script in the sandbox via `sh -c`. */
async function sh(sandbox: MaterializationSandbox, script: string): Promise<SandboxCommandResult> {
  return sandbox.executeCommand('sh', ['-c', script]);
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

/**
 * Materialize the repo inside the user's sandbox. Clones on first open, pulls on
 * re-open. Always scrubs the install token from the remote afterwards and sets
 * `materialized_at` on the per-user sandbox binding row.
 *
 * @param sandboxRow the per-(project,user) sandbox binding (provisioned via
 *                   `ensureProjectSandbox`)
 * @param repo       repo metadata from the org-owned project row
 * @param sandbox    the live sandbox to run git inside
 * @param token      a freshly minted, short-lived installation access token
 */
export async function materializeRepo(
  sandboxRow: GithubProjectSandboxRow,
  repoInfo: RepoMaterializeInfo,
  sandbox: MaterializationSandbox,
  token: string,
  onProgress?: ProgressFn,
): Promise<void> {
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

  try {
    if (!sandboxRow.materializedAt) {
      // 2a. First open: shallow-clone the default branch into the workdir. A
      // shallow single-branch clone is dramatically faster for large repos; the
      // later re-open uses `git pull --ff-only`, which works on shallow clones.
      reportProgress(onProgress, {
        phase: 'cloning',
        message: `Cloning ${repo} (first open can take a minute)…`,
      });
      const clone = await sh(
        sandbox,
        `git clone --depth=1 --single-branch --branch ${shellQuote(repoInfo.defaultBranch)} ${shellQuote(authUrl)} ${shellQuote(workdir)}`,
      );
      if (clone.exitCode !== 0) {
        throw classifyGitFailure(clone, 'clone-failed');
      }
    } else {
      // 2b. Re-open: refresh remote to the token URL and fast-forward pull.
      reportProgress(onProgress, { phase: 'pulling', message: `Updating ${repo} to the latest changes…` });
      const setUrl = await sh(sandbox, `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(authUrl)}`);
      if (setUrl.exitCode !== 0) {
        throw new MaterializeError(`Failed to set git remote: ${setUrl.stderr}`, 'pull-failed');
      }
      const pull = await sh(sandbox, `git -C ${shellQuote(workdir)} pull --ff-only`);
      if (pull.exitCode !== 0) {
        throw classifyGitFailure(pull, 'pull-failed');
      }
    }
  } finally {
    // 3. Always scrub the token from the remote so it isn't left in the VM's
    // git config, even when the clone/pull above failed partway through. This
    // is best-effort on the failure path (the workdir may not exist yet after a
    // failed clone); on the success path the scrub must succeed or we surface it.
    await scrubRemote(sandbox, workdir, repo, Boolean(sandboxRow.materializedAt));
  }

  // 4. Mark materialized.
  reportProgress(onProgress, { phase: 'finalizing', message: 'Finalizing workspace…' });
  await getAppDb()
    .update(githubProjectSandboxes)
    .set({ materializedAt: new Date() })
    .where(eq(githubProjectSandboxes.id, sandboxRow.id));
}

/**
 * Reset the git remote back to the tokenless URL. On a successful clone/pull the
 * workdir always has a `.git`, so a non-zero exit code here means the token may
 * still be persisted — surface it. On the failure path the workdir may not exist
 * (e.g. a failed clone), so a non-zero exit is tolerated.
 */
async function scrubRemote(
  sandbox: MaterializationSandbox,
  workdir: string,
  repoFullName: string,
  expectGitDir: boolean,
): Promise<void> {
  const result = await sh(
    sandbox,
    `git -C ${shellQuote(workdir)} remote set-url origin ${shellQuote(cleanUrl(repoFullName))}`,
  );
  if (result.exitCode !== 0 && expectGitDir) {
    throw new MaterializeError(
      `Failed to scrub installation token from git remote: ${result.stderr.trim() || result.stdout.trim()}`,
      'pull-failed',
    );
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
// the temporary remote URL inside the sandbox, and always scrubbed in a
// `finally` so it never persists in `.git/config`.
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
 * **always** scrub the remote back to the tokenless URL in a `finally`. The
 * token therefore only ever lives in the remote URL for the duration of the
 * operation and is never left in the VM's git config.
 *
 * On the success path the scrub must succeed (a leaked token is a hard error);
 * if it fails we surface it. On the failure path the scrub is best-effort but
 * still attempted, and the original operation error is rethrown.
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

  try {
    return await fn();
  } finally {
    // Always restore the tokenless remote. The workdir has a `.git` (we just
    // rewrote its remote) so a scrub failure means the token may still persist
    // — surface it.
    await scrubRemote(sandbox, workdir, repoFullName, true);
  }
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
    readonly code: 'invalid-branch' | 'worktree-failed',
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
 * reused. The branch is created from `baseBranch` when it does not yet exist.
 *
 * @param sandbox      live sandbox containing the base checkout
 * @param repoWorkdir  the base repo checkout path inside the sandbox
 * @param branch       the feature branch (ref-validated server-side)
 * @param baseBranch   the branch to fork from (ref-validated; default's repo branch)
 */
export async function ensureWorktree(
  sandbox: MaterializationSandbox,
  repoWorkdir: string,
  { branch, baseBranch }: { branch: string; baseBranch: string },
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

  // Make sure the base ref is present locally before forking from it.
  await sh(sandbox, `git -C ${shellQuote(repoWorkdir)} fetch origin ${shellQuote(baseBranch)}`);

  // Create the worktree. If the branch already exists, check it out into the
  // worktree; otherwise create it from the base branch. `git worktree add -B`
  // creates-or-resets the branch to the base, which keeps this idempotent for a
  // fresh worktree while still working when the branch already exists remotely.
  const add = await sh(
    sandbox,
    `git -C ${shellQuote(repoWorkdir)} worktree add -B ${shellQuote(branch)} ${shellQuote(worktreePath)} ${shellQuote(baseBranch)}`,
  );
  if (add.exitCode !== 0) {
    throw new WorktreeError(`git worktree add failed: ${add.stderr.trim() || add.stdout.trim()}`, 'worktree-failed');
  }

  return { worktreePath, branch, baseBranch, reused: false };
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
