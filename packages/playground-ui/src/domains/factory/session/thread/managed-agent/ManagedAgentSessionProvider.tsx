import type { ModelSelectionRequest } from '@internal/factory-contract';
import { useChat, useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ChatCommandsProvider } from '../chat/context/ChatCommandsProvider';
import { ChatConnectionContext } from '../chat/context/ChatConnectionContext';
import type { ChatConnectionApi } from '../chat/context/ChatConnectionContext';
import { ChatModelsContext } from '../chat/context/ChatModelsContext';

import type { ChatModelsApi } from '../chat/context/ChatModelsContext';
import { ChatRuntimeContext } from '../chat/context/ChatRuntimeContext';
import type { ChatRuntimeApi } from '../chat/context/ChatRuntimeContext';
import { ChatSessionActionsContext } from '../chat/context/ChatSessionActionsContext';
import type { ChatSessionActionsApi, OutgoingMessage } from '../chat/context/ChatSessionActionsContext';
import { ChatSessionContext } from '../chat/context/ChatSessionContext';
import type { ChatSessionContextApi } from '../chat/context/ChatSessionContext';
import { ChatThreadMessagesContext } from '../chat/context/ChatThreadMessagesContext';
import { ChatTranscriptContext } from '../chat/context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../chat/context/ChatTranscriptContext';
import { ComposerImagesContext } from '../chat/context/ComposerImagesContext';
import { initialChatRuntime } from '../chat/services/runtime';
import { chatSessionPhase } from '../chat/services/sessionStatus';
import { managedAgentTranscript } from './managedAgentTranscript';
import type { PendingImage } from '@/domains/chat/transcript';
import { createLocalMessageId } from '@/domains/chat/transcript/services/transcript';
import type { NoticeEntry } from '@/domains/chat/transcript/services/transcript';
import { ChatAnnotationsProvider } from '@/ds/components/ai/annotations';

const NO_SELECTION: ModelSelectionRequest = { kind: 'default' };

const RUNTIME: ChatRuntimeApi = {
  followUpCount: initialChatRuntime.followUpCount,
  runsStarted: initialChatRuntime.runsStarted,
  omPhase: initialChatRuntime.omPhase,
  bufferingMessages: false,
  bufferingObservations: false,
  tokensPerSec: 0,
};

const managedAgentThreadsKey = (agentId: string, resourceId: string) =>
  ['managed-agent-session', agentId, resourceId, 'threads'] as const;

/**
 * Fills the session view's contexts from a managed agent's memory thread instead of an
 * Agent Controller session. The thread id is the session id. Goal, thinking, model
 * switching and permissions have no managed-agent path yet, so they are left out and the
 * view hides them.
 */
