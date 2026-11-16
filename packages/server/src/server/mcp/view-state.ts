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
 * What a view shows now. `version` grows with every change, so the view's poll picks up only changes it hasn't
 * seen; `by` says whether the model or the user (through the view) made the latest one. `state` is null until
 * either changes the view, which then shows what its opening tool call returned.
 */
export type ViewRecord = { version: number; by: 'model' | 'app'; state: ViewState | null };

/** A view the host keeps showing outlives a conversation turn; one left alone for this long starts over. */
export const VIEW_TTL_MS = 60 * 60 * 1000;

/**
 * A view's changes, oldest first, each with the index the cache gave it. The cache hands out indexes and appends
 * in one step, so changes from any number of server instances get a single order without a lock. The braces put
 * the log and its counter in one Redis Cluster slot, which keeps that step one atomic script there.
 */
const logKey = (viewId: string) => `mastra:mcp-apps:view:{${viewId}}`;
const counterKey = (viewId: string) => `${logKey(viewId)}:n`;

/** One change. `base` is the version a view's report was made against; the model's changes have none. */
type Change = { by: ViewRecord['by']; state: ViewState; base?: number; index: number };

/** A report made against an older version than the one it landed after lost to that change. */
const applies = (change: Change) => change.base === undefined || change.base === change.index;

/** Recent changes are enough to find the latest that applied: refused reports only pile up in a race. */
const RECENT = 16;

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

async function ownerTag(owner: string | null, nonce: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${owner ?? ''}\n${nonce}`));
  return [...new Uint8Array(digest, 0, 12)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * A new view id for `owner`. The id carries a hash binding it to its owner, so opening a view stores nothing:
 * the explorer's own tool calls open views on every page and filter change, and the cache only holds views
 * someone has changed.
 */
export async function openView(owner: string | null): Promise<string> {
  const nonce = crypto.randomUUID();
  return `${nonce}.${await ownerTag(owner, nonce)}`;
}

/** Someone else's view answers exactly like a malformed id, so view ids can't be probed. */
async function checkOwner(viewId: string, owner: string | null): Promise<void> {
  const [nonce, tag, ...rest] = viewId.split('.');
  if (!nonce || !tag || rest.length > 0 || tag !== (await ownerTag(owner, nonce))) {
    throw toolError(404, `No open view ${viewId}. Open the explorer again.`);
  }
}

/** What the view shows, or a 404 when the id isn't one of `owner`'s. A view nobody changed is at version 0. */
export async function readView(cache: MastraServerCache, viewId: string, owner: string | null): Promise<ViewRecord> {
  await checkOwner(viewId, owner);
  const recent = (await cache.listFromTo(logKey(viewId), -RECENT)) as Change[];
  if (recent.length === 0) return { version: 0, by: 'model', state: null };
  const latest = (changes: Change[]) =>
    changes.filter(applies).reduce<Change | undefined>((a, b) => (a && a.index > b.index ? a : b), undefined);
  const last =
    latest(recent) ??
    (recent.length === RECENT ? latest((await cache.listFromTo(logKey(viewId), 0)) as Change[]) : undefined);
  const version = Math.max(...recent.map(change => change.index)) + 1;
  return last ? { version, by: last.by, state: last.state } : { version, by: 'model', state: null };
}

/**
 * Changes what the view shows. With `base`, only when nothing else changed it after that version: the view
 * reports the user's changes against the version it shows, so a report made before it saw the model's latest
 * change can't undo that change (a 409; the view applies the change on its next poll). The model's changes
 * always win. The change is appended either way; a refused one never counts as what the view shows.
 */
export async function writeView(
  cache: MastraServerCache,
  viewId: string,
  owner: string | null,
  state: ViewState,
  by: ViewRecord['by'],
  base?: number,
): Promise<ViewRecord> {
  await checkOwner(viewId, owner);
  const change = base === undefined ? { by, state } : { by, state, base };
  const index = await cache.listPushIndexed(logKey(viewId), counterKey(viewId), change, VIEW_TTL_MS);
  if (!applies({ ...change, index })) {
    throw toolError(409, `View ${viewId} changed since version ${base}; it is now at ${index + 1}.`);
  }
  return { version: index + 1, by, state };
}
