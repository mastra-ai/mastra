import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useAgentControllerThreadMessages } from '../../../../hooks/useAgentControllerThreadMessages';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useEnsureMaterializedSandbox } from '../../../../hooks/useEnsureMaterializedSandbox';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
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
  draftSessionId,
}: {
  children: ReactNode;
  threadId?: string;
  userScoped?: boolean;
  draftSessionId?: string;
}) {
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl } = useApiConfig();
  const factoryQuery = useFactoryQuery(factoryId);
  const isUserDraft = userScoped && Boolean(draftSessionId);
  const sessionQuery = useUserSessionQuery(userScoped ? threadId : sessionId);
  const factory = factoryQuery.data;
  const storedSession = sessionQuery.data;
  const repository = storedSession
    ? factory?.repositories.find(
        (repo: LinkedRepositoryPayload) => repo.projectRepositoryId === storedSession.projectRepositoryId,
      )
    : factory?.repositories[0];
  // Materializing a sandbox provisions a VM and clones the repo, so it may only
  // happen when the caller actually enters a session. Every factory route mounts
  // this provider (the chat shell is the router layout), so an ungated /ensure
  // here provisioned a sandbox just for visiting the board, metrics or settings.
  const inSession = Boolean(userScoped ? threadId : sessionId);
  const ensureQuery = useEnsureMaterializedSandbox(inSession ? repository?.projectRepositoryId : undefined);
  const resolvingSession = inSession && sessionQuery.isPending;
  // Sessions and their threads are provisioned with the session's own id as the
  // memory resourceId and no scope (see FactoryStartCoordinator.prepare and
  // UserSessionsSection), so the chat surface must address the same
  // (resourceId, no scope) session to read threads and share the live run.
  const resourceId = userScoped ? (draftSessionId ?? threadId) : (storedSession?.sessionId ?? sessionId ?? factory?.id);
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
  const sessionError = userScoped ? undefined : (ensureQuery.error ?? undefined);
  // Outside a session the factory resource is addressable straight away (its id
  // is the factory project id); inside one we keep the original ordering and
  // wait for the workspace so resource reads follow materialization.
  const resourceAddressable =
    userScoped || !inSession ? Boolean(resourceId) : Boolean(resourceOverride) || ensureQuery.isSuccess;
  const resourceEnabled = !isUserDraft && resourceAddressable;
  const value = {
    resourceId: resourceOverride ?? resourceId ?? '',
    sessionEnabled,
    resourceEnabled,
    sessionError,
    retrySession: sessionError ? () => void ensureQuery.refetch() : undefined,
    projectPath,
    sessionThreadId: storedSession?.sessionId,
    workspacePending: storedSession !== undefined && !storedSession.materializedAt,
    draftSessionId: isUserDraft ? draftSessionId : undefined,
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
    error: messagesQuery.data ? undefined : messagesQuery.error,
  };

  if (deferUntilMessagesReady && threadId && (messages.isPending || messages.error)) {
    return <ChatMessageFeedback {...messages} />;
  }

  return (
    <ChatTranscriptProvider
      // No `isPending` segment: remounting on the pending -> ready flip would drop
      // the live SSE listener. Results merge into the reducer instead.
      key={`${resourceId}:${threadId ?? 'draft'}`}
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
  const { sessionError, retrySession } = useChatSessionContext();

  // A failed workspace preparation keeps the session disabled, which leaves
  // the messages query pending forever — surface the real failure instead of
  // an eternal skeleton.
  if (sessionError) {
    return (
      <div className="flex flex-col items-stretch gap-4">
        <Notice variant="destructive">Failed to prepare the workspace: {sessionError.message}</Notice>
        {retrySession && (
          <div>
            <Button variant="default" onClick={retrySession}>
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (threadId && isPending) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  if (threadId && error) {
    const errorMessage = error instanceof Error ? error.message : undefined;
    return (
      <Notice variant="destructive">
        {errorMessage ? `Failed to load messages: ${errorMessage}` : 'Failed to load messages.'}
      </Notice>
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
