import type { UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
import * as AIV5 from '@internal/ai-sdk-v5';

import { getImageCacheKey } from '../prompt/image-utils';
import type { AIV5Type, CoreMessageV4 } from '../types';
import type { MastraMessagePart, UIMessageV4Part } from './types';

/**
 * CacheKeyGenerator - Centralized cache key generation for message equality checks
 *
 * This class provides consistent cache key generation across all message formats,
 * which is critical for:
 * - Deduplication of messages
 * - Detecting when messages have been updated
 * - Comparing messages across different formats
 *
 * Cache key invariants:
 * - Same message content should always produce the same key
 * - Different content should produce different keys
 * - Provider metadata (e.g., reasoning itemId) must be included for proper distinction
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key from AIV4 UIMessage parts
   */
  static fromAIV4Parts(parts: UIMessageV4['parts']): string {
    let key = '';
    for (const part of parts) {
      key += part.type;
      key += CacheKeyGenerator.fromAIV4Part(part);
    }
    return key;
  }

  /**
   * Generate cache key from a single AIV4 UIMessage part
   */
  static fromAIV4Part(part: UIMessageV4['parts'][number]): string {
    let cacheKey = '';
    if (part.type === 'text') {
      cacheKey += part.text;
    }
    if (part.type === 'tool-invocation') {
      cacheKey += part.toolInvocation.toolCallId;
      cacheKey += part.toolInvocation.state;
    }
    if (part.type === 'reasoning') {
      cacheKey += part.reasoning;
      cacheKey += part.details.reduce((prev, current) => {
        if (current.type === 'text') {
          return prev + current.text.length + (current.signature?.length || 0);
        }
        return prev;
      }, 0);

      // Providers send reasoning items (rs_...) inside providerMetadata.<provider>.itemId.
      // The provider key varies by SDK: "openai" for standard OpenAI, "azure" for Azure
      // OpenAI (via @ai-sdk/azure v3+), etc. When the reasoning text is empty, the default
      // cache key logic produces "reasoning0" for *all* reasoning parts, making distinct
      // rs_ entries appear identical and causing the message-merging logic to drop subsequent
      // reasoning items. This breaks providers like Azure OpenAI that require each
      // function_call to be preceded by its reasoning item.
      //
      // To fix this, we look for an itemId under any provider key in providerMetadata.
      //
      // Note: We cast `part` to `any` here because the AI SDK's ReasoningUIPart V4 type does
      // NOT declare `providerMetadata` (even though Mastra attaches it at runtime).

      const partAny = part as any;
      const metadata = partAny?.providerMetadata;

      if (metadata && typeof metadata === 'object') {
        for (const providerKey of Object.keys(metadata)) {
          const provider = metadata[providerKey];
          if (provider && typeof provider === 'object' && 'itemId' in provider && provider.itemId) {
            cacheKey += `|${provider.itemId}`;
            break;
          }
        }
      }
    }
    if (part.type === 'file') {
      cacheKey += part.data;
      cacheKey += part.mimeType;
    }

    return cacheKey;
  }

  /**
   * Generate cache key from MastraDB message parts
   */
  static fromDBParts(parts: MastraMessagePart[]): string {
    let key = '';
    for (const part of parts) {
      key += part.type;
      if (part.type.startsWith('data-')) {
        // Stringify data for proper cache key comparison since data can be any type
        const data = (part as AIV5Type.DataUIPart<AIV5.UIDataTypes>).data;
        key += JSON.stringify(data);
      } else {
        // Cast to UIMessageV4Part since we've already handled data-* parts above
        key += CacheKeyGenerator.fromAIV4Part(part as UIMessageV4Part);
      }
    }
    return key;
  }

  /**
   * Generate cache key from AIV4 CoreMessage content
   */
  static fromAIV4CoreMessageContent(content: CoreMessageV4['content']): string {
    if (typeof content === 'string') return content;
    let key = '';
    for (const part of content) {
      key += part.type;
      if (part.type === 'text') {
        key += part.text.length;
      }
      if (part.type === 'reasoning') {
        key += part.text.length;
      }
      if (part.type === 'tool-call') {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === 'tool-result') {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === 'file') {
        key += part.filename;
        key += part.mimeType;
      }
      if (part.type === 'image') {
        key += getImageCacheKey(part.image);
        key += part.mimeType;
      }
      if (part.type === 'redacted-reasoning') {
        key += part.data.length;
      }
    }
    return key;
  }

  /**
   * Generate cache key from AIV5 UIMessage parts
   */
  static fromAIV5Parts(parts: AIV5Type.UIMessage['parts']): string {
    let key = '';
    for (const part of parts) {
      key += part.type;
      if (part.type === 'text') {
        key += part.text;
      }
      if (AIV5.isToolUIPart(part) || part.type === 'dynamic-tool') {
        key += part.toolCallId;
        key += part.state;
      }
      if (part.type === 'reasoning') {
        key += part.text;
      }
      if (part.type === 'file') {
        key += part.url.length;
        key += part.mediaType;
        key += part.filename || '';
      }
    }
    return key;
  }

  /**
   * Generate cache key from AIV5 ModelMessage content
   */
  static fromAIV5ModelMessageContent(content: AIV5Type.ModelMessage['content']): string {
    if (typeof content === 'string') return content;
    let key = '';
    for (const part of content) {
      key += part.type;
      if (part.type === 'text') {
        key += part.text.length;
      }
      if (part.type === 'reasoning') {
        key += part.text.length;
      }
      if (part.type === 'tool-call') {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === 'tool-result') {
        key += part.toolCallId;
        key += part.toolName;
      }
      if (part.type === 'file') {
        key += part.filename;
        key += part.mediaType;
      }
      if (part.type === 'image') {
        key += getImageCacheKey(part.image);
        key += part.mediaType;
      }
    }
    return key;
  }
}
