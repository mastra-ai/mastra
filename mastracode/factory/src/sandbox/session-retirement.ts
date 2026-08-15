import { cleanReleasedSandbox } from '../integrations/github/sandbox-release.js';
import { runWorktreeTeardown } from '../integrations/github/sandbox.js';
import type {
  ProjectRepository,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { MaterializationSandbox, SandboxBindingStore, SandboxFleet } from './fleet.js';

type RetirementFleet = Pick<SandboxFleet, 'provider' | 'reattachSandbox' | 'teardownSandbox'>;
type WarningLogger = (message: string, details: Record<string, unknown>) => void;

export interface SessionRetirementCoordinatorOptions {
  fleet: RetirementFleet;
  invalidateSession?: (sessionId: string) => Promise<void> | void;
  warn?: WarningLogger;
}

export interface RetireSessionInput {
  sourceControl: SourceControlStorageHandle;
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
 * run teardown concurrently. Once the sandbox binding is cleared, later calls
 * are idempotent no-ops apart from cache invalidation or requested row deletion.
 */
export class SessionRetirementCoordinator {
  readonly #fleet: RetirementFleet;
  readonly #invalidateSession: NonNullable<SessionRetirementCoordinatorOptions['invalidateSession']>;
  readonly #warn: WarningLogger;
  readonly #locks = new Map<string, Promise<void>>();

  constructor(options: SessionRetirementCoordinatorOptions) {
    this.#fleet = options.fleet;
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
      let sandbox: MaterializationSandbox | undefined;

      if (session.sandboxId && session.sandboxWorkdir) {
        try {
          sandbox = await this.#fleet.reattachSandbox(session.sandboxId, {
            actingUserId: session.userId,
            ...(this.#fleet.provider === 'local' ? { workingDirectory: session.sandboxWorkdir } : {}),
          });
        } catch (error) {
          this.#warn('Factory session sandbox could not be reattached for retirement', {
            orgId: session.orgId,
            sessionId: session.sessionId,
            projectRepositoryId: session.projectRepositoryId,
            sandboxId: session.sandboxId,
            error: boundedError(error),
          });
        }

        if (sandbox && projectRepository?.teardownCommand) {
          try {
            await runWorktreeTeardown(sandbox, session.sandboxWorkdir, projectRepository.teardownCommand);
          } catch (error) {
            this.#warn('Factory worktree teardown failed', {
              orgId: session.orgId,
              sessionId: session.sessionId,
              projectRepositoryId: session.projectRepositoryId,
              sandboxId: session.sandboxId,
              error: boundedError(error),
            });
          }
        }

        if (this.#fleet.provider === 'local') {
          await this.#destroyLocalSandbox(input.sourceControl, session, sandbox);
        } else {
          await this.#releaseRemoteSandbox(input.sourceControl, session, sandbox);
        }
      }
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

      if (input.deleteSession) await input.sourceControl.sessions.delete(session.id);
    }
  }

  async #releaseRemoteSandbox(
    sourceControl: SourceControlStorageHandle,
    session: SourceControlSession,
    sandbox: MaterializationSandbox | undefined,
  ): Promise<void> {
    const sandboxId = session.sandboxId;
    const sandboxWorkdir = session.sandboxWorkdir;
    if (!sandboxId || !sandboxWorkdir) return;
    await cleanReleasedSandbox({
      fleet: this.#fleet,
      sourceControl,
      orgId: session.orgId,
      projectRepositoryId: session.projectRepositoryId,
      sandboxId,
      sandboxWorkdir,
      actingUserId: session.userId,
      ...(sandbox ? { sandbox } : {}),
    });
    try {
      await sourceControl.sandboxPool.release({
        orgId: session.orgId,
        projectRepositoryId: session.projectRepositoryId,
        userId: session.userId,
        sandboxId,
        sandboxWorkdir,
      });
    } catch (error) {
      this.#warn('Factory remote sandbox release failed', {
        orgId: session.orgId,
        sessionId: session.sessionId,
        projectRepositoryId: session.projectRepositoryId,
        sandboxId,
        error: boundedError(error),
      });
    }
    try {
      await sourceControl.sessions.setSandbox({ id: session.id, sandboxId: null, sandboxWorkdir });
    } catch (error) {
      this.#warn('Factory remote sandbox binding could not be cleared', {
        orgId: session.orgId,
        sessionId: session.sessionId,
        projectRepositoryId: session.projectRepositoryId,
        sandboxId,
        error: boundedError(error),
      });
    }
  }

  async #destroyLocalSandbox(
    sourceControl: SourceControlStorageHandle,
    session: SourceControlSession,
    sandbox: MaterializationSandbox | undefined,
  ): Promise<void> {
    const sandboxWorkdir = session.sandboxWorkdir ?? '';
    const binding: SandboxBindingStore = {
      get sandboxId() {
        return session.sandboxId;
      },
      setSandboxId: async sandboxId => {
        await sourceControl.sessions.setSandbox({ id: session.id, sandboxId, sandboxWorkdir });
        session.sandboxId = sandboxId;
      },
      clear: async () => {
        await sourceControl.sessions.setSandbox({ id: session.id, sandboxId: null, sandboxWorkdir });
        session.sandboxId = null;
      },
    };
    try {
      await this.#fleet.teardownSandbox(binding, sandbox);
    } catch (error) {
      this.#warn('Factory local sandbox destruction failed', {
        orgId: session.orgId,
        sessionId: session.sessionId,
        projectRepositoryId: session.projectRepositoryId,
        sandboxId: session.sandboxId,
        error: boundedError(error),
      });
    }
    if (session.sandboxId) {
      try {
        await sourceControl.sessions.setSandbox({ id: session.id, sandboxId: null, sandboxWorkdir });
        session.sandboxId = null;
      } catch (error) {
        this.#warn('Factory local sandbox binding could not be cleared', {
          orgId: session.orgId,
          sessionId: session.sessionId,
          projectRepositoryId: session.projectRepositoryId,
          sandboxId: session.sandboxId,
          error: boundedError(error),
        });
      }
    }
  }
}
