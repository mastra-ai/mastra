import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows } from '../../../ui';
// Deep imports (not the domain barrels): the barrels re-export components
// that consume this chat context, so importing them here would create cycles.
import { useWebAuth } from '../../auth/hooks/useWebAuth';
import { userSessionResourceId } from '../../auth/services/auth';
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../../workspaces/hooks/useWorkspaces';
import { findUserSessionByThreadId } from '../../workspaces/services/projects';
import { useAgentControllerThreadMessages } from '../hooks/useAgentControllerThreadMessages';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatModesProvider } from './ChatModesProvider';
import { ChatPermissionsProvider } from './ChatPermissionsProvider';
import { ChatSessionContext } from './ChatSessionContext';
import type { ChatSessionContextApi } from './ChatSessionContext';
import { ChatTranscriptProvider } from './ChatTranscriptProvider';
import { useChatSessionContext } from './useChatSessionContext';

export function ChatSessionProvider({
  children,
  threadId,
  userScoped = false,
}: {
  children: ReactNode;
  threadId?: string;
  /** True for /user/threads/* routes: bind to the user's personal session. */
  userScoped?: boolean;
}) {
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const auth = useWebAuth();
  const { baseUrl } = useApiConfig();
  let sessionContextValue: ChatSessionContextApi;
  if (userScoped) {
    // Personal session: resourceId is the logged-in user, scope is the
    // user-session worktree that owns the route's thread.
    const userSession = threadId ? findUserSessionByThreadId(threadId) : undefined;
    sessionContextValue = {
      resourceId: userSessionResourceId(auth.data),
      sessionEnabled: !auth.isPending && Boolean(userSession),
      projectPath: userSession?.worktree.worktreePath,
      baseUrl,
      kind: 'user',
      threadBasePath: '/user/threads',
    };
  } else {
    const projectPath = deriveProjectPath(activeProject);
    const isGithubProject = activeProject?.source === 'github';
    sessionContextValue = {
      resourceId,
      // GitHub projects have no repo-root session anymore — without a factory
      // worktree there is nothing to bind a session to.
      sessionEnabled: sessionEnabled && (!isGithubProject || Boolean(projectPath)),
      projectPath,
      projectState: isGithubProject ? { githubProjectId: activeProject.githubProjectId } : undefined,
      baseUrl,
      kind: isGithubProject ? 'factory' : 'user',
      threadBasePath: '/threads',
    };
  }

  return (
    <ChatSessionContext.Provider value={sessionContextValue}>
      <ChatSessionBoundary threadId={threadId}>{children}</ChatSessionBoundary>
    </ChatSessionContext.Provider>
  );
}

function ChatSessionBoundary({ children, threadId }: { children: ReactNode; threadId?: string }) {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
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
