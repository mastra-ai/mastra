import { releaseSessionSandbox } from '../integrations/github/sandbox-release.js';
import { DEFAULT_COMMAND_TIMEOUT_MS, runTeardownCommand } from '../integrations/github/sandbox.js';
import type {
  ProjectRepository,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { requireExec } from './materialization.js';
import { peekSessionSandbox } from './session-sandbox.js';

type WarningLogger = (message: string, details: Record<string, unknown>) => void;

export interface SessionRetirementCoordinatorOptions {
  invalidateSession?: (sessionId: string) => Promise<void> | void;
  warn?: WarningLogger;
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
 * Sessions opened on another replica have no memo entry here — their VMs are
 * left to the provider's idle lifecycle (pause / idle GC), which is the
 * provider-owned half of the contract.
 */
export class SessionRetirementCoordinator {
  readonly #invalidateSession: NonNullable<SessionRetirementCoordinatorOptions['invalidateSession']>;
  readonly #warn: WarningLogger;
  readonly #locks = new Map<string, Promise<void>>();

  constructor(options: SessionRetirementCoordinatorOptions = {}) {
    this.#invalidateSession = options.invalidateSession ?? (() => {});
    this.#warn = options.warn ?? ((message, details) => console.warn(`[Mastra Factory] ${message}`, details));
  }

  async retireSession(input: RetireSessionInput): Promise<void> {
    const previous = this.#locks.get(input.sessionId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(() => this.#retireSession(input));
    this.#locks.set(input.sessionId, current);
    try {
      await current;
    } finally {
      if (this.#locks.get(input.sessionId) === current) this.#locks.delete(input.sessionId);
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

      if (input.deleteSession) {
        // Refs first: clearing again is a no-op, but refs on a deleted row would dangle forever.
        await input.workItems?.clearSessionReferences({ orgId: input.orgId, sessionId: input.sessionId });
        await input.sourceControl.sessions.delete(session.id);
      }
    }
  }

  async #teardownSessionSandbox(input: RetireSessionInput, session: SourceControlSession): Promise<void> {
    const entry = peekSessionSandbox(session.id);
    if (!entry) return;

    let projectRepository: ProjectRepository | null | undefined;
    try {
      projectRepository = await input.sourceControl.projectRepositories.get({
        orgId: input.orgId,
        id: session.projectRepositoryId,
      });
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
