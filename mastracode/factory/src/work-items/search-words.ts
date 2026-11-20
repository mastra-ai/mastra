/** The words of a typed search, lowercased. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * A typed search as the server is asked it: its words, lowercased, one space apart. Searches that
 * differ only in case or spacing find the same cards, so they share one request and one cached answer.
 */
export function searchQuery(query: string): string {
  return searchWords(query).join(' ');
}
