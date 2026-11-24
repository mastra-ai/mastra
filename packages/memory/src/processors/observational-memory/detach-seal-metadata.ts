type MastraMetadata = { mastra?: object; [key: string]: unknown };
type SealableMessage = { content: { metadata?: unknown; parts?: unknown[] } };

/**
 * Copies a message (stored or serialized) deep enough that OM sealing the live copy in place
 * (message and part `metadata.mastra`) doesn't reach this one. Avoids structuredClone(), which
 * cannot copy provider functions carried in message parts.
 */
export function detachSealMetadata<T extends SealableMessage>(message: T): T {
  const metadata = message.content.metadata as MastraMetadata | undefined;
  return {
    ...message,
    content: {
      ...message.content,
      metadata: metadata && { ...metadata, mastra: { ...metadata.mastra } },
      parts: message.content.parts?.map(part => {
        const partMetadata = (part as { metadata?: MastraMetadata }).metadata;
        return {
          ...(part as object),
          ...(partMetadata && { metadata: { ...partMetadata, mastra: { ...partMetadata.mastra } } }),
        };
      }),
    },
  };
}
