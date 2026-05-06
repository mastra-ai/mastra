import type { ToolSet } from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessagePart, MastraPartVisibility } from '../../../agent/message-list';
import type {
  ChunkVisibility,
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
 * We only store the type, payload, and visibility — everything needed to
 * reconstruct messages post-stream while preserving processor-set visibility.
 */
export type CollectedChunk = { type: string; payload: any; visibility?: ChunkVisibility };

/**
 * Merge two visibility values, returning the more restrictive one.
 * `'llm'` is more restrictive than `'all'` (or undefined).
 */
function mergeVisibility(
  current: MastraPartVisibility | undefined,
  next: ChunkVisibility | undefined,
): MastraPartVisibility | undefined {
  if (next === 'llm' || current === 'llm') return 'llm';
  return current ?? next;
}

/**
 * Apply a visibility flag to a part, omitting the field when not set so we
 * don't pollute persisted messages with default values.
 */
function withVisibility<T extends MastraMessagePart>(part: T, visibility?: MastraPartVisibility): T {
  if (!visibility || visibility === 'all') return part;
  return { ...part, visibility } as T;
}

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
  const parts: MastraMessagePart[] = [];

  // Collect tool results so we can match them to tool calls
  const toolResults = new Map<
    string,
    {
      result: any;
      args: any;
      providerMetadata: any;
      providerExecuted: boolean | undefined;
      toolName: string;
      visibility?: ChunkVisibility;
    }
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
        visibility: chunk.visibility,
      });
    }
  }

  // State for text span accumulation (keyed by text ID to handle interleaved spans)
  const textSpans = new Map<
    string,
    {
      deltas: string[];
      providerMetadata: Record<string, any> | undefined;
      visibility?: MastraPartVisibility;
    }
  >();

  // State for reasoning span accumulation (keyed by reasoning ID)
  const reasoningSpans = new Map<
    string,
    {
      deltas: string[];
      providerMetadata: Record<string, any> | undefined;
      redacted: boolean;
      visibility?: MastraPartVisibility;
    }
  >();
  for (const chunk of chunks) {
    switch (chunk.type) {
      // ── Text span ──────────────────────────────────────────────
      case 'text-start': {
        const p = chunk.payload as TextStartPayload;
        if (!textSpans.has(p.id)) {
          textSpans.set(p.id, {
            deltas: [],
            providerMetadata: p.providerMetadata,
            visibility: mergeVisibility(undefined, chunk.visibility),
          });
        } else {
          // Update providerMetadata if this start has it
          const existing = textSpans.get(p.id)!;
          if (p.providerMetadata) {
            existing.providerMetadata = p.providerMetadata;
          }
          existing.visibility = mergeVisibility(existing.visibility, chunk.visibility);
        }
        break;
      }
      case 'text-delta': {
        const p = chunk.payload as TextDeltaPayload;
        let span = textSpans.get(p.id);
        // Auto-create span if delta arrives without a matching text-start
        if (!span) {
          span = { deltas: [], providerMetadata: p.providerMetadata };
          textSpans.set(p.id, span);
        }
        span.deltas.push(p.text);
        // AI SDK semantics: latest non-null providerMetadata wins
        if (p.providerMetadata) {
          span.providerMetadata = p.providerMetadata;
        }
        span.visibility = mergeVisibility(span.visibility, chunk.visibility);
        break;
      }
      case 'text-end': {
        const pEnd = chunk.payload as { id: string; providerMetadata?: Record<string, any> };
        const span = textSpans.get(pEnd.id);
        if (span) {
          // AI SDK semantics: latest non-null providerMetadata wins
          if (pEnd.providerMetadata) {
            span.providerMetadata = pEnd.providerMetadata;
          }
          span.visibility = mergeVisibility(span.visibility, chunk.visibility);
          const text = span.deltas.join('');
          // Only emit a part if there's actual content — skip empty text spans
          if (text.length > 0) {
            parts.push(
              withVisibility(
                {
                  type: 'text' as const,
                  text,
                  ...(span.providerMetadata ? { providerMetadata: span.providerMetadata } : {}),
                } as MastraMessagePart,
                span.visibility,
              ),
            );
          }
          textSpans.delete(pEnd.id);
        }
        break;
      }

      // ── Reasoning span ─────────────────────────────────────────
      case 'reasoning-start': {
        const p = chunk.payload as ReasoningStartPayload;
        // Check for redacted reasoning
        const isRedacted = Object.values(p.providerMetadata || {}).some((v: any) => v?.redactedData);

        if (!reasoningSpans.has(p.id)) {
          reasoningSpans.set(p.id, {
            deltas: [],
            providerMetadata: p.providerMetadata,
            redacted: isRedacted,
            visibility: mergeVisibility(undefined, chunk.visibility),
          });
        } else {
          // Update providerMetadata if this start has it
          const existing = reasoningSpans.get(p.id)!;
          if (p.providerMetadata) {
            existing.providerMetadata = p.providerMetadata;
          }
          if (isRedacted) {
            existing.redacted = true;
          }
          existing.visibility = mergeVisibility(existing.visibility, chunk.visibility);
        }
        break;
      }
      case 'reasoning-delta': {
        const p = chunk.payload as ReasoningDeltaPayload;
        let span = reasoningSpans.get(p.id);
        // Auto-create span if delta arrives without a matching reasoning-start
        if (!span) {
          span = { deltas: [], providerMetadata: p.providerMetadata, redacted: false };
          reasoningSpans.set(p.id, span);
        }
        span.deltas.push(p.text);
        // AI SDK semantics: latest non-null providerMetadata wins
        if (p.providerMetadata) {
          span.providerMetadata = p.providerMetadata;
        }
        span.visibility = mergeVisibility(span.visibility, chunk.visibility);
        break;
      }
      case 'reasoning-end': {
        const p = chunk.payload as { id: string; providerMetadata?: Record<string, any> };
        const span = reasoningSpans.get(p.id);
        if (span) {
          // End metadata wins if present — it's the final/complete metadata for this span
          if (p.providerMetadata) {
            span.providerMetadata = p.providerMetadata;
          }
          span.visibility = mergeVisibility(span.visibility, chunk.visibility);

          if (span.redacted) {
            parts.push(
              withVisibility(
                {
                  type: 'reasoning' as const,
                  reasoning: '',
                  details: [{ type: 'redacted', data: '' }],
                  providerMetadata: span.providerMetadata,
                } as MastraMessagePart,
                span.visibility,
              ),
            );
          } else {
            // Always emit reasoning parts, even if empty — OpenAI requires item_reference
            // for tool calls that follow reasoning. See: https://github.com/mastra-ai/mastra/issues/9005
            parts.push(
              withVisibility(
                {
                  type: 'reasoning' as const,
                  reasoning: '',
                  details: [{ type: 'text', text: span.deltas.join('') }],
                  providerMetadata: span.providerMetadata,
                } as MastraMessagePart,
                span.visibility,
              ),
            );
          }

          reasoningSpans.delete(p.id);
        }
        break;
      }

      // Redacted reasoning can appear as a standalone chunk (not wrapped in start/end)
      case 'redacted-reasoning': {
        const p = chunk.payload as { id: string; data: unknown; providerMetadata?: Record<string, any> };
        parts.push(
          withVisibility(
            {
              type: 'reasoning' as const,
              reasoning: '',
              details: [{ type: 'redacted', data: '' }],
              providerMetadata: p.providerMetadata,
            } as MastraMessagePart,
            mergeVisibility(undefined, chunk.visibility),
          ),
        );
        break;
      }

      // ── Source ──────────────────────────────────────────────────
      case 'source': {
        const p = chunk.payload as SourcePayload;
        parts.push(
          withVisibility(
            {
              type: 'source',
              source: {
                sourceType: 'url',
                id: p.id,
                url: p.url || '',
                title: p.title,
                providerMetadata: p.providerMetadata,
              },
            } as MastraMessagePart,
            mergeVisibility(undefined, chunk.visibility),
          ),
        );
        break;
      }

      // ── File ───────────────────────────────────────────────────
      case 'file': {
        const p = chunk.payload as FilePayload;
        parts.push(
          withVisibility(
            {
              type: 'file' as const,
              data: p.data,
              mimeType: p.mimeType,
              ...(p.providerMetadata ? { providerMetadata: p.providerMetadata } : {}),
            } as MastraMessagePart,
            mergeVisibility(undefined, chunk.visibility),
          ),
        );
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
          parts.push(
            withVisibility(
              {
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
              } as MastraMessagePart,
              mergeVisibility(mergeVisibility(undefined, chunk.visibility), result.visibility),
            ),
          );
        } else {
          // No result yet — emit as 'call' state
          parts.push(
            withVisibility(
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: p.toolCallId,
                  toolName: p.toolName,
                  args: p.args,
                },
                providerMetadata: p.providerMetadata,
                providerExecuted,
              } as MastraMessagePart,
              mergeVisibility(undefined, chunk.visibility),
            ),
          );
        }
        break;
      }

      // tool-result is consumed above via the toolResults map — no direct handling needed here
      // All other chunk types (finish, error, response-metadata, etc.) don't produce message parts
      default:
        break;
    }
  }

  // Flush any unclosed reasoning spans (stream ended without reasoning-end)
  for (const [_id, span] of reasoningSpans) {
    if (span.redacted) {
      parts.push(
        withVisibility(
          {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'redacted', data: '' }],
            providerMetadata: span.providerMetadata,
          } as MastraMessagePart,
          span.visibility,
        ),
      );
    } else {
      const text = span.deltas.join('');
      parts.push(
        withVisibility(
          {
            type: 'reasoning' as const,
            reasoning: '',
            details: [{ type: 'text', text }],
            providerMetadata: span.providerMetadata,
          } as MastraMessagePart,
          span.visibility,
        ),
      );
    }
  }

  // Flush any unclosed text spans (stream ended without text-end)
  for (const [, span] of textSpans) {
    const text = span.deltas.join('');
    if (text.length > 0) {
      parts.push(
        withVisibility(
          {
            type: 'text' as const,
            text,
            ...(span.providerMetadata ? { providerMetadata: span.providerMetadata } : {}),
          } as MastraMessagePart,
          span.visibility,
        ),
      );
    }
  }

  // Insert step-start markers between tool-invocation and subsequent text parts.
  // This matches the convention used by MessageMerger.pushNewPart when merging messages,
  // and is required so that AI SDK convertToModelMessages splits them into separate steps.
  const finalParts: MastraMessagePart[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
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
