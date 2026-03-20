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
  if (typeof msg.content === 'string') return (msg.content as string).length > 0;
  const parts = msg.content?.parts;
  if (!parts || !Array.isArray(parts)) return false;
  return parts.some((p: { type?: string }) => !p.type?.startsWith('data-'));
}

type RecallThread = {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
};

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
  listThreads: (args: {
    perPage?: number | false;
    page?: number;
    orderBy?: { field: string; direction: 'ASC' | 'DESC' };
    filter?: { resourceId?: string; metadata?: Record<string, unknown> };
  }) => Promise<{ threads: RecallThread[]; total: number; hasMore: boolean; page: number }>;
  searchMessages?: (args: {
    query: string;
    resourceId: string;
    topK?: number;
  }) => Promise<{ results: Array<{ messageId: string; threadId: string; score: number }> }>;
  getThreadById?: (args: { threadId: string }) => Promise<RecallThread | null>;
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

// ── Thread listing ──────────────────────────────────────────────────

export async function listThreadsForResource({
  memory,
  resourceId,
  currentThreadId,
  page = 0,
  limit = 20,
  before,
  after,
}: {
  memory: RecallMemory;
  resourceId: string;
  currentThreadId: string;
  page?: number;
  limit?: number;
  before?: string;
  after?: string;
}): Promise<{
  threads: string;
  count: number;
  page: number;
  hasMore: boolean;
}> {
  if (!resourceId) {
    throw new Error('Resource ID is required to list threads');
  }

  const MAX_LIMIT = 50;
  const normalizedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  const hasDateFilter = !!(before || after);
  const beforeDate = before ? new Date(before) : null;
  const afterDate = after ? new Date(after) : null;

  // When date filtering, fetch all threads and filter client-side
  // (storage layer doesn't support date range on threads)
  const result = await memory.listThreads({
    filter: { resourceId },
    page: hasDateFilter ? 0 : page,
    perPage: hasDateFilter ? false : normalizedLimit,
    orderBy: { field: 'updatedAt', direction: 'DESC' },
  });

  let threads = result.threads;

  if (beforeDate) {
    threads = threads.filter(t => t.createdAt < beforeDate);
  }
  if (afterDate) {
    threads = threads.filter(t => t.createdAt > afterDate);
  }

  // Apply client-side pagination when date-filtered
  let hasMore: boolean;
  if (hasDateFilter) {
    const offset = page * normalizedLimit;
    hasMore = offset + normalizedLimit < threads.length;
    threads = threads.slice(offset, offset + normalizedLimit);
  } else {
    hasMore = result.hasMore;
  }

  if (threads.length === 0) {
    return {
      threads: 'No threads found matching the criteria.',
      count: 0,
      page,
      hasMore: false,
    };
  }

  const lines: string[] = [];
  for (const thread of threads) {
    const isCurrent = thread.id === currentThreadId;
    const title = thread.title || '(untitled)';
    const updated = formatTimestamp(thread.updatedAt);
    const created = formatTimestamp(thread.createdAt);
    const marker = isCurrent ? ' ← current' : '';
    lines.push(`- **${title}**${marker}`);
    lines.push(`  id: ${thread.id}`);
    lines.push(`  updated: ${updated} | created: ${created}`);
  }

  return {
    threads: lines.join('\n'),
    count: threads.length,
    page,
    hasMore,
  };
}

// ── Cross-thread search ─────────────────────────────────────────────

