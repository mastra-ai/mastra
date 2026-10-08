import { RequestContext } from '@mastra/core/request-context';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi, onTestFinished } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { WorkItemsStorage, WORK_ITEMS_SCHEMA } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryPhaseStateProcessor } from './processor.js';
import { createFactoryTransitionTools } from './tools.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function requestContext(
  overrides: Partial<{
    threadId: string;
    scope: string;
    authenticated: boolean;
    modelId: string;
    thinkingLevel: 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  }> = {},
) {
  const context = new RequestContext();
  if (overrides.authenticated !== false) {
    context.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  }
  context.set('controller', {
    resourceId: 'resource-1',
    threadId: overrides.threadId ?? 'thread-1',
    scope: overrides.scope ?? '/worktree',
    state: { factoryProjectId: PROJECT_ID, thinkingLevel: overrides.thinkingLevel ?? 'high' },
    getState: () => ({ factoryProjectId: PROJECT_ID, thinkingLevel: overrides.thinkingLevel ?? 'high' }),
    session: { modelId: overrides.modelId ?? 'openai/gpt-5.6-sol', modeId: 'review' },
  });
  return context;
}

async function prepare(
  storage: WorkItemsStorage,
  role = 'work',
  sourceType: 'issue' | 'pull-request' = 'issue',
  board?: { id: string; stage: string },
) {
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        ...(board ? { board: board.id } : {}),
        externalSource: {
          integrationId: 'github',
          type: sourceType,
          externalId: sourceType === 'issue' ? 'github-issue:1' : 'github-pr:1',
          url: sourceType === 'issue' ? 'https://example.test/issues/1' : 'https://example.test/pull/1',
        },
        title: 'Improve the settings UI',
        stages: [board?.stage ?? 'planning'],
        sessions: {},
        metadata: {},
      },
    },
    role,
    session: { sessionId: 'resource-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
}

function toolMessage(
  options: {
    id?: string;
    toolCallId?: string;
    toolName?: string;
    state?: 'call' | 'result' | 'error';
    result?: unknown;
    args?: unknown;
    createdAt?: Date;
  } = {},
) {
  return {
    id: options.id ?? 'assistant-1',
    role: 'assistant' as const,
    createdAt: options.createdAt ?? new Date(),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2 as const,
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocation: {
            toolCallId: options.toolCallId ?? 'tool-call-1',
            toolName: options.toolName ?? 'submit_plan',
            args: options.args ?? {},
            state: options.state ?? 'result',
            result: options.result ?? { approved: true },
          },
        },
      ],
    },
  };
}

function inputArgs(context: RequestContext, messages: unknown[]) {
  return {
    requestContext: context,
    messages,
    messageList: {},
    steps: [{ toolResults: [{ toolCallId: 'tool-call-1' }] }],
    stepNumber: 1,
    state: {},
    retryCount: 0,
    abort: () => {
      throw new Error('abort');
    },
  } as never;
}

