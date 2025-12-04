import type { MastraDBMessage } from '@mastra/core/agent';
import { encode } from '@toon-format/toon';
import { CHARS_PER_TOKEN } from './types';
import type { ConversationExchange } from './types';

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Estimate token count from text using character approximation
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Compress observation tokens for the main agent by removing non-critical markers
 */
export function compressObservationTokens(
  text: string,
  opts?: { removeTags?: boolean; removePriorities?: boolean; removeArrows?: boolean }
): string {
  if (!opts) opts = {};
  opts = { removePriorities: true, removeTags: true, removeArrows: true, ...opts };

  let finalText = text;

  const replacements: [RegExp | string, string][] = [
    [/[\r\n]+/g, '\n'], // remove double newlines
    [/ +/g, ' '], // remove double spaces
  ];

  if (opts.removePriorities) {
    replacements.push([/[🟢🟡]/gu, '']); // keep red high pri emojis, drop the rest
  }

  if (opts.removeTags) {
    // Remove tags but preserve collapsed section markers like [72 items collapsed - ID: b1fa]
    replacements.push([/\[(?![\d]+ items collapsed - ID: [a-f0-9]+\]).*?\]/g, '']);
  }

  if (opts.removeArrows) {
    replacements.push(['-> ', '']);
  }

  for (const [pattern, replacement] of replacements) {
    if (!finalText) finalText = '';
    finalText = finalText.replaceAll(pattern, replacement);
  }

  return finalText;
}

// ============================================================================
// Message Utilities
// ============================================================================

/**
 * Clean messages by removing provider metadata to reduce token usage
 */
export function cleanMessagesForEncoding(messages: MastraDBMessage[]): MastraDBMessage[] {
  return messages.map(m => {
    const msg = { ...m };
    if (`providerMetadata` in msg) delete msg.providerMetadata;
    if (msg.content && typeof msg.content === 'object' && 'parts' in msg.content && msg.content.parts) {
      msg.content = {
        ...msg.content,
        parts: msg.content.parts.map(part => {
          if (`providerMetadata` in part) {
            const { providerMetadata, ...rest } = part;
            return rest;
          }
          return part;
        }),
      };
    }
    return msg;
  });
}

/**
 * Encode messages to TOON format for the observer/reflector prompts
 */
export function encodeMessagesForPrompt(messages: MastraDBMessage[]): string {
  const cleanedMessages = cleanMessagesForEncoding(messages);
  return encode(cleanedMessages);
}

/**
 * Get the text content from a message for token estimation
 */
export function getMessageTextContent(message: MastraDBMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content?.content || JSON.stringify(message.content);
}
