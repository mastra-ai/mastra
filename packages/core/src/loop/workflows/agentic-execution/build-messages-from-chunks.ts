import type { ToolSet } from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessagePart } from '../../../agent/message-list';
import type { ChunkType, ProviderMetadata } from '../../../stream/types';
import { findProviderToolByName, inferProviderExecuted } from '../../../tools/provider-tool-utils';

/**
 * Subset of ChunkType that only requires `type` and `payload`.
 * Strips BaseChunkType fields (runId, from, metadata) while preserving the
 * discriminated union so switch cases auto-narrow payload types.
 */
export type CollectedChunk =
  Extract<ChunkType<any>, { payload: any }> extends infer T
    ? T extends { type: infer U; payload: infer P }
      ? { type: U; payload: P }
      : never
    : never;

/**
 * Build MastraDBMessage entries from the full sequence of stream chunks.
 *
 * This replaces the previous approach of flushing text/reasoning deltas into
 * messages mid-stream. By walking the complete chunk sequence we:
 *
 * 1. Produce exactly one text part per text-start/text-end span (no duplicates)
 * 2. Produce exactly one reasoning part per reasoning-start/reasoning-end span
 * 3. Preserve correct stream ordering (text before tool-call if that's how they arrived)
 * 4. Use providerMetadata with "last seen wins" semantics per AI SDK convention
 * 5. Skip empty text spans (empty-string deltas only) — no more empty text parts in DB
 * 6. Merge tool-call + tool-result into a single part with state: 'result' when applicable
 */
