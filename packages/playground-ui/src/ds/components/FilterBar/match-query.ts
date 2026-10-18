/** Every whitespace-separated term of `query` must appear in `text` (case-insensitive). */
export function matchesQuery(text: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  return terms.every(term => haystack.includes(term));
}

/** Base UI `filter` for `ComboboxPrimitive.Root`, matching on the item label. */
export function matchesQueryFilter<T>(item: T, query: string, itemToString?: (item: T) => string): boolean {
  return matchesQuery(itemToString ? itemToString(item) : String(item), query);
}
