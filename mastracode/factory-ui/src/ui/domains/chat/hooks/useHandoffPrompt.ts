import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { useComposerImagesState } from '../context/useComposerImagesState';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { takeHandoffFiles } from '../services/handoffFiles';
import type { OutgoingFile } from '../services/transcript';

interface PromptHandoff {
  handoffPrompt: string;
  handoffModelId?: string;
  handoffThinkingLevel?: ThinkingLevelSetting;
}

export function promptHandoffState(
  prompt: string,
  config: { modelId?: string; thinkingLevel?: ThinkingLevelSetting },
): PromptHandoff {
  return {
    handoffPrompt: prompt,
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

// An image-only first prompt hands off an empty string, so only a missing field means "no handoff".
function readHandoffPrompt(state: unknown): string | undefined {
  if (!isRecord(state)) return undefined;
  const value = state.handoffPrompt;
  return typeof value === 'string' ? value : undefined;
}

const pendingHandoffKey = (resourceId: string) => `factory-pending-handoff:${resourceId}`;

interface QueuedHandoff {
  prompt: string;
  files: ReturnType<typeof takeHandoffFiles>;
  outgoing: OutgoingFile[];
  modelId?: string;
  thinkingLevel?: ThinkingLevelSetting;
}

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
  const { resourceId, projectPath, baseUrl, sessionEnabled, sessionThreadId } = useChatSessionContext();
  const { threadId: boundThreadId, status: connectionStatus } = useChatConnection();
  const sessionBound = !sessionThreadId || boundThreadId === sessionThreadId;
  const { localUser, clearPending, pushNotice } = useChatTranscript();
  const { prefillComposer } = useChatCommands();
  const { setImages } = useComposerImagesState();
  const mutationArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const { mutateAsync: sendMessage } = useSendAgentControllerMessageMutation(mutationArgs);
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation(mutationArgs);
  const handedOff = useRef(false);
  const recovered = useRef(false);
  const queued = useRef<QueuedHandoff | null>(null);
  const prompt = readHandoffPrompt(location.state);
  const modelId = readHandoffField(location.state, 'handoffModelId');
  const handoffThinkingLevel = readHandoffField(location.state, 'handoffThinkingLevel');
  const thinkingLevel = isThinkingLevelSetting(handoffThinkingLevel) ? handoffThinkingLevel : undefined;

  useEffect(() => {
    if (!sessionEnabled) return;
    if (handedOff.current) return;
    if (prompt === undefined) {
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
    const files = takeHandoffFiles(resourceId);
    // Keep a recoverable draft before dropping history state. Never auto-resend
    // after an interruption: the server may already have accepted the message.
    storePendingHandoff(resourceId, prompt);
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    if (!prompt && files.length === 0) return;
    const outgoing = files.map(f => ({ data: f.data, mediaType: f.mediaType, filename: f.filename }));
    localUser(prompt, false, outgoing);
    queued.current = { prompt, files, outgoing, modelId, thinkingLevel };
  }, [
    localUser,
    location.pathname,
    location.search,
    modelId,
    navigate,
    prefillComposer,
    prompt,
    pushNotice,
    resourceId,
    sessionEnabled,
    thinkingLevel,
  ]);

  // The send and model routes resolve the session without a thread id. Sending
  // before session init binds the session thread would persist the prompt to a
  // random-id thread this page never reads, so the network calls wait for it.
  // No deps: it must also run in the same commit the first effect queues in.
  useEffect(() => {
    const handoff = queued.current;
    if (!handoff) return;
    const { prompt, files, outgoing, modelId, thinkingLevel } = handoff;
    const restore = (message: string) => {
      prefillComposer(prompt);
      setImages(current => [...files, ...current]);
      clearPending();
      pushNotice(message, 'error');
    };
    if (!sessionBound) {
      // Session init does not retry, so a failed init will never bind. The
      // prompt was never posted: hand it back instead of leaving it pending.
      // Keep the stored copy so the reload this failure asks for restores it.
      if (connectionStatus !== 'error') return;
      queued.current = null;
      restore('The session could not start, so the message was not sent.');
      return;
    }
    queued.current = null;
    void (async () => {
      if (modelId) {
        await switchModel({ modelId, thinkingLevel }).catch((error: unknown) =>
          pushNotice(error instanceof Error ? error.message : `Could not start on ${modelId}.`, 'error'),
        );
      }
      await sendMessage(outgoing.length ? { text: prompt, files: outgoing } : prompt);
      clearPendingHandoff(resourceId);
    })().catch(error => {
      const reason = error instanceof Error ? error.message : 'The message could not be sent.';
      // A 4xx means the server refused the message. Anything else (network
      // failure, 5xx) can come after the server accepted it, so warn before a
      // retry posts it twice.
      restore(
        isRejectedRequest(error)
          ? reason
          : `${reason} The message may have been sent. Check the transcript before retrying.`,
      );
    });
  });
}

function isRejectedRequest(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500;
}
