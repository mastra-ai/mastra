import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { LiveSessions } from '../session/live-sessions.js';
import { sessionActivity, sessionRowsView } from '../session/session-row-view.js';
import { runningSessionIds } from '../session/session-rows.js';
import type { SessionRowIndex, SessionStatusViewer } from '../session/session-rows.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { hashedBody, sendRevalidated, sessionIdsWhere } from './board-snapshot.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { ProjectSessions, ProjectSessionsReader, SeenSessions } from './project-sessions.js';
import { loose } from './route.js';
import { CARD_DECISION_PAGE_SIZE, CARD_DECISION_STATUSES, cardsAwaitingPerson } from './work-item-starters.js';

interface ProjectScope {
  orgId: string;
  factoryProjectId: string;
}

type ViewerScope = ProjectScope & { userId: string };

interface SessionRowRouteDependencies {
  resolveProject(context: unknown): Promise<ViewerScope | { response: Response }>;
  workItems: Pick<WorkItemsStorage, 'ensureReady' | 'listDeferredDecisionPage'>;
  boards: ProjectBoardSource;
  liveSessions: Pick<LiveSessions, 'parked' | 'sessionOnThread'>;
  sessionCards(scope: ProjectScope): Promise<readonly Card[]>;
  projectSessions: ProjectSessionsReader;
  activeRuns: () => readonly { threadId: string; resourceId?: string }[];
  authEnabled: () => boolean;
}

interface SessionFacts {
  seen: SeenSessions;
  cards: readonly Card[];
  index: SessionRowIndex;
  viewer: SessionStatusViewer;
}

async function sessionFacts(deps: SessionRowRouteDependencies, scope: ViewerScope): Promise<SessionFacts> {
  const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
  await deps.workItems.ensureReady();
  const [sessions, cards, boards, { decisions }] = await Promise.all([
    deps.projectSessions(project),
    deps.sessionCards(project),
    deps.boards.load(project),
    deps.workItems.listDeferredDecisionPage({
      ...project,
      statuses: [...CARD_DECISION_STATUSES],
      limit: CARD_DECISION_PAGE_SIZE,
    }),
  ]);
  const seen = sessions.seenBy(scope.userId);
  const isParked = (sessionId: string) => deps.liveSessions.parked(sessionId) !== undefined;
  return {
    seen,
    cards,
    index: sessions.rowIndex(cards, boards),
    viewer: {
      viewerUserId: scope.userId,
      awaitingPerson: cardsAwaitingPerson(decisions),
      runningSessionIds: runningSessionIds(deps.activeRuns(), {
        authEnabled: deps.authEnabled(),
        viewerUserId: scope.userId,
        factoryProjectId: scope.factoryProjectId,
        visibleSessionIds: seen,
        sessionOnThread: threadId => deps.liveSessions.sessionOnThread(threadId),
      }),
      parkedSessionIds: new Set([
        ...sessionIdsWhere(cards, isParked),
        ...seen.sessions.flatMap(({ sessionId, userId }) =>
          userId === scope.userId && isParked(sessionId) ? [sessionId] : [],
        ),
      ]),
    },
  };
}

export function buildSessionRowRoutes(deps: SessionRowRouteDependencies): ApiRoute[] {
  return [
    registerApiRoute(FACTORY_ROUTE_CONTRACTS.sessionRows.path, {
      method: FACTORY_ROUTE_CONTRACTS.sessionRows.method,
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await deps.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const query = FACTORY_ROUTE_CONTRACTS.sessionRows.querySchema.safeParse({
          sort: context.req.query('sort'),
          groupBy: context.req.query('groupBy'),
          owner: context.req.query('owner'),
          status: context.req.query('status'),
          updated: context.req.query('updated'),
          source: context.req.query('source'),
          children: context.req.query('children'),
          pin: context.req.queries('pin'),
          open: context.req.query('open'),
          window: context.req.queries('window'),
        });
        if (!query.success) return c.json({ error: 'invalid_session_rows_query' }, 400);
        const { pin, children, ...view } = query.data;
        const facts = await sessionFacts(deps, resolved);
        const rows = facts.index.rows({
          ...facts.viewer,
          pinnedSessionIds: pin,
          revealChildSessions: children === 'true',
        });
        return sendRevalidated(context, hashedBody(sessionRowsView(rows, view, resolved.userId, Date.now())));
      },
    }),

    registerApiRoute(FACTORY_ROUTE_CONTRACTS.sessionActivity.path, {
      method: FACTORY_ROUTE_CONTRACTS.sessionActivity.method,
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await deps.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const { seen, cards, index, viewer } = await sessionFacts(deps, resolved);
        return sendRevalidated(
          context,
          hashedBody(
            sessionActivity({
              sessions: seen.sessions,
              cards,
              runningSessionIds: viewer.runningSessionIds,
              parkedSessionIds: viewer.parkedSessionIds,
              cardStatuses: index.cardStatuses(viewer),
            }),
          ),
        );
      },
    }),
  ];
}
