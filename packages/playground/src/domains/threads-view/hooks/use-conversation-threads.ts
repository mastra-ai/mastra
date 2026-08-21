import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

type ListTracesResponse = Awaited<ReturnType<MastraClient['listTraces']>>;
type TraceRootSpan = ListTracesResponse['spans'][number];

export interface ConversationThread {
  /** Stable grouping key: threadId, else sessionId, else the trace itself. */
  threadKey: string;
  /** True when the key came from a real conversation identifier. */
  isConversation: boolean;
  turns: TraceRootSpan[];
  actors: string[];
  startedAt: Date | string;
  lastActivityAt: Date | string;
  hasErrors: boolean;
}

function getThreadKey(span: TraceRootSpan): { key: string; isConversation: boolean } {
  if (span.threadId) return { key: `thread:${span.threadId}`, isConversation: true };
  if (span.sessionId) return { key: `session:${span.sessionId}`, isConversation: true };
  return { key: `trace:${span.traceId}`, isConversation: false };
}

export function groupTracesIntoThreads(spans: TraceRootSpan[]): ConversationThread[] {
  const byKey = new Map<string, ConversationThread & { actorSet: Set<string> }>();

  for (const span of spans) {
    const { key, isConversation } = getThreadKey(span);
    const existing = byKey.get(key);
    const actor = span.entityName ?? span.name;
    const failed = span.status === 'error';

    if (!existing) {
      byKey.set(key, {
        threadKey: key,
        isConversation,
        turns: [span],
        actorSet: new Set(actor ? [actor] : []),
        actors: [],
        startedAt: span.startedAt,
        lastActivityAt: span.endedAt ?? span.startedAt,
        hasErrors: failed,
      });
      continue;
    }

    existing.turns.push(span);
    if (actor) existing.actorSet.add(actor);
    if (new Date(span.startedAt) < new Date(existing.startedAt)) existing.startedAt = span.startedAt;
    const activity = span.endedAt ?? span.startedAt;
    if (new Date(activity) > new Date(existing.lastActivityAt)) existing.lastActivityAt = activity;
    existing.hasErrors = existing.hasErrors || failed;
  }

  const threads: ConversationThread[] = [...byKey.values()].map(({ actorSet, ...thread }) => ({
    ...thread,
    actors: [...actorSet],
    turns: [...thread.turns].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()),
  }));

  return threads.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
}

export function useConversationThreads() {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['conversation-threads'],
    queryFn: async () => {
      const response = await client.listTraces({ pagination: { page: 0, perPage: 100 } });
      return groupTracesIntoThreads(response.spans);
    },
  });
}
