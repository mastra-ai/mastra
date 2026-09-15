/** Bound on a free-text `q` param before it reaches a provider's search API. */
export const SEARCH_QUERY_MAX_LENGTH = 200;

/** `undefined` when absent or blank, `null` when it must be rejected. */
export function parseSearchQuery(raw: string | undefined): string | undefined | null {
  const query = raw?.trim();
  if (!query) return undefined;
  return query.length > SEARCH_QUERY_MAX_LENGTH ? null : query;
}
