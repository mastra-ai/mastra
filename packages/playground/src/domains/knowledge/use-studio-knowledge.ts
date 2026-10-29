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

export function useKnowledgeScopes(knowledgeKey: string | undefined) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', knowledgeKey, 'scopes'],
    queryFn: knowledgeKey ? async () => client.getKnowledge(knowledgeKey).scopes() : skipToken,
  });
}

/** The graph of one scope, or of the whole instance when no scope is chosen. */
export function useKnowledgeGraph(knowledgeKey: string | undefined, scopeNodeId: string | undefined) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', knowledgeKey, 'graph', scopeNodeId ?? null],
    queryFn: knowledgeKey
      ? async (): Promise<KnowledgeGraphPayload> => client.getKnowledge(knowledgeKey).graph(scopeNodeId)
      : skipToken,
  });
}

/**
 * What the shared Knowledge explorer reads from Studio: one instance, read as the operator.
 * Built fresh on every render, so the closures never hold a stale instance or scope.
 */
export function useStudioKnowledgeDataSource(
  knowledgeKey: string | undefined,
  scopeNodeId: string | undefined,
): KnowledgeDataSource {
  const client = useMastraClient();
  return {
    useNode: nodeId =>
      useQuery({
        queryKey: ['knowledge', knowledgeKey, 'node', nodeId],
        queryFn: knowledgeKey
          ? async (): Promise<KnowledgeNodePayload> => client.getKnowledge(knowledgeKey).node(nodeId)
          : skipToken,
      }),
    useActivity: selection => {
      const activityScope = selection.scopeNodeId ?? scopeNodeId;
      return useInfiniteQuery({
        queryKey: ['knowledge', knowledgeKey, 'activity', activityScope ?? null],
        queryFn: knowledgeKey
          ? async ({ pageParam }): Promise<KnowledgeActivityPayload> =>
              client.getKnowledge(knowledgeKey).activity({ scopeNodeId: activityScope, cursor: pageParam })
          : skipToken,
        initialPageParam: undefined as string | undefined,
        getNextPageParam: page => page.nextCursor,
      });
    },
    useSearch: query => {
      const trimmed = query.trim();
      return useQuery({
        queryKey: ['knowledge', knowledgeKey, 'search', trimmed],
        queryFn:
          knowledgeKey && trimmed.length >= MIN_SEARCH_LENGTH
            ? async (): Promise<KnowledgeSearchPayload> => client.getKnowledge(knowledgeKey).search(trimmed)
            : skipToken,
      });
    },
  };
}
