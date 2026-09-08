import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useAgentControllerThreadMessages } from '../../../../hooks/useAgentControllerThreadMessages';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatCommandsProvider } from './ChatCommandsProvider';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatModesProvider } from './ChatModesProvider';
import { ChatSessionContext } from './ChatSessionContext';
import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import type { ChatThreadMessagesApi } from './ChatThreadMessagesContext';
import { ChatTranscriptProvider } from './ChatTranscriptProvider';
import { useChatMessagePreparation } from './useChatMessagePreparation';
import { SessionPrepareSteps } from '../components/SessionPrepareSteps';
import { useChatSessionContext } from './useChatSessionContext';

/** Stable project/API configuration for chat shell consumers such as the sidebar. */
export function ChatSessionConfigProvider({
  children,
  threadId,
  userScoped = false,
  draftSessionId,
  supervisor,
}: {
  children: ReactNode;
  threadId?: string;
  userScoped?: boolean;
  draftSessionId?: string;
  /**
   * Bind the chat to the factory's supervisor session instead of a stored
   * workspace session. The supervisor has no repository or sandbox and no
   * session row: its resource is addressable straight away, and the server's
   * session-start hook stamps factory state from the resource id.
   */
  supervisor?: { resourceId: string; threadId: string };
}) {
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl } = useApiConfig();
  const factoryQuery = useFactoryQuery(factoryId);
  const isUserDraft = userScoped && Boolean(draftSessionId);
  const sessionQuery = useUserSessionQuery(supervisor ? undefined : userScoped ? threadId : sessionId);
  const factory = factoryQuery.data;
  const storedSession = sessionQuery.data;

  if (supervisor) {
    return (
      <ChatSessionContext.Provider
        value={{
          resourceId: supervisor.resourceId,
          sessionEnabled: true,
          sandboxReady: true,
          resourceReady: true,
          sandboxPreparing: false,
          resourceEnabled: true,
          sessionError: undefined,
          retrySession: undefined,
          projectPath: undefined,
          sessionThreadId: supervisor.threadId,
          workspacePending: false,
          draftSessionId: undefined,
          factorySessionState: factory ? { factoryProjectId: factory.id } : undefined,
          baseUrl,
          kind: 'factory' as const,
        }}
      >
        {children}
      </ChatSessionContext.Provider>
    );
  }
  const repository = storedSession
    ? factory?.repositories.find(
        (repo: LinkedRepositoryPayload) => repo.projectRepositoryId === storedSession.projectRepositoryId,
      )
    : factory?.repositories[0];
  // Entering a session provisions nothing: session sandboxes boot lazily at the
  // first real command. This provider only resolves session metadata.
  const inSession = Boolean(userScoped ? threadId : sessionId);
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
  // `sandboxReady` — session metadata resolved; safe to run mutations. The
  // server materializes sandboxes lazily on first use (and revives dead ones),
  // so nothing here waits on a sandbox existing.
  const sandboxReady = resourceOverride ? Boolean(resourceOverride) : Boolean(storedSession) && !resolvingSession;
  // A denied or missing session (404 from the session query) is fatal and must
  // surface the error state, not the eternal preparing loader.
  const sessionError = sessionQuery.error ?? undefined;
  // `resourceReady` — safe to address the agent-controller session by
  // `resourceId` for reads/streaming as soon as server-side session metadata
  // resolves. The agent-controller endpoints are keyed by resourceId, not by a
  // live sandbox, so reads and thread lookups never wait on one.
  const resourceReady = userScoped
    ? Boolean(storedSession) && !resolvingSession
    : Boolean(resourceOverride) || (Boolean(storedSession) && !resolvingSession);
  // `sandboxPreparing` — true only while session metadata is still resolving
  // for an in-session mount. Distinct from `!sandboxReady`, which is also
  // false outside any session. Track the pending query (not `!sandboxReady`)
  // so a denied/missing session cannot keep the preparing loader up forever.
  const sandboxPreparing = resolvingSession && !resourceOverride;
  // Outside a session the factory resource is addressable straight away (its id
  // is the factory project id); inside one it becomes addressable as soon as
  // session metadata resolves — same as `resourceReady`.
  const resourceAddressable =
    userScoped || !inSession
      ? Boolean(resourceId)
      : Boolean(resourceOverride) || (Boolean(storedSession) && !resolvingSession);
  const resourceEnabled = !isUserDraft && resourceAddressable;
  const value = {
    resourceId: resourceOverride ?? resourceId ?? '',
    // `sessionEnabled` retained as an alias for `sandboxReady` so existing
    // mutation/display consumers don't need to be renamed in this change.
    sessionEnabled: sandboxReady,
    sandboxReady,
    resourceReady,
    sandboxPreparing,
    resourceEnabled,
    sessionError,
    retrySession: sessionError
      ? () => {
          if (sessionQuery.isError) void sessionQuery.refetch();
        }
      : undefined,
    projectPath,
    sessionThreadId: storedSession?.sessionId,
    workspacePending: storedSession !== undefined && !storedSession.materializedAt,
    draftSessionId: isUserDraft ? draftSessionId : undefined,
    factorySessionState:
      factory && repository
        ? {
            factoryProjectId: factory.id,
            projectRepositoryId: repository.projectRepositoryId,
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
  const { resourceId, resourceReady, projectPath, baseUrl } = useChatSessionContext();
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    threadId,
    baseUrl,
    enabled: resourceReady && Boolean(threadId),
  });
  const messages = {
    threadId,
    isPending: Boolean(threadId) && messagesQuery.isPending,
    error: messagesQuery.data ? undefined : messagesQuery.error,
  };

  if (deferUntilMessagesReady && threadId && (messages.isPending || messages.error)) {
    return (
      <ChatThreadMessagesContext.Provider value={messages}>
        <ChatMessageBoundary>{null}</ChatMessageBoundary>
      </ChatThreadMessagesContext.Provider>
    );
  }

  // Above the transcript so the favicon and the stepper read one pending state.
  return (
    <ChatThreadMessagesContext.Provider value={messages}>
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
            <ChatCommandsProvider>{children}</ChatCommandsProvider>
          </ChatModelsProvider>
        </ChatModesProvider>
      </ChatTranscriptProvider>
    </ChatThreadMessagesContext.Provider>
  );
}

