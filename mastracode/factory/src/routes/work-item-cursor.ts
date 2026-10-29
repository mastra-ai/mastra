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
