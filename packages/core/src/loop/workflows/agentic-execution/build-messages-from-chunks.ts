import type { ToolSet } from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessagePart } from '../../../agent/message-list';
import { isSpanChunk, MessagePartSpans } from '../../../agent/message-list/message-part-spans';
import { getErrorFromUnknown } from '../../../error';
import type {
  FilePayload,
  SourcePayload,
  ToolCallPayload,
  ToolErrorPayload,
  ToolResultPayload,
} from '../../../stream/types';
import { withToolPayloadTransformProviderMetadata } from '../../../tools/payload-transform';
import { findProviderToolByName, inferProviderExecuted } from '../../../tools/provider-tool-utils';

/**
 * A raw chunk collected during the stream.
 * We only store the type and payload — everything needed to reconstruct messages post-stream.
 */
export type CollectedChunk = { type: string; payload: any; metadata?: Record<string, any> };

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
    { result: any; args: any; providerMetadata: any; providerExecuted: boolean | undefined; toolName: string }
  >();
  for (const chunk of chunks) {
    if (chunk.type === 'tool-result' && chunk.payload.result != null) {
      const p = chunk.payload as ToolResultPayload;
      toolResults.set(p.toolCallId, {
        result: p.result,
        args: p.args,
        providerMetadata: withToolPayloadTransformProviderMetadata(p.providerMetadata, chunk.metadata),
        providerExecuted: p.providerExecuted,
        toolName: p.toolName,
      });
    }
  }

  const spans = new MessagePartSpans();

  for (const chunk of chunks) {
    if (isSpanChunk(chunk)) {
      spans.fold(parts, chunk);
      continue;
    }
    switch (chunk.type) {
      // ── Source ──────────────────────────────────────────────────
      case 'source': {
        const p = chunk.payload as SourcePayload;
        parts.push({
          type: 'source',
          source: {
            sourceType: 'url',
            id: p.id,
            url: p.url || '',
            title: p.title,
            providerMetadata: p.providerMetadata,
          },
        } as MastraMessagePart);
        break;
      }

      // ── File ───────────────────────────────────────────────────
      case 'file': {
        const p = chunk.payload as FilePayload;
        parts.push({
          type: 'file' as const,
          data: p.data,
          mimeType: p.mimeType,
          ...(p.providerMetadata ? { providerMetadata: p.providerMetadata } : {}),
        } as MastraMessagePart);
        break;
      }

      // ── Tool call ──────────────────────────────────────────────
      case 'tool-call': {
        const p = chunk.payload as ToolCallPayload;
        const toolDef = tools?.[p.toolName] || findProviderToolByName(tools, p.toolName);
        const providerExecuted = inferProviderExecuted(p.providerExecuted, toolDef);
        const providerMetadata = withToolPayloadTransformProviderMetadata(p.providerMetadata, chunk.metadata);

        // Check if we have a matching result from a provider-executed tool
        const result = toolResults.get(p.toolCallId);

        if (result) {
          // Merge call + result into a single 'result' state part
          const resultProviderExecuted = inferProviderExecuted(result.providerExecuted, toolDef);
          parts.push({
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'result' as const,
              toolCallId: p.toolCallId,
              toolName: p.toolName,
              args: p.args,
              result: result.result,
            },
            providerMetadata: result.providerMetadata ?? providerMetadata,
            providerExecuted: resultProviderExecuted,
          } as MastraMessagePart);
        } else {
          // No result yet — emit as 'call' state
          parts.push({
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'call' as const,
              toolCallId: p.toolCallId,
              toolName: p.toolName,
              args: p.args,
            },
            providerMetadata,
            providerExecuted,
          } as MastraMessagePart);
        }
        break;
      }

      case 'tool-error': {
        const p = chunk.payload as ToolErrorPayload;
        const invocationPart = parts.find(
          part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === p.toolCallId,
        );

        if (invocationPart?.type === 'tool-invocation') {
          const errorMessage = getErrorFromUnknown(p.error, { fallbackMessage: 'Tool execution failed' }).message;
          invocationPart.toolInvocation = {
            ...invocationPart.toolInvocation,
            state: 'output-error',
            errorText: errorMessage.trim() ? errorMessage : 'Tool execution failed',
          };
        }
        break;
      }

      // tool-result is consumed above via the toolResults map — no direct handling needed here
      // All other chunk types (finish, error, response-metadata, etc.) don't produce message parts
      default:
        break;
    }
  }

  spans.flushSpansLeftOpen(parts);

  // Remove text parts that ended up empty (e.g. spans where every delta was ''),
  // unless they carry providerMetadata (e.g. Gemini thought signatures, #20469) —
  // that metadata must survive to the DB so it can be sent back to the provider.
  // Empty reasoning parts are kept intentionally (#9005) and are not filtered here.
  const nonEmptyParts = parts.filter(
    p => !(p.type === 'text' && (p as any).text === '' && (p as any).providerMetadata == null),
  );

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
      finalParts.push({ type: 'step-start' } as MastraMessagePart);
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
  const message = {
    id: messageId,
    role: 'assistant' as const,
    content: {
      format: 2,
      parts: finalParts,
      ...(contentString ? { content: contentString } : {}),
      ...responseModelMetadata,
    },
  } as MastraDBMessage;

  return [message];
}
