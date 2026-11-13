import type { MastraServerCache } from '@mastra/core/cache';
import type { RequestContext } from '@mastra/core/request-context';
import { MASTRA_NORMALIZED_USER_KEY, MASTRA_RESOURCE_ID_KEY, MASTRA_USER_KEY } from '../constants';
import { toolError } from './catalogue';

/** The explorer tools whose arguments say what a view shows; the explorer opens on the same arguments. */
export const STEERABLE_TOOLS = ['query_traces', 'list_traces', 'list_logs', 'analyze_metrics'] as const;
export type SteerableTool = (typeof STEERABLE_TOOLS)[number];

/**
 * What an open explorer shows: the list it would get from `tool` called with `args` (without `tool`, the list it
 * opened with), and the trace open over it.
 */
export type ViewState = {
  tool?: SteerableTool;
  args?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  /** What the user has on screen, in words, as the view last reported it (its filters, tab, open span). */
  context?: string;
};

/**
 * A view's record in the server cache. `version` grows with every change, so the view's poll picks up only
 * changes it hasn't seen; `by` says whether the model or the user (through the view) made the latest one.
 * `state` is null until either changes the view, which then shows what its opening tool call returned.
 */
export type ViewRecord = { owner: string | null; version: number; by: 'model' | 'app'; state: ViewState | null };

/** A view the host keeps showing outlives a conversation turn; one left alone for this long can't be steered. */
export const VIEW_TTL_MS = 60 * 60 * 1000;

const key = (viewId: string) => `mastra:mcp-apps:view:${viewId}`;

/**
 * Who may read and change a view: the signed-in user, else the resource the auth layer set. Without auth
 * (local `mastra dev`) anyone holding the view id can, the same as they could call the tools themselves.
 */
export function viewOwner(requestContext: RequestContext): string | null {
  const normalized = requestContext.get(MASTRA_NORMALIZED_USER_KEY) as { id?: unknown } | undefined;
  if (typeof normalized?.id === 'string') return `user:${normalized.id}`;
  const user = requestContext.get(MASTRA_USER_KEY) as { id?: unknown; sub?: unknown } | undefined;
  const id = user?.id ?? user?.sub;
  if (typeof id === 'string' || typeof id === 'number') return `user:${id}`;
  const resource = requestContext.get(MASTRA_RESOURCE_ID_KEY);
  return typeof resource === 'string' ? `resource:${resource}` : null;
}

/** Records a new view for `owner` and returns its id. */
export async function openView(cache: MastraServerCache, owner: string | null): Promise<string> {
  const viewId = crypto.randomUUID();
  const record: ViewRecord = { owner, version: 0, by: 'model', state: null };
  await cache.set(key(viewId), record, VIEW_TTL_MS);
  return viewId;
}

/** The view's record, or a 404 when it expired, never existed, or belongs to someone else. */
export async function readView(cache: MastraServerCache, viewId: string, owner: string | null): Promise<ViewRecord> {
  const record = (await cache.get(key(viewId))) as ViewRecord | undefined | null;
  // Someone else's view answers exactly like a missing one, so view ids can't be probed.
  if (!record || record.owner !== owner) {
    throw toolError(404, `No open view ${viewId}. It may have expired; open the explorer again.`);
  }
  return record;
}

/**
 * Replaces what the view shows. With `base`, only when the record is still at that version: the view reports
 * the user's changes against the version it shows, so a report made before it saw the model's latest change
 * can't undo that change (a 409; the view applies the change on its next poll). The model's changes always win.
 */
export async function writeView(
  cache: MastraServerCache,
  viewId: string,
  owner: string | null,
  state: ViewState,
  by: ViewRecord['by'],
  base?: number,
): Promise<ViewRecord> {
  const current = await readView(cache, viewId, owner);
  if (base !== undefined && current.version !== base) {
    throw toolError(409, `View ${viewId} changed since version ${base}; it is now at ${current.version}.`);
  }
  const record: ViewRecord = { owner, version: current.version + 1, by, state };
  await cache.set(key(viewId), record, VIEW_TTL_MS);
  return record;
}
