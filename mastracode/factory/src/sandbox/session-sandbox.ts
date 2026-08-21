import type { SandboxStartHook, WorkspaceSandbox } from '@mastra/core/workspace';
import { deriveSandboxWorkdir } from './workdir.js';

/**
 * Everything factory knows about a session's sandbox needs — the whole
 * contract between factory and the deployer's sandbox callback. Factory owns
 * intent; the provider owns resolving `sessionId` to a runnable VM.
 */
export interface FactorySandboxContext {
  /** Stable session id — the sandbox identity. */
  sessionId: string;
  /** owner/name of the repository, when the session is repo-backed. */
  repoFullName?: string;
  /** Configured repo setup command, when present — for template keying. */
  setupCommand?: string;
  /**
   * Factory-built session setup hook (repo materialize + branch checkout +
   * setup command, marker-guarded). Callbacks MUST forward this to the
   * provider constructor's `onStart` option so setup runs inside the start
   * lifecycle — any lazy start then heals a replaced VM, and a setup failure
   * fails the start loudly. There is no fallback: a callback that drops the
   * hook produces sessions whose repo never materializes.
   */
  onStart?: SandboxStartHook;
  /** Opaque acting-user subject for provider attribution. */
  actingUserId?: string;
}

/**
 * The deploy's sandbox configuration: construct a session's sandbox from
 * intent. The sandbox identity is the session id; the provider must honor
 * id-keyed getOrCreate on `start()` (reconnect/resume an existing VM for the
 * id, create otherwise). Construction must be cheap and side-effect-free —
 * VMs are provisioned on `start()` only. Local sandboxes should root their
 * `workingDirectory` at a per-session directory (e.g.
 * `join(root, ctx.sessionId)`); the repo checks out as a subdirectory of it.
 *
 * @example
 * ```typescript
 * sandbox: ({ sessionId, onStart }) => new E2BSandbox({ id: sessionId, onStart })
 * ```
 */
export type MastraFactorySandboxConfig = (ctx: FactorySandboxContext) => WorkspaceSandbox;

/** The session's setup work, run against a started sandbox. Must be idempotent. */
export type SessionSetupRun = (sandbox: WorkspaceSandbox) => Promise<void>;

/**
 * Per-process session-id → sandbox instance memo.
 *
 * The provider contract is id-keyed getOrCreate, but provider find-then-create
 * has a real double-create race across independent instances. Memoizing the
 * instance per session makes the base class's per-instance start coalescing
 * apply process-wide per session — the same single-flight scope the fleet's
 * per-binding coalescing provided. Cross-replica races are accepted (the
 * fleet was also per-replica).
 */
interface SessionSandboxEntry {
  sandbox: WorkspaceSandbox;
  /** The session's deterministic workdir, recorded for passive readers (fs routes). */
  workdir: string;
}

const sessionSandboxes = new Map<string, SessionSandboxEntry>();

/**
 * Get the session's memoized sandbox entry, constructing (and memoizing) it on
 * first access. The workdir is derived from the constructed instance —
 * construction is cheap and side-effect-free by contract; VMs are provisioned
 * on `start()` only.
 */
export function getSessionSandbox(
  sessionId: string,
  repoFullName: string,
  construct: () => WorkspaceSandbox,
): SessionSandboxEntry {
  const existing = sessionSandboxes.get(sessionId);
  if (existing) return existing;
  const sandbox = construct();
  const entry = { sandbox, workdir: deriveSandboxWorkdir(sandbox, repoFullName) };
  sessionSandboxes.set(sessionId, entry);
  return entry;
}

/**
 * The session's memoized sandbox (and its workdir) when one was already
 * constructed in this process, else undefined. Never constructs — passive
 * read paths use this so browsing files cannot provision a VM.
 */
export function peekSessionSandbox(sessionId: string): SessionSandboxEntry | undefined {
  return sessionSandboxes.get(sessionId);
}

/** Drop the memoized instance (on stop/destroy/retirement or construction failure). */
export function evictSessionSandbox(sessionId: string): void {
  sessionSandboxes.delete(sessionId);
}

/** Test-only: reset the process-wide memo between tests. */
export function __clearSessionSandboxesForTests(): void {
  sessionSandboxes.clear();
}

/**
 * Completion marker for the session setup. Factory owns this end-to-end:
 * the `onStart` hook and the post-start fallback guard the exact same path,
 * so setup never double-runs regardless of which layer executed it. It is a
 * skip cache, not a correctness mechanism — the setup work is idempotent by
 * construction (materialize probes the disk, checkout/setup re-run safely).
 */
const SESSION_SETUP_MARKER = '.mastra-bootstrapped';

function markerShellPath(sandbox: Pick<WorkspaceSandbox, 'provider'>): string {
  // Local sandboxes exec with cwd = the session working directory; remote
  // VMs are one-per-session so $HOME is private to the session.
  return sandbox.provider === 'local' ? `./${SESSION_SETUP_MARKER}` : `$HOME/${SESSION_SETUP_MARKER}`;
}

/** Shell-expandable form of a workdir: `~/a/b` → `$HOME/a/b` (tilde does not expand inside quotes). */
function workdirShellPath(workdir: string): string {
  return workdir.startsWith('~/') ? `$HOME/${workdir.slice(2)}` : workdir;
}

async function markerPresent(sandbox: WorkspaceSandbox, workdir: string): Promise<boolean> {
  // The marker is a skip cache — it sits beside the checkout, not inside it,
  // so it can outlive a removed checkout (e.g. a wiped local session dir or
  // a recovered VM). Trust it only when the checkout it describes exists.
  const probe = await sandbox.executeCommand!(
    `test -f "${markerShellPath(sandbox)}" && test -d "${workdirShellPath(workdir)}/.git"`,
  );
  return probe.exitCode === 0;
}

async function writeMarker(sandbox: WorkspaceSandbox): Promise<void> {
  // Best-effort: a missing marker only re-runs the idempotent setup later.
  await sandbox.executeCommand!(`touch "${markerShellPath(sandbox)}"`).catch(() => {});
}

/**
 * Run the session setup, marker-guarded: skip when the marker exists (unless
 * the VM is known-fresh), otherwise run and write the marker only on
 * success. Setup failures propagate — no marker is written, so the next
 * attempt re-runs.
 */
async function runGuardedSetup(
  sandbox: WorkspaceSandbox,
  run: SessionSetupRun,
  { skipMarkerProbe, repoFullName }: { skipMarkerProbe: boolean; repoFullName: string },
): Promise<void> {
  if (!sandbox.executeCommand) {
    throw new Error(`Sandbox '${sandbox.id}' cannot run the session setup: no executeCommand implementation`);
  }
  // Derived from the live instance — the hook is built before the sandbox is
  // constructed, so the workdir cannot be an input here.
  const workdir = deriveSandboxWorkdir(sandbox, repoFullName);
  if (!skipMarkerProbe && (await markerPresent(sandbox, workdir))) return;
  await run(sandbox);
  await writeMarker(sandbox);
}

/**
 * Build the setup hook for `ctx.onStart`. Runs inside the sandbox start
 * lifecycle: a fresh VM (`outcome: 'created'`) runs setup with no probe; a
 * reconnect probes the marker first, which re-runs setup after a failed or
 * crash-interrupted attempt. Throwing fails `start()` loudly — core treats
 * onStart errors as fatal.
 */
export function createSessionSetupHook(run: SessionSetupRun, repoFullName: string): SandboxStartHook {
  return async ({ sandbox, outcome }) => {
    await runGuardedSetup(sandbox, run, { skipMarkerProbe: outcome === 'created', repoFullName });
  };
}
