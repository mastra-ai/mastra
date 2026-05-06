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
  // For any future visibility tier we treat undefined and the explicit `'all'`
  // flag as the permissive default — only parts whose flag explicitly disagrees
  // are dropped.
  return partVisibility === undefined || partVisibility === 'all' || partVisibility === visibility;
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

    // Recompute the legacy aggregated string `content.content` from the
    // filtered text parts so callers that still read that field don't see
    // text that was supposed to be hidden.
    const visibleText = filteredParts
      .filter((part): part is Extract<MastraMessagePart, { type: 'text' }> => part.type === 'text')
      .map(part => part.text)
      .join('\n');

    // Recompute the legacy `content.toolInvocations` array using only the
    // tool-invocation parts that survived the visibility filter — otherwise
    // a hidden tool call would still leak through that field.
    const visibleToolCallIds = new Set(
      filteredParts
        .filter(
          (part): part is Extract<MastraMessagePart, { type: 'tool-invocation' }> => part.type === 'tool-invocation',
        )
        .map(part => part.toolInvocation.toolCallId)
        .filter((id): id is string => typeof id === 'string'),
    );

    const { content: _legacyContent, toolInvocations, ...restContent } = message.content;
    const contentStringPatch = message.content.content === undefined ? {} : { content: visibleText };
    const toolInvocationsPatch = Array.isArray(toolInvocations)
      ? {
          toolInvocations: toolInvocations.filter(
            invocation => typeof invocation?.toolCallId === 'string' && visibleToolCallIds.has(invocation.toolCallId),
          ),
        }
      : {};

    result.push({
      ...message,
      content: {
        ...restContent,
        parts: filteredParts,
        ...contentStringPatch,
        ...toolInvocationsPatch,
      },
    });
  }

  return result;
}
