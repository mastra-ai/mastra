import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';

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
import { ChatPermissionsProvider } from './ChatPermissionsProvider';
import { ChatSessionContext } from './ChatSessionContext';
import { ChatTranscriptProvider } from './ChatTranscriptProvider';
import { useChatSessionContext } from './useChatSessionContext';

export function ChatSessionProvider({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const { activeProject, resourceId: projectResourceId, sessionEnabled } = useActiveProjectContext();
  const { baseUrl } = useApiConfig();
  const [searchParams] = useSearchParams();

  // A `?resourceId=` query param overrides the active project's resource so the
  // whole chat session (transcript, messages, connection, thread switch) binds
  // to a thread that lives under a different resource — e.g. a Slack channel
  // session keyed `channel:slack:...`. Channel threads are not partitioned by
  // worktree, so drop `projectPath` when the override is present.
  const resourceOverride = searchParams.get('resourceId');
  const resourceId = resourceOverride ?? projectResourceId;
  const projectPath = resourceOverride ? undefined : deriveProjectPath(activeProject);
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
    <ChatTranscriptProvider key={threadId ?? 'draft'} threadId={threadId} initialMessages={messagesQuery.data}>
      <ChatModesProvider>
        <ChatModelsProvider>
          <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
        </ChatModelsProvider>
      </ChatModesProvider>
    </ChatTranscriptProvider>
  );
}
