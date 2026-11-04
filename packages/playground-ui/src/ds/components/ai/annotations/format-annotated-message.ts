export function normalizeAnnotationText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface AnnotatedPassage {
  text: string;
  comment?: string;
}

function formatListItem({ text, comment }: AnnotatedPassage, number: number): string {
  const marker = `${number}. `;
  const pad = ' '.repeat(marker.length);
  const quoted = text.split('\n').map(line => (line ? `> ${line}` : '>'));
  const quote = `${marker}${quoted.join(`\n${pad}`)}`;
  const note = comment ? normalizeAnnotationText(comment) : '';
  if (!note) return quote;
  const indentedNote = note.split('\n').map(line => (line ? `${pad}${line}` : ''));
  return [quote, '', ...indentedNote].join('\n');
}

// CommonMark keeps a numbered or indented line that follows the list inside it; an empty link definition ends the list and renders nothing.
const JOINS_LIST = /^(?:\s|\d{1,9}[.)](?:\s|$))/;

/**
 * Labelled with the shortest run of slashes the message never holds, so no `[//]` the person wrote turns into
 * a link; that run stays far below CommonMark's 999-character label limit.
 */
function listEnd(message: string): string {
  const runs = new Set(Array.from(message.matchAll(/\/+/g), match => match[0].length));
  let length = 2;
  while (runs.has(length)) length += 1;
  return `\n\n[${'/'.repeat(length)}]: #\n\n`;
}

/**
 * The message the agent receives: the annotations as a numbered Markdown list, each holding its passage
 * as a blockquote and any comment on it, then what the person typed. The list keeps a comment on the
 * last passage apart from the typed message.
 */
export function formatAnnotatedMessage(text: string, annotations: readonly AnnotatedPassage[]): string {
  const passages = annotations
    .map(annotation => ({ text: normalizeAnnotationText(annotation.text), comment: annotation.comment }))
    .filter(annotation => annotation.text);
  if (passages.length === 0) return text;
  const list = passages.map((passage, index) => formatListItem(passage, index + 1)).join('\n\n');
  if (!text.trim()) return list;
  if (!JOINS_LIST.test(text.replace(/^\s*\n/, ''))) return `${list}\n\n${text}`;
  return `${list}${listEnd(list + text)}${text}`;
}