describe('Factory plan approval recovery', () => {
  const approvedMessage = (createdAt: Date) =>
    toolMessage({
      createdAt,
      result: {
        toolId: 'submit_plan',
        content: 'Plan approved. Proceed with implementation following the approved plan.',
        submittedPlan: { action: 'approved', path: '.artifacts/plans/issue-1.md', plan: 'Plan A' },
      },
    });

  it('does not reuse Plan A approval for a new planning attempt on the same thread', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const first = await prepare(storage, 'plan');
    const boards = createBoardRegistry();
    const transitionService = new FactoryTransitionService({ configVersion: 'investigation', boards, storage });
    const oldMessage = approvedMessage(new Date(first.binding.createdAt.getTime() + 1));
    const processor = new FactoryPhaseStateProcessor({
      configVersion: 'investigation',
      boards,
      storage,
      transitionService,
      messageReader: { listMessages: async () => ({ messages: [oldMessage], hasMore: false }) } as never,
    });
    await processor.processInputStep(inputArgs(requestContext(), [oldMessage]));
    expect((await storage.get({ orgId: 'org-1', id: first.item.id }))?.stages).toEqual(['execute']);

    const item = (await storage.get({ orgId: 'org-1', id: first.item.id }))!;
    const back = await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'planning',
      expectedRevision: item.revision,
      actor: { type: 'human', id: 'user-1' },
      ingress: { type: 'human', identity: 'replan-B' },
      cause: 'Request a new plan',
    });
    expect(back.status).toBe('accepted');
    const second = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: { id: item.id, input: { title: item.title } },
      role: 'plan',
      session: { sessionId: 'resource-1', branch: 'factory/issue-1', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'replan-B',
      kickoffMessage: null,
    });
    expect(second.binding.id).not.toBe(first.binding.id);
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['planning']);
    await processor.reconcileBinding(second.binding);
    // A new planning attempt needs its own approval, even when it reuses the thread.
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['planning']);
  });

  it('ignores a late approval resumed from a tool call predating the current planning attempt', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage, 'plan');
    const boards = createBoardRegistry();
    const transitionService = new FactoryTransitionService({ configVersion: 'test', boards, storage });
    const processor = new FactoryPhaseStateProcessor({ configVersion: 'test', boards, storage, transitionService });
    const old = toolMessage({
      createdAt: new Date(prepared.binding.createdAt.getTime() - 1),
      result: {
        content: 'Plan approved. Proceed with implementation.',
        submittedPlan: { action: 'approved', plan: 'An earlier plan' },
      },
    });
    await processor.processInputStep(inputArgs(requestContext(), [old]));
    expect((await storage.get({ orgId: 'org-1', id: prepared.item.id }))?.stages).toEqual(['planning']);
    expect(await storage.listDeferredDecisions('org-1', PROJECT_ID)).toEqual([]);
  });

  it('retains approval when recovery executes the persisted transition', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage, 'plan');
    await storage.markPendingStart(prepared.binding.id, 'sent');
    const boards = createBoardRegistry();
    const transitionService = new FactoryTransitionService({ configVersion: 'investigation', boards, storage });
    const apply = vi.spyOn(transitionService, 'transition').mockRejectedValueOnce(new Error('simulated process loss'));
    const processor = new FactoryPhaseStateProcessor({
      configVersion: 'investigation',
      boards,
      storage,
      transitionService,
    });
    await expect(
      processor.processInputStep(
        inputArgs(requestContext(), [approvedMessage(new Date(prepared.binding.createdAt.getTime() + 1))]),
      ),
    ).rejects.toThrow('simulated process loss');
    apply.mockRestore();
    const [queued] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    expect(queued).toMatchObject({ status: 'pending', decision: { type: 'transition', stage: 'execute' } });

    const dispatcher = new FactoryDecisionDispatcher({
      storage,
      boards,
      transitionService,
      isAutoRunEnabled: async () => true,
      controller: { listActiveThreadRuns: () => [] } as never,
    });
    await dispatcher.runOnce(new Date());
    const [after] = await storage.listDeferredDecisions('org-1', PROJECT_ID);
    // Recovery must consume the same approval as the immediate execution path.
    expect(after).toMatchObject({ status: 'succeeded', lastError: null });
    expect((await storage.get({ orgId: 'org-1', id: prepared.item.id }))?.stages).toEqual(['execute']);
  });
});

describe('Factory plan submission migration', () => {
  it('adds the nullable submission key to an existing database without losing cards', async () => {
    const storage = new LibSQLFactoryStorage({ id: 'old-factory', url: ':memory:' });
    onTestFinished(() => storage.close());
    const columns = Object.fromEntries(
      Object.entries(WORK_ITEMS_SCHEMA.columns).filter(([name]) => name !== 'plan_submission_key'),
    );
    await storage.ensureCollections([{ ...WORK_ITEMS_SCHEMA, columns }]);
    const now = new Date();
    const old = await storage.ops.insertOne('work_items', {
      org_id: 'org-1',
      factory_project_id: PROJECT_ID,
      title: 'Existing plan',
      stages: ['planning'],
      stage_history: [],
      sessions: {},
      created_by: 'user-1',
      revision: 1,
      created_at: now,
      updated_at: now,
    });
    const workItems = storage.registerDomain(new WorkItemsStorage());
    await storage.init();
    expect(await workItems.get({ orgId: 'org-1', id: String(old.id) })).toMatchObject({
      title: 'Existing plan',
      stages: ['planning'],
      planSubmissionKey: null,
    });
  });
});

