import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import type { CoreUserMessage } from '@mastra/core/llm';

/**
 * Convert a CoreUserMessage into a canonical `MastraDBMessage` (`format: 2`).
 *
 * Handles all CoreUserMessage content types:
 * - String content → single text part
 * - Array content with text/image/file parts → corresponding `MastraMessagePart`s
 */
export const fromCoreUserMessageToMastraDBMessage = (coreUserMessage: CoreUserMessage): MastraDBMessage => {
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const parts: MastraMessagePart[] =
    typeof coreUserMessage.content === 'string'
      ? [{ type: 'text' as const, text: coreUserMessage.content }]
      : coreUserMessage.content.map((part): MastraMessagePart => {
          switch (part.type) {
            case 'text': {
              return { type: 'text' as const, text: part.text };
            }
            case 'image': {
              const url =
                typeof part.image === 'string' ? part.image : part.image instanceof URL ? part.image.toString() : '';
              return {
                type: 'file' as const,
                mediaType: part.mimeType ?? 'image/*',
                url,
              } as unknown as MastraMessagePart;
            }
            case 'file': {
              const url =
                typeof part.data === 'string' ? part.data : part.data instanceof URL ? part.data.toString() : '';
              return {
                type: 'file' as const,
                mediaType: part.mimeType,
                url,
                ...(part.filename !== undefined ? { filename: part.filename } : {}),
              } as unknown as MastraMessagePart;
            }
            default: {
              const exhaustiveCheck: never = part;
              throw new Error(`Unhandled content part type: ${(exhaustiveCheck as { type: string }).type}`);
            }
          }
        });

  return {
    id,
    role: 'user',
    createdAt: new Date(),
    content: {
      format: 2,
      parts,
    },
  };
};
