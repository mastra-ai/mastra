import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryConfigInternal } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import { estimateTokenCount } from 'tokenx';
import { z } from 'zod';

import {
  formatToolResultForObserver,
  resolveToolResultValue,
  truncateStringByTokens,
} from '../processors/observational-memory/tool-result-helpers';

export type RecallDetail = 'low' | 'high';

/** Returns true if a message has at least one non-data part with visible content. */
function hasVisibleParts(msg: MastraDBMessage): boolean {
  const parts = msg.content?.parts;
  if (!parts || !Array.isArray(parts)) return false;
  return parts.some((p: { type?: string }) => !p.type?.startsWith('data-'));
}

type RecallMemory = {
  getMemoryStore: () => Promise<{
    listMessagesById: (args: { messageIds: string[] }) => Promise<{ messages: MastraDBMessage[] }>;
  }>;
  recall: (args: {
    threadId: string;
    resourceId?: string;
    page: number;
    perPage: number | false;
    orderBy?: { field: 'createdAt'; direction: 'ASC' | 'DESC' };
    filter?: {
      dateRange?: {
        start?: Date;
        end?: Date;
        startExclusive?: boolean;
        endExclusive?: boolean;
      };
    };
  }) => Promise<{ messages: MastraDBMessage[] }>;
};

function parseRangeFormat(cursor: string): { startId: string; endId: string } | null {
  // Comma-separated merged ranges: "id1:id2,id3:id4"
  if (cursor.includes(',')) {
    const parts = cursor
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length >= 1) {
      const first = parts[0]!;
      const last = parts[parts.length - 1]!;
      const firstColon = first.indexOf(':');
      const lastColon = last.indexOf(':');
      return {
        startId: firstColon > 0 ? first.slice(0, firstColon) : first,
        endId: lastColon > 0 ? last.slice(lastColon + 1) : last,
      };
    }
  }

  // Colon-delimited range: "startId:endId"
  const colonIndex = cursor.indexOf(':');
  if (colonIndex > 0 && colonIndex < cursor.length - 1) {
    return { startId: cursor.slice(0, colonIndex), endId: cursor.slice(colonIndex + 1) };
  }

  return null;
}

async function resolveCursorMessage(
  memory: RecallMemory,
  cursor: string,
): Promise<MastraDBMessage | { hint: string; startId: string; endId: string }> {
  const normalized = cursor.trim();

  if (!normalized) {
    throw new Error('Cursor is required');
  }

  const rangeIds = parseRangeFormat(normalized);
  if (rangeIds) {
    return {
      hint: `The cursor "${cursor}" looks like a range. Use one of the individual message IDs as the cursor instead: start="${rangeIds.startId}" or end="${rangeIds.endId}".`,
      ...rangeIds,
    };
  }

  const memoryStore = await memory.getMemoryStore();
  const result = await memoryStore.listMessagesById({ messageIds: [normalized] });
  const message = result.messages.find(message => message.id === normalized);

  if (!message) {
    throw new Error(`Could not resolve cursor message: ${cursor}`);
  }

  return message;
}

// ── Per-part formatting ─────────────────────────────────────────────

const LOW_DETAIL_TEXT_LIMIT = 120;
const LOW_DETAIL_TOOL_RESULT_TOKENS = 60;
const HIGH_DETAIL_TOOL_RESULT_TOKENS = 4000;
const DEFAULT_MAX_RESULT_TOKENS = 8000;

function formatTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, 'Z');
}

interface FormattedPart {
  messageId: string;
  partIndex: number;
  role: string;
  type: string;
  text: string;
}

function truncateText(text: string, maxChars: number, hint?: string): string {
  if (text.length <= maxChars) return text;
  const suffix = hint ? `… [truncated — ${hint}]` : '…';
  return text.slice(0, maxChars) + suffix;
}

