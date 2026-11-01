import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useSwitchAgentControllerModelMutation } from '../../../../hooks/useAgentControllerStateMutations';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { useComposerImagesState } from '../context/useComposerImagesState';
import type { PendingImage } from '../context/ComposerImagesContext';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { peekHandoffFiles, takeHandoffFiles } from '../services/handoffFiles';

interface PromptHandoff {
  handoffPrompt: string;
  handoffModelId?: string;
  handoffThinkingLevel?: ThinkingLevelSetting;
}

interface HandoffModel {
  modelId?: string;
  thinkingLevel?: ThinkingLevelSetting;
}

// History keeps a thread's route state, so only the tab that opened it may send its first prompt, once.
const unsentHandoffs = new Map<string, HandoffModel>();

export function startPromptHandoff(sessionId: string, prompt: string, model: HandoffModel): PromptHandoff {
  unsentHandoffs.set(sessionId, model);
  storePendingHandoff(sessionId, prompt);
  return {
    handoffPrompt: prompt,
    handoffModelId: model.modelId,
    handoffThinkingLevel: model.thinkingLevel,
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

/** A thread opened with a first prompt to send: its session may still be being created. */
export function opensWithPrompt(state: unknown): boolean {
  return readHandoffPrompt(state) !== undefined;
}

function toOutgoing(files: PendingImage[]) {
  return files.map(f => ({ data: f.data, mediaType: f.mediaType, filename: f.filename }));
}

const pendingHandoffKey = (sessionId: string) => `factory-pending-handoff:${sessionId}`;

function storePendingHandoff(sessionId: string, prompt: string): void {
  try {
    sessionStorage.setItem(pendingHandoffKey(sessionId), prompt);
  } catch {
    // Browser storage can be unavailable; the current tab can still send.
  }
}

function readPendingHandoff(sessionId: string): string | null {
  try {
    return sessionStorage.getItem(pendingHandoffKey(sessionId));
  } catch {
    return null;
  }
}

export function clearPendingHandoff(sessionId: string): void {
  try {
    sessionStorage.removeItem(pendingHandoffKey(sessionId));
  } catch {
    // Storage can be unavailable; the message is already sent.
  }
}

export function useHandoffPrompt(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId, baseUrl, sessionEnabled } = useChatSessionContext();
  const { localUser, clearPending, pushNotice } = useChatTranscript();
  const { prefillComposer } = useChatCommands();
  const { setImages } = useComposerImagesState();
  const mutationArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const { mutateAsync: sendMessage } = useSendAgentControllerMessageMutation(mutationArgs);
  const { mutateAsync: switchModel } = useSwitchAgentControllerModelMutation(mutationArgs);
  const handedOff = useRef(false);
  const recovered = useRef(false);
  const shown = useRef(false);
  const prompt = readHandoffPrompt(location.state);
  const modelId = readHandoffField(location.state, 'handoffModelId');
  const handoffThinkingLevel = readHandoffField(location.state, 'handoffThinkingLevel');
  const thinkingLevel = isThinkingLevelSetting(handoffThinkingLevel) ? handoffThinkingLevel : undefined;

  useEffect(() => {
    if (handedOff.current) return;
    const startOn = async ({ modelId, thinkingLevel }: HandoffModel) => {
      if (!modelId) return;
      await switchModel({ modelId, thinkingLevel }).catch((error: unknown) =>
        pushNotice(error instanceof Error ? error.message : `Could not start on ${modelId}.`, 'error'),
      );
    };
    // The prompt shows as soon as the thread opens, while its session may still
    // be being created; it sends once the session exists.
    if (prompt !== undefined && !shown.current) {
      if (!unsentHandoffs.has(sessionId)) {
        void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
        return;
      }
      shown.current = true;
      const files = peekHandoffFiles(sessionId);
      if (prompt || files.length > 0) localUser(prompt, false, toOutgoing(files));
    }
    if (!sessionEnabled) return;
    if (prompt === undefined) {
      if (recovered.current) return;
      recovered.current = true;
      const leftModel = unsentHandoffs.get(sessionId);
      unsentHandoffs.delete(sessionId);
      const interruptedPrompt = readPendingHandoff(sessionId);
      const interruptedFiles = takeHandoffFiles(sessionId);
      if (interruptedPrompt || interruptedFiles.length > 0) {
        if (leftModel) void startOn(leftModel);
        if (interruptedPrompt) prefillComposer(interruptedPrompt);
        if (interruptedFiles.length > 0) setImages(current => [...interruptedFiles, ...current]);
        pushNotice('The previous message may not have been sent. Check the transcript before retrying.', 'error');
      }
      return;
    }
    handedOff.current = true;
    unsentHandoffs.delete(sessionId);
    const files = takeHandoffFiles(sessionId);
    // Never auto-resend after an interruption: the server may already have accepted the message.
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    if (!prompt && files.length === 0) return;
    const outgoing = toOutgoing(files);
    void (async () => {
      await startOn({ modelId, thinkingLevel });
      await sendMessage(outgoing.length ? { text: prompt, files: outgoing } : prompt);
      clearPendingHandoff(sessionId);
    })().catch(error => {
      prefillComposer(prompt);
      setImages(current => [...files, ...current]);
      clearPending();
      const reason = error instanceof Error ? error.message : 'The message could not be sent.';
      // A 4xx means the server refused the message. Anything else (network
      // failure, 5xx) can come after the server accepted it, so warn before a
      // retry posts it twice.
      pushNotice(
        isRejectedRequest(error)
          ? reason
          : `${reason} The message may have been sent. Check the transcript before retrying.`,
        'error',
      );
    });
  }, [
    clearPending,
    localUser,
    location.pathname,
    location.search,
    modelId,
    navigate,
    prefillComposer,
    prompt,
    pushNotice,
    sessionId,
    sendMessage,
    sessionEnabled,
    setImages,
    switchModel,
    thinkingLevel,
  ]);
}

function isRejectedRequest(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500;
}
