import type { ModelSelectionRequest, ResolvedModelSelection } from '@mastra/factory/model-packs';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import type { ApiClient } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { readModelSelection } from '../ui/domains/chat/services/modelSelection';

export interface SessionModelTarget {
  resourceId: string;
  threadId: string;
  sessionId: string;
}

export interface SessionModelResponse {
  modelSelection: ResolvedModelSelection;
}

const SESSION_MODEL_ERRORS: Record<string, string> = {
  model_pack_not_found: 'That model pack no longer exists. Reopen the model menu to see the current packs.',
  session_not_running: 'This session is not running yet. Try again once it has started.',
};

async function setSessionModel(client: ApiClient, target: SessionModelTarget, selection: ModelSelectionRequest) {
  try {
    return await client.put<SessionModelResponse>('/web/config/session-model', { ...target, selection });
  } catch (cause) {
    const message = cause instanceof ApiError ? SESSION_MODEL_ERRORS[cause.message] : undefined;
    throw message ? new Error(message, { cause }) : cause;
  }
}

const sessionModelMutationKey = (sessionId: string) => ['session-model', sessionId] as const;

export function useSetSessionModelMutation(target: SessionModelTarget) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: sessionModelMutationKey(target.sessionId),
    mutationFn: (selection: ModelSelectionRequest) => setSessionModel(client, target, selection),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerConnectionState(AGENT_CONTROLLER_ID, target.sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSettings(AGENT_CONTROLLER_ID, target.sessionId),
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
      ]),
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() }),
  });
}

export function usePendingSessionModel(sessionId: string): ModelSelectionRequest | undefined {
  return useMutationState({
    filters: { mutationKey: sessionModelMutationKey(sessionId), status: 'pending' },
    select: mutation => readModelSelection(mutation.state.variables),
  }).at(-1);
}
