import type { MastraDBMessage } from '@mastra/core/agent';

export const SUBCONSCIOUS_ORIGIN = 'subconscious';

function isSubconsciousSignalPart(part: unknown): boolean {
  if (!part || typeof part !== 'object') return false;
  const candidate = part as {
    type?: string;
    data?: { metadata?: { origin?: string }; attributes?: { source?: string } };
  };
  return (
    candidate.type === 'data-signal' &&
    (candidate.data?.metadata?.origin === SUBCONSCIOUS_ORIGIN ||
      candidate.data?.attributes?.source === SUBCONSCIOUS_ORIGIN)
  );
}

export function stripSubconsciousSignals(messages: MastraDBMessage[]): MastraDBMessage[] {
  return messages.flatMap(message => {
    if (typeof message.content === 'string') return [message];
    const parts = message.content.parts.filter(part => !isSubconsciousSignalPart(part));
    if (parts.length === message.content.parts.length) return [message];
    if (parts.length === 0) return [];
    return [{ ...message, content: { ...message.content, parts } }];
  });
}
