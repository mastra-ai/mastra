import path from 'node:path';
import {
  SETUP_FAILED_MARKER_PATH,
  SETUP_MARKER_PATH,
  WORKSPACE_SETUP_MARKER_PATH,
  repoSetupMarkerPath,
  setupMarkerContent,
} from '@internal/workspace';

import type { MastraSandbox, SandboxStartHook, WorkspaceSandbox } from '@mastra/core/workspace';
import type { RepositoryAccess } from '../capabilities/version-control.js';
import { timedPhase } from '../timing.js';
import { deriveLocalWorkdir, deriveRemoteRepoDir, repoDirUnder, repositoryDirectoryName } from './workdir.js';

/**
 * Everything factory knows about a session's sandbox needs — the whole
 * contract between factory and the deployer's sandbox callback. Factory owns
 * intent; the provider owns resolving `sessionId` to a runnable VM.
 */
export interface FactorySandboxContext {
  /** Stable session id — the sandbox identity. */
  sessionId: string;
  /**
   * The provider's physical sandbox id persisted from a prior start, when the
   * session has been started before. Providers that reattach by physical id
   * (e.g. Railway) MUST forward it to the sandbox constructor so resume
   * reattaches the original VM instead of provisioning a replacement. E2B and
   * Platform accept it as a deterministic-reattach optimization. Undefined on
   * a session's first ever start.
   */
  sandboxId?: string;
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
  /**
   * Every repository of the session's factory environment, in position
   * order, when the factory has one. Same shape and semantics as the repo
   * templates' `repos` option: each entry resolves its own access and runs
   * its own setup inside its clone at `<workingDirectory>/<repo>`. Mutually
   * exclusive with `getRepositoryAccess`, which is `undefined` whenever this
   * is set. Absent for a session whose factory has no environment repository.
   */
  repos?: Array<{ getRepositoryAccess: () => Promise<RepositoryAccess>; setupCommand?: string | string[] }>;
  /** Command run once at the workspace root after every repository is set up (`repos` only). */
  workspaceSetupCommand?: string | string[];
  /** A failing repository setup is recorded and the build continues (`repos` only). Factory passes true. */
  continueOnSetupFailure?: boolean;
  /** Absolute workspace root the repositories check out under; the provider default when absent. */
  workingDirectory?: string;
  /** vCPU count from the factory's environment settings. */
  cpuCount?: number;
  /** Memory in MB from the factory's environment settings. */
  memoryMB?: number;
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
 * Forward `ctx.sandboxId` to providers that reattach by physical id so resume
 * reattaches the original VM instead of provisioning a replacement.
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
 * sandbox: ({ sessionId, sandboxId }) => new E2BSandbox({ id: sessionId, sandboxId })
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

/** One environment repository as the boot hook needs it: its slug and setup command. */
export interface SessionEnvironmentRepository {
  slug: string;
  setupCommand?: string;
}

/** What the environment hook learned about one repository before the boot runs. */
export interface SessionEnvironmentRepositoryGate extends SessionEnvironmentRepository {
  /** `<root>/<repoDir>`, the directory the template cloned this repository into. */
  dir: string;
  gate: SessionSetupGate;
}

/** The environment hook's view of the workspace: the root, every repository in position order, the workspace gate. */
export interface SessionEnvironmentGate {
  /** The workspace root, parent of every repository directory. */
  root: string;
  repos: SessionEnvironmentRepositoryGate[];
  /** Gate for `workspaceSetupCommand`; `setupDone` when there is no command or its marker matches. */
  workspace: SessionSetupGate;
}

/** The list-form session boot: run on every start, like `SessionSetupRun`. */
export type SessionEnvironmentSetupRun = (
  sandbox: WorkspaceSandbox,
  environment: SessionEnvironmentGate,
) => Promise<void>;

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
  /** The repository `workdir` was derived for: the memo answers only that repository. */
  workdirRepo?: string;
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
  const entry: SessionSandboxEntry = { sandbox, ...(local ? { workdir: local, workdirRepo: repoFullName } : {}) };
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
 * `entry.workdir` instead. The memo is the session's own checkout; another
 * environment repository lives beside it under the same root, so it is
 * answered from the memo's parent without a second probe.
 */
export async function resolveSessionWorkdir(
  sessionId: string,
  sandbox: WorkspaceSandbox,
  repoFullName: string,
): Promise<string> {
  const entry = sessionSandboxes.get(sessionId);
  if (entry?.workdir && entry.sandbox === sandbox) {
    if (entry.workdirRepo === repoFullName) return entry.workdir;
    return repoDirUnder(path.posix.dirname(entry.workdir), repoFullName);
  }
  const workdir =
    deriveLocalWorkdir(sandbox, repoFullName) ??
    deriveRemoteRepoDir(sandbox, repoFullName) ??
    repoDirUnder(await probeHome(sandbox), repoFullName);
  if (entry && entry.sandbox === sandbox) {
    entry.workdir = workdir;
    entry.workdirRepo = repoFullName;
  }
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
    const setupDone = marker
      ? await timedPhase('workspace.setup-marker', () => markerMatches(sandbox, workdir, marker))
      : true;
    if (marker) {
      process.stderr.write(
        `[factory:setup] ${setupDone ? 'marker matches, skipping setup command' : 'no matching marker, setup command will run'} (${markerShellPath(workdir)})\n`,
      );
    }
    await run(sandbox, workdir, {
      setupDone,
      markSetupDone: () => (marker ? writeMarker(sandbox, workdir, marker) : Promise.resolve()),
    });
  };
}

