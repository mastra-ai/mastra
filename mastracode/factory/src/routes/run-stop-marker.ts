import type { MiddlewareHandler } from 'hono';

import type { FactoryBoardEngine } from '../board-engine/engine.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { RouteAuth } from './route.js';
import { SESSION_PATH } from './session-access.js';

/**
 * Records a session abort request on the session's Factory run bindings before the abort runs, so
 * the dispatcher settles the run as stopped instead of retrying it. Only explicit client requests
 * pass through here; a process going away aborts without one, and that run still retries.
 *
 * Once the abort succeeded, a board engine that keeps what a card is doing hears that a person
 * stopped the run of each card the session was bound to, when a run was going on the session. A
 * Stop with none going (a run waiting out its retry, or queued) stops nothing: the next attempt
 * clears the stop request and runs.
 */
export function createRunStopMarker({
  auth,
  workItems,
  boardEngine = () => undefined,
  runInFlight = async () => false,
}: {
  auth: Pick<RouteAuth, 'enabled' | 'ensureUser' | 'tenant'>;
  workItems: () => Pick<WorkItemsStorage, 'requestRunBindingStop' | 'listRunBindingsForSession'> | undefined;
  boardEngine?: () => Pick<FactoryBoardEngine, 'runStopped'> | undefined;
  /** Whether a run is going on the session, read before the abort ends it. */
  runInFlight?: (sessionId: string) => Promise<boolean>;
}): MiddlewareHandler {
  const callerOrgId = async (c: Parameters<MiddlewareHandler>[0]): Promise<string | undefined> => {
    if (!auth.enabled()) return 'local';
    await auth.ensureUser(c);
    return auth.tenant(c)?.orgId;
  };
  return async (c, next) => {
    // The session the access guard authorized, and only when the rest of the path is the abort route.
    const match = c.req.method === 'POST' ? SESSION_PATH.exec(c.req.path) : null;
    const aborts = match !== null && c.req.path.slice(match.index + match[0].length) === '/abort';
    const storage = aborts ? workItems() : undefined;
    if (!match || !storage) return next();
    const sessionId = decodeURIComponent(match[1]!);
    const engine = boardEngine();
    let stopped: Parameters<NonNullable<FactoryBoardEngine['runStopped']>>[0][] = [];
    try {
      const orgId = await callerOrgId(c);
      if (orgId) {
        await storage.requestRunBindingStop({ orgId, sessionId, at: new Date() });
        // The seats the stop is for, read before the abort can end them.
        if (engine?.runStopped && (await runInFlight(sessionId))) {
          stopped = (await storage.listRunBindingsForSession({ orgId, sessionId }))
            .filter(binding => binding.status === 'active')
            .map(({ orgId, factoryProjectId, workItemId, role }) => ({ orgId, factoryProjectId, workItemId, role }));
        }
      }
    } catch (error) {
      // Stop still stops; only the retry decision loses its signal.
      console.warn('[Factory] Could not record a stop request', {
        path: c.req.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await next();
    if (c.res.status >= 300) return;
    for (const seat of stopped) {
      // The abort is answered without waiting on the card's run.
      void engine?.runStopped?.(seat).catch((error: unknown) =>
        console.warn("[Factory] Could not tell a card's board run that its run was stopped", {
          workItemId: seat.workItemId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };
}
