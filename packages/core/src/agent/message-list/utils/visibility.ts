import type { MastraDBMessage, MastraMessagePart, MastraPartVisibility } from '../state/types';

/**
 * A message part is visible to the UI when it has no `visibility` flag, or
 * when the flag is explicitly `'all'`.
 */
export function isVisiblePart(
  part: MastraMessagePart | { visibility?: MastraPartVisibility },
  visibility: MastraPartVisibility = 'all',
): boolean {
  const partVisibility = (part as { visibility?: MastraPartVisibility }).visibility;
  if (visibility === 'all') {
    // UI / "all" view: drop parts marked llm-only.
    return partVisibility !== 'llm';
  }
  // For any future visibility tier we treat undefined as the most permissive
  // setting and only drop parts whose flag explicitly disagrees.
  return partVisibility === undefined || partVisibility === visibility;
}

/**
 * Filter a list of stored messages to those that should be visible at the
 * given visibility tier. Parts marked with a more restrictive `visibility`
 * are stripped, and any message whose parts are entirely stripped is dropped.
 *
 * Pass `'all'` (the default) to apply the UI-facing filter — i.e. drop parts
 * that processors marked with `visibility: 'llm'`.
 *
 * Messages whose `content` is a plain string have no parts to filter, so they
 * are returned unchanged.
 */
export function filterMessagesByVisibility(
  messages: MastraDBMessage[],
  visibility: MastraPartVisibility = 'all',
): MastraDBMessage[] {
  const result: MastraDBMessage[] = [];

  for (const message of messages) {
    if (typeof message.content === 'string' || !message.content?.parts) {
      result.push(message);
      continue;
    }

    const filteredParts = message.content.parts.filter(part => isVisiblePart(part, visibility));

    // If nothing was filtered, preserve referential identity.
    if (filteredParts.length === message.content.parts.length) {
      result.push(message);
      continue;
    }

    // If every part was hidden, drop the message entirely so consumers don't
    // render a blank assistant turn.
    if (filteredParts.length === 0) {
      continue;
    }

    result.push({
      ...message,
      content: {
        ...message.content,
        parts: filteredParts,
      },
    });
  }

  return result;
}
