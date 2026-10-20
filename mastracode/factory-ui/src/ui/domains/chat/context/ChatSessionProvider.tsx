import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';
import { useContext, useMemo } from 'react';
import { useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useAgentControllerThreadMessages } from '../../../../hooks/useAgentControllerThreadMessages';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ChatCommandsProvider } from './ChatCommandsProvider';
import { ComposerImagesProvider } from './ComposerImagesProvider';
import { ChatModelsProvider } from './ChatModelsProvider';
import { ChatThinkingProvider } from './ChatThinkingProvider';
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
  const owner = useMemo(
    () =>
      storedSession && {
        id: storedSession.userId,
        name: storedSession.owner?.name,
        avatarUrl: storedSession.owner?.avatarUrl,
      },
    [storedSession],
  );

  const repository = storedSession
    ? factory?.repositories.find(
        (repo: LinkedRepositoryPayload) => repo.projectRepositoryId === storedSession.projectRepositoryId,
      )
    : factory?.repositories[0];
  // Entering a session provisions nothing: session sandboxes boot lazily at the
  // first real command. This provider only resolves session metadata.
  const inSession = Boolean(userScoped ? threadId : sessionId);
  const resolvingSession = inSession && sessionQuery.isPending;
  // The chat addresses its agent-controller session by the session id
  // (=== the session's thread id). The session runs under a memory resource
  // shared with other sessions: the Factory for runs and Slack sessions, the
  // owner for user sessions. The server reports it with the stored session.
  // Outside any session the Factory chat is its own session on the Factory.
  //
  // A `?sessionId=` query param overrides the address so the whole chat
  // (transcript, messages, connection, thread switch) binds to a session the
  // route can't name — e.g. a Slack channel session keyed `channel:slack:...`,
  // which is its own resource. `?resourceId=` is the same override in links
  // posted before sessions had their own address. Only the non-user-scoped
  // branch reads it; user-scoped sessions derive identity from their stored session.
  //
  // Read once from the entry URL rather than via the router's `useSearchParams`:
  // this is a deep-link entry param that the session binds to at mount and does
  // not re-read on in-app navigation, and this config provider otherwise has no
  // added router dependency.
  const entryParams = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const addressOverride = userScoped ? null : (entryParams.get('sessionId') ?? entryParams.get('resourceId'));
  const routedSessionId = userScoped ? (draftSessionId ?? threadId) : (storedSession?.sessionId ?? sessionId);
  const chatSessionId = addressOverride ?? routedSessionId ?? factory?.id;
  const resourceId =
    addressOverride ?? (inSession ? (storedSession?.resourceId ?? storedSession?.userId) : factory?.id);
  // A Factory session's threads are stamped with its id; the Factory chat
  // (no session) and channel sessions list every thread of their own resource.
  // So does a session still on a resource of its own (a run on untrusted
  // content, or one not migrated yet), whose older threads carry no stamp.
  const threadTags =
    !addressOverride && routedSessionId && resourceId !== routedSessionId
      ? { factorySessionId: routedSessionId }
      : undefined;
  // `sandboxReady` — session metadata resolved; safe to run mutations. The
  // server materializes sandboxes lazily on first use (and revives dead ones),
  // so nothing here waits on a sandbox existing.
  const sandboxReady = addressOverride ? Boolean(addressOverride) : Boolean(storedSession) && !resolvingSession;
  // A denied or missing session (404 from the session query) is fatal and must
  // surface the error state, not the eternal preparing loader.
  const sessionError = sessionQuery.error ?? undefined;
  // `resourceReady` — safe to address the agent-controller session by its
  // session id for reads/streaming as soon as server-side session metadata
  // resolves (that is when its memory resource is known). The endpoints are
  // keyed by session id, not by a live sandbox, so reads never wait on one.
  const resourceReady = userScoped
    ? Boolean(storedSession) && !resolvingSession
    : Boolean(addressOverride) || (Boolean(storedSession) && !resolvingSession);
  // `sandboxPreparing` — true only while session metadata is still resolving
  // for an in-session mount. Distinct from `!sandboxReady`, which is also
  // false outside any session. Track the pending query (not `!sandboxReady`)
  // so a denied/missing session cannot keep the preparing loader up forever.
  const sandboxPreparing = resolvingSession && !addressOverride;
  // Outside a session the factory resource is addressable straight away (its id
  // is the factory project id); inside one it becomes addressable as soon as
  // session metadata resolves — same as `resourceReady`.
  const resourceAddressable =
    userScoped || !inSession
      ? Boolean(chatSessionId)
      : Boolean(addressOverride) || (Boolean(storedSession) && !resolvingSession);
  const resourceEnabled = !isUserDraft && resourceAddressable;
  const value = {
    sessionId: chatSessionId ?? '',
    resourceId: resourceId ?? '',
    threadTags,
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
    owner,
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
  const { sessionId, resourceReady, baseUrl, sessionThreadId } = useChatSessionContext();
  const messagesQuery = useAgentControllerThreadMessages({
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    threadId,
    baseUrl,
    enabled: resourceReady && Boolean(threadId),
    isSessionThread: Boolean(threadId) && threadId === sessionThreadId,
  });
  const messages = {
    threadId,
    isPending: Boolean(threadId) && messagesQuery.isPending,
    error: messagesQuery.isError ? messagesQuery.error : undefined,
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
        key={`${sessionId}:${threadId ?? 'draft'}`}
        threadId={threadId}
        initialMessages={messagesQuery.data}
        hasMoreHistory={messagesQuery.hasMore}
        isLoadingMoreHistory={messagesQuery.isLoadingMore}
        loadMoreHistory={messagesQuery.loadMore}
      >
        <ChatModelsProvider>
          <ChatThinkingProvider>
            <ChatCommandsProvider>
              <ComposerImagesProvider>{children}</ComposerImagesProvider>
            </ChatCommandsProvider>
          </ChatThinkingProvider>
        </ChatModelsProvider>
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
