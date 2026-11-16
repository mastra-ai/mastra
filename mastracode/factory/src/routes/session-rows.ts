import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { LiveSessions } from '../session/live-sessions.js';
import { isSettling, sessionActivity, sessionRowsView } from '../session/session-row-view.js';
import { runningSessionIds, sessionRows } from '../session/session-rows.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { hashedBody, sendRevalidated, sessionIdsWhere } from './board-snapshot.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import type { ListedSession, ProjectSessionsReader } from './project-sessions.js';
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
  liveSessions: Pick<LiveSessions, 'parked'>;
  sessionCards(scope: ProjectScope): Promise<readonly Card[]>;
  projectSessions: ProjectSessionsReader;
  activeRuns: () => readonly { threadId: string; resourceId?: string }[];
  authEnabled: () => boolean;
}

interface SessionFacts {
  sessions: ListedSession[];
  cards: readonly Card[];
  runningSessionIds: Set<string>;
  parkedSessionIds: Set<string>;
}

async function sessionFacts(deps: SessionRowRouteDependencies, scope: ViewerScope): Promise<SessionFacts> {
  const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
  const [sessions, cards] = await Promise.all([
    deps.projectSessions({ ...project, userId: scope.userId }),
    deps.sessionCards(project),
  ]);
  return {
    sessions,
    cards,
    runningSessionIds: runningSessionIds(deps.activeRuns(), {
      authEnabled: deps.authEnabled(),
      viewerUserId: scope.userId,
      factoryProjectId: scope.factoryProjectId,
      visibleSessionIds: new Set(sessions.map(session => session.sessionId)),
    }),
    parkedSessionIds: new Set(sessionIdsWhere(cards, sessionId => deps.liveSessions.parked(sessionId) !== undefined)),
  };
}

export function buildSessionRowRoutes(deps: SessionRowRouteDependencies): ApiRoute[] {
  const { workItems } = deps;
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
          children: context.req.query('children'),
          pin: context.req.queries('pin'),
          open: context.req.query('open'),
          window: context.req.queries('window'),
        });
        if (!query.success) return c.json({ error: 'invalid_session_rows_query' }, 400);
        const { pin, children, ...view } = query.data;
        const project = { orgId: resolved.orgId, factoryProjectId: resolved.factoryProjectId };
        await workItems.ensureReady();
        const [facts, boards, { decisions }] = await Promise.all([
          sessionFacts(deps, resolved),
          deps.boards.load(project),
          workItems.listDeferredDecisionPage({
            ...project,
            statuses: [...CARD_DECISION_STATUSES],
            limit: CARD_DECISION_PAGE_SIZE,
          }),
        ]);
        const rows = sessionRows({
          ...facts,
          boards,
          awaitingPerson: cardsAwaitingPerson(decisions),
          viewerUserId: resolved.userId,
          pinnedSessionIds: pin,
          revealChildSessions: children === 'true',
        });
        const now = Date.now();
        return sendRevalidated(
          context,
          hashedBody({
            ...sessionRowsView(rows, view, resolved.userId, now),
            settling: isSettling(facts.sessions, now),
          }),
        );
      },
    }),

    registerApiRoute(FACTORY_ROUTE_CONTRACTS.sessionActivity.path, {
      method: FACTORY_ROUTE_CONTRACTS.sessionActivity.method,
      requiresAuth: false,
      handler: async c => {
        const context = loose(c);
        const resolved = await deps.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        await workItems.ensureReady();
        const facts = await sessionFacts(deps, resolved);
        return sendRevalidated(context, hashedBody(sessionActivity({ ...facts, now: Date.now() })));
      },
    }),
  ];
}
