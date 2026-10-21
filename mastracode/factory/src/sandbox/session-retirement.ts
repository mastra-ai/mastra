import type { FactorySandbox, WorkspaceSandbox } from '@mastra/core/workspace';

import { destroyDetachedSessionSandbox, releaseSessionSandbox } from '../integrations/github/sandbox-release.js';
import { DEFAULT_COMMAND_TIMEOUT_MS, runTeardownCommand } from '../integrations/github/sandbox.js';
import { peekSessionEnvironmentTeardown } from '../session/environment-state-processor.js';
import type {
  ProjectRepository,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { requireExec } from './materialization.js';
import { clearFailedSetupCommands, evictSessionSandbox, peekSessionSandbox } from './session-sandbox.js';

type WarningLogger = (message: string, details: Record<string, unknown>) => void;

export interface SessionRetirementCoordinatorOptions {
  invalidateSession?: (sessionId: string) => Promise<void> | void;
  /**
   * The deploy's sandbox configuration. Used to destroy a deleted session's
   * VM by identity when this process never attached to it (after a restart,
   * or on another replica). Recreate uses it the same way.
   */
  sandbox?: FactorySandbox;
  warn?: WarningLogger;
  /** How long recreate waits on a started sandbox's lifecycle destroy before falling back. */
  destroyTimeoutMs?: number;
}

export interface RecreateSessionSandboxInput {
  sourceControl: SourceControlStorageHandle;
  orgId: string;
  sessionId: string;
}

const DEFAULT_DESTROY_TIMEOUT_MS = 30_000;

/**
 * A provider error meaning the VM is already gone: 410, or a 404 the proxy
 * marks `not_found` (or leaves uncoded). A routing 404 with another code is
 * not proof the VM is gone.
 */
function isSandboxGoneError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  if (status === 410) return true;
  return status === 404 && (code === undefined || code === null || code === 'not_found');
}

export interface RetireSessionInput {
  sourceControl: SourceControlStorageHandle;
  /** When provided, deleting the session row also strips its work-item refs. */
  workItems?: Pick<WorkItemsStorage, 'clearSessionReferences'>;
  orgId: string;
  sessionId: string;
  deleteSession: boolean;
}

function boundedError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.length <= 2000) return detail;
  return `${detail.slice(0, 200)}...${detail.slice(-1797)}`;
}

/**
 * Owns terminal and destructive session cleanup. Each session is serialized so
 * duplicate role bindings and competing deletion/transition requests cannot
 * run teardown concurrently.
 *
 * Sandbox identity is the session id: retirement stops (or, for deleted
 * sessions, destroys) the sandbox this process holds in the session memo.
 * Sessions opened on another replica (or before a restart) have no memo entry
 * here: stopping them is left to the provider's idle lifecycle, but deleting a
 * materialized session destroys its VM by identity through the configured
 * sandbox. Providers such as E2B keep paused VMs forever, so the row's
 * deletion must never orphan one.
 */
export class SessionRetirementCoordinator {
  readonly #invalidateSession: NonNullable<SessionRetirementCoordinatorOptions['invalidateSession']>;
  readonly #sandbox: FactorySandbox | undefined;
  readonly #warn: WarningLogger;
  readonly #destroyTimeoutMs: number;
  readonly #locks = new Map<string, Promise<unknown>>();

  constructor(options: SessionRetirementCoordinatorOptions = {}) {
    this.#invalidateSession = options.invalidateSession ?? (() => {});
    this.#sandbox = options.sandbox;
    this.#warn = options.warn ?? ((message, details) => console.warn(`[Mastra Factory] ${message}`, details));
    this.#destroyTimeoutMs = options.destroyTimeoutMs ?? DEFAULT_DESTROY_TIMEOUT_MS;
  }

  async retireSession(input: RetireSessionInput): Promise<void> {
    await this.#withSessionLock(input.sessionId, () => this.#retireSession(input));
  }

