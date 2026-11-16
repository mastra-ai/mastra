import { BoardDefinitionError, boardRegistryOf } from '@mastra/factory/boards';
import type { InstalledBoard } from '@mastra/factory/boards';
import { compileStoredBoard } from '@mastra/factory/boards/stored-board';
import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import {
  CARD_DECISION_PAGE_SIZE,
  CARD_DECISION_STATUSES,
  cardsAwaitingPerson,
} from '@mastra/factory/routes/work-item-starters';
import { isSettling, sessionActivity, sessionRowsView } from '@mastra/factory/session/session-row-view';
import { runningSessionIds, sessionRows } from '@mastra/factory/session/session-rows';
import type { RowSession } from '@mastra/factory/session/session-rows';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { AGENT_CONTROLLER_ID } from '../../src/ui/domains/chat/services/constants';
import { queryValues, storedCard, stubbedReads, stubbedUserId } from './board-reads';
import type { StubbedReads } from './board-reads';

/**
 * The server's session rows and session activity reads for the UI suites, answered by the
 * server's own rules from the lists a test stubs: its sessions, its session cards, its boards,
 * decisions, signed-in user and active runs. A test keeps stubbing those lists; the sidebar asks
 * for rows, and gets what the real server would answer for them.
 */

const dateSchema = z.coerce.date();

// What a test's session may leave out, with what the server's rules then read.
const wireSessionSchema = z
  .object({
    id: z.string().optional(),
    sessionId: z.string(),
    projectRepositoryId: z.string().nullish(),
    userId: z.string().default('user-1'),
    owner: z.object({ id: z.string(), name: z.string(), avatarUrl: z.string().optional() }).optional(),
    visibility: z.enum(['org', 'private']).default('org'),
    title: z.string().nullish(),
    branch: z.string().default(''),
    materializedAt: dateSchema.nullish(),
    createdAt: dateSchema.default(new Date(0)),
    updatedAt: dateSchema.optional(),
    followedWorkItemIds: z.array(z.string()).default([]),
  })
  .transform(
    ({ owner, ...session }): RowSession => ({
      id: session.id ?? session.sessionId,
      sessionId: session.sessionId,
      projectRepositoryId: session.projectRepositoryId ?? null,
      userId: session.userId,
      branch: session.branch,
      title: session.title ?? null,
      visibility: session.visibility,
      materializedAt: session.materializedAt ?? null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt ?? session.createdAt,
      ...(owner ? { owner } : {}),
      followedWorkItemIds: session.followedWorkItemIds,
    }),
  );
const stubbedSessionsSchema = z.object({ sessions: z.array(wireSessionSchema) });
const stubbedSessionCardsSchema = z.object({
  workItems: z.array(z.unknown()).default([]),
  parkedSessionIds: z.array(z.string()).default([]),
});
const stubbedRunsSchema = z.object({
  runs: z.array(
    z.object({
      threadId: z.string(),
      resourceId: z
        .string()
        .nullish()
        .transform(id => id ?? undefined),
    }),
  ),
});
const stubbedDecisionsSchema = z.object({
  decisions: z.array(z.object({ workItemId: z.string().nullish(), status: z.string() })),
});
const cardDecisionStatusSchema = z.enum(CARD_DECISION_STATUSES);
const stubbedCatalogSchema = z.object({ boards: z.array(z.unknown()) });
const catalogBoardSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  title: z.string().optional(),
  phases: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      title: z.string().optional(),
      kind: z.enum(['resting', 'working', 'terminal']),
      nextPhases: z.array(z.string()).optional(),
      context: z.string().optional(),
      role: z.string().optional(),
    }),
  ),
});

/** A board of the catalog as the server installs it; one it could not load is left out, as the server leaves it. */
function installedBoard(listed: unknown): InstalledBoard[] {
  const board = catalogBoardSchema.safeParse(listed);
  if (!board.success) return [];
  try {
    return [
      compileStoredBoard({
        key: board.data.id,
        name: board.data.name ?? board.data.title ?? board.data.id,
        phases: board.data.phases.map(phase => ({
          key: phase.id,
          name: phase.name ?? phase.title ?? phase.id,
          kind: phase.kind,
          nextPhases: phase.nextPhases,
          runner: phase.kind === 'working' ? { context: phase.context ?? phase.role } : null,
        })),
      }),
    ];
  } catch (error) {
    if (error instanceof BoardDefinitionError) return [];
    throw error;
  }
}

