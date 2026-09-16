import type { MastraDBMessage } from '@mastra/core/agent';

export const SUBCONSCIOUS_ORIGIN = 'subconscious';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSubconsciousSignalMessage(message: MastraDBMessage): boolean {
  if (message.role !== 'signal' || !isRecord(message.content)) return false;
  const contentMetadata = message.content.metadata;
  if (!isRecord(contentMetadata) || !isRecord(contentMetadata.signal)) return false;
  const signal = contentMetadata.signal;
  const metadata = signal.metadata;
  const attributes = signal.attributes;
  return (
    signal.origin === SUBCONSCIOUS_ORIGIN ||
    (isRecord(metadata) && metadata.origin === SUBCONSCIOUS_ORIGIN) ||
    (isRecord(attributes) && attributes.source === SUBCONSCIOUS_ORIGIN)
  );
}

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
    if (isSubconsciousSignalMessage(message)) return [];
    if (typeof message.content === 'string') return [message];
    const parts = message.content.parts.filter(part => !isSubconsciousSignalPart(part));
    if (parts.length === message.content.parts.length) return [message];
    if (parts.length === 0) return [];
    return [{ ...message, content: { ...message.content, parts } }];
  });
}
