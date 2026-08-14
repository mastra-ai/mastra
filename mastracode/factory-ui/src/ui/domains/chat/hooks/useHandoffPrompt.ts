import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import {
  useSwitchAgentControllerModeMutation,
  useSwitchAgentControllerModelMutation,
} from '../../../../hooks/useAgentControllerStateMutations';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';

interface PromptHandoff {
  handoffPrompt: string;
  handoffModeId?: string;
  handoffModelId?: string;
}

export function promptHandoffState(prompt: string, config: { modeId: string; modelId: string }): PromptHandoff {
  return { handoffPrompt: prompt, handoffModeId: config.modeId, handoffModelId: config.modelId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readHandoffField(state: unknown, key: keyof PromptHandoff): string | undefined {
  if (!isRecord(state)) return undefined;
  const value = state[key];
  return typeof value === 'string' && value ? value : undefined;
}

export function useHandoffPrompt(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { localUser, clearPending, pushNotice } = useChatTranscript();
  const mutationArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const { mutateAsync: sendMessage } = useSendAgentControllerMessageMutation(mutationArgs);
  const { mutateAsync: switchMode } = useSwitchAgentControllerModeMutation(mutationArgs);
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation(mutationArgs);
  const handedOff = useRef(false);
  const prompt = readHandoffField(location.state, 'handoffPrompt');
  const modeId = readHandoffField(location.state, 'handoffModeId');
  const modelId = readHandoffField(location.state, 'handoffModelId');

  useEffect(() => {
    if (!prompt || !sessionEnabled || handedOff.current) return;
    handedOff.current = true;
    // history state outlives a reload; drop it before sending so the prompt cannot go twice
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    localUser(prompt);
    void (async () => {
      // mode first — switching it resets the model; a failed bind must not lose the prompt
      if (modeId) {
        await switchMode(modeId).catch((error: unknown) =>
          pushNotice(error instanceof Error ? error.message : `Could not start in ${modeId} mode.`, 'error'),
        );
      }
      if (modelId) {
        await switchModel(modelId).catch((error: unknown) =>
          pushNotice(error instanceof Error ? error.message : `Could not start on ${modelId}.`, 'error'),
        );
      }
      await sendMessage(prompt);
    })().catch(error => {
      clearPending();
      pushNotice(error instanceof Error ? error.message : 'The message could not be sent.', 'error');
    });
  }, [
    clearPending,
    localUser,
    location.pathname,
    location.search,
    modeId,
    modelId,
    navigate,
    prompt,
    pushNotice,
    sendMessage,
    sessionEnabled,
    switchMode,
    switchModel,
  ]);
}