export async function searchMessagesForResource({
  memory,
  resourceId,
  currentThreadId,
  query,
  topK = 10,
  before,
  after,
}: {
  memory: RecallMemory;
  resourceId: string;
  currentThreadId?: string;
  query: string;
  topK?: number;
  before?: string;
  after?: string;
}): Promise<{
  results: string;
  count: number;
}> {
  if (!memory.searchMessages) {
    throw new Error(
      'Search requires a vector store and embedder. Configure vector and embedder on your Memory instance.',
    );
  }

  const { results } = await memory.searchMessages({ query, resourceId, topK });

  if (results.length === 0) {
    return {
      results: 'No matching messages found.',
      count: 0,
    };
  }

  // Fetch actual message content for previews
  const memoryStore = await memory.getMemoryStore();
  const messageIds = results.map(r => r.messageId);
  const { messages } = await memoryStore.listMessagesById({ messageIds });
  const messageMap = new Map(messages.map(m => [m.id, m]));

  // Fetch thread info for context
  const threadIds = [...new Set(results.map(r => r.threadId))];
  const threadMap = new Map<string, RecallThread>();
  if (memory.getThreadById) {
    await Promise.all(
      threadIds.map(async id => {
        const thread = await memory.getThreadById!({ threadId: id });
        if (thread) threadMap.set(id, thread);
      }),
    );
  }

  // Filter by date if specified
  const beforeDate = before ? new Date(before) : undefined;
  const afterDate = after ? new Date(after) : undefined;
  const dateFilteredThreadIds = new Set(
    threadIds.filter(id => {
      const thread = threadMap.get(id);
      if (!thread) return true; // keep if no thread info
      const created = new Date(thread.createdAt);
      if (beforeDate && created >= beforeDate) return false;
      if (afterDate && created <= afterDate) return false;
      return true;
    }),
  );

  // Group results by thread (filtered)
  const byThread = new Map<string, Array<{ messageId: string; score: number; message?: MastraDBMessage }>>();
  for (const r of results) {
    if (!dateFilteredThreadIds.has(r.threadId)) continue;
    const group = byThread.get(r.threadId) || [];
    group.push({ messageId: r.messageId, score: r.score, message: messageMap.get(r.messageId) });
    byThread.set(r.threadId, group);
  }

  const lines: string[] = [];
  for (const [threadId, matches] of byThread) {
    const thread = threadMap.get(threadId);
    const title = thread?.title || '(untitled)';
    const isCurrent = threadId === currentThreadId;
    const marker = isCurrent ? ' ← current' : '';
    const date = thread ? formatTimestamp(thread.updatedAt) : '';
    lines.push(`**${title}**${marker}`);
    lines.push(`  thread: ${threadId}${date ? ` | updated: ${date}` : ''}`);

    for (const match of matches) {
      const preview = getMessagePreview(match.message);
      lines.push(`  - [${match.score.toFixed(2)}] ${preview}`);
      lines.push(`    cursor: ${match.messageId}`);
    }
    lines.push('');
  }

  const filteredCount = [...byThread.values()].reduce((sum, matches) => sum + matches.length, 0);

  return {
    results: filteredCount === 0 ? 'No matching messages found.' : lines.join('\n').trim(),
    count: filteredCount,
  };
}

function getMessagePreview(message?: MastraDBMessage): string {
  if (!message) return '(message not found)';

  // Extract text from message parts
  if (message.content?.parts) {
    for (const part of message.content.parts) {
      if (part.type === 'text' && part.text) {
        const text = part.text.trim();
        if (text) {
          return text.length > 120 ? text.slice(0, 117) + '...' : text;
        }
      }
    }
  }

  // Fallback to content string
  if (typeof message.content?.content === 'string') {
    const text = message.content.content.trim();
    if (text) {
      return text.length > 120 ? text.slice(0, 117) + '...' : text;
    }
  }

  return `(${message.role} message)`;
}

// ── Per-part formatting ─────────────────────────────────────────────

const LOW_DETAIL_PART_TOKENS = 30;
const AUTO_EXPAND_TEXT_TOKENS = 100;
const AUTO_EXPAND_TOOL_TOKENS = 20;
const HIGH_DETAIL_TOOL_RESULT_TOKENS = 4000;
const DEFAULT_MAX_RESULT_TOKENS = 2000;

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
  /** Full untruncated text — used for auto-expand when token budget allows */
  fullText: string;
}

function truncateByTokens(text: string, maxTokens: number, hint?: string): { text: string; wasTruncated: boolean } {
  if (estimateTokenCount(text) <= maxTokens) return { text, wasTruncated: false };
  // Truncate content to maxTokens, then append hint outside the budget
  const truncated = truncateStringByTokens(text, maxTokens);
  const suffix = hint ? ` [${hint} for more]` : '';
  return { text: truncated + suffix, wasTruncated: true };
}

function lowDetailPartLimit(type: string): number {
  if (type === 'text') return AUTO_EXPAND_TEXT_TOKENS;
  if (type === 'tool-result' || type === 'tool-call') return AUTO_EXPAND_TOOL_TOKENS;
  return LOW_DETAIL_PART_TOKENS;
}

function makePart(
  msg: MastraDBMessage,
  partIndex: number,
  type: string,
  fullText: string,
  detail: RecallDetail,
): FormattedPart {
  if (detail === 'high') {
    return { messageId: msg.id, partIndex, role: msg.role, type, text: fullText, fullText };
  }
  const hint = `recall cursor="${msg.id}" partIndex=${partIndex} detail="high"`;
  const { text } = truncateByTokens(fullText, lowDetailPartLimit(type), hint);
  return { messageId: msg.id, partIndex, role: msg.role, type, text, fullText };
}