/** Limits delayed thread-history feedback to the transcript content region. */
export function ChatMessageBoundary({
  children,
  showPreparation = true,
}: {
  children: ReactNode;
  showPreparation?: boolean;
}) {
  const value = useContext(ChatThreadMessagesContext);
  if (!value) throw new Error('ChatMessageBoundary must be used within a ChatSessionBoundary');
  const { sessionError } = useChatSessionContext();
  const { historyInitializing, preparing } = useChatMessagePreparation();

  if (sessionError) return <ChatMessageFeedback error={sessionError} />;

  if (preparing) {
    return showPreparation ? <SessionPrepareSteps historyInitializing={historyInitializing} /> : null;
  }

  if (value.threadId && value.error) {
    return <ChatMessageFallback {...value} />;
  }

  return <>{children}</>;
}

function ChatMessageFeedback({ error }: { error: Error }) {
  const { retrySession } = useChatSessionContext();
  // The server intentionally returns the same 404 for a missing session and a
  // private one owned by someone else, so the message covers both.
  const notFound = (error as { status?: number }).status === 404;
  return (
    <div className="flex flex-col items-stretch gap-4">
      <Notice variant="destructive">
        {notFound
          ? 'This session was not found or is private to another user.'
          : `Failed to prepare the workspace: ${error.message}`}
      </Notice>
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

function ChatMessageFallback({ threadId, isPending, error }: ChatThreadMessagesApi) {
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
