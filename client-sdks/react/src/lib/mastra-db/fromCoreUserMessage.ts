import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import type { CoreUserMessage } from '@mastra/core/llm';
import { encodeFilePartDataForStorage } from '../../agent/signal-data';

/**
 * Convert a CoreUserMessage into a canonical `MastraDBMessage` (`format: 2`).
 *
 * Image and file inputs are emitted as the canonical V4 `file` part shape
 * (`{ type: 'file', mimeType, data }`) — the exact shape memory resolves on
 * reload (see `AIV4Adapter`), so optimistic-send and reload render identically.
 *
 * Handles all CoreUserMessage content types:
 * - String content → single text part
 * - Array content with text/image/file parts → corresponding `MastraMessagePart`s
 */
const coreUserMessageToParts = (coreUserMessage: CoreUserMessage): MastraMessagePart[] =>
  typeof coreUserMessage.content === 'string'
    ? [{ type: 'text' as const, text: coreUserMessage.content }]
    : coreUserMessage.content.map((part): MastraMessagePart => {
        switch (part.type) {
          case 'text': {
            return { type: 'text' as const, text: part.text };
          }
          case 'image': {
            const mimeType = part.mimeType ?? 'image/*';
            return {
              type: 'file' as const,
              mimeType,
              data: encodeFilePartDataForStorage(part.image, mimeType),
            };
          }
          case 'file': {
            return {
              type: 'file' as const,
              mimeType: part.mimeType,
              data: encodeFilePartDataForStorage(part.data, part.mimeType),
              ...(part.filename !== undefined ? { filename: part.filename } : {}),
            };
          }
          default: {
            const exhaustiveCheck: never = part;
            throw new Error(`Unhandled content part type: ${(exhaustiveCheck as { type: string }).type}`);
          }
        }
      });

const newUserMessage = (parts: MastraMessagePart[]): MastraDBMessage => ({
  id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  role: 'user',
  createdAt: new Date(),
  content: {
    format: 2,
    parts,
  },
});

export const fromCoreUserMessageToMastraDBMessage = (coreUserMessage: CoreUserMessage): MastraDBMessage =>
  newUserMessage(coreUserMessageToParts(coreUserMessage));

/**
 * Merge multiple `CoreUserMessage`s into a single canonical `MastraDBMessage`.
 *
 * A user turn that carries attachments arrives as several `CoreUserMessage`s
 * (one for the text, one per attachment). Memory/reload persists and resolves
 * that whole turn as a single multi-part user message, so the optimistic
 * streaming display must do the same — flatten every message's parts into one
 * `parts` array — to render identically (one bubble, not one per message).
 */
export const fromCoreUserMessagesToMastraDBMessage = (coreUserMessages: CoreUserMessage[]): MastraDBMessage =>
  newUserMessage(coreUserMessages.flatMap(coreUserMessageToParts));
