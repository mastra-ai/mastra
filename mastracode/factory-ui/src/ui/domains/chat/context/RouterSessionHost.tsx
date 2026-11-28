import { forwardRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';
import { newUserSessionPath, threadPath } from '../../workspaces/services/factoryPaths';
import { SessionHostContext } from './SessionHostContext';
import type { SessionHost, SessionLinkProps, SessionRouteKind } from './SessionHostContext';

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
      },
    };
  }, [factoryProjectId, sessionId, threadId, draftSessionId, routeKind, location, navigate]);

  return <SessionHostContext.Provider value={host}>{children}</SessionHostContext.Provider>;
}

const RouterSessionLink = forwardRef<HTMLAnchorElement, SessionLinkProps>(function RouterSessionLink(
  { href, returnHere, ...props },
  ref,
) {
  const location = useLocation();
  return <Link ref={ref} to={href} state={returnHere ? { from: location } : undefined} {...props} />;
});
