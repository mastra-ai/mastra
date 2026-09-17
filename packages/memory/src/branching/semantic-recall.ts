import type { MemoryStorage } from '@mastra/core/storage';
import type { QueryResult, VectorFilter } from '@mastra/core/vector';
import { messageIsReachableInSegment } from './query';
import type { ThreadBranchSegment } from './query';

export const BRANCH_SEMANTIC_RECALL_MAX_QUERIES = 8;

type ReachableVectorQueryInput = {
  memoryStore: MemoryStorage;
  segments: ThreadBranchSegment[];
  topK: number;
  threshold?: number;
  userFilter?: VectorFilter;
  query: (topK: number, filter: VectorFilter) => Promise<QueryResult[]>;
};

function branchPathFilter(segments: ThreadBranchSegment[], userFilter?: VectorFilter): VectorFilter {
  const threadIds = [...new Set(segments.map(segment => segment.thread.id))];
  const scopeFilter = threadIds.length === 1 ? { thread_id: threadIds[0] } : { thread_id: { $in: threadIds } };
  return userFilter ? { $and: [scopeFilter, userFilter] } : scopeFilter;
}

export async function queryReachableVectorResults({
  memoryStore,
  segments,
  topK,
  threshold,
  userFilter,
  query,
}: ReachableVectorQueryInput): Promise<QueryResult[]> {
  if (topK <= 0 || segments.length === 0) return [];

  const filter = branchPathFilter(segments, userFilter);
  const seenVectorIds = new Set<string>();
  const lookedUpMessageIds = new Set<string>();
  const messagesById = new Map<string, Awaited<ReturnType<MemoryStorage['listMessagesById']>>['messages'][number]>();
  const bestResultByMessageId = new Map<string, QueryResult>();
  let requestedTopK = topK;

  for (let queryCount = 0; queryCount < BRANCH_SEMANTIC_RECALL_MAX_QUERIES; queryCount += 1) {
    const results = await query(requestedTopK, filter);
    const newVectorIds = results.filter(result => !seenVectorIds.has(result.id));
    for (const result of results) seenVectorIds.add(result.id);

    const unknownMessageIds = [
      ...new Set(
        results.flatMap(result => {
          const messageId = result.metadata?.message_id;
          return typeof messageId === 'string' && !lookedUpMessageIds.has(messageId) ? [messageId] : [];
        }),
      ),
    ];
    if (unknownMessageIds.length > 0) {
      for (const messageId of unknownMessageIds) lookedUpMessageIds.add(messageId);
      const { messages } = await memoryStore.listMessagesById({ messageIds: unknownMessageIds });
      for (const message of messages) messagesById.set(message.id, message);
    }

    for (const result of results) {
      if (threshold !== undefined && result.score < threshold) continue;
      const messageId = result.metadata?.message_id;
      if (typeof messageId !== 'string') continue;
      const message = messagesById.get(messageId);
      if (!message || !segments.some(segment => messageIsReachableInSegment(message, segment))) continue;
      const current = bestResultByMessageId.get(messageId);
      if (!current || result.score > current.score) bestResultByMessageId.set(messageId, result);
    }

    if (bestResultByMessageId.size >= topK || results.length < requestedTopK || newVectorIds.length === 0) break;
    requestedTopK *= 2;
  }

  return [...bestResultByMessageId.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}