describe('Factory plan submissions', () => {
  async function setup(autoApprove = false) {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepare(storage, 'plan');
    await storage.markPendingStart(prepared.binding.id, 'sent');
    const boards = createBoardRegistry();
    const transitionService = new FactoryTransitionService({
      configVersion: 'test',
      boards,
      storage,
      autoApprovePlans: async () => autoApprove,
    });
    const context = requestContext();
    const tools = await createFactoryTransitionTools({ requestContext: context, storage, transitionService });
    const tool = tools.factory_submit_plan as {
      execute: (input: unknown, context: unknown) => Promise<unknown>;
      inputSchema: { safeParse: (input: unknown) => { success: boolean } };
    };
    const submit = async (key = 'plan-1', content = 'Implement the reviewed change.', revision?: number) => {
      const item = (await storage.get({ orgId: 'org-1', id: prepared.item.id }))!;
      return tool.execute(
        { title: 'Fix the bug', content, expectedRevision: revision ?? item.revision },
        {
          requestContext: context,
          agent: { toolCallId: key },
        },
      );
    };
    const decisions = () => storage.listDeferredDecisions('org-1', PROJECT_ID);
    const dispatcher = () =>
      new FactoryDecisionDispatcher({
        storage,
        boards,
        transitionService,
        isAutoRunEnabled: async () => true,
        autoApprovePlans: async () => autoApprove,
        controller: { listActiveThreadRuns: () => [] } as never,
      });
    return { storage, prepared, transitionService, tool, submit, decisions, dispatcher };
  }

  it('waits for approval, survives recovery, and queues the reviewed content exactly once', async () => {
    const h = await setup();
    const transition = vi.spyOn(h.transitionService, 'transition');
    const first = await h.submit();
    expect(await h.submit()).toEqual(first);
    expect(transition).not.toHaveBeenCalled();
    expect(await h.decisions()).toHaveLength(1);
    await h.dispatcher().runOnce(new Date());
    const [plan] = await h.decisions();
    expect(plan.status).toBe('proposed');
    expect((await h.storage.get({ orgId: 'org-1', id: h.prepared.item.id }))?.stages).toEqual(['planning']);
    const results = await Promise.all([
      h.storage.approveDeferredDecision('org-1', PROJECT_ID, plan.id, new Date(), 'user-1'),
      h.storage.approveDeferredDecision('org-1', PROJECT_ID, plan.id, new Date(), 'user-1'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await h.dispatcher().runOnce(new Date());
    const queued = await h.decisions();
    expect(queued.find(row => row.id === plan.id)?.status).toBe('succeeded');
    const builds = queued.filter(row => row.decision.type === 'invokeSkill');
    expect(builds).toHaveLength(1);
    expect(builds[0].decision.approvedPlan).toEqual({
      title: 'Fix the bug',
      content: 'Implement the reviewed change.',
    });
    expect((await h.storage.get({ orgId: 'org-1', id: h.prepared.item.id }))?.stages).toEqual(['execute']);
  });

  it('supersedes approval for an earlier submission in the same planning attempt', async () => {
    const h = await setup();
    await h.submit('old', 'Old plan');
    await h.dispatcher().runOnce(new Date());
    const [old] = await h.decisions();
    await h.submit('new', 'New plan');
    await h.storage.approveDeferredDecision('org-1', PROJECT_ID, old.id, new Date(), 'user-1');
    await h.dispatcher().runOnce(new Date());
    const rows = await h.decisions();
    expect(rows.find(row => row.id === old.id)?.status).toBe('superseded');
    expect(rows.find(row => row.id !== old.id)?.status).toBe('proposed');
    expect(rows.some(row => row.decision.type === 'invokeSkill')).toBe(false);
  });

  it('keeps approval valid across unrelated metadata updates', async () => {
    const h = await setup();
    await h.submit();
    await h.dispatcher().runOnce(new Date());
    const [plan] = await h.decisions();
    await h.storage.update({
      orgId: 'org-1',
      id: h.prepared.item.id,
      userId: 'user-1',
      patch: { metadata: { labels: ['docs'] } },
    });
    await h.storage.approveDeferredDecision('org-1', PROJECT_ID, plan.id, new Date(), 'user-1');
    await h.dispatcher().runOnce(new Date());
    expect((await h.storage.get({ orgId: 'org-1', id: h.prepared.item.id }))?.stages).toEqual(['execute']);
  });

  it('allows only one concurrent submission at a given revision', async () => {
    const h = await setup();
    const revision = h.prepared.item.revision;
    const attempts = await Promise.allSettled([h.submit('one', 'One', revision), h.submit('two', 'Two', revision)]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await h.decisions()).toHaveLength(1);
  });

  it('honors project plan auto-approval using the same saved transition', async () => {
    const h = await setup(true);
    await h.submit();
    await h.dispatcher().runOnce(new Date());
    expect((await h.decisions())[0].status).toBe('succeeded');
    expect((await h.storage.get({ orgId: 'org-1', id: h.prepared.item.id }))?.stages).toEqual(['execute']);
  });

  it('leaves a rejected plan in Planning without scheduling a build', async () => {
    const h = await setup();
    await h.submit();
    await h.dispatcher().runOnce(new Date());
    const [plan] = await h.decisions();
    await h.storage.dismissDeferredDecision('org-1', PROJECT_ID, plan.id, new Date());
    expect((await h.decisions())[0].status).toBe('dismissed');
    expect(await h.decisions()).toHaveLength(1);
    expect((await h.storage.get({ orgId: 'org-1', id: h.prepared.item.id }))?.stages).toEqual(['planning']);
  });

  it('does not accept agent-supplied approval or empty plan content', async () => {
    const h = await setup();
    const input = { title: 'Plan', content: 'Plan body', expectedRevision: 1 };
    expect(h.tool.inputSchema.safeParse({ ...input, approved: true }).success).toBe(false);
    expect(h.tool.inputSchema.safeParse({ ...input, content: '   ' }).success).toBe(false);
  });
});