  /**
   * Destroy a session's sandbox so its next message boots a fresh VM from the
   * template, keeping the session row, its conversation, and work-item refs.
   * Skips teardown commands, and works without a memo entry in this process
   * by destroying a detached instance built from the persisted `sandboxId`.
   * A destroy failure keeps the persisted id so a retry can reach the VM.
   */
  async recreateSessionSandbox(input: RecreateSessionSandboxInput): Promise<'recreated' | 'not-found'> {
    return this.#withSessionLock(input.sessionId, () => this.#recreateSessionSandbox(input));
  }

  /**
   * Replace the session's VM while keeping its sandbox instance, for the
   * session's own agent. A run holds the instance it started with until the
   * run ends, so recreate (which destroys the instance) would leave every
   * later command in that run failing. Here the VM is destroyed and the
   * instance is left `stopped` with no VM id, so the run's next command starts
   * a fresh VM and the start hook sets it up again.
   *
   * `not-here` means this process holds no instance for the session.
   */
  async resetSessionSandbox(input: RecreateSessionSandboxInput): Promise<'reset' | 'not-found' | 'not-here'> {
    return this.#withSessionLock(input.sessionId, () => this.#resetSessionSandbox(input));
  }

  async #withSessionLock<T>(sessionId: string, run: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(sessionId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(run);
    this.#locks.set(sessionId, current);
    try {
      return await current;
    } finally {
      if (this.#locks.get(sessionId) === current) this.#locks.delete(sessionId);
    }
  }

  async retireWorkItemSessions(options: {
    workItems: Pick<WorkItemsStorage, 'get'>;
    sourceControl: SourceControlStorageHandle;
    orgId: string;
    workItemId: string;
  }): Promise<void> {
    const item = await options.workItems.get({ orgId: options.orgId, id: options.workItemId });
    if (!item) return;
    const sessionIds = [...new Set(Object.values(item.sessions).map(session => session.sessionId))];
    await Promise.all(
      sessionIds.map(sessionId =>
        this.retireSession({
          sourceControl: options.sourceControl,
          orgId: options.orgId,
          sessionId,
          deleteSession: false,
        }),
      ),
    );
  }

  async retireProjectRepositorySessions(options: {
    sourceControl: SourceControlStorageHandle;
    workItems?: Pick<WorkItemsStorage, 'clearSessionReferences'>;
    orgId: string;
    projectRepositoryId: string;
  }): Promise<void> {
    const sessions = await options.sourceControl.sessions.listByProjectRepository({
      projectRepositoryId: options.projectRepositoryId,
    });
    await Promise.all(
      sessions.map(session =>
        this.retireSession({
          sourceControl: options.sourceControl,
          ...(options.workItems ? { workItems: options.workItems } : {}),
          orgId: options.orgId,
          sessionId: session.sessionId,
          deleteSession: true,
        }),
      ),
    );
  }

  async #retireSession(input: RetireSessionInput): Promise<void> {
    const session = await input.sourceControl.sessions.getBySessionId(input.sessionId);
    if (!session || session.orgId !== input.orgId) return;

