import path from 'node:path';
import { SETUP_MARKER_PATH, setupMarkerContent } from '@internal/workspace';

import type { MastraSandbox, SandboxStartHook, WorkspaceSandbox } from '@mastra/core/workspace';
import type { RepositoryAccess } from '../capabilities/version-control.js';
import { deriveLocalWorkdir, deriveRemoteRepoDir, repoDirUnder } from './workdir.js';

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
  /**
   * Configured repo setup command, when present. Part of a repo template's
   * identity: a different setup command produces a different template.
   */
  setupCommand?: string;
  /**
   * Resolves the session repository's clone URL and a fresh short-lived
   * credential for it. Providers use it for authenticated work that runs
   * outside the VM — resolving a private repo's head, or cloning it during
   * a template build. The credential is minted per call (installation
   * tokens expire in ~1h); never an org PAT.
   *
   * `undefined` when the session has no repository, which is how a provider
   * knows to build no repo template. The key is always present so that
   * passing the whole context to a provider helper keeps working when this
   * field changes, instead of silently resolving to "no repository".
   */
  getRepositoryAccess: (() => Promise<RepositoryAccess>) | undefined;
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
 * Returns a `MastraSandbox`, not the bare `WorkspaceSandbox` interface:
 * factory relies on the base class for the start lifecycle and the runtime
 * env, so providers extend it rather than reimplementing the contract.
 *
 * Factory attaches its own session setup to the returned sandbox, so the
 * callback never has to wire it up. A callback may still pass its own
 * `onStart`; it runs after factory's setup, against a prepared workspace.
 *
 * @example
 * ```typescript
 * sandbox: ({ sessionId }) => new E2BSandbox({ id: sessionId })
 * ```
 */
export type MastraFactorySandboxConfig = (ctx: FactorySandboxContext) => MastraSandbox;

/**
 * What the start hook learned about the setup command before running the
 * session setup, and how to record its completion afterwards.
 */
export interface SessionSetupGate {
  /** True when the sandbox already carries a marker for the current setup command. */
  setupDone: boolean;
  /** Write the marker once the setup command succeeded. Best-effort. */
  markSetupDone: () => Promise<void>;
}

/**
 * The session's setup work, run against a started sandbox on EVERY start.
 * Materialize and checkout are idempotent and must always run (a warm boot
 * still needs its pull); only the setup command consults `gate`.
 */
export type SessionSetupRun = (sandbox: WorkspaceSandbox, workdir: string, gate: SessionSetupGate) => Promise<void>;

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
    deriveLocalWorkdir(sandbox, repoFullName) ??
    deriveRemoteRepoDir(sandbox, repoFullName) ??
    repoDirUnder(await probeHome(sandbox), repoFullName);
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
  failedSetupCommands.delete(sessionId);
}

/** Test-only: reset the process-wide memo between tests. */
export function __clearSessionSandboxesForTests(): void {
  sessionSandboxes.clear();
  failedSetupCommands.clear();
}

/**
 * Setup commands that already failed once for a session. The first failure
 * fails the start loudly — the agent sees the real error in the tool result
 * that triggered it. Recording it lets the next start skip the known-bad
 * command instead of wedging the session behind a permanently failing
 * onStart: clone and checkout still run, and the agent can fix or re-run
 * the setup itself. Keyed by the exact command so an edited setup command
 * runs fresh. In-memory only — a server restart re-runs the (idempotent)
 * setup.
 */
const failedSetupCommands = new Map<string, string>();

export function recordFailedSetupCommand(sessionId: string, command: string): void {
  failedSetupCommands.set(sessionId, command);
}

export function hasFailedSetupCommand(sessionId: string, command: string): boolean {
  return failedSetupCommands.get(sessionId) === command;
}

/**
 * The setup completion marker is a convention shared with the repo templates
 * (`@internal/workspace`): `.mastra-sandbox/setup` beside the checkout,
 * containing a digest of the setup commands. Templates write it as their last
 * build step, so a sandbox booted from a warm image already carries it; the
 * start hook writes it after a successful runtime setup. It is a skip cache,
 * not a correctness mechanism: the setup command is assumed idempotent, and a
 * missing or mismatched marker only re-runs it.
 *
 * The working directory is the parent of the repo dir, which is also the
 * template's build cwd, so this is the file the template's marker step wrote.
 */
function markerShellPath(workdir: string): string {
  return `${path.posix.dirname(workdir)}/${SETUP_MARKER_PATH}`;
}

async function markerMatches(sandbox: WorkspaceSandbox, workdir: string, content: string): Promise<boolean> {
  // The marker sits beside the checkout, not inside it, so it can outlive a
  // removed checkout (a wiped local session dir, a recovered VM). Trust it
  // only when the checkout it describes exists and it names this command.
  const marker = markerShellPath(workdir);
  const probe = await sandbox.executeCommand!(
    `test -d "${workdir}/.git" && test -f "${marker}" && [ "$(cat "${marker}")" = "${content}" ]`,
  );
  return probe.exitCode === 0;
}

async function writeMarker(sandbox: WorkspaceSandbox, workdir: string, content: string): Promise<void> {
  // Best-effort: a missing marker only re-runs the idempotent setup later.
  const marker = markerShellPath(workdir);
  await sandbox.executeCommand!(`mkdir -p "$(dirname "${marker}")" && printf '%s' '${content}' > "${marker}"`).catch(
    () => {},
  );
}

/**
 * Build the session setup hook, which factory attaches to the constructed
 * sandbox with `setOnStart`. Runs inside the sandbox start lifecycle on
 * every start, fresh VM or reconnect: materialize and checkout always run,
 * and the setup command runs unless the sandbox already carries the marker
 * for it (a warm template image, or an earlier successful start). Throwing
 * fails `start()` loudly; core treats onStart errors as fatal.
 */
export function createSessionSetupHook(
  run: SessionSetupRun,
  sessionId: string,
  repoFullName: string,
  setupCommand: string | undefined,
): SandboxStartHook {
  // No command, no marker: nothing to gate.
  const marker = setupCommand?.trim() ? setupMarkerContent(setupCommand) : undefined;
  return async ({ sandbox }) => {
    if (!sandbox.executeCommand) {
      throw new Error(`Sandbox '${sandbox.id}' cannot run the session setup: no executeCommand implementation`);
    }
    // Resolved from the live instance (the hook runs inside `start()`, so the
    // VM is up) and memoized on the session entry for passive readers.
    const workdir = await resolveSessionWorkdir(sessionId, sandbox, repoFullName);
    // Probed before materialize so a wiped checkout reads as "not done" even
    // though materialize is about to restore it.
    const setupDone = marker ? await markerMatches(sandbox, workdir, marker) : true;
    await run(sandbox, workdir, {
      setupDone,
      markSetupDone: () => (marker ? writeMarker(sandbox, workdir, marker) : Promise.resolve()),
    });
  };
}