export function ManagedAgentSessionProvider({
  agentId,
  resourceId,
  threadId,
  baseUrl,
  activeModelId,
  children,
}: {
  agentId: string;
  resourceId: string;
  /** The routed thread; absent on a new-session draft until the first message creates one. */
  threadId?: string;
  baseUrl: string;
  activeModelId?: string;
  children: ReactNode;
}) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const chat = useChat({ agentId, resourceId, threadId, enableThreadSignals: true, withInitialHistory: true });
  const [notices, setNotices] = useState<NoticeEntry[]>([]);
  const [resolvedPrompts, setResolvedPrompts] = useState<ReadonlySet<string>>(() => new Set());
  const [images, setImages] = useState<PendingImage[]>([]);
  const historyLoading = Boolean(threadId) && chat.initialHistoryPagination === undefined && chat.messages.length === 0;

  const threadsKey = managedAgentThreadsKey(agentId, resourceId);
  const threadsQuery = useQuery({
    queryKey: threadsKey,
    queryFn: () => client.listMemoryThreads({ agentId, resourceId }),
  });

  const sendMutation = useMutation({
    mutationFn: async (message: OutgoingMessage | string) => {
      const outgoing = typeof message === 'string' ? { text: message } : message;
      await chat.sendMessage({
        message: outgoing.text,
        threadId,
        coreUserMessages: outgoing.files?.length
          ? [
              {
                role: 'user',
                content: outgoing.files.map(file => ({
                  type: 'file' as const,
                  data: file.data,
                  mimeType: file.mediaType,
                })),
              },
            ]
          : undefined,
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ toolCallId, approved, resumeData }: ReplyInput) => {
      if (chat.activeRunId || !threadId) {
        if (approved) await chat.approveToolCall(toolCallId, resumeData);
        else await chat.declineToolCall(toolCallId);
        return;
      }
      // A thread opened after its run paused has no live stream; the reply goes to the thread and the
      // resumed run's output arrives on the thread subscription.
      await client.getAgent(agentId).sendToolApproval({
        resourceId,
        threadId,
        toolCallId,
        approved,
        ...(resumeData !== undefined ? { resumeData } : {}),
      });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const thread = await client.createMemoryThread({ agentId, resourceId });
      return { id: thread.id };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: threadsKey }),
  });

  const resolvePrompt = useCallback((id: string) => setResolvedPrompts(prev => new Set(prev).add(id)), []);
  const pushNotice = useCallback(
    (text: string, level: 'info' | 'error' = 'info') =>
      setNotices(prev => [...prev, { kind: 'notice', id: createLocalMessageId(), level, text }]),
    [],
  );

  const running = chat.isRunning;
  const session = useMemo<ChatSessionContextApi>(
    () => ({
      sessionId: threadId ?? '',
      resourceId,
      sessionEnabled: true,
      sandboxReady: true,
      resourceReady: true,
      sandboxPreparing: false,
      resourceEnabled: Boolean(threadId),
      sessionThreadId: threadId,
      baseUrl,
      kind: 'user',
    }),
    [threadId, resourceId, baseUrl],
  );

  const connection = useMemo<ChatConnectionApi>(() => ({ status: 'ready', threadId }), [threadId]);

  const transcript = useMemo<ChatTranscriptApi>(() => {
    const state = managedAgentTranscript({ messages: chat.messages, threadId, running, notices, resolvedPrompts });
    return {
      transcript: state,
      busy: running || chat.isAwaitingToolApproval,
      phase: chatSessionPhase({
        sessionError: false,
        threadError: false,
        hasThread: Boolean(threadId),
        running,
        initializing: historyLoading,
        pending: state.pending,
      }),
      initializing: historyLoading,
      loadingHistory: historyLoading,
      initialHistoryReady: !historyLoading,
      // useChat shows the user's message itself, so the local echo is a no-op.
      localUser: () => createLocalMessageId(),
      failLocalUser: () => {},
      reset: () => {
        setNotices([]);
        setResolvedPrompts(new Set());
      },
      resolvePrompt,
      clearPending: () => {},
      pushNotice,
      loadMore: { hasMore: false, isLoading: false },
    };
  }, [
    chat.messages,
    chat.isAwaitingToolApproval,
    threadId,
    running,
    notices,
    resolvedPrompts,
    historyLoading,
    resolvePrompt,
    pushNotice,
  ]);

  const models = useMemo<ChatModelsApi>(
    () => ({
      activeModelId,
      modelPacks: [],
      defaultModelPack: undefined,
      selectedPack: undefined,
      selection: NO_SELECTION,
      selectedThinkingLevel: undefined,
      switching: false,
      isLoading: false,
      error: undefined,
    }),
    [activeModelId],
  );

  const threadList = threadsQuery.data?.threads;
  const actions: ChatSessionActionsApi = {
    send: sendMutation.mutateAsync,
    sending: sendMutation.isPending,
    abort: async () => chat.cancelRun(),
    approveTool: (toolCallId, approved) => replyMutation.mutateAsync({ toolCallId, approved }),
    respondToSuspension: (toolCallId, resumeData) =>
      replyMutation.mutateAsync({ toolCallId, approved: true, resumeData }),
    replying: replyMutation.isPending,
    createThread: createThreadMutation.mutateAsync,
    switchingThread: false,
    followUp: threadId
      ? text => client.getAgent(agentId).queueMessage({ message: text, resourceId, threadId })
      : undefined,
    threads: {
      list: threadList?.map(thread => ({ id: thread.id, title: thread.title ?? undefined })),
    },
  };

  const messages = { threadId, isPending: historyLoading, error: undefined };

  return (
    <ChatSessionContext.Provider value={session}>
      <ChatConnectionContext.Provider value={connection}>
        <ChatRuntimeContext.Provider value={RUNTIME}>
          <ChatThreadMessagesContext.Provider value={messages}>
            <ChatSessionActionsContext.Provider value={actions}>
              <ChatTranscriptContext.Provider value={transcript}>
                <ChatModelsContext.Provider value={models}>
                  <ChatCommandsProvider>
                    <ComposerImagesContext.Provider value={{ images, setImages }}>
                      <ChatAnnotationsProvider>{children}</ChatAnnotationsProvider>
                    </ComposerImagesContext.Provider>
                  </ChatCommandsProvider>
                </ChatModelsContext.Provider>
              </ChatTranscriptContext.Provider>
            </ChatSessionActionsContext.Provider>
          </ChatThreadMessagesContext.Provider>
        </ChatRuntimeContext.Provider>
      </ChatConnectionContext.Provider>
    </ChatSessionContext.Provider>
  );
}

type ResumeData = Parameters<ChatSessionActionsApi['respondToSuspension']>[1];

interface ReplyInput {
  toolCallId: string;
  approved: boolean;
  resumeData?: ResumeData;
}