    try {
      await this.#teardownSessionSandbox(input, session);
    } finally {
      await this.#invalidate(session);

      if (input.deleteSession) {
        // Refs first: clearing again is a no-op, but refs on a deleted row would dangle forever.
        await input.workItems?.clearSessionReferences({ orgId: input.orgId, sessionId: input.sessionId });
        await input.sourceControl.sessions.delete(session.id);
      }
    }
  }

  async #teardownSessionSandbox(input: RetireSessionInput, session: SourceControlSession): Promise<void> {
    const entry = peekSessionSandbox(session.id);
    if (!entry) {
      await this.#destroyDetachedSandbox(input, session);
      return;
    }

    // A session booted from its factory environment tears every repository
    // down in position order, each in its own directory; a failure is logged
    // and the next repository still runs.
    const environmentTeardown = peekSessionEnvironmentTeardown(session.sessionId);
    if (environmentTeardown.length > 0) {
      for (const repo of environmentTeardown) {
        try {
          await runTeardownCommand(requireExec(entry.sandbox), repo.dir, repo.command, {
            timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
          });
        } catch (error) {
          this.#warn('Factory teardown command failed', {
            orgId: session.orgId,
            sessionId: session.sessionId,
            projectRepositoryId: session.projectRepositoryId,
            repository: repo.slug,
            error: boundedError(error),
          });
        }
      }
      await this.#releaseSandbox(input, session);
      return;
    }

    let projectRepository: ProjectRepository | null | undefined;
    try {
      projectRepository = session.projectRepositoryId
        ? await input.sourceControl.projectRepositories.get({ orgId: input.orgId, id: session.projectRepositoryId })
        : null;
    } catch (error) {
      this.#warn('Factory repository settings could not be loaded for session retirement', {
        orgId: session.orgId,
        sessionId: session.sessionId,
        projectRepositoryId: session.projectRepositoryId,
        error: boundedError(error),
      });
    }

    // An unresolved workdir means the sandbox never started in this process:
    // nothing was set up, so there is nothing for a teardown command to undo.
    if (projectRepository?.teardownCommand && entry.workdir) {
      try {
        await runTeardownCommand(requireExec(entry.sandbox), entry.workdir, projectRepository.teardownCommand, {
          timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
        });
      } catch (error) {
        this.#warn('Factory teardown command failed', {
          orgId: session.orgId,
          sessionId: session.sessionId,
          projectRepositoryId: session.projectRepositoryId,
          error: boundedError(error),
        });
      }
    }

    await this.#releaseSandbox(input, session);
  }

  /**
   * Destroy a deleted session's VM that this process never attached to. Only
   * for sessions that materialized (a persisted `sandboxId`): nothing is
   * started, no teardown command runs — the provider kills by identity.
   */
  async #destroyDetachedSandbox(input: RetireSessionInput, session: SourceControlSession): Promise<void> {
    if (!input.deleteSession || !session.sandboxId || !this.#sandbox) return;
    try {
      await destroyDetachedSessionSandbox({ sandbox: this.#sandbox, session });
    } catch (error) {
      this.#warn('Factory detached session sandbox destroy failed', {
        orgId: session.orgId,
        sessionId: session.sessionId,
        projectRepositoryId: session.projectRepositoryId,
        error: boundedError(error),
      });
    }
  }

  /** Bump the session's workspace generation; a failing unregister is logged, never fatal. */
  async #invalidate(session: SourceControlSession): Promise<void> {
    try {
      await this.#invalidateSession(session.sessionId);
    } catch (error) {
      this.#warn('Factory session workspace cache invalidation failed', {
        orgId: session.orgId,
        sessionId: session.sessionId,
        projectRepositoryId: session.projectRepositoryId,
        error: boundedError(error),
      });
    }
  }

  async #recreateSessionSandbox(input: RecreateSessionSandboxInput): Promise<'recreated' | 'not-found'> {
    const session = await input.sourceControl.sessions.getBySessionId(input.sessionId);
    if (!session || session.orgId !== input.orgId) return 'not-found';

    // Bump the generation first so an in-flight start hook for the old
    // instance throws instead of republishing its sandbox id.
    await this.#invalidate(session);
    const entry = peekSessionSandbox(session.id);
    evictSessionSandbox(session.id);

    await this.#destroyForRecreate(session, entry?.sandbox);
    await input.sourceControl.sessions.setSandbox({ id: session.id, sandboxId: null, sandboxWorkdir: '' });

    // A resolve that ran between the eviction and clearing the id could have
    // built a fresh instance from the old `sandboxId`; drop it and fence it.
    evictSessionSandbox(session.id);
    await this.#invalidate(session);
    return 'recreated';
  }

  async #resetSessionSandbox(input: RecreateSessionSandboxInput): Promise<'reset' | 'not-found' | 'not-here'> {
    const session = await input.sourceControl.sessions.getBySessionId(input.sessionId);
    if (!session || session.orgId !== input.orgId) return 'not-found';
    const sandbox = peekSessionSandbox(session.id)?.sandbox;
    if (!sandbox) return 'not-here';

    // The provider's own destroy, not the lifecycle wrapper: the wrapper marks
    // the instance destroyed for good. Bounded, so a VM that won't answer
    // can't hold the session lock.
    if (!(await this.#settledWithin(this.#destroyDirectly(sandbox)))) {
      throw new Error('Timed out destroying the sandbox. Try again.');
    }
    // A start still in flight on the old VM would set the status after this
    // reset does. Its commands fail fast once the VM is gone.
    const starting = (sandbox as { _startPromise?: Promise<unknown> })._startPromise;
    if (
      starting &&
      !(await this.#settledWithin(
        starting.then(
          () => {},
          () => {},
        ),
      ))
    ) {
      throw new Error('The old sandbox is still starting. Try again.');
    }

    sandbox.status = 'stopped';
    // The new VM runs setup from scratch, including commands that failed on the old one.
    clearFailedSetupCommands(session.id);
    await input.sourceControl.sessions.setSandbox({
      id: session.id,
      sandboxId: null,
      sandboxWorkdir: session.sandboxWorkdir ?? '',
    });
    return 'reset';
  }

  /**
   * Destroy the session's VM. `_destroy()` silently no-ops on a never-started
   * (`pending`) instance, so pending and detached instances call the
   * provider's `destroy()` directly; a started instance goes through the
   * lifecycle wrapper, bounded so a hung start can't hold the session lock.
   */
  async #destroyForRecreate(session: SourceControlSession, memo: WorkspaceSandbox | undefined): Promise<void> {
    const lifecycle = memo as { _destroy?: () => Promise<void> } | undefined;
    if (memo && memo.status !== 'pending' && lifecycle?._destroy) {
      const destroying = lifecycle._destroy.call(memo);
      if (await this.#settledWithin(destroying)) {
        memo.status = 'destroyed';
        return;
      }
      // Load-bearing: once the hung start settles, this destroy reaps any VM it
      // provisioned. Its rejection must never surface as unhandled.
      destroying.catch(error =>
        this.#warn('Factory sandbox destroy failed after recreate stopped waiting', {
          orgId: session.orgId,
          sessionId: session.sessionId,
          error: boundedError(error),
        }),
      );
      if (!this.#sandbox) {
        throw new Error(
          'Timed out destroying the session sandbox, and no sandbox provider is configured to retry by identity.',
        );
      }
      await this.#destroyDetachedForRecreate(this.#sandbox, session);
      memo.status = 'destroyed';
      return;
    }

    if (memo) {
      await this.#destroyDirectly(memo);
      memo.status = 'destroyed';
      return;
    }

    // No instance in this process (restart, or another replica opened it):
    // destroy through a never-started instance carrying the persisted id.
    // Unlike retirement, this runs without a `sandboxId` too: E2B and Docker
    // find the VM by session identity, and Platform's destroy no-ops safely.
    if (this.#sandbox) await this.#destroyDetachedForRecreate(this.#sandbox, session);
  }

  async #destroyDetachedForRecreate(sandbox: FactorySandbox, session: SourceControlSession): Promise<void> {
    try {
      await destroyDetachedSessionSandbox({ sandbox, session });
    } catch (error) {
      if (!isSandboxGoneError(error)) throw error;
    }
  }

  /** True when the destroy finished in time; false on timeout. Gone-VM errors count as finished. */
  async #settledWithin(destroying: Promise<void>): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>(resolve => {
      timer = setTimeout(() => resolve(false), this.#destroyTimeoutMs);
    });
    try {
      return await Promise.race([destroying.then(() => true as const), timedOut]);
    } catch (error) {
      if (isSandboxGoneError(error)) return true;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async #destroyDirectly(sandbox: WorkspaceSandbox): Promise<void> {
    try {
      await sandbox.destroy?.();
    } catch (error) {
      if (!isSandboxGoneError(error)) throw error;
    }
  }

  async #releaseSandbox(input: RetireSessionInput, session: SourceControlSession): Promise<void> {
    try {
      await releaseSessionSandbox({ sessionId: session.id, destroy: input.deleteSession });
    } catch (error) {
      this.#warn('Factory session sandbox release failed', {
        orgId: session.orgId,
        sessionId: session.sessionId,
        projectRepositoryId: session.projectRepositoryId,
        error: boundedError(error),
      });
    }
  }
}