export function buildMessagesFromChunks({
  chunks,
  messageId,
  responseModelMetadata,
  tools,
}: {
  chunks: CollectedChunk[];
  messageId: string;
  responseModelMetadata?: { metadata: Record<string, unknown> };
  tools?: ToolSet;
}): MastraDBMessage[] {
  // Parts are pushed in first-delta order. Text and reasoning spans push a part
  // on the first delta and mutate it in place as subsequent deltas arrive.
  // *-start only stashes providerMetadata. This preserves content arrival
  // ordering without needing slots, nulls, or separate push tracking (#15914).
  const parts: MastraMessagePart[] = [];

  // Collect tool results so we can match them to tool calls
  const toolResults = new Map<
    string,
    {
      result: unknown;
      args: unknown;
      providerMetadata?: ProviderMetadata;
      providerExecuted: boolean | undefined;
      toolName: string;
    }
  >();
  for (const chunk of chunks) {
    if (chunk.type === 'tool-result' && chunk.payload.result != null) {
      toolResults.set(chunk.payload.toolCallId, {
        result: chunk.payload.result,
        args: chunk.payload.args,
        providerMetadata: chunk.payload.providerMetadata,
        providerExecuted: chunk.payload.providerExecuted,
        toolName: chunk.payload.toolName,
      });
    }
  }

  // Metadata stashed by *-start events, applied when the ref is created on first delta.
  const textMeta = new Map<string, ProviderMetadata | undefined>();
  const reasoningMeta = new Map<string, ProviderMetadata | undefined>();

  // Live references to parts already in the `parts` array, keyed by span ID.
  // Created and pushed on first delta — position reflects content arrival order (#15914).
  type TextRef = { type: 'text'; text: string; providerMetadata?: ProviderMetadata };
  type ReasoningDetail = { type: 'text'; text: string; signature?: string } | { type: 'redacted'; data: string };
  type ReasoningRef = {
    type: 'reasoning';
    reasoning: string;
    details: ReasoningDetail[];
    providerMetadata?: ProviderMetadata;
  };
  const textRefs = new Map<string, TextRef>();
  const reasoningRefs = new Map<string, ReasoningRef>();

  for (const chunk of chunks) {
    switch (chunk.type) {
      // ── Text span ──────────────────────────────────────────────
      case 'text-start': {
        // Just stash metadata — part is created on first delta
        textMeta.set(chunk.payload.id, chunk.payload.providerMetadata);
        break;
      }
      case 'text-delta': {
        let ref = textRefs.get(chunk.payload.id);
        if (!ref) {
          // First delta for this span — create the part and push it now
          ref = {
            type: 'text' as const,
            text: '',
            providerMetadata: textMeta.get(chunk.payload.id) ?? chunk.payload.providerMetadata,
          };
          textRefs.set(chunk.payload.id, ref);
          parts.push(ref as MastraMessagePart);
        }
        ref.text += chunk.payload.text;
        if (chunk.payload.providerMetadata) {
          ref.providerMetadata = chunk.payload.providerMetadata;
        }
        break;
      }
      case 'text-end': {
        const ref = textRefs.get(chunk.payload.id);
        if (ref) {
          if (chunk.payload.providerMetadata) {
            ref.providerMetadata = chunk.payload.providerMetadata;
          }
          // Clean up undefined providerMetadata so we don't serialize { providerMetadata: undefined }
          if (!ref.providerMetadata) {
            delete ref.providerMetadata;
          }
        }
        // text-end with no deltas means empty span — nothing to emit
        textMeta.delete(chunk.payload.id);
        textRefs.delete(chunk.payload.id);
        break;
      }

      // ── Reasoning span ─────────────────────────────────────────
      case 'reasoning-start': {
        const isRedacted = Object.values(chunk.payload.providerMetadata || {}).some(v => v && 'redactedData' in v);

        // Redacted reasoning never receives deltas, so create and push immediately
        if (isRedacted) {
          const part = {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'redacted' as const, data: '' }],
            providerMetadata: chunk.payload.providerMetadata,
          };
          reasoningRefs.set(chunk.payload.id, part);
          parts.push(part as MastraMessagePart);
        } else {
          // Non-redacted: just stash metadata, part is created on first delta
          reasoningMeta.set(chunk.payload.id, chunk.payload.providerMetadata);
        }
        break;
      }
      case 'reasoning-delta': {
        let ref = reasoningRefs.get(chunk.payload.id);
        if (!ref) {
          // First delta for this span — create the part and push it now
          ref = {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'text' as const, text: '' }],
            providerMetadata: reasoningMeta.get(chunk.payload.id) ?? chunk.payload.providerMetadata,
          };
          reasoningRefs.set(chunk.payload.id, ref);
          parts.push(ref as MastraMessagePart);
        }
        // Append to the text detail
        const detail = ref.details[0];
        if (detail && detail.type === 'text') {
          detail.text += chunk.payload.text;
        }
        if (chunk.payload.providerMetadata) {
          ref.providerMetadata = chunk.payload.providerMetadata;
        }
        break;
      }
      case 'reasoning-end': {
        const ref = reasoningRefs.get(chunk.payload.id);
        if (ref) {
          if (chunk.payload.providerMetadata) {
            ref.providerMetadata = chunk.payload.providerMetadata;
          }
        } else {
          // No deltas arrived — emit empty reasoning part.
          // OpenAI requires item_reference for tool calls that follow reasoning.
          // See: https://github.com/mastra-ai/mastra/issues/9005
          const part: MastraMessagePart = {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'text', text: '' }],
            providerMetadata: chunk.payload.providerMetadata ?? reasoningMeta.get(chunk.payload.id),
          };
          parts.push(part);
        }
        reasoningMeta.delete(chunk.payload.id);
        reasoningRefs.delete(chunk.payload.id);
        break;
      }

      // Redacted reasoning can appear as a standalone chunk (not wrapped in start/end)
      case 'redacted-reasoning': {
        parts.push({
          type: 'reasoning' as const,
          reasoning: '',
          details: [{ type: 'redacted' as const, data: '' }],
          providerMetadata: chunk.payload.providerMetadata,
        } satisfies MastraMessagePart);
        break;
      }

      // ── Source ──────────────────────────────────────────────────
      case 'source': {
        parts.push({
          type: 'source',
          source: {
            sourceType: 'url',
            id: chunk.payload.id,
            url: chunk.payload.url || '',
            title: chunk.payload.title,
            providerMetadata: chunk.payload.providerMetadata,
          },
        } satisfies MastraMessagePart);
        break;
      }

      // ── File ───────────────────────────────────────────────────
      case 'file': {
        parts.push({
          type: 'file' as const,
          data: chunk.payload.data as string,
          mimeType: chunk.payload.mimeType,
          ...(chunk.payload.providerMetadata ? { providerMetadata: chunk.payload.providerMetadata } : {}),
        } satisfies MastraMessagePart);
        break;
      }

      // ── Tool call ──────────────────────────────────────────────
      case 'tool-call': {
        const toolDef = tools?.[chunk.payload.toolName] || findProviderToolByName(tools, chunk.payload.toolName);
        const providerExecuted = inferProviderExecuted(chunk.payload.providerExecuted, toolDef);

        // Check if we have a matching result from a provider-executed tool
        const result = toolResults.get(chunk.payload.toolCallId);

        if (result) {
          // Merge call + result into a single 'result' state part
          const resultProviderExecuted = inferProviderExecuted(result.providerExecuted, toolDef);
          parts.push({
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: chunk.payload.toolCallId,
              toolName: chunk.payload.toolName,
              args: chunk.payload.args,
              result: result.result,
            },
            providerMetadata: result.providerMetadata ?? chunk.payload.providerMetadata,
            providerExecuted: resultProviderExecuted,
          } satisfies MastraMessagePart);
        } else {
          // No result yet — emit as 'call' state
          parts.push({
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'call' as const,
              toolCallId: chunk.payload.toolCallId,
              toolName: chunk.payload.toolName,
              args: chunk.payload.args,
            },
            providerMetadata: chunk.payload.providerMetadata,
            providerExecuted,
          } satisfies MastraMessagePart);
        }
        break;
      }

      // tool-result is consumed above via the toolResults map — no direct handling needed here
      // All other chunk types (finish, error, response-metadata, etc.) don't produce message parts
      default:
        break;
    }
  }

  // Unclosed reasoning spans that had deltas are already in `parts` (pushed on first delta).
  // Unclosed reasoning spans with NO deltas need to be emitted for #9005.
  for (const [id] of reasoningMeta) {
    if (!reasoningRefs.has(id)) {
      const part: MastraMessagePart = {
        type: 'reasoning' as const,
        reasoning: '',
        details: [{ type: 'text', text: '' }],
        providerMetadata: reasoningMeta.get(id),
      };
      parts.push(part);
    }
  }

  // Unclosed text spans that had deltas are already in `parts`.
  // Clean up undefined providerMetadata on any that are still open.
  for (const [, ref] of textRefs) {
    if (!ref.providerMetadata) {
      delete ref.providerMetadata;
    }
  }

  // Remove text parts that ended up empty (e.g. spans where every delta was '').
  // Empty reasoning parts are kept intentionally (#9005) and are not filtered here.
  const nonEmptyParts = parts.filter(p => !(p.type === 'text' && 'text' in p && p.text === ''));

  // Insert step-start markers between tool-invocation and subsequent text parts.
  // This matches the convention used by MessageMerger.pushNewPart when merging messages,
  // and is required so that AI SDK convertToModelMessages splits them into separate steps.
  const finalParts: MastraMessagePart[] = [];
  for (let i = 0; i < nonEmptyParts.length; i++) {
    const part = nonEmptyParts[i]!;
    if (
      part.type === 'text' &&
      finalParts.length > 0 &&
      finalParts[finalParts.length - 1]?.type === 'tool-invocation'
    ) {
      finalParts.push({ type: 'step-start' } satisfies MastraMessagePart);
    }
    finalParts.push(part);
  }

  if (finalParts.length === 0) {
    return [];
  }

  // TODO: remove in v2, this is added for backwards compatibility. We used to double add response messages accidentally, and the second path added them in ai sdk format, which had this duplicated content field.
  const contentString = finalParts
    .filter((part): part is Extract<MastraMessagePart, { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('\n');

  // Build a single assistant message with all parts in stream order
  const message: MastraDBMessage = {
    id: messageId,
    role: 'assistant' as const,
    content: {
      format: 2,
      parts: finalParts,
      ...(contentString ? { content: contentString } : {}),
      ...responseModelMetadata,
    },
    createdAt: new Date(),
  };

  return [message];
}
