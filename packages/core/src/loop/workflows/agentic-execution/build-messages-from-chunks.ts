import type { ToolSet } from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessagePart } from '../../../agent/message-list';
import type {
  FilePayload,
  ReasoningDeltaPayload,
  ReasoningStartPayload,
  SourcePayload,
  TextDeltaPayload,
  TextStartPayload,
  ToolCallPayload,
  ToolResultPayload,
} from '../../../stream/types';
import { findProviderToolByName, inferProviderExecuted } from '../../../tools/provider-tool-utils';

/**
 * A raw chunk collected during the stream.
 * We only store the type and payload — everything needed to reconstruct messages post-stream.
 */
export type CollectedChunk = { type: string; payload: any };

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
        providerMetadata: p.providerMetadata,
        providerExecuted: p.providerExecuted,
        toolName: p.toolName,
      });
    }
  }

  // Metadata stashed by *-start events, applied when the ref is created on first delta.
  const textMeta = new Map<string, Record<string, any> | undefined>();
  const reasoningMeta = new Map<string, Record<string, any> | undefined>();

  // Live references to parts already in the `parts` array, keyed by span ID.
  // Created and pushed on first delta — position reflects content arrival order (#15914).
  const textRefs = new Map<string, { type: 'text'; text: string; providerMetadata?: Record<string, any> }>();
  const reasoningRefs = new Map<
    string,
    { type: 'reasoning'; reasoning: string; details: any[]; providerMetadata?: Record<string, any> }
  >();

  for (const chunk of chunks) {
    switch (chunk.type) {
      // ── Text span ──────────────────────────────────────────────
      case 'text-start': {
        const p = chunk.payload as TextStartPayload;
        // Just stash metadata — part is created on first delta
        textMeta.set(p.id, p.providerMetadata);
        break;
      }
      case 'text-delta': {
        const p = chunk.payload as TextDeltaPayload;
        let ref = textRefs.get(p.id);
        if (!ref) {
          // First delta for this span — create the part and push it now
          ref = { type: 'text' as const, text: '', providerMetadata: textMeta.get(p.id) ?? p.providerMetadata };
          textRefs.set(p.id, ref);
          parts.push(ref as unknown as MastraMessagePart);
        }
        ref.text += p.text;
        if (p.providerMetadata) {
          ref.providerMetadata = p.providerMetadata;
        }
        break;
      }
      case 'text-end': {
        const pEnd = chunk.payload as { id: string; providerMetadata?: Record<string, any> };
        const ref = textRefs.get(pEnd.id);
        if (ref) {
          if (pEnd.providerMetadata) {
            ref.providerMetadata = pEnd.providerMetadata;
          }
          // Clean up undefined providerMetadata so we don't serialize { providerMetadata: undefined }
          if (!ref.providerMetadata) {
            delete ref.providerMetadata;
          }
        }
        // text-end with no deltas means empty span — nothing to emit
        textMeta.delete(pEnd.id);
        textRefs.delete(pEnd.id);
        break;
      }

      // ── Reasoning span ─────────────────────────────────────────
      case 'reasoning-start': {
        const p = chunk.payload as ReasoningStartPayload;
        const isRedacted = Object.values(p.providerMetadata || {}).some((v: any) => v?.redactedData);

        // Redacted reasoning never receives deltas, so create and push immediately
        if (isRedacted) {
          const part = {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'redacted', data: '' }],
            providerMetadata: p.providerMetadata,
          };
          reasoningRefs.set(p.id, part);
          parts.push(part as unknown as MastraMessagePart);
        } else {
          // Non-redacted: just stash metadata, part is created on first delta
          reasoningMeta.set(p.id, p.providerMetadata);
        }
        break;
      }
      case 'reasoning-delta': {
        const p = chunk.payload as ReasoningDeltaPayload;
        let ref = reasoningRefs.get(p.id);
        if (!ref) {
          // First delta for this span — create the part and push it now
          ref = {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'text', text: '' }],
            providerMetadata: reasoningMeta.get(p.id) ?? p.providerMetadata,
          };
          reasoningRefs.set(p.id, ref);
          parts.push(ref as unknown as MastraMessagePart);
        }
        // Append to the text detail
        const detail = ref.details[0];
        if (detail && detail.type === 'text') {
          detail.text += p.text;
        }
        if (p.providerMetadata) {
          ref.providerMetadata = p.providerMetadata;
        }
        break;
      }
      case 'reasoning-end': {
        const p = chunk.payload as { id: string; providerMetadata?: Record<string, any> };
        const ref = reasoningRefs.get(p.id);
        if (ref) {
          if (p.providerMetadata) {
            ref.providerMetadata = p.providerMetadata;
          }
        } else {
          // No deltas arrived — emit empty reasoning part.
          // OpenAI requires item_reference for tool calls that follow reasoning.
          // See: https://github.com/mastra-ai/mastra/issues/9005
          const part: MastraMessagePart = {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'text', text: '' }],
            providerMetadata: p.providerMetadata ?? reasoningMeta.get(p.id),
          };
          parts.push(part);
        }
        reasoningMeta.delete(p.id);
        reasoningRefs.delete(p.id);
        break;
      }

      // Redacted reasoning can appear as a standalone chunk (not wrapped in start/end)
      case 'redacted-reasoning': {
        const p = chunk.payload as { id: string; data: unknown; providerMetadata?: Record<string, any> };
        parts.push({
          type: 'reasoning' as const,
          reasoning: '',
          details: [{ type: 'redacted', data: '' }],
          providerMetadata: p.providerMetadata,
        } as MastraMessagePart);
        break;
      }

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
            providerMetadata: result.providerMetadata ?? p.providerMetadata,
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
            providerMetadata: p.providerMetadata,
            providerExecuted,
          } as MastraMessagePart);
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
  const nonEmptyParts = parts.filter(p => !(p.type === 'text' && (p as any).text === ''));

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
