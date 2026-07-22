import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useWebAuth } from '../../../../../shared/hooks/useWebAuth';
import { SkeletonRows } from '../../../ui';
import { userSessionResourceId } from '../../auth/services/auth';
import { useActiveFactoryContext } from '../../workspaces/context/ActiveFactoryProvider';
import { findUserSessionByThreadId, isServerFactory, selectedRepository } from '../../workspaces/services/factories';
import { deriveProjectPath } from '../../../../../shared/hooks/useWorkspaces';
import { useAgentControllerThreadMessages } from '../../../../../shared/hooks/useAgentControllerThreadMessages';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatCommandsProvider } from './ChatCommandsProvider';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatModesProvider } from './ChatModesProvider';
import { ChatPermissionsProvider } from './ChatPermissionsProvider';
import { ChatSessionContext } from './ChatSessionContext';
import { ChatTranscriptProvider } from './ChatTranscriptProvider';
import { useChatSessionContext } from './useChatSessionContext';

interface ChatThreadMessagesApi {
  threadId?: string;
  isPending: boolean;
  error: unknown;
}

const ChatThreadMessagesContext = createContext<ChatThreadMessagesApi | null>(null);

/** Stable project/API configuration for chat shell consumers such as the sidebar. */
export function ChatSessionConfigProvider({
  children,
  threadId,
  userScoped = false,
}: {
  children: ReactNode;
  threadId?: string;
  userScoped?: boolean;
}) {
  const { activeFactory, resourceId, sessionEnabled } = useActiveFactoryContext();
  const auth = useWebAuth();
  const { baseUrl } = useApiConfig();
  const projectPath = deriveProjectPath(activeFactory);
  const userSession = userScoped && threadId ? findUserSessionByThreadId(threadId) : undefined;
  const serverFactory = activeFactory && isServerFactory(activeFactory) ? activeFactory : undefined;
  const repository = serverFactory ? selectedRepository(serverFactory) : undefined;
  // A repo-less server factory still chats against the factory resource, so
  // only repo-backed sessions wait on a worktree path.
  const projectSessionEnabled = sessionEnabled && (!repository || Boolean(projectPath));
  const value = userScoped
    ? {
        resourceId: userSessionResourceId(auth.data),
        sessionEnabled: !auth.isPending && Boolean(userSession),
        projectPath: userSession?.worktree.worktreePath,
        baseUrl,
        kind: 'user' as const,
        threadBasePath: '/user/threads' as const,
      }
    : {
        resourceId,
        sessionEnabled: projectSessionEnabled,
        projectPath,
        factorySessionState:
          serverFactory && repository
            ? {
                factoryProjectId: serverFactory.binding.factoryProjectId,
                projectRepositoryId: repository.projectRepositoryId,
                sandboxId: repository.sandboxId,
                sandboxWorkdir: repository.sandboxWorkdir,
              }
            : undefined,
        baseUrl,
        kind: serverFactory ? ('factory' as const) : ('user' as const),
        threadBasePath: '/threads' as const,
      };

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

/**
 * Route-thread state and transport. This boundary deliberately remains below
 * the persistent shell so only chat content responds to history loading.
 */
export function ChatSessionBoundary({
  children,
  threadId,
  deferUntilMessagesReady = false,
}: {
  children: ReactNode;
  threadId?: string;
  deferUntilMessagesReady?: boolean;
}) {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    threadId,
    baseUrl,
    enabled: sessionEnabled && Boolean(threadId),
  });
  const messages = {
    threadId,
    isPending: Boolean(threadId) && messagesQuery.isPending,
    error: messagesQuery.error,
  };

  if (deferUntilMessagesReady && threadId && (messages.isPending || messages.error)) {
    return <ChatMessageFeedback {...messages} />;
  }

  return (
    <ChatTranscriptProvider
      key={`${resourceId}:${threadId ?? 'draft'}:${messagesQuery.isPending ? 'loading' : 'ready'}`}
      threadId={threadId}
      initialMessages={messagesQuery.data}
      hasMoreHistory={messagesQuery.hasMore}
      isLoadingMoreHistory={messagesQuery.isLoadingMore}
      loadMoreHistory={messagesQuery.loadMore}
    >
      <ChatModesProvider>
        <ChatModelsProvider>
          <ChatCommandsProvider>
            <ChatThreadMessagesContext.Provider value={messages}>{children}</ChatThreadMessagesContext.Provider>
          </ChatCommandsProvider>
        </ChatModelsProvider>
      </ChatModesProvider>
    </ChatTranscriptProvider>
  );
}

/** Limits delayed thread-history feedback to the transcript content region. */
export function ChatMessageBoundary({ children }: { children: ReactNode }) {
  const value = useContext(ChatThreadMessagesContext);
  if (!value) throw new Error('ChatMessageBoundary must be used within a ChatSessionBoundary');

  if (value.isPending || value.error) return <ChatMessageFeedback {...value} />;

  return children;
}

function ChatMessageFeedback({ threadId, isPending, error }: ChatThreadMessagesApi) {
  if (threadId && isPending) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]">
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  if (threadId && error) {
    const errorMessage = error instanceof Error ? error.message : undefined;
    return (
      <div className="flex min-h-0 flex-1 flex-col place-items-center gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]">
        <Notice variant="destructive">
          {errorMessage ? `Failed to load messages: ${errorMessage}` : 'Failed to load messages.'}
        </Notice>
      </div>
    );
  }

  return null;
}

/** Backward-compatible full chat boundary for focused component tests. */
export function ChatSessionProvider({
  children,
  threadId,
  userScoped = false,
}: {
  children: ReactNode;
  threadId?: string;
  userScoped?: boolean;
}) {
  return (
    <ChatSessionConfigProvider threadId={threadId} userScoped={userScoped}>
      <ChatSessionBoundary threadId={threadId} deferUntilMessagesReady>
        {children}
      </ChatSessionBoundary>
    </ChatSessionConfigProvider>
  );
}
