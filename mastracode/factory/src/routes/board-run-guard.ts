import type { MiddlewareHandler } from 'hono';

const WORKFLOW_PATH = /\/workflows\/([^/]+)(?:\/|$)/;

/**
 * Answers 404 for the host's workflow routes on the workflows a board engine runs cards on. Those
 * runs belong to no one org and hold what each card is doing; the engine drives them in process,
 * so nothing a caller is meant to do goes through these routes.
 */
export function createBoardRunGuard(workflowIds: () => readonly string[]): MiddlewareHandler {
  return async (c, next) => {
    const match = WORKFLOW_PATH.exec(c.req.path);
    if (!match) return next();
    let workflowId = match[1]!;
    try {
      workflowId = decodeURIComponent(workflowId);
    } catch {
      // A path that doesn't decode names no workflow of ours.
    }
    if (!workflowIds().includes(workflowId)) return next();
    return c.json({ error: 'Not found' }, 404);
  };
}
