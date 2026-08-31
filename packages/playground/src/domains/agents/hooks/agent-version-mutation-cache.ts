import { MastraClientError } from '@mastra/client-js';
import type { QueryClient } from '@tanstack/react-query';

import { getAgentVersionLabelError } from './agent-version-label-error';
import {
  agentVersionQueryKeys,
  invalidateAgentVersionState,
  markAgentVersionEntityMissing,
} from './agent-version-query-keys';

/** Refreshes pointer or authorization state after shared version-mutation failures. */
export const refreshAgentVersionMutationState = (queryClient: QueryClient, agentId: string, error: unknown): void => {
  const labelError = getAgentVersionLabelError(error);
  if (labelError?.code === 'ENTITY_NOT_FOUND') {
    void markAgentVersionEntityMissing(queryClient, agentId);
  }
  const hasStalePointerState =
    labelError?.code === 'LABEL_MOVE_CONFLICT' ||
    labelError?.code === 'VERSION_NOT_FOUND' ||
    labelError?.code === 'LABEL_NOT_FOUND';
  if (hasStalePointerState) {
    void invalidateAgentVersionState(queryClient, agentId);
  }
  if (error instanceof MastraClientError && error.status === 403) {
    void queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.authorization });
  }
};

/** Refreshes discovery after a failed custom-label read without touching pointer caches. */
export const refreshAgentVersionLabelReadState = (queryClient: QueryClient, error: unknown, agentId?: string): void => {
  const labelError = getAgentVersionLabelError(error);
  if (labelError?.code === 'ENTITY_NOT_FOUND' && agentId) {
    void markAgentVersionEntityMissing(queryClient, agentId);
  }
  if (labelError?.code === 'VERSION_LABELS_UNSUPPORTED') {
    void queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.capability });
  }
  if (error instanceof MastraClientError && error.status === 403) {
    void queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.authorization });
  }
};

/** Adds custom-label capability recovery without coupling activation to that capability. */
export const refreshAgentVersionLabelMutationState = (
  queryClient: QueryClient,
  agentId: string,
  error: unknown,
): void => {
  refreshAgentVersionMutationState(queryClient, agentId, error);
  refreshAgentVersionLabelReadState(queryClient, error);
};
