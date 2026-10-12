import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import {
  useSwitchAgentControllerModeMutation,
  useSwitchAgentControllerModelMutation,
} from '../../../../hooks/useAgentControllerStateMutations';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatTranscript } from '../context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';

interface PromptHandoff {
  handoffPrompt: string;
  handoffModeId?: string;
  handoffModelId?: string;
  handoffThinkingLevel?: ThinkingLevelSetting;
}

export function promptHandoffState(
  prompt: string,
  config: { modeId: string; modelId?: string; thinkingLevel?: ThinkingLevelSetting },
): PromptHandoff {
  return {
    handoffPrompt: prompt,
    handoffModeId: config.modeId,
    handoffModelId: config.modelId,
    handoffThinkingLevel: config.thinkingLevel,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readHandoffField(state: unknown, key: keyof PromptHandoff): string | undefined {
  if (!isRecord(state)) return undefined;
  const value = state[key];
  return typeof value === 'string' && value ? value : undefined;
}

const pendingHandoffKey = (resourceId: string) => `factory-pending-handoff:${resourceId}`;

function storePendingHandoff(resourceId: string, prompt: string): void {
  try {
    sessionStorage.setItem(pendingHandoffKey(resourceId), prompt);
  } catch {
    // Browser storage can be unavailable; the current tab can still send.
  }
}

function readPendingHandoff(resourceId: string): string | null {
  try {
    return sessionStorage.getItem(pendingHandoffKey(resourceId));
  } catch {
    return null;
  }
}

export function clearPendingHandoff(resourceId: string): void {
  try {
    sessionStorage.removeItem(pendingHandoffKey(resourceId));
  } catch {
    // Storage can be unavailable; the message is already sent.
  }
}

export function useHandoffPrompt(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const { localUser, clearPending, pushNotice } = useChatTranscript();
  const { prefillComposer } = useChatCommands();
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
  const recovered = useRef(false);
  const prompt = readHandoffField(location.state, 'handoffPrompt');
  const modeId = readHandoffField(location.state, 'handoffModeId');
  const modelId = readHandoffField(location.state, 'handoffModelId');
  const handoffThinkingLevel = readHandoffField(location.state, 'handoffThinkingLevel');
  const thinkingLevel = isThinkingLevelSetting(handoffThinkingLevel) ? handoffThinkingLevel : undefined;

  useEffect(() => {
    if (!sessionEnabled) return;
    if (handedOff.current) return;
    if (!prompt) {
      if (recovered.current) return;
      recovered.current = true;
      const interruptedPrompt = readPendingHandoff(resourceId);
      if (interruptedPrompt) {
        prefillComposer(interruptedPrompt);
        pushNotice('The previous message may not have been sent. Check the transcript before retrying.', 'error');
      }
      return;
    }
    handedOff.current = true;
    // Keep a recoverable draft before dropping history state. Never auto-resend
    // after an interruption: the server may already have accepted the message.
    storePendingHandoff(resourceId, prompt);
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
        await switchModel({ modelId, thinkingLevel }).catch((error: unknown) =>
          pushNotice(error instanceof Error ? error.message : `Could not start on ${modelId}.`, 'error'),
        );
      }
      await sendMessage(prompt);
      clearPendingHandoff(resourceId);
    })().catch(error => {
      prefillComposer(prompt);
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
    prefillComposer,
    prompt,
    pushNotice,
    resourceId,
    sendMessage,
    sessionEnabled,
    switchMode,
    switchModel,
    thinkingLevel,
  ]);
}
