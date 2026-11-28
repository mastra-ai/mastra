import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { forwardRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { useFactoriesQuery, useFactoryQuery } from '../../../../hooks/useFactories';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import {
  addCachedSession,
  invalidateSessionQueries,
  updateCachedSessionTitle,
  useUserSessionQuery,
  useWorkspacesQuery,
} from '../../../../hooks/useWorkspaces';
import { useSessionCard } from '../../factory/hooks/useSessionCard';
import { useSessionRepository } from '../../factory/hooks/useSessionRepository';
import {
  pullRequestSubscriptionsQuery,
  pullRequestSubscriptionsQueryKey,
} from '../../factory/services/githubSubscriptions';
import { answerParkedApproval, createUserSession } from '../../workspaces/services/user-sessions';
import type { FactoryUserSession } from '@internal/factory-contract';

import { settingsSectionPath } from '../../settings/settingsSections';
import { useTakeSessionOwnership } from '../../workspaces/hooks/useTakeSessionOwnership';
import { relationshipPath } from '../../factory/services/relationshipPath';
import { cardPath, factoryHomePath, newUserSessionPath, threadPath } from '../../workspaces/services/factoryPaths';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { SessionHostContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';
import type {
  SessionHost,
  SessionHostData,
  SessionLinkProps,
  SessionRouteKind,
} from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';

/** Factory's project, viewer and session data, read through its own query cache. */
export function useFactorySessionData(): SessionHostData {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMemo<SessionHostData>(
    () => ({
      useProject: useFactoryQuery,
      useProjects: useFactoriesQuery,
      useProjectSettings: useFactoryProjectQuery,
      useViewer: useFactoryAuth,
      useUserSession: useUserSessionQuery,
      useSessionList: useWorkspacesQuery,
      createUserSession: ({ projectId, projectRepositoryId, ...options }, toError) => {
        const done = queryClient.query({
          queryKey: queryKeys.userSession(options.sessionId),
          queryFn: async (): Promise<FactoryUserSession> => {
            let session: FactoryUserSession;
            try {
              session = await createUserSession(baseUrl, projectRepositoryId, options);
            } catch (error) {
              throw toError(error);
            }
            addCachedSession(queryClient, projectId, session);
            return session;
          },
        });
        // A new session has no history, so the thread opens on an empty transcript
        // instead of waiting on a history read the session cannot answer yet.
        queryClient.setQueryData<MastraDBMessage[]>(
          queryKeys.agentControllerThreadMessages(
            AGENT_CONTROLLER_ID,
            options.sessionId,
            options.sessionId,
            INITIAL_THREAD_MESSAGE_LIMIT,
          ),
          [],
        );
        return done;
      },
      useTakeSessionOwnership,
      answerParkedApproval: (sessionId, decision, toolCallId) =>
        answerParkedApproval(baseUrl, sessionId, decision, toolCallId),
      onSessionTitleChanged: (projectId, sessionId, title) =>
        updateCachedSessionTitle(queryClient, projectId, sessionId, title),
      invalidateSessions: async projectId => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.workItems(projectId) }),
          invalidateSessionQueries(queryClient, projectId),
        ]);
      },
      useSessionCard,
      useSessionRepository,
      pullRequestSubscriptions: {
        use: function usePullRequestSubscriptions(sessionId, threadId, provider, enabled) {
          return useQuery(pullRequestSubscriptionsQuery(baseUrl, sessionId, threadId, provider, enabled));
        },
        invalidate: (sessionId, threadId, provider) =>
          void queryClient.invalidateQueries({
            queryKey: pullRequestSubscriptionsQueryKey(sessionId, threadId, provider),
          }),
      },
    }),
    [baseUrl, queryClient],
  );
}

/** Fills the session host from Factory's router. Mounted once, above every session page. */
export function RouterSessionHost({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  // `useParams` in a layout can't see descendant params, so match the session routes explicitly.
  const factoryMatch = useMatch('/factories/:factoryId/*');
  const draftMatch = useMatch('/factories/:factoryId/new');
  const userDraftMatch = useMatch('/factories/:factoryId/user/new/:draftSessionId');
  const cardDraftMatch = useMatch('/factories/:factoryId/cards/:workItemId/new/:draftSessionId');
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const threadMatch = useMatch('/factories/:factoryId/workspaces/:sessionId/threads/:threadId');

  const factoryProjectId = factoryMatch?.params.factoryId;
  const routeKind: SessionRouteKind = threadMatch
    ? 'thread'
    : userThreadMatch
      ? 'user-thread'
      : userDraftMatch
        ? 'user-draft'
        : cardDraftMatch
          ? 'card-draft'
          : draftMatch
            ? 'draft'
            : 'none';
  const sessionId = threadMatch?.params.sessionId;
  const threadId = threadMatch?.params.threadId ?? userThreadMatch?.params.threadId;
  const draftSessionId = (userDraftMatch ?? cardDraftMatch)?.params.draftSessionId;

  const data = useFactorySessionData();
  const host = useMemo<SessionHost>(() => {
    const factoryId = factoryProjectId ?? '';
    const from = { from: location };
    return {
      factoryProjectId,
      sessionId,
      threadId,
      draftSessionId,
      routeKind,
      location: { pathname: location.pathname, search: location.search, state: location.state },
      LinkComponent: RouterSessionLink,
      navigate: (href, options) =>
        void navigate(href, {
          replace: options?.replace,
          state: options?.returnHere ? { ...(options.state as object | undefined), ...from } : options?.state,
        }),
      links: {
        settings: (section, anchor) => settingsSectionPath(factoryId, section, anchor),
        thread: thread => threadPath(factoryId, thread),
        userThread: id => `/factories/${factoryId}/user/threads/${id}`,
        newUserSession: () => newUserSessionPath(factoryId),
        channelThread: id => `/factories/${factoryId}/threads/${id}`,
        knowledgePage: pageId =>
          `/factories/${encodeURIComponent(factoryId)}/knowledge?page=${encodeURIComponent(pageId)}&view=page`,
        project: id => factoryHomePath({ id }),
        card: workItemId => cardPath(factoryId, workItemId, undefined),
        workItemBoard: item => relationshipPath(item, factoryId),
      },
      data,
    };
  }, [factoryProjectId, sessionId, threadId, draftSessionId, routeKind, location, navigate, data]);

  return <SessionHostContext.Provider value={host}>{children}</SessionHostContext.Provider>;
}

const RouterSessionLink = forwardRef<HTMLAnchorElement, SessionLinkProps>(function RouterSessionLink(
  { href, returnHere, ...props },
  ref,
) {
  const location = useLocation();
  return <Link ref={ref} to={href ?? ''} state={returnHere ? { from: location } : undefined} {...props} />;
});
