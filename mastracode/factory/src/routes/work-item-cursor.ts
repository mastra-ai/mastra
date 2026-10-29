/** Sorts and the keyset cursor of the paged work-items list, shared by the route contract and the pager. */

/** The board's sorts; the same names the board UI stores in its view settings. */
export const WORK_ITEM_SORTS = ['recent', 'recent-mine', 'created-newest', 'created-oldest'] as const;
export type WorkItemSort = (typeof WORK_ITEM_SORTS)[number];

export interface WorkItemPageCursor {
  key: string;
  id: string;
}

export function encodeWorkItemCursor(cursor: WorkItemPageCursor): string {
  return Buffer.from(JSON.stringify([cursor.key, cursor.id]), 'utf8').toString('base64url');
}

export function decodeWorkItemCursor(value: string): WorkItemPageCursor | undefined {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(decoded) || decoded.length !== 2) return undefined;
    const [key, id] = decoded as unknown[];
    return typeof key === 'string' && typeof id === 'string' ? { key, id } : undefined;
  } catch {
    return undefined;
  }
}

/** Where a board's sync left off: the newest card write or delete it has seen. */
export function encodeWorkItemSyncCursor(at: Date): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString() }), 'utf8').toString('base64url');
}

export function decodeWorkItemSyncCursor(value: string): Date | undefined {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (!decoded || typeof decoded !== 'object' || !('at' in decoded) || typeof decoded.at !== 'string') {
      return undefined;
    }
    const at = new Date(decoded.at);
    return Number.isNaN(at.getTime()) ? undefined : at;
  } catch {
    return undefined;
  }
}
