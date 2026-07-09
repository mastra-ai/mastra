import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows } from '../../../ui';
// Deep imports (not the workspaces barrel): the barrel re-exports components
// that consume this chat context, so importing it here would create a cycle.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { useAgentControllerThreadMessages } from '../hooks/useAgentControllerThreadMessages';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatModesProvider } from './ChatModesProvider';
import { ChatSessionContext } from './ChatSessionContext';
import { ChatTranscriptProvider } from './ChatTranscriptProvider';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';

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
    <ChatTranscriptProvider threadId={threadId} initialMessages={messagesQuery.data}>
      <ChatModesProvider>
        <ChatModelsProvider>{children}</ChatModelsProvider>
      </ChatModesProvider>
    </ChatTranscriptProvider>
  );
}

export { useChatTranscript };
