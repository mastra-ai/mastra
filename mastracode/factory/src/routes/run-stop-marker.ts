import type { MiddlewareHandler } from 'hono';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

const SESSION_ABORT_PATH = /\/agent-controller\/[^/]+\/sessions\/([^/]+)\/abort\/?$/;

/**
 * Records a session abort request on the session's Factory run bindings before the abort runs, so
 * the dispatcher settles the run as stopped instead of retrying it. Only explicit client requests
 * pass through here; a process going away aborts without one, and that run still retries.
 */
export function createRunStopMarker(
  workItems: () => Pick<WorkItemsStorage, 'requestRunBindingStop'> | undefined,
): MiddlewareHandler {
  return async (c, next) => {
    const match = c.req.method === 'POST' ? SESSION_ABORT_PATH.exec(c.req.path) : null;
    const storage = match ? workItems() : undefined;
    if (!match || !storage) return next();
    try {
      await storage.requestRunBindingStop({ sessionId: decodeURIComponent(match[1]!), at: new Date() });
    } catch (error) {
      // Stop still stops; only the retry decision loses its signal.
      console.warn('[Factory] Could not record a stop request', {
        path: c.req.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return next();
  };
}
