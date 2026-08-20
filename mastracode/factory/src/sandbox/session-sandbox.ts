import type { SandboxLifecycleHook, WorkspaceSandbox } from '@mastra/core/workspace';

/**
 * Everything factory knows about a session's sandbox needs — the whole
 * contract between factory and the deployer's sandbox callback. Factory owns
 * intent; the provider owns resolving `sessionId` to a runnable VM.
 */
export interface FactorySandboxContext {
  /** Stable session id — the sandbox identity. */
  sessionId: string;
  /** Deterministic in-sandbox working directory for the session's checkout. */
  workdir: string;
  /** owner/name of the repository, when the session is repo-backed. */
  repoFullName?: string;
  /** Default-branch head sha, when factory knows it — for template keying. */
  repoSha?: string;
  /** Configured repo setup command, when present — for template keying. */
  setupCommand?: string;
  /** Idle window advisory (minutes). */
  idleTimeoutMinutes: number;
  /**
   * Factory-built session setup hook (repo materialize + branch checkout +
   * setup command, marker-guarded). Callbacks SHOULD forward this to the
   * provider constructor's `onStart` option so setup runs inside the start
   * lifecycle — any lazy start then heals a replaced VM, and a setup failure
   * fails the start loudly. Factory also runs a marker-guarded fallback
   * after `start()` for callbacks that do not forward it.
   */
  onStart?: SandboxLifecycleHook;
  /** Opaque acting-user subject for provider attribution. */
  actingUserId?: string;
}

/** The session's setup work, run against a started sandbox. Must be idempotent. */
export type SessionSetupRun = (sandbox: WorkspaceSandbox) => Promise<void>;

/**
 * The sandbox surface handed to integrations and route builders: whether
 * sandboxes are configured, a provider label for diagnostics, and the
 * deployer's create callback for paths that construct sandboxes themselves
 * (e.g. the per-project git routes).
 */
export interface FactorySandboxRuntime {
  enabled: boolean;
  /** Provider label for diagnostics ('local', 'e2b', 'platform', 'custom', 'none'). */
  provider: string;
  /** Host root for local sandbox checkouts, when the deploy is local. */
  localRoot?: string;
  create?: (ctx: FactorySandboxContext) => WorkspaceSandbox;
  instructions?: string;
}

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

/** Get the session's memoized sandbox, constructing (and memoizing) it on first access. */
export function getSessionSandbox(
  sessionId: string,
  workdir: string,
  construct: () => WorkspaceSandbox,
): WorkspaceSandbox {
  const existing = sessionSandboxes.get(sessionId);
  if (existing) return existing.sandbox;
  const sandbox = construct();
  sessionSandboxes.set(sessionId, { sandbox, workdir });
  return sandbox;
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

async function markerPresent(sandbox: WorkspaceSandbox): Promise<boolean> {
  const probe = await sandbox.executeCommand!(`test -f "${markerShellPath(sandbox)}"`);
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
  { skipMarkerProbe }: { skipMarkerProbe: boolean },
): Promise<void> {
  if (!sandbox.executeCommand) {
    throw new Error(`Sandbox '${sandbox.id}' cannot run the session setup: no executeCommand implementation`);
  }
  if (!skipMarkerProbe && (await markerPresent(sandbox))) return;
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
export function createSessionSetupHook(run: SessionSetupRun): SandboxLifecycleHook {
  return async ({ sandbox, outcome }) => {
    await runGuardedSetup(sandbox, run, { skipMarkerProbe: outcome === 'created' });
  };
}

/**
 * Marker-guarded fallback for sandbox callbacks that did not forward
 * `ctx.onStart` to the provider. Runs after `start()` settled. When the
 * callback DID forward it, the hook already ran and wrote the marker, so
 * this probes and no-ops — no detection logic needed. Failures are fatal to
 * the caller: a session whose repo never materialized must fail preparation
 * loudly.
 */
export async function runSessionSetupFallback(sandbox: WorkspaceSandbox, run: SessionSetupRun): Promise<void> {
  await runGuardedSetup(sandbox, run, { skipMarkerProbe: false });
}