/**
 * Shell-quote one marker file's content. Marker contents are digests, but
 * the quoting keeps an edited command's digest from ever reaching the shell
 * unquoted.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The list-form marker probe: trust a repository's marker only when its
 * checkout exists, the marker names this command, and the template did not
 * record the repository in `setup-failed` (a failed per-repo setup still
 * writes the marker because every step ran; the failure list says it failed).
 */
async function repoMarkerMatches(
  sandbox: WorkspaceSandbox,
  root: string,
  repoDir: string,
  content: string,
): Promise<boolean> {
  const marker = `${root}/${repoSetupMarkerPath(repoDir)}`;
  const failed = `${root}/${SETUP_FAILED_MARKER_PATH}`;
  const probe = await sandbox.executeCommand!(
    `test -d "${root}/${repoDir}/.git" && test -f "${marker}" && [ "$(cat "${marker}")" = ${shellQuote(content)} ] && ! grep -qxF -- ${shellQuote(repoDir)} "${failed}" 2>/dev/null`,
  );
  return probe.exitCode === 0;
}

/** Write a repository's marker and drop it from `setup-failed`. Best-effort, like `writeMarker`. */
async function writeRepoMarker(
  sandbox: WorkspaceSandbox,
  root: string,
  repoDir: string,
  content: string,
): Promise<void> {
  const marker = `${root}/${repoSetupMarkerPath(repoDir)}`;
  const failed = `${root}/${SETUP_FAILED_MARKER_PATH}`;
  await sandbox.executeCommand!(
    `mkdir -p "$(dirname "${marker}")" && printf '%s' ${shellQuote(content)} > "${marker}" && { test -f "${failed}" && { grep -vxF -- ${shellQuote(repoDir)} "${failed}" > "${failed}.tmp" || true; } && mv "${failed}.tmp" "${failed}" || true; }`,
  ).catch(() => {});
}

async function workspaceMarkerMatches(sandbox: WorkspaceSandbox, root: string, content: string): Promise<boolean> {
  const marker = `${root}/${WORKSPACE_SETUP_MARKER_PATH}`;
  const probe = await sandbox.executeCommand!(
    `test -f "${marker}" && [ "$(cat "${marker}")" = ${shellQuote(content)} ]`,
  );
  return probe.exitCode === 0;
}

async function writeWorkspaceMarker(sandbox: WorkspaceSandbox, root: string, content: string): Promise<void> {
  const marker = `${root}/${WORKSPACE_SETUP_MARKER_PATH}`;
  await sandbox.executeCommand!(
    `mkdir -p "$(dirname "${marker}")" && printf '%s' ${shellQuote(content)} > "${marker}"`,
  ).catch(() => {});
}

/**
 * The list-form start hook for a session whose factory has an environment:
 * the same lifecycle as `createSessionSetupHook`, with one gate per
 * repository plus one for the workspace setup command. The markers are the
 * ones the multi-repo templates write (`.mastra-sandbox/repos/<repoDir>`,
 * `.mastra-sandbox/workspace-setup`, `.mastra-sandbox/setup-failed`), all
 * under the workspace root, which is the parent of the primary repository's
 * directory: `resolveSessionWorkdir` keeps answering that directory so the
 * PR tools and passive readers see the primary checkout, and the root is
 * derived from it rather than probed twice.
 *
 * `repos` is in position order and must include the primary (`repoFullName`).
 */
export function createEnvironmentSetupHook(
  run: SessionEnvironmentSetupRun,
  sessionId: string,
  repoFullName: string,
  environment: { repos: SessionEnvironmentRepository[]; workspaceSetupCommand?: string },
): SandboxStartHook {
  const workspaceCommand = environment.workspaceSetupCommand?.trim() ? environment.workspaceSetupCommand : undefined;
  const workspaceMarker = workspaceCommand ? setupMarkerContent(workspaceCommand) : undefined;
  return async ({ sandbox }) => {
    if (!sandbox.executeCommand) {
      throw new Error(`Sandbox '${sandbox.id}' cannot run the session setup: no executeCommand implementation`);
    }
    const workdir = await resolveSessionWorkdir(sessionId, sandbox, repoFullName);
    const root = path.posix.dirname(workdir);
    const repos: SessionEnvironmentRepositoryGate[] = [];
    for (const repo of environment.repos) {
      const repoDir = repositoryDirectoryName(repo.slug);
      const marker = repo.setupCommand?.trim() ? setupMarkerContent(repo.setupCommand) : undefined;
      const setupDone = marker
        ? await timedPhase(`workspace.setup-marker(${repoDir})`, () =>
            repoMarkerMatches(sandbox, root, repoDir, marker),
          )
        : true;
      if (marker) {
        process.stderr.write(
          `[factory:setup] ${repo.slug}: ${setupDone ? 'marker matches, skipping setup command' : 'no matching marker, setup command will run'} (${root}/${repoSetupMarkerPath(repoDir)})\n`,
        );
      }
      repos.push({
        ...repo,
        dir: `${root}/${repoDir}`,
        gate: {
          setupDone,
          markSetupDone: () => (marker ? writeRepoMarker(sandbox, root, repoDir, marker) : Promise.resolve()),
        },
      });
    }
    const workspaceDone = workspaceMarker
      ? await timedPhase('workspace.setup-marker(workspace)', () =>
          workspaceMarkerMatches(sandbox, root, workspaceMarker),
        )
      : true;
    await run(sandbox, {
      root,
      repos,
      workspace: {
        setupDone: workspaceDone,
        markSetupDone: () =>
          workspaceMarker ? writeWorkspaceMarker(sandbox, root, workspaceMarker) : Promise.resolve(),
      },
    });
  };
}
