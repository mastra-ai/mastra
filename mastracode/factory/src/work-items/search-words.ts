/** The words of a typed search, lowercased. */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether every word is somewhere in `text`, which the caller has lowercased. */
export function hasEveryWord(text: string, words: readonly string[]): boolean {
  return words.every(word => text.includes(word));
}
