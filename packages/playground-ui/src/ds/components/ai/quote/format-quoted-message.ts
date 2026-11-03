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

const toBlockquote = (quote: string): string =>
  quote
    .split('\n')
    .map(line => (line ? `> ${line}` : '>'))
    .join('\n');

/**
 * The message the agent receives: each quote as a Markdown blockquote, in the order they were added,
 * then what the person typed. A blank line separates every block, so two quotes stay two
 * blockquotes and the typed text is not folded into the last one.
 */
export function formatQuotedMessage(text: string, quotes: readonly string[]): string {
  const blocks = quotes.map(normalizeQuote).filter(Boolean).map(toBlockquote);
  if (blocks.length === 0) return text;
  return text.trim() ? [...blocks, text].join('\n\n') : blocks.join('\n\n');
}
