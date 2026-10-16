import * as AIV5 from '@internal/ai-sdk-v5';

import { getImageCacheKey, resolveFilePartMediaTypeAndData } from '../prompt/image-utils';
import type { LegacyCoreMessage, LegacyUIMessage } from '../state/legacy-shapes';
import type { AIV5Type } from '../types';
import { getResponseProviderItemKeys } from '../utils/response-item-metadata';
import { appendReasoningIdentityKeys, hashIdentityValue } from './reasoning-identity';
import { stableStringify } from './stable-stringify';
import type { MastraMessagePart, MastraBasePart } from './types';

function appendResponseProviderItemKeys(cacheKey: string, ...providerSources: unknown[]): string {
  const itemKeys = new Set(
    providerSources.flatMap(source => getResponseProviderItemKeys(source as Record<string, unknown> | undefined)),
  );

  for (const itemKey of itemKeys) {
    cacheKey += `|${itemKey}`;
  }

  return cacheKey;
}

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
 * - Provider metadata (e.g., OpenAI/Azure OpenAI text, reasoning, and tool itemId) must be included for proper distinction
 * - Reasoning identity held in any provider namespace (signatures, redacted data, item ids) is included,
 *   so empty-text reasoning blocks from different steps stay distinct without provider-specific helpers
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key from AIV4 UIMessage parts
   */
  static fromLegacyParts(parts: LegacyUIMessage['parts']): string {
    let key = '';
    for (const part of parts) {
      key += part.type;
      key += CacheKeyGenerator.fromLegacyPart(part);
    }
    return key;
  }

  /**
   * Generate cache key from a single AIV4 UIMessage part
   */
  static fromLegacyPart(part: LegacyUIMessage['parts'][number]): string {
    let cacheKey = '';
    if (part.type === 'text') {
      cacheKey += part.text;
      cacheKey = appendResponseProviderItemKeys(cacheKey, (part as any).providerMetadata);
    }
    if (part.type === 'tool-invocation') {
      if (!part.toolInvocation) return cacheKey;
      cacheKey += part.toolInvocation.toolCallId;
      cacheKey += part.toolInvocation.state;
    }
    if (part.type === 'reasoning') {
      cacheKey += part.reasoning;
      cacheKey += (part.details ?? []).reduce((prev, current) => {
        if (current.type === 'text') {
          return prev + (current.text?.length ?? 0) + (current.signature?.length || 0);
        }
        return prev;
      }, 0);

      // OpenAI-compatible Responses providers send reasoning items (rs_...) inside
      // provider metadata itemId fields such as openai.itemId or azure.itemId.
      // When the reasoning text is empty, the default cache key logic produces "reasoning0"
      // for *all* reasoning parts. This makes distinct rs_ entries appear identical, so the
      // message-merging logic drops the latest reasoning item. The result is that subsequent
      // OpenAI-compatible calls fail with:
      //
      //   "Item 'fc_...' was provided without its required 'reasoning' item"
      //
      // To fix this, we incorporate the provider itemId into the cache key so each
      // rs_ entry is treated as distinct.
      //
      // Note: We cast `part` to `any` here because the AI SDK's ReasoningUIPart V4 type does
      // NOT declare `providerMetadata` (even though Mastra attaches it at runtime). This
      // access is safe in JavaScript, but TypeScript cannot type it without augmentation,
      // so we intentionally narrow to `any` only for this metadata lookup.

      const partAny = part as any;

      if (partAny && Object.hasOwn(partAny, 'providerMetadata')) {
        cacheKey = appendResponseProviderItemKeys(cacheKey, partAny.providerMetadata);
      }

      // Other providers (Anthropic, Bedrock, Gemini, ...) carry reasoning identity such as
      // signatures or redacted data in metadata or in reasoning details. Fold it in generically.
      cacheKey = appendReasoningIdentityKeys(cacheKey, partAny?.providerMetadata);
      for (const detail of part.details ?? []) {
        const identity = detail.type === 'text' ? detail.signature : detail.data;
        if (identity) cacheKey += `|${detail.type}:${hashIdentityValue(identity)}`;
      }
    }
    if (part.type === 'file') {
      // Stored parts can be v5-shaped (`mediaType`/`url`) even though this union only
      // describes v4 (`mimeType`/`data`); both fields read as `undefined` otherwise,
      // collapsing distinct v5 file parts onto the same cache key. Mirrors #17366.
      const { mediaType, data } = resolveFilePartMediaTypeAndData(part);
      cacheKey += data;
      cacheKey += mediaType;
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
        key += stableStringify(data); // order-independent: jsonb vs text storage may reorder keys
      } else {
        // Cast to MastraBasePart since we've already handled data-* parts above
        key += CacheKeyGenerator.fromLegacyPart(part as MastraBasePart);
      }
    }
    return key;
  }

  /**
   * Generate cache key from stored format-1 (MastraMessageV1) content
   */
  static fromV1Content(content: LegacyCoreMessage['content']): string {
    if (typeof content === 'string') return content;
    let key = '';
    for (const part of content) {
      key += part.type;
      if (part.type === 'text') {
        key += part.text.length;
        const partAny = part as any;
        key = appendResponseProviderItemKeys(key, partAny.providerMetadata, partAny.providerOptions);
      }
      if (part.type === 'reasoning') {
        key += part.text.length;
        const partAny = part as any;
        key = appendResponseProviderItemKeys(key, partAny.providerMetadata, partAny.providerOptions);
        key = appendReasoningIdentityKeys(key, partAny.providerMetadata, partAny.providerOptions);
        if (part.signature) key += `|signature:${hashIdentityValue(part.signature)}`;
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
        key += `|${hashIdentityValue(part.data)}`;
      }
    }
    return key;
  }

  /**
   * Generate cache key from system message content
   */
  static fromSystemMessageContent(content: string): string {
    return content;
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
        key = appendResponseProviderItemKeys(key, (part as any).providerMetadata);
      }
      if (AIV5.isToolUIPart(part) || part.type === 'dynamic-tool') {
        key += part.toolCallId;
        key += part.state;
      }
      if (part.type === 'reasoning') {
        key += part.text;
        key = appendResponseProviderItemKeys(key, (part as any).providerMetadata);
        key = appendReasoningIdentityKeys(key, (part as any).providerMetadata);
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
        key = appendResponseProviderItemKeys(key, (part as any).providerOptions);
      }
      if (part.type === 'reasoning') {
        key += part.text.length;
        key = appendResponseProviderItemKeys(key, (part as any).providerOptions);
        key = appendReasoningIdentityKeys(key, (part as any).providerOptions);
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
