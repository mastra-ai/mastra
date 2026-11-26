export interface KnowledgeMention {
  /** Index of the opening `[` in the source text. */
  index: number;
  /** Text between `[[` and `]]`, before trimming. */
  ref: string;
  /** Length of the full `[[ref]]` match. */
  length: number;
}

/**
 * Find `[[ref]]` mentions. A ref may contain `[` but not `]`, matching
 * `/\[\[([^\]]+)\]\]/g`. The scan is linear: a failed opener resumes at the
 * `]` that rejected it, because no later `[[` in that span can close either.
 */
export function findKnowledgeMentions(text: string): KnowledgeMention[] {
  const mentions: KnowledgeMention[] = [];
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf('[[', from);
    if (start === -1) break;
    let i = start + 2;
    if (i >= text.length || text[i] === ']') {
      from = start + 1;
      continue;
    }
    while (i < text.length && text[i] !== ']') i++;
    if (i + 1 < text.length && text[i] === ']' && text[i + 1] === ']') {
      mentions.push({ index: start, ref: text.slice(start + 2, i), length: i + 2 - start });
      from = i + 2;
    } else {
      from = i;
    }
  }
  return mentions;
}