function formatMessageParts(msg: MastraDBMessage, detail: RecallDetail): FormattedPart[] {
  const parts: FormattedPart[] = [];

  if (typeof msg.content === 'string') {
    parts.push(makePart(msg, 0, 'text', msg.content, detail));
    return parts;
  }

  if (msg.content?.parts && Array.isArray(msg.content.parts)) {
    for (let i = 0; i < msg.content.parts.length; i++) {
      const part = msg.content.parts[i]!;
      const partType = (part as { type?: string }).type;

      if (partType === 'text') {
        const text = (part as { text: string }).text;
        parts.push(makePart(msg, i, 'text', text, detail));
      } else if (partType === 'tool-invocation') {
        const inv = (part as any).toolInvocation;
        if (inv.state === 'result') {
          const { value: resultValue } = resolveToolResultValue(
            part as { providerMetadata?: Record<string, any> },
            inv.result,
          );
          // Serialize at high-detail budget — makePart handles per-part truncation with hint
          const resultStr = formatToolResultForObserver(resultValue, { maxTokens: HIGH_DETAIL_TOOL_RESULT_TOKENS });
          const fullText = `[Tool Result: ${inv.toolName}]\n${resultStr}`;
          parts.push(makePart(msg, i, 'tool-result', fullText, detail));
        } else {
          const argsStr = detail === 'low' ? '' : `\n${JSON.stringify(inv.args, null, 2)}`;
          const fullText = `[Tool Call: ${inv.toolName}]${argsStr}`;
          parts.push({ messageId: msg.id, partIndex: i, role: msg.role, type: 'tool-call', text: fullText, fullText });
        }
      } else if (partType === 'reasoning') {
        const reasoning = (part as { reasoning?: string }).reasoning;
        if (reasoning) {
          parts.push(makePart(msg, i, 'reasoning', reasoning, detail));
        }
      } else if (partType === 'image' || partType === 'file') {
        const filename = (part as any).filename;
        const label = filename ? `: ${filename}` : '';
        const fullText = `[${partType === 'image' ? 'Image' : 'File'}${label}]`;
        parts.push({ messageId: msg.id, partIndex: i, role: msg.role, type: partType, text: fullText, fullText });
      } else if (partType?.startsWith('data-')) {
        // skip data parts — these are internal OM markers (buffering, observation, etc.)
      } else if (partType) {
        const fullText = `[${partType}]`;
        parts.push({ messageId: msg.id, partIndex: i, role: msg.role, type: partType, text: fullText, fullText });
      }
    }
  } else if (msg.content?.content) {
    parts.push(makePart(msg, 0, 'text', msg.content.content, detail));
  }

  return parts;
}

function buildRenderedText(parts: FormattedPart[], timestamps: Map<string, Date>): string {
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
    lines.push(`  ${indexLabel} ${part.text}`);
  }

  return lines.join('\n');
}

const MAX_EXPAND_USER_TEXT_TOKENS = 200;
const MAX_EXPAND_OTHER_TOKENS = 50;

function expandLimit(part: FormattedPart): number {
  if (part.role === 'user' && part.type === 'text') return MAX_EXPAND_USER_TEXT_TOKENS;
  return MAX_EXPAND_OTHER_TOKENS;
}

function expandPriority(part: FormattedPart): number {
  // Lower number = higher priority for expansion
  if (part.role === 'user' && part.type === 'text') return 0;
  if (part.type === 'text' || part.type === 'reasoning') return 1;
  if (part.type === 'tool-result') return 2;
  if (part.type === 'tool-call') return 3;
  return 4;
}