/** The deferred decisions the server reads for the rows: the stubbed page, as its storage filters it. */
function cardDecisions(page: unknown) {
  return stubbedDecisionsSchema
    .parse(page)
    .decisions.flatMap(({ workItemId, status }) => {
      const cardStatus = cardDecisionStatusSchema.safeParse(status);
      return cardStatus.success ? [{ workItemId: workItemId ?? null, status: cardStatus.data }] : [];
    })
    .slice(0, CARD_DECISION_PAGE_SIZE);
}

/**
 * What both reads know of the project's sessions, as the route composes it from what the test
 * stubs. An answer that is not one of these is the stub's own failure, which the read then fails with.
 */
async function stubbedSessionFacts(reads: StubbedReads, factoryProjectId: string) {
  const [listed, list, me, active] = await Promise.all([
    reads.project('sessions'),
    reads.project('work-items?scope=sessions'),
    reads.origin('auth/me'),
    reads.origin(`api/agent-controller/${AGENT_CONTROLLER_ID}/active-runs`),
  ]);
  const failed = [listed, list, active].find(read => !read.ok);
  if (failed) return failed;
  const { sessions } = stubbedSessionsSchema.parse(await listed.json());
  const { workItems, parkedSessionIds } = stubbedSessionCardsSchema.parse(await list.json());
  const viewerUserId = await stubbedUserId(me);
  return {
    viewerUserId,
    facts: {
      sessions,
      cards: workItems.map(storedCard),
      runningSessionIds: runningSessionIds(stubbedRunsSchema.parse(await active.json()).runs, {
        authEnabled: me.status !== 404,
        viewerUserId,
        factoryProjectId,
        visibleSessionIds: new Set(sessions.map(session => session.sessionId)),
      }),
      parkedSessionIds: new Set(parkedSessionIds),
    },
  };
}

/** Ambient session rows and activity reads, answered from whatever lists the running test stubs. */
export const sessionReadHandlers = [
  http.get('*/web/factory/projects/:id/session-rows', async ({ request, params }) => {
    const url = new URL(request.url);
    const query = FACTORY_ROUTE_CONTRACTS.sessionRows.querySchema.safeParse({
      sort: url.searchParams.get('sort') ?? undefined,
      groupBy: url.searchParams.get('groupBy') ?? undefined,
      owner: url.searchParams.get('owner') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      updated: url.searchParams.get('updated') ?? undefined,
      children: url.searchParams.get('children') ?? undefined,
      pin: queryValues(url, 'pin'),
      open: url.searchParams.get('open') ?? undefined,
      window: queryValues(url, 'window'),
    });
    if (!query.success) return HttpResponse.json({ error: 'invalid_session_rows_query' }, { status: 400 });
    const factoryProjectId = String(params.id);
    const reads = stubbedReads(request, factoryProjectId);
    const [project, catalog, decisions] = await Promise.all([
      stubbedSessionFacts(reads, factoryProjectId),
      reads.project('boards'),
      reads.project(`decisions?statuses=${CARD_DECISION_STATUSES.join(',')}&limit=${CARD_DECISION_PAGE_SIZE}`),
    ]);
    if (project instanceof Response) return project;
    if (!catalog.ok) return catalog;
    if (!decisions.ok) return decisions;
    const { pin, children, ...view } = query.data;
    const rows = sessionRows({
      ...project.facts,
      boards: boardRegistryOf(stubbedCatalogSchema.parse(await catalog.json()).boards.flatMap(installedBoard)),
      awaitingPerson: cardsAwaitingPerson(cardDecisions(await decisions.json())),
      viewerUserId: project.viewerUserId,
      pinnedSessionIds: pin,
      revealChildSessions: children === 'true',
    });
    const now = Date.now();
    return HttpResponse.json({
      ...sessionRowsView(rows, view, project.viewerUserId, now),
      settling: isSettling(project.facts.sessions, now),
    });
  }),
  http.get('*/web/factory/projects/:id/session-activity', async ({ request, params }) => {
    const factoryProjectId = String(params.id);
    const project = await stubbedSessionFacts(stubbedReads(request, factoryProjectId), factoryProjectId);
    return project instanceof Response
      ? project
      : HttpResponse.json(sessionActivity({ ...project.facts, now: Date.now() }));
  }),
];
