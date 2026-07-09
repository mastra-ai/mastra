import type { AgentControllerMessage } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows } from '../../../ui';
// Deep imports (not the workspaces barrel): the barrel re-exports components
// that consume this chat context, so importing it here would create a cycle.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { useAgentControllerConnection } from '../hooks/useAgentControllerConnection';
import { useAgentControllerThreadMessages } from '../hooks/useAgentControllerThreadMessages';
import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { TranscriptState } from '../services/transcript';
import { ChatConnectionContext } from './ChatConnectionContext';
import type { ChatConnectionApi } from './ChatConnectionContext';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatModesProvider } from './ChatModesProvider';
import { ChatSessionContext } from './ChatSessionContext';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import type { ChatTranscriptApi } from './ChatTranscriptContext';
import type { ChatModesApi } from './ChatModesContext';
import { useChatConnection } from './useChatConnection';
import { useChatModes } from './useChatModes';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';

export interface ChatSessionApi extends ChatConnectionApi, ChatTranscriptApi {
  modes: ChatModesApi['modes'];
}

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
    threadId: transcript.threadId ?? threadId ?? connection.createdThreadId,
    omProgress: transcript.omProgress ?? connection.state?.omProgress,
    usage: transcript.usage ?? connection.state?.tokenUsage,
  };

  const busy = effectiveTranscript.running || effectiveTranscript.pending;
  const lastEntry = effectiveTranscript.entries.at(-1);
  const showWorkingIndicator = busy && !(lastEntry?.kind === 'message' && lastEntry.streaming);

  const connectionValue: ChatConnectionApi = { status: connection.status, state: connection.state };
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
        <ChatModesProvider>
          <ChatModelsProvider>{children}</ChatModelsProvider>
        </ChatModesProvider>
      </ChatTranscriptContext.Provider>
    </ChatConnectionContext.Provider>
  );
}

export function useChatSession(): ChatSessionApi {
  const connection = useChatConnection();
  const transcript = useChatTranscript();
  const modes = useChatModes();
  if (!connection) throw new Error('useChatSession must be used within a ChatSessionProvider');
  return { ...connection, ...transcript, modes: modes.modes };
}

export { useChatConnection, useChatTranscript };
