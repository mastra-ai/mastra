import type { TimelineSpan } from './build-thread-timeline';

export type PromptMessage = { role: string; text: string };

/**
 * Message content is either a plain string or the AI SDK's array of typed parts. Anything else
 * (tool-call parts, images) has no text to show, so it drops out rather than rendering as JSON.
 */
/**
 * Instructions are usually authored as indented template literals, so the raw text carries the
 * source's leading whitespace. Line breaks are meaningful and kept; the indentation is not.
 */
function dedent(text: string): string {
  return text
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return dedent(content);
  if (!Array.isArray(content)) return '';

  const text = content
    .map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return (part as { text: string }).text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  return dedent(text);
}

/**
 * The prompt a `model_generation` span was given, as role/text pairs.
 * Degrades to an empty list on unexpected payloads rather than throwing (decision 3).
 */
export function promptMessages(span: TimelineSpan): PromptMessage[] {
  const input = span.input as { messages?: unknown } | undefined;
  if (!input || typeof input !== 'object' || !Array.isArray(input.messages)) return [];

  return input.messages.flatMap(message => {
    if (!message || typeof message !== 'object') return [];
    const { role, content } = message as { role?: unknown; content?: unknown };
    if (typeof role !== 'string') return [];

    const text = messageText(content);
    return text ? [{ role, text }] : [];
  });
}