function formatMessageParts(msg: MastraDBMessage, detail: RecallDetail): FormattedPart[] {
  const role = msg.role;
  const parts: FormattedPart[] = [];

  if (typeof msg.content === 'string') {
    parts.push({
      messageId: msg.id,
      partIndex: 0,
      role,
      type: 'text',
      text:
        detail === 'low'
          ? truncateText(msg.content, LOW_DETAIL_TEXT_LIMIT, `recall cursor="${msg.id}" partIndex=0 detail="high"`)
          : msg.content,
    });
    return parts;
  }

  if (msg.content?.parts && Array.isArray(msg.content.parts)) {
    for (let i = 0; i < msg.content.parts.length; i++) {
      const part = msg.content.parts[i]!;
      const partType = (part as { type?: string }).type;

      if (partType === 'text') {
        const text = (part as { text: string }).text;
        parts.push({
          messageId: msg.id,
          partIndex: i,
          role,
          type: 'text',
          text:
            detail === 'low'
              ? truncateText(text, LOW_DETAIL_TEXT_LIMIT, `recall cursor="${msg.id}" partIndex=${i} detail="high"`)
              : text,
        });
      } else if (partType === 'tool-invocation') {
        const inv = (part as any).toolInvocation;
        if (inv.state === 'result') {
          const { value: resultValue } = resolveToolResultValue(
            part as { providerMetadata?: Record<string, any> },
            inv.result,
          );
          if (detail === 'low') {
            const resultStr = formatToolResultForObserver(resultValue, { maxTokens: LOW_DETAIL_TOOL_RESULT_TOKENS });
            parts.push({
              messageId: msg.id,
              partIndex: i,
              role,
              type: 'tool-result',
              text: `[Tool Result: ${inv.toolName}] ${truncateText(resultStr, LOW_DETAIL_TEXT_LIMIT, `recall cursor="${msg.id}" partIndex=${i} detail="high"`)}`,
            });
          } else {
            const resultStr = formatToolResultForObserver(resultValue, { maxTokens: HIGH_DETAIL_TOOL_RESULT_TOKENS });
            parts.push({
              messageId: msg.id,
              partIndex: i,
              role,
              type: 'tool-result',
              text: `[Tool Result: ${inv.toolName}]\n${resultStr}`,
            });
          }
        } else {
          if (detail === 'low') {
            parts.push({
              messageId: msg.id,
              partIndex: i,
              role,
              type: 'tool-call',
              text: `[Tool Call: ${inv.toolName}]`,
            });
          } else {
            const argsStr = JSON.stringify(inv.args, null, 2);
            parts.push({
              messageId: msg.id,
              partIndex: i,
              role,
              type: 'tool-call',
              text: `[Tool Call: ${inv.toolName}]\n${argsStr}`,
            });
          }
        }
      } else if (partType === 'reasoning') {
        const reasoning = (part as { reasoning?: string }).reasoning;
        if (reasoning) {
          parts.push({
            messageId: msg.id,
            partIndex: i,
            role,
            type: 'reasoning',
            text:
              detail === 'low'
                ? truncateText(
                    reasoning,
                    LOW_DETAIL_TEXT_LIMIT,
                    `recall cursor="${msg.id}" partIndex=${i} detail="high"`,
                  )
                : reasoning,
          });
        }
      } else if (partType === 'image' || partType === 'file') {
        const filename = (part as any).filename;
        const label = filename ? `: ${filename}` : '';
        parts.push({
          messageId: msg.id,
          partIndex: i,
          role,
          type: partType,
          text: `[${partType === 'image' ? 'Image' : 'File'}${label}]`,
        });
      } else if (partType?.startsWith('data-')) {
        // skip data parts — these are internal OM markers (buffering, observation, etc.)
      } else if (partType) {
        // unknown part type — include a placeholder so the part isn't silently lost
        parts.push({
          messageId: msg.id,
          partIndex: i,
          role,
          type: partType,
          text: `[${partType}]`,
        });
      }
    }
  } else if (msg.content?.content) {
    parts.push({
      messageId: msg.id,
      partIndex: 0,
      role,
      type: 'text',
      text:
        detail === 'low'
          ? truncateText(
              msg.content.content,
              LOW_DETAIL_TEXT_LIMIT,
              `recall cursor="${msg.id}" partIndex=0 detail="high"`,
            )
          : msg.content.content,
    });
  }

  return parts;
}

function renderFormattedParts(
  parts: FormattedPart[],
  timestamps: Map<string, Date>,
  options: { detail: RecallDetail; maxTokens: number },
): { text: string; truncated: boolean; tokenOffset: number } {
  let currentMessageId = '';
  const lines: string[] = [];

  for (const part of parts) {
    if (part.messageId !== currentMessageId) {
      currentMessageId = part.messageId;
      const ts = timestamps.get(part.messageId);
      const tsStr = ts ? ` (${formatTimestamp(ts)})` : '';
      if (lines.length > 0) lines.push(''); // blank line between messages
      lines.push(`**${part.role}${tsStr}** [${part.messageId}]:`);
    }

    const indexLabel = `[p${part.partIndex}]`;
    if (options.detail === 'low') {
      lines.push(`  ${indexLabel} ${part.text}`);
    } else {
      lines.push(`  ${indexLabel} ${part.text}`);
    }
  }

  const fullText = lines.join('\n');
  const totalTokens = estimateTokenCount(fullText);

  if (totalTokens <= options.maxTokens) {
    return { text: fullText, truncated: false, tokenOffset: 0 };
  }

  // Truncate to fit token budget
  const truncated = truncateStringByTokens(fullText, options.maxTokens);
  return { text: truncated, truncated: true, tokenOffset: totalTokens - options.maxTokens };
}

