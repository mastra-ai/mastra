import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import type { AuditEventRow } from '../storage/domains/audit/base.js';
import type { WorkItemCommentRow } from '../storage/domains/comments/base.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryRunBindingRecord,
  WorkItemRow,
  WorkItemSubscription,
} from '../storage/domains/work-items/base.js';
import { MAX_ERROR, MAX_TEXT, createFactoryReadTools } from './read-tools.js';
import type { FactoryReadToolDependencies } from './read-tools.js';
import type { FactoryToolScope } from './scope.js';

const scope: FactoryToolScope = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  userId: 'user-1',
  sessionId: 'session-1',
  resourceId: 'session-1',
  threadId: 'thread-1',
  kind: 'user',
  interactive: true,
};

let clock = Date.parse('2026-10-01T00:00:00Z');

function item(overrides: Partial<WorkItemRow> & { id: string }): WorkItemRow {
  clock += 60_000;
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    board: null,
    externalSource: null,
    claimKey: null,
    parentWorkItemId: null,
    title: `Item ${overrides.id}`,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: null,
    triageType: null,
    autonomyArmedAt: null,
    plansPreapprovedAt: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdBy: 'someone-else',
    createdAt: new Date(clock),
    updatedAt: new Date(clock),
    ...overrides,
  } as WorkItemRow;
}

function binding(workItemId: string, role: string, status: 'active' | 'revoked' = 'active'): FactoryRunBindingRecord {
  return {
    id: `binding-${workItemId}-${role}`,
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId,
    role,
    threadId: `thread-${workItemId}`,
    resourceId: `session-${workItemId}`,
    sessionId: `session-${workItemId}`,
    branch: 'factory/item',
    status,
    createdAt: new Date(),
    revokedAt: status === 'revoked' ? new Date() : null,
  } as FactoryRunBindingRecord;
}

