const WORD_RE = /[A-Za-z_$][\w$]{1,}/g;

/**
 * Scan the document for identifiers matching the current prefix. Same shape as
 * CodeMirror's `completeAnyWord` — the trailing partial word under the cursor
 * seeds the candidates list, ranked by recency (proximity to the caret).
 */
export function candidatesForPrefix(text: string, cursorOffset: number, limit = 8): string[] {
  const before = text.slice(0, cursorOffset);
  const prefixMatch = before.match(/([A-Za-z_$][\w$]*)$/);
  const prefix = prefixMatch?.[1] ?? '';
  if (prefix.length < 2) return [];
  const seen = new Set<string>([prefix]);
  const words: { word: string; distance: number }[] = [];
  let match: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((match = WORD_RE.exec(text))) {
    const word = match[0];
    if (seen.has(word)) continue;
    if (!word.startsWith(prefix)) continue;
    if (word === prefix) continue;
    seen.add(word);
    words.push({ word, distance: Math.abs(match.index - cursorOffset) });
  }
  words.sort((a, b) => a.distance - b.distance);
  return words.slice(0, limit).map(w => w.word);
}

export function currentPrefix(text: string, cursorOffset: number): string {
  const before = text.slice(0, cursorOffset);
  return before.match(/([A-Za-z_$][\w$]*)$/)?.[1] ?? '';
}