// ── Single-part fetch ────────────────────────────────────────────────

export async function recallPart({
  memory,
  threadId,
  cursor,
  partIndex,
  maxTokens = DEFAULT_MAX_RESULT_TOKENS,
}: {
  memory: RecallMemory;
  threadId: string;
  cursor: string;
  partIndex: number;
  maxTokens?: number;
}): Promise<{ text: string; messageId: string; partIndex: number; role: string; type: string; truncated: boolean }> {
  if (!memory || typeof memory.getMemoryStore !== 'function') {
    throw new Error('Memory instance is required for recall');
  }

  if (!threadId) {
    throw new Error('Thread ID is required for recall');
  }

  const resolved = await resolveCursorMessage(memory, cursor);

  if ('hint' in resolved) {
    throw new Error(resolved.hint);
  }

  if (resolved.threadId !== threadId) {
    throw new Error('The requested cursor does not belong to the current thread');
  }

  const allParts = formatMessageParts(resolved, 'high');

  if (allParts.length === 0) {
    throw new Error(
      `Message ${cursor} has no visible content (it may be an internal system message). Try a neighboring message ID instead.`,
    );
  }

  const target = allParts.find(p => p.partIndex === partIndex);

  if (!target) {
    throw new Error(
      `Part index ${partIndex} not found in message ${cursor}. Available indices: ${allParts.map(p => p.partIndex).join(', ')}`,
    );
  }

  const truncatedText = truncateStringByTokens(target.text, maxTokens);
  const wasTruncated = truncatedText !== target.text;

  return {
    text: truncatedText,
    messageId: target.messageId,
    partIndex: target.partIndex,
    role: target.role,
    type: target.type,
    truncated: wasTruncated,
  };
}

// ── Paged recall ─────────────────────────────────────────────────────

export interface RecallResult {
  messages: string;
  count: number;
  cursor: string;
  page: number;
  limit: number;
  detail: RecallDetail;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  truncated: boolean;
  tokenOffset: number;
}

export async function recallMessages({
  memory,
  threadId,
  resourceId,
  cursor,
  page = 1,
  limit = 20,
  detail = 'low',
  maxTokens = DEFAULT_MAX_RESULT_TOKENS,
}: {
  memory: RecallMemory;
  threadId: string;
  resourceId?: string;
  cursor: string;
  page?: number;
  limit?: number;
  detail?: RecallDetail;
  maxTokens?: number;
}): Promise<RecallResult> {
  if (!memory) {
    throw new Error('Memory instance is required for recall');
  }

  if (!threadId) {
    throw new Error('Thread ID is required for recall');
  }

  if (typeof memory.getMemoryStore !== 'function') {
    throw new Error('recall requires a Memory instance with storage access');
  }

  const normalizedPage = page === 0 ? 1 : page;
  const normalizedLimit = limit;

  const resolved = await resolveCursorMessage(memory, cursor);

  if ('hint' in resolved) {
    return {
      messages: resolved.hint,
      count: 0,
      cursor,
      page: normalizedPage,
      limit: normalizedLimit,
      detail,
      hasNextPage: false,
      hasPrevPage: false,
      truncated: false,
      tokenOffset: 0,
    };
  }

  const anchor = resolved;

  if (anchor.threadId !== threadId) {
    throw new Error('The requested cursor does not belong to the current thread');
  }

  const isForward = normalizedPage > 0;
  const pageIndex = Math.max(Math.abs(normalizedPage), 1) - 1;
  const skip = pageIndex * normalizedLimit;

  // Fetch skip + limit + 1 to detect whether another page exists beyond this one
  const fetchCount = skip + normalizedLimit + 1;

  const result = await memory.recall({
    threadId,
    resourceId,
    page: 0,
    perPage: fetchCount,
    orderBy: { field: 'createdAt', direction: isForward ? 'ASC' : 'DESC' },
    filter: {
      dateRange: isForward
        ? {
            start: anchor.createdAt,
            startExclusive: true,
          }
        : {
            end: anchor.createdAt,
            endExclusive: true,
          },
    },
  });

  // Filter out messages with only internal data-* parts so they don't consume page slots.
  const visibleMessages = result.messages.filter(hasVisibleParts);

  // Memory.recall() always returns messages sorted chronologically (ASC) via MessageList.
  // For forward pagination: take from the start of the ASC array (oldest first after cursor).
  // For backward pagination: take from the END of the ASC array (closest to cursor).
  //   DESC query ensures the DB returns the N messages closest to cursor, but MessageList
  //   re-sorts them to ASC. So we slice from the end to get the right page window.
  const total = visibleMessages.length;
  const hasMore = total > skip + normalizedLimit;
  let messages: typeof visibleMessages;
  if (isForward) {
    messages = visibleMessages.slice(skip, skip + normalizedLimit);
  } else {
    // For backward: closest-to-cursor messages are at the end of the ASC-sorted array.
    // Page -1 (skip=0): last `limit` items; page -2 (skip=limit): next `limit` from end; etc.
    const endIdx = Math.max(total - skip, 0);
    const startIdx = Math.max(endIdx - normalizedLimit, 0);
    messages = visibleMessages.slice(startIdx, endIdx);
  }

  // Compute pagination flags
  const hasNextPage = isForward ? hasMore : pageIndex > 0;
  const hasPrevPage = isForward ? pageIndex > 0 : hasMore;

  // Format parts from returned messages
  const allParts: FormattedPart[] = [];
  const timestamps = new Map<string, Date>();
  for (const msg of messages) {
    timestamps.set(msg.id, msg.createdAt);
    allParts.push(...formatMessageParts(msg, detail));
  }

  // High detail: clamp to 1 message and 1 part to avoid token blowup
  if (detail === 'high' && allParts.length > 0) {
    const firstPart = allParts[0]!;
    const sameMsgParts = allParts.filter(p => p.messageId === firstPart.messageId);
    const otherMsgParts = allParts.filter(p => p.messageId !== firstPart.messageId);

    const rendered = renderFormattedParts([firstPart], timestamps, { detail, maxTokens });

    let text = rendered.text;

    // Build continuation hints
    const hints: string[] = [];
    if (sameMsgParts.length > 1) {
      const nextPart = sameMsgParts[1]!;
      hints.push(`next part: partIndex=${nextPart.partIndex} on cursor="${firstPart.messageId}"`);
    }
    if (otherMsgParts.length > 0) {
      hints.push(`next message: cursor="${otherMsgParts[0]!.messageId}"`);
    } else if (hasNextPage) {
      hints.push(`more messages available on page ${normalizedPage + 1}`);
    }

    if (hints.length > 0) {
      text += `\n\nHigh detail returns 1 part at a time. To continue: ${hints.join(', or ')}.`;
    }

    return {
      messages: text,
      count: 1,
      cursor,
      page: normalizedPage,
      limit: normalizedLimit,
      detail,
      hasNextPage: otherMsgParts.length > 0 || hasNextPage,
      hasPrevPage,
      truncated: rendered.truncated,
      tokenOffset: rendered.tokenOffset,
    };
  }

  const rendered = renderFormattedParts(allParts, timestamps, { detail, maxTokens });

  return {
    messages: rendered.text,
    count: messages.length,
    cursor,
    page: normalizedPage,
    limit: normalizedLimit,
    detail,
    hasNextPage,
    hasPrevPage,
    truncated: rendered.truncated,
    tokenOffset: rendered.tokenOffset,
  };
}

