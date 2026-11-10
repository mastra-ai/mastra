import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { BoardRegistry } from '../boards/registry.js';
import { boardForWorkItem } from '../boards/semantics.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SessionRetirementCoordinator } from './session-retirement.js';

type WarningLogger = (message: string, details: Record<string, unknown>) => void;

export interface ContextSandboxStopsOptions {
  workItems: Pick<WorkItemsStorage, 'get'>;
  boards: BoardRegistry | ProjectBoardSource;
  sessions: Pick<SourceControlSessionLookup, 'getSourceControlBySessionId'>;
  retirement: Pick<SessionRetirementCoordinator, 'stopSessionSandbox'>;
  /**
   * The run in flight on the session in this process, with a promise that
   * settles when it ends, or `null` when none is. A run holds its sandbox until it ends: the agent whose own
   * tool call left the context is still returning from it, and a person may
   * be mid-conversation in the session.
   */
  runInFlight: (sessionId: string) => Promise<{ ended: Promise<void> } | null>;
  warn?: WarningLogger;
}

export interface ContextLeftArgs {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  /** The context the card left. */
  context: string;
  /** Revision the move committed at. */
  revision: number;
}

function sessionIdOf(item: Card, context: string): string | undefined {
  return item.sessions[context]?.sessionId;
}

/**
 * Stop the sandbox of the context a card just left (Triage → Planning stops
 * the triage session's sandbox). The session row, its files and its refs
 * stay, so a card that comes back resumes the same sandbox.
 *
 * A session with a run in flight is stopped when that run ends; the run is
 * not awaited here, since it may be the very tool call waiting on this
 * transition. Best-effort throughout: failures are logged, never thrown.
 */
export function createContextSandboxStops(options: ContextSandboxStopsOptions) {
  const warn = options.warn ?? ((message, details) => console.warn(`[Mastra Factory] ${message}`, details));
  const boards = toBoardSource(options.boards);

  /** The left context's session, unless the card is back in that context or holds the session under its new one. */
  const leftSession = async (args: ContextLeftArgs, expectedRevision?: number): Promise<string | undefined> => {
    const item = await options.workItems.get({ orgId: args.orgId, id: args.workItemId });
    if (!item) return undefined;
    if (expectedRevision !== undefined && item.revision !== expectedRevision) return undefined;
    const sessionId = sessionIdOf(item, args.context);
    if (!sessionId) return undefined;
    const stage = item.stages.length === 1 ? item.stages[0] : undefined;
    const registry = await boards.load({ orgId: args.orgId, factoryProjectId: args.factoryProjectId });
    const current = stage === undefined ? undefined : registry.get(boardForWorkItem(item))?.roleForPhase(stage);
    if (current !== undefined && sessionIdOf(item, current) === sessionId) return undefined;
    return sessionId;
  };

  const stop = async (args: ContextLeftArgs, sessionId: string): Promise<void> => {
    const sourceControl = await options.sessions.getSourceControlBySessionId(sessionId);
    if (!sourceControl) return;
    await options.retirement.stopSessionSandbox({ sourceControl, orgId: args.orgId, sessionId });
  };

  return async (args: ContextLeftArgs): Promise<void> => {
    try {
      // Like terminal cleanup: a card re-entered before this ran keeps its sandbox.
      const sessionId = await leftSession(args, args.revision);
      if (!sessionId) return;
      const run = await options.runInFlight(sessionId);
      if (!run) {
        await stop(args, sessionId);
        return;
      }
      // The revision may move on while the run ends (an attached pull
      // request bumps it), so only coming back to the context keeps the sandbox.
      void run.ended
        .then(async () => {
          if ((await leftSession(args)) === sessionId) await stop(args, sessionId);
        })
        .catch(error => warn('Factory context sandbox stop failed', { ...args, sessionId, error: String(error) }));
    } catch (error) {
      warn('Factory context sandbox stop failed', { ...args, error: String(error) });
    }
  };
}

/**
 * Retire every session a finished card holds: each sandbox is stopped, not
 * destroyed, by identity when this process never attached to it, so a card
 * finished on another replica still stops its sandboxes.
 */
export function createTerminalSandboxStops(options: {
  workItems: Pick<WorkItemsStorage, 'get'>;
  sessions: Pick<SourceControlSessionLookup, 'getSourceControlBySessionId'>;
  retirement: Pick<SessionRetirementCoordinator, 'retireSession'>;
}) {
  return async ({ orgId, workItemId }: { orgId: string; workItemId: string }): Promise<void> => {
    const item = await options.workItems.get({ orgId, id: workItemId });
    if (!item) return;
    const sessionIds = [...new Set(Object.values(item.sessions).map(session => session.sessionId))];
    await Promise.all(
      sessionIds.map(async sessionId => {
        const sourceControl = await options.sessions.getSourceControlBySessionId(sessionId);
        if (!sourceControl) return;
        await options.retirement.retireSession({ sourceControl, orgId, sessionId, deleteSession: false });
      }),
    );
  };
}
