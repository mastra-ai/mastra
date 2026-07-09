import type { AgentControllerMessage } from '@mastra/client-js';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
// Deep imports (not the workspaces barrel): the barrel re-exports components
// that consume this chat context, so importing it here would create a cycle.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import type { ConnectionStatus } from '../hooks/useAgentControllerConnection';
import {
  useSwitchAgentControllerModeMutation,
  useSwitchAgentControllerModelMutation,
} from '../hooks/useAgentControllerStateMutations';
import { useAgentControllerThreadMessages } from '../hooks/useAgentControllerThreadMessages';
import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { TranscriptState } from '../services/transcript';

export interface ChatConnectionApi {
  status: ConnectionStatus;
}

export interface ChatTranscriptApi {
  transcript: TranscriptState;
  messagesPending: boolean;
  messagesError: boolean;
  messagesErrorMessage?: string;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean) => void;
  resetCurrentThread: (threadId?: string) => void;
  syncState: (state: {
    modeId?: string;
    modelId?: string;
    omProgress?: TranscriptState['omProgress'];
    tokenUsage?: TranscriptState['usage'];
  }) => void;
  reset: (state?: Parameters<ReturnType<typeof useAgentControllerTranscript>['reset']>[0], threadId?: string) => void;
  resolvePrompt: (id: string) => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

export interface ChatModesApi {
  modes: ReturnType<typeof useAgentControllerConnection>['modes'];
  activeMode: ReturnType<typeof useAgentControllerConnection>['modes'][number] | undefined;
  activeModeId: string | undefined;
  setMode: (modeId: string) => Promise<void>;
}

export interface ChatModelsApi {
  activeModelId: string | undefined;
  setModel: (modelId: string) => Promise<void>;
}

export interface ChatSessionApi extends ChatConnectionApi, ChatTranscriptApi {
  modes: ChatModesApi['modes'];
}

const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);
const ChatModesContext = createContext<ChatModesApi | null>(null);
const ChatModelsContext = createContext<ChatModelsApi | null>(null);

export function ChatSessionProvider({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const projectPath = deriveProjectPath(activeProject);

  return (
    <ChatSessionBoundary
      key={`${resourceId}:${projectPath ?? ''}:${sessionEnabled ? 'enabled' : 'disabled'}:${threadId ?? ''}`}
      resourceId={resourceId}
      projectPath={projectPath}
      sessionEnabled={sessionEnabled}
      threadId={threadId}
    >
      {children}
    </ChatSessionBoundary>
  );
}

function ChatSessionBoundary({
  children,
  resourceId,
  projectPath,
  sessionEnabled,
  threadId,
}: {
  children: ReactNode;
  resourceId: string;
  projectPath?: string;
  sessionEnabled: boolean;
  threadId?: string;
}) {
  const { baseUrl } = useApiConfig();
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    threadId,
    baseUrl,
    enabled: sessionEnabled,
  });

  return (
    <ChatSessionBoundaryContent
      key={`${threadId ?? ''}:${messagesQuery.dataUpdatedAt}`}
      resourceId={resourceId}
      projectPath={projectPath}
      sessionEnabled={sessionEnabled}
      threadId={threadId}
      initialMessages={messagesQuery.data}
      messagesPending={Boolean(threadId) && messagesQuery.isPending}
      messagesError={Boolean(threadId) && messagesQuery.isError}
      messagesErrorMessage={messagesQuery.error instanceof Error ? messagesQuery.error.message : undefined}
    >
      {children}
    </ChatSessionBoundaryContent>
  );
}

