/**
 * Selected text as one quote: unified line endings, no trailing spaces, at most one blank line in a
 * row, and nothing around it. Empty when the selection held only whitespace.
 */
export function normalizeQuote(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A passage to send, and what the person said about it. */
export interface QuotedPassage {
  text: string;
  comment?: string;
}

const indent = (lines: string[], pad: string) => lines.map(line => (line ? `${pad}${line}` : '')).join('\n');

/** One numbered list item: the passage as a blockquote, and its comment as a paragraph of the same item. */
function formatAnnotation({ text, comment }: QuotedPassage, number: number): string {
  const marker = `${number}. `;
  const pad = ' '.repeat(marker.length);
  const [first = '>', ...rest] = text.split('\n').map(line => (line ? `> ${line}` : '>'));
  const quote = rest.length > 0 ? `${marker}${first}\n${indent(rest, pad)}` : `${marker}${first}`;
  const note = comment ? normalizeQuote(comment) : '';
  return note ? `${quote}\n\n${indent(note.split('\n'), pad)}` : quote;
}

/**
 * The message the agent receives: the annotations as a numbered Markdown list, numbered as the
 * person sees them, each holding its passage as a blockquote and any comment on it, then what the
 * person typed. The list keeps a comment on the last passage apart from the typed message.
 */
export function formatQuotedMessage(text: string, quotes: readonly QuotedPassage[]): string {
  const passages = quotes
    .map(quote => ({ text: normalizeQuote(quote.text), comment: quote.comment }))
    .filter(quote => quote.text);
  if (passages.length === 0) return text;
  const list = passages.map((passage, index) => formatAnnotation(passage, index + 1)).join('\n\n');
  return text.trim() ? `${list}\n\n${text}` : list;
}
