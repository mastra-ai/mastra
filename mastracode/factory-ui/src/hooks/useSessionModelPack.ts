import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import type { ApiClient } from '../api/client';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';

export interface SessionModelPackRequest {
  resourceId: string;
  threadId: string;
  sessionId?: string;
  modelPackId: string;
}

export interface SessionModelPackResponse {
  ok: true;
  modelPackId: string;
  modelId: string;
  thinkingLevel: ThinkingLevelSetting;
}

const SESSION_MODEL_PACK_ERRORS: Record<string, string> = {
  model_pack_not_found: 'That model pack no longer exists. Reopen the model menu to see the current packs.',
  session_not_running: 'This session is not running yet. Try again once it has started.',
};

async function setSessionModelPack(client: ApiClient, request: SessionModelPackRequest) {
  try {
    return await client.put<SessionModelPackResponse>('/web/config/session-model-pack', request);
  } catch (cause) {
    const message = cause instanceof ApiError ? SESSION_MODEL_PACK_ERRORS[cause.message] : undefined;
    throw message ? new Error(message, { cause }) : cause;
  }
}

export interface SessionModelPackTarget {
  resourceId: string;
  threadId: string;
  sessionId: string;
}

export function useSetSessionModelPackMutation(target: SessionModelPackTarget) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (modelPackId: string) => setSessionModelPack(client, { ...target, modelPackId }),
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
  });
}
