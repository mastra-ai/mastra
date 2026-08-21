import type { SandboxStartHook, WorkspaceSandbox } from '@mastra/core/workspace';
import { deriveLocalWorkdir, remoteWorkdirFromHome } from './workdir.js';

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
  /**
   * Mints a fresh short-lived GitHub App installation token for the
   * session's repository. Providers may use it for authenticated work that
   * runs outside the VM — e.g. resolving a private repo's head or cloning it
   * during a template build. Always a fresh mint per call (installation
   * tokens expire in ~1h); never an org PAT.
   */
  getGithubToken?: () => Promise<string>;
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
export type SessionSetupRun = (sandbox: WorkspaceSandbox, workdir: string) => Promise<void>;

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
  /**
   * The session's repo checkout root, recorded for passive readers (fs
   * routes, capture, authz). Local sandboxes derive it at construction;
   * remote sandboxes clone into the VM's own home, so it is undefined until
   * `resolveSessionWorkdir` probes the first started VM — passive readers
   * treat an unresolved workdir as "nothing materialized".
   */
  workdir?: string;
}

const sessionSandboxes = new Map<string, SessionSandboxEntry>();

/**
 * Get the session's memoized sandbox entry, constructing (and memoizing) it on
 * first access. Construction is cheap and side-effect-free by contract; VMs
 * are provisioned on `start()` only. Local sandboxes get their workdir here;
 * remote workdirs are a runtime fact of the VM, resolved on first start.
 */
export function getSessionSandbox(
  sessionId: string,
  repoFullName: string,
  construct: () => WorkspaceSandbox,
): SessionSandboxEntry {
  const existing = sessionSandboxes.get(sessionId);
  if (existing) return existing;
  const sandbox = construct();
  const local = deriveLocalWorkdir(sandbox, repoFullName);
  const entry: SessionSandboxEntry = { sandbox, ...(local ? { workdir: local } : {}) };
  sessionSandboxes.set(sessionId, entry);
  return entry;
}

/**
 * Resolve (and memoize on the session entry) the session's repo checkout
 * root. Local sandboxes answer synchronously from their configured
 * `workingDirectory`; remote sandboxes clone into the VM's own default cwd,
 * so the first resolution probes it with one `pwd` — the VM tells us where
 * home is, we never invent a path. Calling this against a stopped sandbox
 * lazily starts it (the probe is a command), so passive readers must peek
 * `entry.workdir` instead.
 */
export async function resolveSessionWorkdir(
  sessionId: string,
  sandbox: WorkspaceSandbox,
  repoFullName: string,
): Promise<string> {
  const entry = sessionSandboxes.get(sessionId);
  if (entry?.workdir && entry.sandbox === sandbox) return entry.workdir;
  const workdir =
    deriveLocalWorkdir(sandbox, repoFullName) ?? remoteWorkdirFromHome(await probeHome(sandbox), repoFullName);
  if (entry && entry.sandbox === sandbox) entry.workdir = workdir;
  return workdir;
}

/** One `pwd` in the VM's default shell cwd — its home dir, by provider convention. */
async function probeHome(sandbox: WorkspaceSandbox): Promise<string> {
  if (!sandbox.executeCommand) {
    throw new Error(`Sandbox '${sandbox.id}' cannot resolve its workdir: no executeCommand implementation`);
  }
  const probe = await sandbox.executeCommand('pwd');
  const home = probe.stdout.trim().split('\n').pop()?.trim() ?? '';
  if (probe.exitCode !== 0 || !home.startsWith('/')) {
    throw new Error(
      `Sandbox '${sandbox.id}' default cwd probe failed (exit ${probe.exitCode}): ${
        probe.stderr.trim() || probe.stdout.trim() || 'empty output'
      }`,
    );
  }
  return home;
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

async function markerPresent(sandbox: WorkspaceSandbox, workdir: string): Promise<boolean> {
  // The marker is a skip cache — it sits beside the checkout, not inside it,
  // so it can outlive a removed checkout (e.g. a wiped local session dir or
  // a recovered VM). Trust it only when the checkout it describes exists.
  const probe = await sandbox.executeCommand!(`test -f "${markerShellPath(sandbox)}" && test -d "${workdir}/.git"`);
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
  { skipMarkerProbe, sessionId, repoFullName }: { skipMarkerProbe: boolean; sessionId: string; repoFullName: string },
): Promise<void> {
  if (!sandbox.executeCommand) {
    throw new Error(`Sandbox '${sandbox.id}' cannot run the session setup: no executeCommand implementation`);
  }
  // Resolved from the live instance (the hook runs inside `start()`, so the
  // VM is up) and memoized on the session entry for passive readers.
  const workdir = await resolveSessionWorkdir(sessionId, sandbox, repoFullName);
  if (!skipMarkerProbe && (await markerPresent(sandbox, workdir))) return;
  await run(sandbox, workdir);
  await writeMarker(sandbox);
}

/**
 * Build the setup hook for `ctx.onStart`. Runs inside the sandbox start
 * lifecycle: a fresh VM (`outcome: 'created'`) runs setup with no probe; a
 * reconnect probes the marker first, which re-runs setup after a failed or
 * crash-interrupted attempt. Throwing fails `start()` loudly — core treats
 * onStart errors as fatal.
 */
export function createSessionSetupHook(
  run: SessionSetupRun,
  sessionId: string,
  repoFullName: string,
): SandboxStartHook {
  return async ({ sandbox, outcome }) => {
    await runGuardedSetup(sandbox, run, { skipMarkerProbe: outcome === 'created', sessionId, repoFullName });
  };
}
