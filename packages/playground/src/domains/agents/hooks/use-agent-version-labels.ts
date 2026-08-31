import type {
  AgentVersionLabel,
  DeleteAgentVersionLabelInput,
  DeleteAgentVersionLabelResponse,
  ListAgentVersionLabelsResponse,
  SetAgentVersionLabelInput,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  refreshAgentVersionLabelMutationState,
  refreshAgentVersionLabelReadState,
} from './agent-version-mutation-cache';
import { agentVersionQueryKeys, invalidateAgentVersionState } from './agent-version-query-keys';
import { usePlaygroundStore } from '@/store/playground-store';

const LABELS_PER_PAGE = 50;
const observedReadErrorsByClient = new WeakMap<QueryClient, WeakSet<Error>>();

type UseAgentVersionLabelsParams = {
  agentId?: string;
  enabled?: boolean;
};

export type SetAgentVersionLabelMutationInput = {
  label: string;
  input: SetAgentVersionLabelInput;
};

export type DeleteAgentVersionLabelMutationInput = {
  label: string;
  input: DeleteAgentVersionLabelInput;
};

const toCompleteLabelResponse = async (
  listPage: (page: number) => Promise<ListAgentVersionLabelsResponse>,
): Promise<ListAgentVersionLabelsResponse> => {
  const labels: AgentVersionLabel[] = [];
  const seenNames = new Set<string>();
  let page = 0;
  let perPage = LABELS_PER_PAGE;
  let hasMore = true;

  while (hasMore) {
    const response = await listPage(page);
    perPage = response.pagination.perPage;
    for (const label of response.labels) {
      if (seenNames.has(label.name)) continue;
      seenNames.add(label.name);
      labels.push(label);
    }
    hasMore = response.pagination.hasMore;
    page += 1;
  }

  return {
    labels,
    pagination: {
      total: labels.length,
      page: 0,
      perPage,
      hasMore: false,
    },
  };
};

const useAgentVersionLabelReadError = (agentId: string | undefined, error: Error | null): void => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!error) return;
    const observedErrors = observedReadErrorsByClient.get(queryClient) ?? new WeakSet<Error>();
    if (observedErrors.has(error)) return;
    observedErrors.add(error);
    observedReadErrorsByClient.set(queryClient, observedErrors);
    refreshAgentVersionLabelReadState(queryClient, error, agentId);
  }, [agentId, error, queryClient]);
};

/** Lists the complete custom and computed agent-label set across every server page. */
export const useAgentVersionLabels = ({ agentId, enabled = true }: UseAgentVersionLabelsParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  const query = useQuery<ListAgentVersionLabelsResponse>({
    queryKey: agentVersionQueryKeys.labels(agentId ?? '', requestContext),
    queryFn: agentId
      ? () =>
          toCompleteLabelResponse(page =>
            client.getStoredAgent(agentId).listVersionLabels({ page, perPage: LABELS_PER_PAGE }, requestContext),
          )
      : skipToken,
    enabled,
    retry: false,
    retryOnMount: false,
  });

  useAgentVersionLabelReadError(agentId, query.error);
  return query;
};

/** Creates or compare-and-swap moves a custom agent version label. */
export const useSetAgentVersionLabel = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<AgentVersionLabel, Error, SetAgentVersionLabelMutationInput>({
    mutationFn: ({ label, input }) => client.getStoredAgent(agentId).setVersionLabel(label, input, requestContext),
    onSuccess: () => invalidateAgentVersionState(queryClient, agentId),
    onError: error => refreshAgentVersionLabelMutationState(queryClient, agentId, error),
    retry: false,
  });
};

/** Deletes a custom label using the exact revision token last observed by Studio. */
export const useDeleteAgentVersionLabel = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<DeleteAgentVersionLabelResponse, Error, DeleteAgentVersionLabelMutationInput>({
    mutationFn: ({ label, input }) => client.getStoredAgent(agentId).deleteVersionLabel(label, input, requestContext),
    onSuccess: () => invalidateAgentVersionState(queryClient, agentId),
    onError: error => refreshAgentVersionLabelMutationState(queryClient, agentId, error),
    retry: false,
  });
};