function decision(overrides: Partial<FactoryDeferredDecisionRecord> & { id: string }): FactoryDeferredDecisionRecord {
  return {
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    evaluationId: `evaluation-${overrides.id}`,
    workItemId: null,
    idempotencyKey: overrides.id,
    effectOrdinal: 0,
    effectHash: 'hash',
    causalChain: [],
    actor: null,
    decision: { type: 'invokeSkill', role: 'work' },
    status: 'failed',
    attempts: 1,
    deliveryGeneration: 0,
    failureOccurrence: 0,
    availableAt: new Date(),
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: null,
    failureCode: null,
    approvedAt: null,
    approvedBy: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup({
  items = [],
  bindings = [],
  decisions = [],
  audit = [],
  comments = [],
  subscriptions = [],
}: {
  items?: WorkItemRow[];
  bindings?: FactoryRunBindingRecord[];
  decisions?: FactoryDeferredDecisionRecord[];
  audit?: AuditEventRow[];
  comments?: WorkItemCommentRow[];
  subscriptions?: WorkItemSubscription[];
}) {
  const deps: FactoryReadToolDependencies = {
    workItems: {
      list: vi.fn(async ({ factoryProjectId }) => items.filter(row => row.factoryProjectId === factoryProjectId)),
      getForProject: vi.fn(
        async (_orgId, factoryProjectId, id) =>
          items.find(row => row.id === id && row.factoryProjectId === factoryProjectId) ?? null,
      ),
      listRunBindings: vi.fn(async (_orgId, _projectId, workItemId) =>
        bindings.filter(row => workItemId === undefined || row.workItemId === workItemId),
      ),
      listDeferredDecisions: vi.fn(async (_orgId, _projectId, filter = {}) =>
        decisions.filter(
          row =>
            (!filter.statuses || filter.statuses.includes(row.status)) &&
            (!filter.workItemId || row.workItemId === filter.workItemId),
        ),
      ),
      listByIds: vi.fn(async ({ ids }) => items.filter(row => ids.includes(row.id))),
      listDecisionsForEvaluations: vi.fn(async () => []),
      listWorkItemSubscribers: vi.fn(async ({ workItemId }) =>
        subscriptions.filter(row => row.workItemId === workItemId),
      ),
      listSessionSubscriptions: vi.fn(async ({ factoryProjectId, sessionId }) =>
        subscriptions.filter(row => row.factoryProjectId === factoryProjectId && row.sessionId === sessionId),
      ),
    },
    comments: { listRecent: vi.fn(async () => comments) },
    audit: { list: vi.fn(async () => ({ events: audit })) },
    boards: createBoardRegistry(),
  };
  const tools = createFactoryReadTools(scope, deps) as Record<
    string,
    { execute: (input: unknown, context: unknown) => Promise<unknown> }
  >;
  const run = <T>(name: string, input: unknown) => tools[name]!.execute(input, {}) as Promise<T>;
  return { deps, run };
}

type ListResult = {
  counts: { total: number; byStage: Record<string, number> };
  items: Array<{ id: string; number: number | null; activeWorker: { role: string; sessionId: string } | null }>;
  truncated: boolean;
};

function follow(workItemId: string, sessionId: string, reason: WorkItemSubscription['reason']): WorkItemSubscription {
  return {
    id: `sub-${workItemId}-${sessionId}`,
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    workItemId,
    sessionId,
    threadId: `${sessionId}-thread`,
    resourceId: sessionId,
    userId: 'user-1',
    reason,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  };
}

describe('factory_list_work_items', () => {
  const rows = [
    item({ id: 'a', title: 'Fix login redirect', stages: ['triage'], metadata: { number: 12 } }),
    item({ id: 'b', title: 'Add dark mode', stages: ['execute'], createdBy: 'user-1', sessions: {} }),
    item({
      id: 'c',
      title: 'Review: dark mode',
      stages: ['review'],
      board: 'review',
      sessions: { review: { sessionId: 's-c', branch: 'b', threadId: 't-c', startedBy: 'x' } },
    }),
    item({ id: 'd', title: 'Other factory', factoryProjectId: 'project-2' }),
  ];

  it('counts every item in this Factory by stage before filtering', async () => {
    const { run } = setup({ items: rows });
    const result = await run<ListResult>('factory_list_work_items', { query: 'dark' });
    expect(result.counts).toEqual({ total: 3, byStage: { triage: 1, execute: 1, review: 1 } });
    expect(result.items.map(row => row.id)).toEqual(['c', 'b']);
  });

  it('filters by text, #number, stage, board, role, active and requestedBy', async () => {
    const { run } = setup({ items: rows, bindings: [binding('b', 'work'), binding('c', 'review', 'revoked')] });
    const ids = async (input: object) => (await run<ListResult>('factory_list_work_items', input)).items.map(r => r.id);
    expect(await ids({ query: 'LOGIN' })).toEqual(['a']);
    expect(await ids({ query: '#12' })).toEqual(['a']);
    expect(await ids({ stage: 'execute' })).toEqual(['b']);
    expect(await ids({ board: 'review' })).toEqual(['c']);
    expect(await ids({ board: 'work' })).toEqual(['b', 'a']);
    expect(await ids({ role: 'review' })).toEqual(['c']);
    expect(await ids({ active: true })).toEqual(['b']);
    expect(await ids({ active: false })).toEqual(['c', 'a']);
    expect(await ids({ requestedBy: 'me' })).toEqual(['b']);
  });

  it('filters by what this session follows', async () => {
    const { run } = setup({
      items: rows,
      subscriptions: [follow('a', 'session-1', 'created'), follow('c', 'session-other', 'subscribed')],
    });
    const ids = async (input: object) => (await run<ListResult>('factory_list_work_items', input)).items.map(r => r.id);
    expect(await ids({ subscribed: true })).toEqual(['a']);
    expect(await ids({ subscribed: false })).toEqual(['c', 'b']);
  });

  it('reports the active worker and the card number', async () => {
    const { run } = setup({ items: rows, bindings: [binding('b', 'work')] });
    const result = await run<ListResult>('factory_list_work_items', {});
    expect(result.items.find(row => row.id === 'b')?.activeWorker).toEqual({ role: 'work', sessionId: 'session-b' });
    expect(result.items.find(row => row.id === 'a')?.number).toBe(12);
  });

  it('defaults to 25 rows, caps at 50 and flags truncation', async () => {
    const many = Array.from({ length: 60 }, (_, index) => item({ id: `m${index}` }));
    const { run } = setup({ items: many });
    const byDefault = await run<ListResult>('factory_list_work_items', {});
    expect(byDefault.items).toHaveLength(25);
    expect(byDefault.truncated).toBe(true);
    const max = await run<ListResult>('factory_list_work_items', { limit: 50 });
    expect(max.items).toHaveLength(50);
    expect(max.truncated).toBe(true);
  });

  it('rejects a limit above 50', () => {
    const { deps } = setup({});
    const tool = createFactoryReadTools(scope, deps).factory_list_work_items as {
      inputSchema: { safeParse(input: unknown): { success: boolean } };
    };
    expect(tool.inputSchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('truncates long titles', async () => {
    const { run } = setup({ items: [item({ id: 'long', title: 'x'.repeat(2000) })] });
    const result = await run<{ items: Array<{ title: string }> }>('factory_list_work_items', {});
    expect(result.items[0]!.title).toHaveLength(MAX_TEXT);
    expect(result.items[0]!.title.endsWith('…')).toBe(true);
  });
});

const TARGET = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const FOREIGN = 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f';

describe('factory_inspect_work_item', () => {
  const target = item({
    id: TARGET,
    stages: ['execute'],
    metadata: { number: 7, labels: ['bug', 3, 'ui'] },
    stageHistory: [{ stage: 'intake', enteredAt: '2026-10-01T00:00:00Z', exitedAt: '2026-10-02T00:00:00Z', by: 'u' }],
    sessions: { work: { sessionId: `session-${TARGET}`, branch: 'b', threadId: 't', startedBy: 'user-1' } },
  });
  const child = item({ id: 'child', parentWorkItemId: TARGET });
  const foreign = item({ id: FOREIGN, factoryProjectId: 'project-2', metadata: { number: 8 } });

  it('inspects by id and by #number', async () => {
    const { run } = setup({
      items: [target, child, foreign],
      bindings: [binding(TARGET, 'work')],
      decisions: [
        decision({ id: 'd1', workItemId: TARGET, lastError: 'e'.repeat(1000), failureCode: 'session_unavailable' }),
      ],
      comments: [{ id: 'c1', kind: 'comment', body: 'b'.repeat(1000), author: { type: 'human', id: 'u' } } as never],
      audit: [
        {
          id: 'a1',
          action: 'factory.work_item.created',
          actorId: 'user-1',
          actorType: 'human',
          targets: [{ type: 'work_item', id: TARGET }],
          occurredAt: new Date(),
        } as never,
        { id: 'a2', action: 'other', targets: [{ type: 'work_item', id: 'child' }], occurredAt: new Date() } as never,
      ],
    });
    const byId = await run<Record<string, unknown>>('factory_inspect_work_item', { workItem: TARGET });
    const byNumber = await run<Record<string, unknown>>('factory_inspect_work_item', { workItem: '#7' });
    expect(byNumber).toEqual(byId);
    expect(byId).toMatchObject({
      item: { id: TARGET, number: 7, stage: 'execute', activeWorker: { role: 'work', sessionId: `session-${TARGET}` } },
      labels: ['bug', 'ui'],
      sessions: [{ role: 'work', sessionId: `session-${TARGET}`, active: true }],
      decisions: [{ id: 'd1', canRetry: true, failureCode: 'session_unavailable' }],
      audit: [{ action: 'factory.work_item.created' }],
      children: [{ id: 'child' }],
      parent: null,
    });
    const decisions = byId.decisions as Array<{ error: string }>;
    expect(decisions[0]!.error).toHaveLength(MAX_ERROR);
    expect((byId.feed as Array<{ body: string }>)[0]!.body).toHaveLength(MAX_TEXT);
  });

  it('shows whether each session is mid-run and when its thread last moved (#27742)', async () => {
    const { run, deps } = setup({ items: [target], bindings: [binding(TARGET, 'work')] });
    const lastMoved = new Date('2026-10-20T01:38:00Z');
    deps.messaging = async () => ({
      controller: {
        getSessionByResource: async (sessionId: string) =>
          sessionId === `session-${TARGET}` ? { stream: { isActive: () => true } } : undefined,
        queryThreadById: async ({ threadId }: { threadId: string }) =>
          threadId === 't' ? { id: 't', updatedAt: lastMoved } : null,
      } as never,
    });
    const result = await run<{ sessions: unknown[] }>('factory_inspect_work_item', { workItem: TARGET });
    expect(result.sessions).toEqual([
      expect.objectContaining({ role: 'work', active: true, running: true, lastActivityAt: lastMoved.toISOString() }),
    ]);
  });

  it('lists the sessions following the item and marks the caller', async () => {
    const { run } = setup({
      items: [target],
      subscriptions: [follow(TARGET, 'session-1', 'created'), follow(TARGET, 'session-2', 'subscribed')],
    });
    const result = await run<{ subscribers: unknown[] }>('factory_inspect_work_item', { workItem: TARGET });
    expect(result.subscribers).toEqual([
      { sessionId: 'session-1', reason: 'created', isCaller: true },
      { sessionId: 'session-2', reason: 'subscribed', isCaller: false },
    ]);
  });

  it('refuses an item from another Factory', async () => {
    const { run } = setup({ items: [target, foreign] });
    await expect(run('factory_inspect_work_item', { workItem: FOREIGN })).rejects.toThrow(
      `No work item ${FOREIGN} was found in this Factory.`,
    );
    await expect(run('factory_inspect_work_item', { workItem: '#8' })).rejects.toThrow('in this Factory');
  });

  it('rejects a ref that is neither a UUID nor a number before it reaches storage', async () => {
    const { run, deps } = setup({ items: [target] });
    await expect(run('factory_inspect_work_item', { workItem: 'not-an-id' })).resolves.toMatchObject({ error: true });
    expect(deps.workItems.getForProject).not.toHaveBeenCalled();
  });
});

describe('factory_list_attention', () => {
  it('groups failed decisions by failure, lists proposals and held items', async () => {
    const items = [
      item({ id: 'x', metadata: { number: 1 } }),
      item({ id: 'y' }),
      item({ id: 'held', stages: ['triage'], triageType: 'feature' }),
      item({ id: 'bug', stages: ['triage'], triageType: 'bug' }),
      item({ id: 'accepted', stages: ['triage'], triageType: 'feature', acceptedAt: new Date() }),
    ];
    const { run } = setup({
      items,
      decisions: [
        decision({ id: 'f1', workItemId: 'x', failureCode: 'session_unavailable', lastError: 'boom' }),
        decision({ id: 'f2', workItemId: 'y', failureCode: 'session_unavailable', lastError: 'boom' }),
        decision({ id: 'f3', workItemId: 'y', failureCode: 'run_overdue', lastError: 'slow' }),
        decision({ id: 'p1', workItemId: 'x', status: 'proposed' }),
        decision({ id: 'ok', workItemId: 'x', status: 'succeeded' }),
      ],
    });
    const result = await run<{
      incidents: Array<{ failureCode: string; count: number; decisions: Array<{ id: string; canRetry: boolean }> }>;
      proposals: Array<{ id: string; number: number | null }>;
      held: Array<{ workItemId: string }>;
      truncated: boolean;
    }>('factory_list_attention', {});
    expect(result.incidents.map(group => [group.failureCode, group.count])).toEqual([
      ['session_unavailable', 2],
      ['run_overdue', 1],
    ]);
    expect(result.incidents[0]!.decisions.map(row => row.canRetry)).toEqual([true, true]);
    expect(result.incidents[1]!.decisions[0]!.canRetry).toBe(false);
    expect(result.proposals).toMatchObject([{ id: 'p1', number: 1 }]);
    expect(result.held.map(row => row.workItemId)).toEqual(['held']);
    expect(result.truncated).toBe(false);
  });

  it('flags truncation when incidents are cut by the limit', async () => {
    const { run } = setup({
      items: [item({ id: 'x' })],
      decisions: [
        decision({ id: 'f1', workItemId: 'x', failureCode: 'session_unavailable', lastError: 'a' }),
        decision({ id: 'f2', workItemId: 'x', failureCode: 'run_overdue', lastError: 'b' }),
      ],
    });
    const result = await run<{ incidents: unknown[]; truncated: boolean }>('factory_list_attention', { limit: 1 });
    expect(result.incidents).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it('flags truncation when one incident has more decisions than the limit', async () => {
    const { run } = setup({
      items: [item({ id: 'x' })],
      decisions: [
        decision({ id: 'f1', workItemId: 'x', failureCode: 'session_unavailable', lastError: 'a' }),
        decision({ id: 'f2', workItemId: 'x', failureCode: 'session_unavailable', lastError: 'a' }),
      ],
    });
    const result = await run<{
      incidents: Array<{ count: number; decisions: unknown[] }>;
      truncated: boolean;
    }>('factory_list_attention', { limit: 1 });
    expect(result.incidents).toMatchObject([{ count: 2 }]);
    expect(result.incidents[0]!.decisions).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });
});