function ChatSessionBoundaryContent({
  children,
  resourceId,
  projectPath,
  sessionEnabled,
  threadId,
  initialMessages,
  messagesPending,
  messagesError,
  messagesErrorMessage,
}: {
  children: ReactNode;
  resourceId: string;
  projectPath?: string;
  sessionEnabled: boolean;
  threadId?: string;
  initialMessages?: AgentControllerMessage[];
  messagesPending: boolean;
  messagesError: boolean;
  messagesErrorMessage?: string;
}) {
  const { baseUrl } = useApiConfig();

  const { transcript, reset, resetCurrentThread, syncState, onEvent, localUser, resolvePrompt, pushNotice } =
    useAgentControllerTranscript({ initialThreadId: threadId, initialMessages });

  const connection = useAgentControllerConnection({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
    onEvent,
  });
  const switchModeMutation = useSwitchAgentControllerModeMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const switchModelMutation = useSwitchAgentControllerModelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });

  const effectiveTranscript: TranscriptState = {
    ...transcript,
    modeId: transcript.modeId ?? connection.state?.modeId,
    modelId: transcript.modelId ?? connection.state?.modelId,
    threadId: transcript.threadId ?? threadId ?? connection.state?.threadId ?? connection.createdThreadId,
    omProgress: transcript.omProgress ?? connection.state?.omProgress,
    usage: transcript.usage ?? connection.state?.tokenUsage,
  };

  const busy = effectiveTranscript.running || effectiveTranscript.pending;
  const lastEntry = effectiveTranscript.entries[effectiveTranscript.entries.length - 1];
  const lastEntryHasText =
    lastEntry?.kind === 'message' &&
    lastEntry.message.role === 'assistant' &&
    lastEntry.message.content.parts.some(part => part.type === 'text' && part.text.trim().length > 0);
  const showWorkingIndicator =
    busy &&
    !(lastEntry?.kind === 'message' && lastEntry.message.role === 'assistant' && lastEntry.streaming && lastEntryHasText);

  const activeModeId = connection.state?.modeId ?? transcript.modeId;
  const connectionValue: ChatConnectionApi = { status: connection.status };
  const transcriptValue: ChatTranscriptApi = {
    transcript: effectiveTranscript,
    messagesPending,
    messagesError,
    messagesErrorMessage,
    busy,
    showWorkingIndicator,
    localUser,
    resetCurrentThread,
    syncState,
    reset,
    resolvePrompt,
    pushNotice,
  };
  const modesValue: ChatModesApi = {
    modes: connection.modes,
    activeModeId,
    activeMode: connection.modes.find(mode => mode.id === activeModeId),
    setMode: modeId => switchModeMutation.mutateAsync(modeId),
  };
  const modelsValue: ChatModelsApi = {
    activeModelId: connection.state?.modelId ?? transcript.modelId,
    setModel: modelId => switchModelMutation.mutateAsync(modelId),
  };

  return (
    <ChatConnectionContext.Provider value={connectionValue}>
      <ChatTranscriptContext.Provider value={transcriptValue}>
        <ChatModesContext.Provider value={modesValue}>
          <ChatModelsContext.Provider value={modelsValue}>{children}</ChatModelsContext.Provider>
        </ChatModesContext.Provider>
      </ChatTranscriptContext.Provider>
    </ChatConnectionContext.Provider>
  );
}

export function useChatConnection(): ChatConnectionApi {
  const ctx = useContext(ChatConnectionContext);
  if (!ctx) throw new Error('useChatConnection must be used within a ChatSessionProvider');
  return ctx;
}

export function useChatTranscript(): ChatTranscriptApi {
  const ctx = useContext(ChatTranscriptContext);
  if (!ctx) throw new Error('useChatTranscript must be used within a ChatSessionProvider');
  return ctx;
}

export function useChatModes(): ChatModesApi {
  const ctx = useContext(ChatModesContext);
  if (!ctx) throw new Error('useChatModes must be used within a ChatSessionProvider');
  return ctx;
}

export function useChatModels(): ChatModelsApi {
  const ctx = useContext(ChatModelsContext);
  if (!ctx) throw new Error('useChatModels must be used within a ChatSessionProvider');
  return ctx;
}

export function useChatSession(): ChatSessionApi {
  const connection = useContext(ChatConnectionContext);
  const transcript = useContext(ChatTranscriptContext);
  const modes = useContext(ChatModesContext);
  if (!connection || !transcript || !modes) throw new Error('useChatSession must be used within a ChatSessionProvider');
  return { ...connection, ...transcript, modes: modes.modes };
}
