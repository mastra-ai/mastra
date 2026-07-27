import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows } from '../../../ui';
import { useAgentControllerThreadMessages } from '../../../../../shared/hooks/useAgentControllerThreadMessages';
import { useFactoryQuery } from '../../../../../shared/hooks/useFactories';
import { useEnsureMaterializedSandbox } from '../../../../../shared/hooks/useEnsureMaterializedSandbox';
import { useUserSessionQuery } from '../../../../../shared/hooks/useWorkspaces';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatCommandsProvider } from './ChatCommandsProvider';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatModesProvider } from './ChatModesProvider';
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
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl } = useApiConfig();
  const factoryQuery = useFactoryQuery(factoryId);
  const sessionQuery = useUserSessionQuery(userScoped ? threadId : sessionId);
  const factory = factoryQuery.data;
  const storedSession = sessionQuery.data;
  const repository = storedSession
    ? factory?.repositories.find(
        (repo: LinkedRepositoryPayload) => repo.projectRepositoryId === storedSession.projectRepositoryId,
      )
    : factory?.repositories[0];
  const ensureQuery = useEnsureMaterializedSandbox(repository?.projectRepositoryId);
  const resolvingSession = Boolean(userScoped ? threadId : sessionId) && sessionQuery.isPending;
  // Sessions and their threads are provisioned with the session's own id as the
  // memory resourceId and no scope (see FactoryStartCoordinator.prepare and
  // UserSessionsSection), so the chat surface must address the same
  // (resourceId, no scope) session to read threads and share the live run.
  // On user routes the :threadId param IS the sessionId. Factory routes with
  // no workspace session (e.g. /settings/*) fall back to the factory-level
  // session address returned by the /ensure route so resource-scoped surfaces
  // (behavior settings, tool permissions) stay functional.
  const resourceId = userScoped ? threadId : (storedSession?.sessionId ?? sessionId ?? ensureQuery.data?.resourceId);
  const projectPath = undefined;

  // A `?resourceId=` query param overrides the resolved factory resource so the
  // whole chat session (transcript, messages, connection, thread switch) binds
  // to a thread that lives under a different resource — e.g. a Slack channel
  // session keyed `channel:slack:...`. This only applies to the non-user-scoped
  // branch; user-scoped sessions derive identity from their stored session.
  //
  // Read once from the entry URL rather than via the router's `useSearchParams`:
  // this is a deep-link entry param that the session binds to at mount and does
  // not re-read on in-app navigation, and this config provider otherwise has no
  // added router dependency.
  const resourceOverride = userScoped
    ? null
    : new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('resourceId');
  const sessionEnabled = userScoped
    ? Boolean(storedSession) && !resolvingSession
    : resourceOverride
      ? Boolean(resourceOverride)
      : ensureQuery.isSuccess && Boolean(storedSession) && !resolvingSession;
  const value = {
    resourceId: resourceOverride ?? resourceId ?? '',
    sessionEnabled,
    resourceEnabled: userScoped ? Boolean(resourceId) : resourceOverride ? true : ensureQuery.isSuccess,
    projectPath,
    factorySessionState:
      factory && repository
        ? {
            factoryProjectId: factory.id,
            projectRepositoryId: repository.projectRepositoryId,
            sandboxId: storedSession?.sandboxId ?? ensureQuery.data?.sandboxId,
            sandboxWorkdir:
              storedSession?.sandboxWorkdir ?? ensureQuery.data?.sandboxWorkdir ?? repository.sandboxWorkdir,
          }
        : undefined,
    baseUrl,
    kind: userScoped ? ('user' as const) : ('factory' as const),
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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pt-6 pb-2 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]">
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  if (threadId && error) {
    const errorMessage = error instanceof Error ? error.message : undefined;
    return (
      <div className="flex min-h-0 flex-1 flex-col place-items-center gap-4 overflow-y-auto scroll-smooth px-3 pt-6 pb-2 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]">
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