export const recallTool = (_memoryConfig?: MemoryConfigInternal) => {
  return createTool({
    id: 'recall',
    description:
      'Retrieve raw message history near an observation group cursor. Observation group ranges use the format startId:endId. Pass either the start or end message ID as the cursor. Use detail="low" (default) for an overview, detail="high" for full content, or provide partIndex to fetch a specific part from the cursor message.',
    inputSchema: z.object({
      cursor: z
        .string()
        .min(1)
        .describe('A single message ID to use as the pagination cursor. Extract it from the start or end of a range.'),
      page: z
        .number()
        .int()
        .optional()
        .describe(
          'Pagination offset from the cursor. Positive pages move forward, negative pages move backward, and 0 is treated as 1.',
        ),
      limit: z.number().int().positive().optional().describe('Maximum number of messages to return. Defaults to 20.'),
      detail: z
        .enum(['low', 'high'])
        .optional()
        .describe(
          'Detail level. "low" (default) returns truncated text and tool names. "high" returns full content with tool args/results.',
        ),
      partIndex: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          'Fetch a single part from the cursor message by its positional index. When provided, returns only that part at high detail. Indices are shown as [p0], [p1], etc. in recall results.',
        ),
    }),
    execute: async (
      {
        cursor,
        page,
        limit,
        detail,
        partIndex,
      }: { cursor: string; page?: number; limit?: number; detail?: RecallDetail; partIndex?: number },
      context,
    ) => {
      const memory = (context as any)?.memory as RecallMemory | undefined;
      const threadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;

      if (!memory) {
        throw new Error('Memory instance is required for recall');
      }

      if (!threadId) {
        throw new Error('Thread ID is required for recall');
      }

      // Single-part fetch mode
      if (partIndex !== undefined && partIndex !== null) {
        return recallPart({
          memory,
          threadId,
          cursor,
          partIndex,
        });
      }

      return recallMessages({
        memory,
        threadId,
        resourceId,
        cursor,
        page,
        limit,
        detail: detail ?? 'low',
      });
    },
  });
};
