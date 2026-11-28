import type { ModelSelectionRequest } from '@internal/factory-contract';
import type { SessionModelTarget } from '@mastra/client-js';
import {
  factoryWebKeys,
  useSetSessionModelMutation as useSharedSetSessionModelMutation,
} from '@mastra/react/hooks/factory';
import { useMutationState, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { readModelSelection } from '@mastra/playground-ui/domains/factory/session/thread/chat/services/modelSelection';

export type { SessionModelResponse, SessionModelTarget } from '@mastra/client-js';

export function useSetSessionModelMutation(target: SessionModelTarget) {
  const queryClient = useQueryClient();
  return useSharedSetSessionModelMutation(target, {
    onSaved: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerConnectionState(AGENT_CONTROLLER_ID, target.sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerSettings(AGENT_CONTROLLER_ID, target.sessionId),
          exact: true,
        }),
      ]),
  });
}

export function usePendingSessionModel(sessionId: string): ModelSelectionRequest | undefined {
  return useMutationState({
    filters: { mutationKey: factoryWebKeys.sessionModel(sessionId), status: 'pending' },
    select: mutation => readModelSelection(mutation.state.variables),
  }).at(-1);
}
