import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { RequestContext } from '@mastra/core/di';
import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { ChatSendArgs } from './chat-context';
import { injectBufferingEnds } from '@/services/om-parts-converter';
import {
  buildMaxStepsStreamErrorMessage,
  buildStreamErrorMessage,
  isMaxStepsFinishChunk,
} from '@/services/stream-error-message';

/**
 * The OM/error stream chunks this hook reacts to are not part of the typed
 * `useChat` chunk union, so we narrow them at the stream boundary.
 */
type OmStreamChunk =
  | { type: 'data-om-observation-start'; data?: { operationType?: string } }
  | { type: 'data-om-observation-end'; data?: { operationType?: string } }
  | { type: 'data-om-observation-failed'; data?: { operationType?: string } }
  | {
      type: 'data-om-status';
      data?: {
        windows?: unknown;
        recordId?: string;
        threadId?: string;
        stepNumber?: number;
        generationCount?: number;
      };
    }
  | { type: 'data-om-activation'; data?: { operationType?: string; cycleId?: string } };

type ErrorStreamChunk = { type: 'error'; runId?: string; payload?: { error?: unknown } };
type HandledStreamChunk = OmStreamChunk | ErrorStreamChunk;

const asHandledStreamChunk = (chunk: unknown): HandledStreamChunk | undefined => {
  const type = (chunk as { type?: unknown }).type;
  if (
    type === 'error' ||
    type === 'data-om-observation-start' ||
    type === 'data-om-observation-end' ||
    type === 'data-om-observation-failed' ||
    type === 'data-om-status' ||
    type === 'data-om-activation'
  ) {
    return chunk as HandledStreamChunk;
  }
  return undefined;
};

interface SendDeps {
  requestContext?: Record<string, unknown>;
  agentVersionId?: string;
  threadId?: string;
  modelSettingsArgs: Record<string, unknown>;
  chatWithNetwork?: boolean;
  chatWithGenerate?: boolean;
  maxSteps?: number;
  isOMEnabled: boolean;
  tracingOptions?: unknown;
}

interface UseChatSendHandlerArgs {
  agentId: string;
  requestContext?: Record<string, unknown>;
  agentVersionId?: string;
  threadId?: string;
  modelSettingsArgs: Record<string, unknown>;
  chatWithNetwork?: boolean;
  chatWithGenerate?: boolean;
  maxSteps?: number;
  isOMEnabled: boolean;
  tracingOptions?: unknown;
  threadSignalsUnsupportedRef: { current: boolean };
  isRunningStream: boolean;
  sendMessage: (args: any) => Promise<void>;
  cancelRun?: () => void;
  setMessages: Dispatch<SetStateAction<MastraDBMessage[]>>;
  setStreamErrors: Dispatch<SetStateAction<MastraDBMessage[]>>;
  refreshThreadList?: () => void | Promise<void>;
  refreshWorkingMemory?: () => void | Promise<unknown>;
  handleObservationStart: (operationType?: string) => void;
  handleProgressUpdate: (data: any) => void;
  refreshObservationalMemory: (operationType?: string) => void;
  handleActivation: (data: any) => void;
  resetObservationalMemoryStreamState: () => void;
}

const buildRequestContext = (deps: SendDeps) => {
  const requestContextInstance = new RequestContext();
  Object.entries(deps.requestContext ?? {}).forEach(([key, value]) => {
    requestContextInstance.set(key, value);
  });
  if (deps.agentVersionId) {
    requestContextInstance.set('agentVersionId', deps.agentVersionId);
  }
  return requestContextInstance;
};

const didUpdateWorkingMemory = (chunk: any) =>
  (chunk.type === 'tool-result' || chunk.type === 'tool-execution-end') &&
  chunk.payload?.toolName === 'updateWorkingMemory' &&
  typeof chunk.payload.result === 'object' &&
  'success' in chunk.payload.result! &&
  chunk.payload.result?.success;

