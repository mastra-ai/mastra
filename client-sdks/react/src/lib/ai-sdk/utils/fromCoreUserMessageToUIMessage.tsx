import { CoreUserMessage } from '@mastra/core/llm';
import type { MastraUIMessage } from '../types';

/**
 * Converts a CoreUserMessage to a MastraUIMessage (UIMessage format).
 *
 * Handles all CoreUserMessage content types:
 * - String content → single text part
 * - Array content with text/image/file parts → corresponding UIMessage parts
 */
export const fromCoreUserMessageToUIMessage = (coreUserMessage: CoreUserMessage): MastraUIMessage => {
  // Generate unique ID for the message
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Convert content to parts array
  const parts: MastraUIMessage['parts'] =
    typeof coreUserMessage.content === 'string'
      ? [
          {
            type: 'text' as const,
            text: coreUserMessage.content,
          },
        ]
      : coreUserMessage.content.map((part): MastraUIMessage['parts'][number] => {
          switch (part.type) {
            case 'text': {
              return {
                type: 'text' as const,
                text: part.text,
              };
            }

            case 'image': {
              // UIMessage represents images as file parts, not image parts
              const url =
                typeof part.image === 'string'
                  ? part.image // Assume it's already a URL or data URL
                  : part.image instanceof URL
                    ? part.image.toString()
                    : ''; // For Uint8Array/ArrayBuffer, would need conversion

              return {
                type: 'file' as const,
                mediaType: part.mimeType ?? 'image/*',
                url,
              };
            }

            case 'file': {
              // Convert CoreUserMessage file format (data, mimeType, filename)
              // to UIMessage file format (url, mediaType, filename)
              const url =
                typeof part.data === 'string'
                  ? part.data // Assume it's already a URL or data URL
                  : part.data instanceof URL
                    ? part.data.toString()
                    : ''; // For Uint8Array/ArrayBuffer, would need conversion

              return {
                type: 'file' as const,
                mediaType: part.mimeType,
                url,
                ...(part.filename !== undefined ? { filename: part.filename } : {}),
              };
            }

            default: {
              // Exhaustiveness check - TypeScript will error if a case is missing
              const exhaustiveCheck: never = part;
              throw new Error(`Unhandled content part type: ${(exhaustiveCheck as { type: string }).type}`);
            }
          }
        });

  return {
    id,
    role: 'user',
    parts,
  };
};
