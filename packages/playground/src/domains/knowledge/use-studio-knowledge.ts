import type { KnowledgeDataSource } from '@mastra/playground-ui/domains/knowledge/data-source';
import type {
  KnowledgeActivityPayload,
  KnowledgeGraphPayload,
  KnowledgeNodePayload,
  KnowledgeSearchPayload,
} from '@mastra/playground-ui/domains/knowledge/types';
import { useMastraClient } from '@mastra/react';
import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

const MIN_SEARCH_LENGTH = 2;

export function useKnowledgeInstances() {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', 'instances'],
    queryFn: async () => (await client.listKnowledge()).instances,
  });
}

/** The graph visible from `scope`; idle until an instance and at least one scope tag are chosen. */
export function useKnowledgeGraph(knowledgeKey: string | undefined, scope: string[]) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', knowledgeKey, 'graph', scope],
    queryFn:
      knowledgeKey && scope.length > 0
        ? async (): Promise<KnowledgeGraphPayload> => ({
            view: 'project',
            ...(await client.getKnowledge(knowledgeKey).graph(scope)),
          })
        : skipToken,
  });
}

/**
 * What the shared Knowledge explorer reads from Studio: one instance, viewed through the chosen scope tags.
 * Built fresh on every render, so the closure never holds a stale instance or scope.
 */
export function useStudioKnowledgeDataSource(knowledgeKey: string | undefined, scope: string[]): KnowledgeDataSource {
  const client = useMastraClient();
  const enabled = Boolean(knowledgeKey) && scope.length > 0;
  return {
    useNode: nodeId =>
      useQuery({
        queryKey: ['knowledge', knowledgeKey, 'node', nodeId, scope],
        queryFn: enabled
          ? async (): Promise<KnowledgeNodePayload> => client.getKnowledge(knowledgeKey!).node(nodeId, scope)
          : skipToken,
      }),
    useActivity: () =>
      useInfiniteQuery({
        queryKey: ['knowledge', knowledgeKey, 'activity', scope],
        queryFn: enabled
          ? async ({ pageParam }): Promise<KnowledgeActivityPayload> =>
              (await client
                .getKnowledge(knowledgeKey!)
                .activity(scope, { cursor: pageParam })) as KnowledgeActivityPayload
          : skipToken,
        initialPageParam: undefined as string | undefined,
        getNextPageParam: page => page.nextCursor,
      }),
    useSearch: query => {
      const trimmed = query.trim();
      return useQuery({
        queryKey: ['knowledge', knowledgeKey, 'search', scope, trimmed],
        queryFn:
          enabled && trimmed.length >= MIN_SEARCH_LENGTH
            ? async (): Promise<KnowledgeSearchPayload> =>
                (await client.getKnowledge(knowledgeKey!).search(trimmed, scope)) as KnowledgeSearchPayload
            : skipToken,
      });
    },
  };
}
