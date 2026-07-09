import type { AgentControllerMessage } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows } from '../../../ui';
// Deep imports (not the workspaces barrel): the barrel re-exports components
// that consume this chat context, so importing it here would create a cycle.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import type { ConnectionStatus } from '../hooks/useAgentControllerConnection';
import { useAgentControllerThreadMessages } from '../hooks/useAgentControllerThreadMessages';
import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { TranscriptState } from '../services/transcript';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatModesProvider } from './ChatModesProvider';
import { ChatSessionContext } from './ChatSessionContext';
import type { ChatModesApi } from './ChatModesContext';
import { useChatModes } from './useChatModes';
import { useChatSessionContext } from './useChatSessionContext';

export interface ChatConnectionApi {
  status: ConnectionStatus;
}

export interface ChatTranscriptApi {
  transcript: TranscriptState;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean) => void;
  syncState: (state: {
    modeId?: string;
    modelId?: string;
    omProgress?: TranscriptState['omProgress'];
    tokenUsage?: TranscriptState['usage'];
  }) => void;
  reset: (threadId?: string, state?: Parameters<ReturnType<typeof useAgentControllerTranscript>['reset']>[1]) => void;
  resolvePrompt: (id: string) => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

export interface ChatSessionApi extends ChatConnectionApi, ChatTranscriptApi {
  modes: ChatModesApi['modes'];
}

const ChatConnectionContext = createContext<ChatConnectionApi | null>(null);
const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);

export function ChatSessionProvider({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const { baseUrl } = useApiConfig();
  const projectPath = deriveProjectPath(activeProject);
  const sessionContextValue = { resourceId, sessionEnabled, projectPath, baseUrl };

  return (
    <ChatSessionContext.Provider value={sessionContextValue}>
      <ChatSessionBoundary threadId={threadId}>{children}</ChatSessionBoundary>
    </ChatSessionContext.Provider>
  );
}

function ChatSessionBoundary({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    threadId,
    baseUrl,
    enabled: sessionEnabled && Boolean(threadId),
  });

  if (threadId && messagesQuery.isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]">
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  if (threadId && messagesQuery.isError) {
    const errorMessage = messagesQuery.error instanceof Error ? messagesQuery.error.message : undefined;

    return (
      <div className="flex min-h-0 flex-1 flex-col place-items-center gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]">
        <Notice variant="destructive">
          {errorMessage ? `Failed to load messages: ${errorMessage}` : 'Failed to load messages.'}
        </Notice>
      </div>
    );
  }

  return (
    <ChatSessionBoundaryContent threadId={threadId} initialMessages={messagesQuery.data}>
      {children}
    </ChatSessionBoundaryContent>
  );
}

function ChatSessionBoundaryContent({
  children,
  threadId,
  initialMessages,
}: {
  children: ReactNode;
  threadId?: string;
  initialMessages?: AgentControllerMessage[];
}) {
  const { resourceId, projectPath, sessionEnabled, baseUrl } = useChatSessionContext();

  const { transcript, reset, syncState, onEvent, localUser, resolvePrompt, pushNotice } = useAgentControllerTranscript({
    initialThreadId: threadId,
    initialMessages,
  });

  const connection = useAgentControllerConnection({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
    onEvent,
  });
  const effectiveTranscript: TranscriptState = {
    ...transcript,
    modeId: transcript.modeId ?? connection.state?.modeId,
    modelId: transcript.modelId ?? connection.state?.modelId,
    threadId: transcript.threadId ?? threadId ?? connection.createdThreadId,
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
    !(
      lastEntry?.kind === 'message' &&
      lastEntry.message.role === 'assistant' &&
      lastEntry.streaming &&
      lastEntryHasText
    );

  const connectionValue: ChatConnectionApi = { status: connection.status };
  const transcriptValue: ChatTranscriptApi = {
    transcript: effectiveTranscript,
    busy,
    showWorkingIndicator,
    localUser,
    syncState,
    reset,
    resolvePrompt,
    pushNotice,
  };
  return (
    <ChatConnectionContext.Provider value={connectionValue}>
      <ChatTranscriptContext.Provider value={transcriptValue}>
        <ChatModesProvider
          agentControllerId={AGENT_CONTROLLER_ID}
          resourceId={resourceId}
          baseUrl={baseUrl}
          enabled={sessionEnabled}
          sessionModeId={connection.state?.modeId}
          transcriptModeId={transcript.modeId}
        >
          <ChatModelsProvider
            agentControllerId={AGENT_CONTROLLER_ID}
            resourceId={resourceId}
            baseUrl={baseUrl}
            enabled={sessionEnabled}
            sessionModelId={connection.state?.modelId}
            transcriptModelId={transcript.modelId}
          >
            {children}
          </ChatModelsProvider>
        </ChatModesProvider>
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

export function useChatSession(): ChatSessionApi {
  const connection = useContext(ChatConnectionContext);
  const transcript = useContext(ChatTranscriptContext);
  const modes = useChatModes();
  if (!connection || !transcript) throw new Error('useChatSession must be used within a ChatSessionProvider');
  return { ...connection, ...transcript, modes: modes.modes };
}