export const useChatSendHandler = ({
  agentId,
  requestContext,
  agentVersionId,
  threadId,
  modelSettingsArgs,
  chatWithNetwork,
  chatWithGenerate,
  maxSteps,
  isOMEnabled,
  tracingOptions,
  threadSignalsUnsupportedRef,
  isRunningStream,
  sendMessage,
  cancelRun,
  setMessages,
  setStreamErrors,
  refreshThreadList,
  refreshWorkingMemory,
  handleObservationStart,
  handleProgressUpdate,
  refreshObservationalMemory,
  handleActivation,
  resetObservationalMemoryStreamState,
}: UseChatSendHandlerArgs) => {
  const baseClient = useMastraClient();
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendDepsRef = useRef<SendDeps>({
    requestContext,
    agentVersionId,
    threadId,
    modelSettingsArgs,
    chatWithNetwork,
    chatWithGenerate,
    maxSteps,
    isOMEnabled,
    tracingOptions,
  });
  sendDepsRef.current = {
    requestContext,
    agentVersionId,
    threadId,
    modelSettingsArgs,
    chatWithNetwork,
    chatWithGenerate,
    maxSteps,
    isOMEnabled,
    tracingOptions,
  };

  const completeObservationalMemoryBuffering = useCallback(
    (currentThreadId?: string) => {
      if (!currentThreadId || !sendDepsRef.current.isOMEnabled) return;
      baseClient
        .awaitBufferStatus({ agentId, resourceId: agentId, threadId: currentThreadId })
        .then(result => {
          setMessages(prev => injectBufferingEnds(prev, result?.record));
          void queryClient.invalidateQueries({ queryKey: ['observational-memory', agentId] });
          void queryClient.invalidateQueries({ queryKey: ['memory-status', agentId] });
        })
        .catch(() => {});
    },
    [agentId, baseClient, queryClient, setMessages],
  );

  const handleHandledChunk = useCallback(
    (handled: HandledStreamChunk | undefined) => {
      if (handled?.type === 'error') {
        setStreamErrors(prev => [...prev, buildStreamErrorMessage(handled)]);
      }
      if (handled?.type === 'data-om-observation-start') {
        handleObservationStart(handled.data?.operationType);
      }
      if (handled?.type === 'data-om-status') {
        handleProgressUpdate(handled.data);
      }
      if (
        handled?.type === 'data-om-observation-end' ||
        handled?.type === 'data-om-observation-failed' ||
        handled?.type === 'data-om-activation'
      ) {
        refreshObservationalMemory(handled.data?.operationType);
      }
      if (handled?.type === 'data-om-activation') {
        handleActivation(handled.data);
      }
    },
    [handleActivation, handleObservationStart, handleProgressUpdate, refreshObservationalMemory, setStreamErrors],
  );

  const send = useCallback(
    async ({ message, attachments = [] }: ChatSendArgs) => {
      const deps = sendDepsRef.current;
      if (threadSignalsUnsupportedRef.current && (isRunningStream || abortControllerRef.current)) return;

      setStreamErrors([]);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestContextInstance = buildRequestContext(deps);

      try {
        if (deps.chatWithNetwork) {
          await sendMessage({
            message,
            mode: 'network',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId: deps.threadId,
            modelSettings: deps.modelSettingsArgs,
            signal: controller.signal,
            tracingOptions: deps.tracingOptions,
            onNetworkChunk: async (chunk: any) => {
              if (didUpdateWorkingMemory(chunk)) {
                void refreshWorkingMemory?.();
              }
              if (chunk.type === 'network-execution-event-step-finish') {
                void refreshThreadList?.();
              }
              handleHandledChunk(asHandledStreamChunk(chunk));
            },
          });
        } else if (deps.chatWithGenerate) {
          await sendMessage({
            message,
            mode: 'generate',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId: deps.threadId,
            modelSettings: deps.modelSettingsArgs,
            signal: controller.signal,
            tracingOptions: deps.tracingOptions,
          });
          await refreshThreadList?.();
          return;
        } else {
          await sendMessage({
            message,
            mode: 'stream',
            coreUserMessages: attachments,
            requestContext: requestContextInstance,
            threadId: deps.threadId,
            modelSettings: deps.modelSettingsArgs,
            tracingOptions: deps.tracingOptions,
            onChunk: async (chunk: any) => {
              if (chunk.type === 'finish') {
                if (isMaxStepsFinishChunk(chunk)) {
                  setStreamErrors(prev => [...prev, buildMaxStepsStreamErrorMessage(chunk, deps.maxSteps)]);
                }
                await refreshThreadList?.();
              }
              if (didUpdateWorkingMemory(chunk)) {
                void refreshWorkingMemory?.();
              }
              handleHandledChunk(asHandledStreamChunk(chunk));
            },
            signal: controller.signal,
          });

          completeObservationalMemoryBuffering(deps.threadId);
          return;
        }

        setTimeout(() => {
          void refreshThreadList?.();
        }, 500);
        completeObservationalMemoryBuffering(deps.threadId);
      } catch (error: any) {
        console.error('Error occurred in ChatProvider', error);
        if (error.name === 'AbortError') {
          return;
        }
        setStreamErrors(prev => [...prev, buildStreamErrorMessage({ runId: 'thrown', payload: { error } })]);
        resetObservationalMemoryStreamState();
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      completeObservationalMemoryBuffering,
      handleHandledChunk,
      isRunningStream,
      refreshThreadList,
      refreshWorkingMemory,
      resetObservationalMemoryStreamState,
      sendMessage,
      setStreamErrors,
      threadSignalsUnsupportedRef,
    ],
  );

  const cancel = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resetObservationalMemoryStreamState();
    cancelRun?.();
    completeObservationalMemoryBuffering(sendDepsRef.current.threadId);
  }, [cancelRun, completeObservationalMemoryBuffering, resetObservationalMemoryStreamState]);

  return { send, cancel };
};
