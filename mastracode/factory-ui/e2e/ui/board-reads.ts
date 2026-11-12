import type { Card } from '@mastra/factory';
import { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';
import { workItemColumns } from '@mastra/factory/work-items/board-columns';
import { workItemFilterOptions } from '@mastra/factory/work-items/board-filter-options';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';

/**
 * The server's paged board reads for the UI suites, answered by the server's own rules from the
 * project's cards as a test lists them. A test keeps stubbing one list of cards; the board asks
 * for columns of it, and gets what the real server would answer for that list.
 */

const dateSchema = z.coerce.date();
const sourceRowSchema = z.custom<Card['workItem']['sources'][number]>(
  value => typeof value === 'object' && value !== null,
);

// What a test's card may leave out, with what the server's rules then read.
const wireCardSchema = z.object({
  id: z.string(),
  workItemId: z.string().optional(),
  parentBoardItemId: z.string().nullish(),
  orgId: z.string().default('org-1'),
  createdBy: z.string().default('user-1'),
  factoryProjectId: z.string().default('fp-1'),
  board: z.string().nullish(),
  externalSource: z
    .object({
      integrationId: z.string(),
      type: z.string(),
      workspaceId: z.string().optional(),
      externalId: z.string(),
      url: z
        .string()
        .nullish()
        .transform(url => url ?? undefined),
    })
    .nullish(),
  parentWorkItemId: z.string().nullish(),
  title: z.string().default(''),
  description: z.string().nullish(),
  stages: z.array(z.string()).default([]),
  stageHistory: z
    .array(
      z.object({
        stage: z.string(),
        enteredAt: z.string(),
        exitedAt: z.string().optional(),
        by: z.string().default('user-1'),
        exitedBy: z.string().optional(),
      }),
    )
    .default([]),
  sessions: z
    .record(
      z.string(),
      z.object({
        sessionId: z.string(),
        branch: z.string().default(''),
        threadId: z.string().default(''),
        startedBy: z.string().default('user-1'),
      }),
    )
    .default({}),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  triageType: z.custom<Card['triageType']>(value => value === null || typeof value === 'string').optional(),
  acceptedAt: dateSchema.nullish(),
  autonomyArmedAt: dateSchema.nullish(),
  revision: z.number().default(1),
  createdAt: dateSchema.default(new Date(0)),
  updatedAt: dateSchema.optional(),
  changedAt: dateSchema.nullish(),
  workItem: z
    .object({
      id: z.string().optional(),
      provider: z.string().default('factory'),
      externalId: z.string().nullish(),
      key: z.string().nullish(),
      url: z.string().nullish(),
      title: z.string().optional(),
      state: z.string().nullish(),
      labels: z.array(z.string()).default([]),
      author: z.string().nullish(),
      metadata: z.record(z.string(), z.unknown()).nullish(),
      sources: z.array(sourceRowSchema).default([]),
      syncedAt: dateSchema.nullish(),
    })
    .optional(),
});

/** A stamp for a card that states none: it changes whenever anything of the card does. */
function contentStamp(wire: unknown): Date {
  let hash = 2166136261;
  for (const char of JSON.stringify(wire)) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
  return new Date(hash >>> 0);
}

/** The card the server holds for a card a test lists on the wire. */
function storedCard(wire: unknown): Card {
  const card = wireCardSchema.parse(wire);
  const updatedAt = card.updatedAt ?? card.createdAt;
  const workItemId = card.workItemId ?? card.workItem?.id ?? card.id;
  return {
    id: card.id,
    workItemId,
    parentBoardItemId: card.parentBoardItemId ?? null,
    orgId: card.orgId,
    createdBy: card.createdBy,
    factoryProjectId: card.factoryProjectId,
    board: card.board ?? null,
    externalSource: card.externalSource ?? null,
    parentWorkItemId: card.parentWorkItemId ?? null,
    title: card.workItem?.title ?? card.title,
    description: card.description ?? null,
    stages: card.stages,
    stageHistory: card.stageHistory,
    sessions: card.sessions,
    metadata: card.metadata ?? null,
    triageType: card.triageType ?? null,
    acceptedAt: card.acceptedAt ?? null,
    autonomyArmedAt: card.autonomyArmedAt ?? null,
    revision: card.revision,
    createdAt: card.createdAt,
    updatedAt,
    changedAt: card.changedAt ?? contentStamp(wire),
    workItem: {
      id: workItemId,
      orgId: card.orgId,
      factoryProjectId: card.factoryProjectId,
      provider: card.workItem?.provider ?? 'factory',
      externalId: card.workItem?.externalId ?? card.externalSource?.externalId ?? card.id,
      key: card.workItem?.key ?? null,
      url: card.workItem?.url ?? null,
      title: card.workItem?.title ?? card.title,
      state: card.workItem?.state ?? null,
      labels: card.workItem?.labels ?? [],
      author: card.workItem?.author ?? null,
      parentWorkItemId: card.parentWorkItemId ?? null,
      metadata: card.workItem?.metadata ?? null,
      sources: card.workItem?.sources ?? [],
      revision: card.revision,
      syncedAt: card.workItem?.syncedAt ?? null,
      createdAt: card.createdAt,
      updatedAt,
    },
  };
}

/** A project as a test states it: its cards on the wire, its boards, and who reads it. */
export interface StubbedProject {
  workItems: readonly unknown[];
  boards: ReadonlyArray<{ id: string; phases: ReadonlyArray<{ id: string }> }>;
  userId: string;
  runningSessionIds?: readonly string[];
  parkedSessionIds?: readonly string[];
}

function queryValues(url: URL, name: string): string[] | undefined {
  const values = url.searchParams.getAll(name);
  return values.length > 0 ? values : undefined;
}

/** The columns read's answer for `request`, as the server gives it for `project`. */
export function answerWorkItemColumns(request: Request, project: StubbedProject): Response {
  const url = new URL(request.url);
  const query = FACTORY_ROUTE_CONTRACTS.workItemColumns.querySchema.safeParse({
    board: url.searchParams.get('board') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    source: queryValues(url, 'source'),
    linearProject: queryValues(url, 'linearProject'),
    label: queryValues(url, 'label'),
    teammate: queryValues(url, 'teammate'),
    author: queryValues(url, 'author'),
    assignee: queryValues(url, 'assignee'),
    reviewer: queryValues(url, 'reviewer'),
    worked: queryValues(url, 'worked'),
    limit: url.searchParams.get('limit') ?? undefined,
    window: queryValues(url, 'window'),
    item: url.searchParams.get('item') ?? undefined,
    cards: url.searchParams.get('cards') ?? undefined,
  });
  if (!query.success) return HttpResponse.json({ error: 'invalid_columns_query' }, { status: 400 });
  const { board: boardId, cards: withBodies, ...view } = query.data;
  const board = project.boards.find(candidate => candidate.id === boardId);
  if (!board) return HttpResponse.json({ error: 'board_not_found' }, { status: 404 });
  const phases = board.phases.map(phase => phase.id);
  const wireById = new Map<string, unknown>();
  const list = project.workItems.map(wire => {
    const card = storedCard(wire);
    const body = z.record(z.string(), z.unknown()).parse(wire);
    wireById.set(card.id, { ...body, changedAt: card.changedAt?.toISOString() ?? null });
    return card;
  });
  const { body, named } = workItemColumns(list, { id: boardId, phases }, view, project.userId);
  const namedSessionIds = new Set(
    named.flatMap(card => Object.values(card.sessions).map(session => session.sessionId)),
  );
  return HttpResponse.json({
    ...body,
    ...(withBodies ? { workItems: named.map(card => wireById.get(card.id)) } : {}),
    runningSessionIds: (project.runningSessionIds ?? []).filter(id => namedSessionIds.has(id)),
    parkedSessionIds: (project.parkedSessionIds ?? []).filter(id => namedSessionIds.has(id)),
  });
}

/** The filter options read's answer, as the server gives it for the project's cards. */
export function answerWorkItemFilterOptions(workItems: readonly unknown[]): Response {
  return HttpResponse.json(workItemFilterOptions(workItems.map(storedCard)));
}

const stubbedListSchema = z.object({
  workItems: z.array(z.unknown()).default([]),
  runningSessionIds: z.array(z.string()).optional(),
  parkedSessionIds: z.array(z.string()).optional(),
});
const stubbedCatalogSchema = z.object({
  boards: z.array(z.object({ id: z.string(), phases: z.array(z.object({ id: z.string() })) })),
});
const stubbedUserSchema = z.object({ user: z.object({ userId: z.string() }) });

const STUBBED_PROJECT_READ_HEADER = 'x-stubbed-project-read';

/**
 * Whether `request` is one the ambient paged reads sent to learn what the test stubs, rather than
 * one the app sent. A test that counts or records requests leaves these out.
 */
export function isStubbedProjectRead(request: Request): boolean {
  return request.headers.has(STUBBED_PROJECT_READ_HEADER);
}

/**
 * The project as the running test stubs it: the cards its `work-items` handler lists, its board
 * catalog and its signed-in user. An answer that is not one of these is the stub's own failure,
 * which the paged read then fails with.
 */
async function stubbedProject(request: Request, factoryProjectId: string): Promise<StubbedProject | Response> {
  const { origin } = new URL(request.url);
  const project = `${origin}/web/factory/projects/${encodeURIComponent(factoryProjectId)}`;
  const read = { signal: request.signal, headers: { [STUBBED_PROJECT_READ_HEADER]: 'true' } };
  const [list, catalog, me] = await Promise.all([
    fetch(`${project}/work-items`, read),
    fetch(`${project}/boards`, read),
    fetch(`${origin}/auth/me`, read),
  ]);
  if (!list.ok) return list;
  if (!catalog.ok) return catalog;
  const user = me.ok ? stubbedUserSchema.safeParse(await me.json()) : undefined;
  return {
    ...stubbedListSchema.parse(await list.json()),
    boards: stubbedCatalogSchema.parse(await catalog.json()).boards,
    userId: user?.success ? user.data.user.userId : 'user-1',
  };
}

/** Ambient paged board reads, answered from whatever list of cards the running test stubs. */
export const boardReadHandlers = [
  http.get('*/web/factory/projects/:id/work-items/columns', async ({ request, params }) => {
    const project = await stubbedProject(request, String(params.id));
    return project instanceof Response ? project : answerWorkItemColumns(request, project);
  }),
  http.get('*/web/factory/projects/:id/work-items/filter-options', async ({ request, params }) => {
    const project = await stubbedProject(request, String(params.id));
    return project instanceof Response ? project : answerWorkItemFilterOptions(project.workItems);
  }),
];