function renderFormattedParts(
  parts: FormattedPart[],
  timestamps: Map<string, Date>,
  options: { detail: RecallDetail; maxTokens: number },
): { text: string; truncated: boolean; tokenOffset: number } {
  // Step 1: render with per-part truncated text
  const text = buildRenderedText(parts, timestamps);
  let totalTokens = estimateTokenCount(text);

  if (totalTokens > options.maxTokens) {
    // Already over budget even with truncated text — hard-truncate
    const truncated = truncateStringByTokens(text, options.maxTokens);
    return { text: truncated, truncated: true, tokenOffset: totalTokens - options.maxTokens };
  }

  // Step 2: we're under budget — try expanding truncated parts with leftover room.
  // Find parts where text !== fullText (i.e., they were truncated).
  const truncatedIndices = parts
    .map((p, i) => ({ part: p, index: i }))
    .filter(({ part }) => part.text !== part.fullText)
    .sort((a, b) => expandPriority(a.part) - expandPriority(b.part));

  if (truncatedIndices.length === 0) {
    return { text, truncated: false, tokenOffset: 0 };
  }

  let remaining = options.maxTokens - totalTokens;

  for (const { part, index } of truncatedIndices) {
    if (remaining <= 0) break;

    const maxTokens = expandLimit(part);
    const fullTokens = estimateTokenCount(part.fullText);
    const currentTokens = estimateTokenCount(part.text);
    // Cap at the expand limit for this part type
    const targetTokens = Math.min(fullTokens, maxTokens);
    const delta = targetTokens - currentTokens;

    if (delta <= 0) continue; // already at or above expand limit

    if (delta <= remaining && targetTokens >= fullTokens) {
      // Full text fits within both expand limit and remaining budget
      parts[index] = { ...part, text: part.fullText };
      remaining -= delta;
    } else {
      // Partial expand — cap at expand limit or remaining budget, whichever is smaller
      const expandedLimit = Math.min(currentTokens + remaining, maxTokens);
      const hint = `recall cursor="${part.messageId}" partIndex=${part.partIndex} detail="high"`;
      const { text: expanded } = truncateByTokens(part.fullText, expandedLimit, hint);
      const expandedDelta = estimateTokenCount(expanded) - currentTokens;
      parts[index] = { ...part, text: expanded };
      remaining -= expandedDelta;
    }
  }

  // Step 3: re-render with expanded parts
  const expanded = buildRenderedText(parts, timestamps);
  const expandedTokens = estimateTokenCount(expanded);

  if (expandedTokens <= options.maxTokens) {
    return { text: expanded, truncated: false, tokenOffset: 0 };
  }

  // Safety net: if token estimates drifted, hard-truncate
  const hardTruncated = truncateStringByTokens(expanded, options.maxTokens);
  return { text: hardTruncated, truncated: true, tokenOffset: expandedTokens - options.maxTokens };
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

  const MAX_PAGE = 50;
  const MAX_LIMIT = 20;
  const rawPage = page === 0 ? 1 : page;
  const normalizedPage = Math.max(Math.min(rawPage, MAX_PAGE), -MAX_PAGE);
  const normalizedLimit = Math.min(limit, MAX_LIMIT);

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

  // Use the thread the cursor actually belongs to — the caller may be browsing a different thread
  const resolvedThreadId = anchor.threadId || threadId;

  const isForward = normalizedPage > 0;
  const pageIndex = Math.max(Math.abs(normalizedPage), 1) - 1;
  const skip = pageIndex * normalizedLimit;

  // Fetch skip + limit + 1 to detect whether another page exists beyond this one
  const fetchCount = skip + normalizedLimit + 1;

  const result = await memory.recall({
    threadId: resolvedThreadId,
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
      const next = otherMsgParts[0]!;
      hints.push(`next message: partIndex=${next.partIndex} on cursor="${next.messageId}"`);
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

// ── Thread browsing (no cursor) ─────────────────────────────────────

export async function recallThreadFromStart({
  memory,
  threadId,
  resourceId,
  page = 1,
  limit = 20,
  detail = 'low',
  maxTokens = DEFAULT_MAX_RESULT_TOKENS,
}: {
  memory: RecallMemory;
  threadId: string;
  resourceId?: string;
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

  const MAX_PAGE = 50;
  const MAX_LIMIT = 20;
  const normalizedPage = Math.max(Math.min(page, MAX_PAGE), 1);
  const normalizedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const pageIndex = normalizedPage - 1;

  // Fetch one extra to detect hasNextPage
  const fetchCount = pageIndex * normalizedLimit + normalizedLimit + 1;

  const result = await memory.recall({
    threadId,
    resourceId,
    page: 0,
    perPage: fetchCount,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });

  const visibleMessages = result.messages.filter(hasVisibleParts);
  const total = visibleMessages.length;
  const skip = pageIndex * normalizedLimit;
  const hasMore = total > skip + normalizedLimit;
  const messages = visibleMessages.slice(skip, skip + normalizedLimit);

  const allParts: FormattedPart[] = [];
  const timestamps = new Map<string, Date>();
  for (const msg of messages) {
    timestamps.set(msg.id, msg.createdAt);
    allParts.push(...formatMessageParts(msg, detail));
  }

  const rendered = renderFormattedParts(allParts, timestamps, { detail, maxTokens });

  return {
    messages: rendered.text || '(no messages in this thread)',
    count: messages.length,
    cursor: messages[0]?.id || '',
    page: normalizedPage,
    limit: normalizedLimit,
    detail,
    hasNextPage: hasMore,
    hasPrevPage: pageIndex > 0,
    truncated: rendered.truncated,
    tokenOffset: rendered.tokenOffset,
  };
}

export const recallTool = (_memoryConfig?: MemoryConfigInternal) => {
  return createTool({
    id: 'recall',
    description:
      'Browse conversation history. Use mode="threads" to list all threads for the current user. Use mode="messages" (default) to page through messages near a cursor. Pass threadId to browse a different thread. Use mode="search" to find messages by content across all threads.',
    inputSchema: z.object({
      mode: z
        .enum(['messages', 'threads', 'search'])
        .optional()
        .describe(
          'What to retrieve. "messages" (default) pages through message history. "threads" lists all threads for the current user. "search" finds messages by semantic similarity across all threads.',
        ),
      query: z
        .string()
        .min(1)
        .optional()
        .describe(
          'Search query for mode="search". Finds messages semantically similar to this text across all threads.',
        ),
      cursor: z
        .string()
        .min(1)
        .optional()
        .describe(
          'A message ID to use as the pagination cursor. Required for mode="messages". Extract it from the start or end of an observation group range.',
        ),
      threadId: z
        .string()
        .min(1)
        .optional()
        .describe('Browse a different thread. Use mode="threads" first to discover thread IDs.'),
      page: z
        .number()
        .int()
        .min(-50)
        .max(50)
        .optional()
        .describe(
          'Pagination offset. For messages: positive pages move forward from cursor, negative move backward. For threads: page number (0-indexed). 0 is treated as 1 for messages.',
        ),
      limit: z
        .number()
        .int()
        .positive()
        .max(20)
        .optional()
        .describe('Maximum number of items to return per page. Defaults to 20.'),
      detail: z
        .enum(['low', 'high'])
        .optional()
        .describe(
          'Detail level for messages. "low" (default) returns truncated text and tool names. "high" returns full content with tool args/results.',
        ),
      partIndex: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          'Fetch a single part from the cursor message by its positional index. When provided, returns only that part at high detail. Indices are shown as [p0], [p1], etc. in recall results.',
        ),
      before: z
        .string()
        .optional()
        .describe(
          'For mode="threads": only show threads created before this date. ISO 8601 or natural date string (e.g. "2026-03-15", "2026-03-10T00:00:00Z").',
        ),
      after: z
        .string()
        .optional()
        .describe(
          'For mode="threads": only show threads created after this date. ISO 8601 or natural date string (e.g. "2026-03-01", "2026-03-10T00:00:00Z").',
        ),
    }),
    execute: async (
      {
        mode,
        query,
        cursor,
        threadId: explicitThreadId,
        page,
        limit,
        detail,
        partIndex,
        before,
        after,
      }: {
        mode?: 'messages' | 'threads' | 'search';
        query?: string;
        cursor?: string;
        threadId?: string;
        page?: number;
        limit?: number;
        detail?: RecallDetail;
        partIndex?: number;
        before?: string;
        after?: string;
      },
      context,
    ) => {
      const memory = (context as any)?.memory as RecallMemory | undefined;
      const currentThreadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;

      if (!memory) {
        throw new Error('Memory instance is required for recall');
      }

      // Search mode
      if (mode === 'search') {
        if (!query) {
          throw new Error('query is required for mode="search"');
        }
        if (!resourceId) {
          throw new Error('Resource ID is required for search');
        }
        return searchMessagesForResource({
          memory,
          resourceId,
          currentThreadId: currentThreadId || undefined,
          query,
          topK: limit ?? 10,
          before,
          after,
        });
      }

      // Thread listing mode
      if (mode === 'threads') {
        if (!resourceId) {
          throw new Error('Resource ID is required to list threads');
        }
        return listThreadsForResource({
          memory,
          resourceId,
          currentThreadId: currentThreadId || '',
          page: page ?? 0,
          limit: limit ?? 20,
          before,
          after,
        });
      }

      // Use explicit threadId if provided, otherwise fall back to current thread
      const targetThreadId = explicitThreadId || currentThreadId;
      if (!targetThreadId) {
        throw new Error('Thread ID is required for recall');
      }

      // No cursor — read from the start of the thread
      if (!cursor) {
        return recallThreadFromStart({
          memory,
          threadId: targetThreadId,
          resourceId,
          page: page ?? 1,
          limit: limit ?? 20,
          detail: detail ?? 'low',
        });
      }

      // Single-part fetch mode
      if (partIndex !== undefined && partIndex !== null) {
        return recallPart({
          memory,
          threadId: targetThreadId,
          cursor,
          partIndex,
        });
      }

      return recallMessages({
        memory,
        threadId: targetThreadId,
        resourceId,
        cursor,
        page,
        limit,
        detail: detail ?? 'low',
      });
    },
  });
};
