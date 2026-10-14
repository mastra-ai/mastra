import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import type { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FACTORY_TOOLS_WITHOUT_APPROVAL } from './permissions.js';
import type { FactoryToolScope } from './scope.js';
import { createFactoryWorkItemTools } from './work-item-tools.js';

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

type Transition = FactoryTransitionService['transition'];

async function setup({ transition }: { transition?: Transition } = {}) {
  const seed = await createFactoryStorageForTests();
  const boards = createBoardRegistry();
  const transitionService = {
    transition: vi.fn<Transition>(
      transition ??
        (async request => ({
          status: 'accepted',
          transitionId: 'transition-1',
          itemId: request.workItemId,
          revision: request.expectedRevision + 1,
          stage: request.stage,
          decisions: [],
        })),
    ),
  };
  const auditRecorder = { record: vi.fn(async () => null) };
  const tools = createFactoryWorkItemTools(scope, {
    workItems: seed.workItems,
    boards,
    transitionService,
    auditRecorder,
    comments: seed.comments,
  }) as Record<string, { requireApproval?: boolean; execute: (input: unknown, context: unknown) => Promise<unknown> }>;
  const run = <T>(name: string, input: unknown) => tools[name]!.execute(input, {}) as Promise<T>;
  const fileItem = (factoryProjectId: string, title: string) =>
    seed.workItems.upsert({
      orgId: 'org-1',
      userId: 'someone-else',
      factoryProjectId,
      input: { title, stages: ['intake'], metadata: {} },
    });
  return { ...seed, boards, tools, run, transitionService, auditRecorder, fileItem };
}

function failedDecision(overrides: Partial<FactoryDeferredDecisionRecord> = {}): FactoryDeferredDecisionRecord {
  const now = new Date();
  return {
    id: 'decision-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    evaluationId: 'evaluation-1',
    workItemId: 'missing-item',
    decision: { type: 'invokeSkill', role: 'work', skill: 'factory-execute' },
    status: 'failed',
    attempts: 1,
    failureCode: 'session_unavailable',
    lastError: 'no session',
    approvedAt: null,
    approvedBy: null,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FactoryDeferredDecisionRecord;
}

describe('factory_create_work_item', () => {
  it("files the item as the caller in the board's first phase, posts the brief and follows it", async () => {
    const { run, workItems, comments, transitionService, auditRecorder } = await setup();

    const created = await run<{ id: string; stage: string; title: string }>('factory_create_work_item', {
      title: 'Fix the login redirect',
      brief: 'Users land on /404 after signing in.',
    });

    expect(created).toMatchObject({ title: 'Fix the login redirect', stage: 'intake' });
    const item = await workItems.getForProject('org-1', 'project-1', created.id);
    expect(item).toMatchObject({ createdBy: 'user-1', board: 'work', stages: ['intake'] });
    expect(transitionService.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        workItemId: created.id,
        stage: 'intake',
        initialEntry: true,
        cause: 'work_item_created',
        actor: { type: 'human', id: 'user-1' },
      }),
    );
    const feed = await comments.listRecent({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: created.id,
      limit: 10,
    });
    expect(feed.map(comment => [comment.body, comment.author.id])).toEqual([
      ['Users land on /404 after signing in.', 'user-1'],
    ]);
    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: created.id })).toEqual([
      expect.objectContaining({ sessionId: 'session-1', threadId: 'thread-1', userId: 'user-1', reason: 'created' }),
    ]);
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        actorId: 'user-1',
        actorType: 'human',
        action: 'factory.work_item.created',
        factoryProjectId: 'project-1',
        targets: [{ type: 'work_item', id: created.id, name: 'Fix the login redirect' }],
      }),
    );
  });

  it('removes the item again when the first phase refuses it', async () => {
    const { run, workItems, auditRecorder } = await setup({
      transition: async request => ({
        status: 'rejected',
        transitionId: 'transition-1',
        itemId: request.workItemId,
        code: 'rule_rejected',
        reason: 'Intake is closed.',
      }),
    });

    await expect(run('factory_create_work_item', { title: 'Nope', brief: 'x' })).rejects.toThrow('Intake is closed.');
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: 'project-1' })).toEqual([]);
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it('takes no stage or board: every item enters through the first phase', async () => {
    const { tools } = await setup();
    const schema = (
      tools.factory_create_work_item as unknown as {
        inputSchema: { safeParse(input: unknown): { success: boolean } };
      }
    ).inputSchema;
    expect(schema.safeParse({ title: 't', brief: 'b' }).success).toBe(true);
    expect(schema.safeParse({ title: 't', brief: 'b', stage: 'execute' }).success).toBe(false);
    expect(schema.safeParse({ title: 't', brief: 'b', board: 'review' }).success).toBe(false);
  });
});

describe('approval', () => {
  it('asks before moving or settling, and not before filing or following', async () => {
    const { tools } = await setup();
    const flags = Object.fromEntries(
      Object.entries(tools).map(([name, tool]) => [name, tool.requireApproval === true]),
    );
    expect(flags).toEqual({
      factory_create_work_item: false,
      factory_transition_work_item: true,
      factory_retry_decision: true,
      factory_dismiss_decision: true,
      factory_resolve_proposal: true,
      factory_subscribe_work_item: false,
      factory_unsubscribe_work_item: false,
    });
  });

  it('allow-lists the read tools, filing and following, and none of the gated tools', () => {
    expect([...FACTORY_TOOLS_WITHOUT_APPROVAL].sort()).toEqual(
      [
        'factory_list_work_items',
        'factory_inspect_work_item',
        'factory_list_attention',
        'factory_create_work_item',
        'factory_subscribe_work_item',
        'factory_unsubscribe_work_item',
      ].sort(),
    );
  });
});

describe('factory_transition_work_item', () => {
  it("moves the item on its board as the caller, from the item's current revision", async () => {
    const { run, fileItem, transitionService } = await setup();
    const { item } = await fileItem('project-1', 'Move me');

    const result = await run('factory_transition_work_item', { workItem: item.id, stage: 'triage' });

    expect(result).toEqual({ workItemId: item.id, stage: 'triage', revision: item.revision + 1 });
    expect(transitionService.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItemId: item.id,
        board: 'work',
        stage: 'triage',
        expectedRevision: item.revision,
        actor: { type: 'human', id: 'user-1' },
        cause: 'factory_tools',
        ingress: expect.objectContaining({ type: 'human', identity: expect.stringMatching(/^human:user-1:/) }),
      }),
    );
  });

  it("returns the board's refusal as an error", async () => {
    const { run, fileItem } = await setup({
      transition: async request => ({
        status: 'rejected',
        transitionId: 't',
        itemId: request.workItemId,
        code: 'stale',
        reason: 'The item changed.',
      }),
    });
    const { item } = await fileItem('project-1', 'Stale');
    await expect(run('factory_transition_work_item', { workItem: item.id, stage: 'triage' })).rejects.toThrow(
      'The move was refused (stale): The item changed.',
    );
  });
});

describe('decisions', () => {
  it('refuses to retry a decision that is not a retryable failure', async () => {
    const { run, workItems } = await setup();
    vi.spyOn(workItems, 'getDeferredDecision').mockResolvedValue(failedDecision({ status: 'succeeded' }));
    const retry = vi.spyOn(workItems, 'retryDeferredDecision');
    await expect(run('factory_retry_decision', { decisionId: 'decision-1' })).rejects.toThrow(
      'not a retryable failure',
    );
    expect(retry).not.toHaveBeenCalled();
  });

  it('refuses to retry a run the item has moved on from', async () => {
    const { run, workItems } = await setup();
    // The decided-for item no longer exists, which counts as overtaken.
    vi.spyOn(workItems, 'getDeferredDecision').mockResolvedValue(failedDecision());
    const retry = vi.spyOn(workItems, 'retryDeferredDecision');
    await expect(run('factory_retry_decision', { decisionId: 'decision-1' })).rejects.toThrow('moved on');
    expect(retry).not.toHaveBeenCalled();
  });

  it('retries a retryable failure', async () => {
    const { run, workItems, fileItem } = await setup();
    const { item } = await fileItem('project-1', 'Retry me');
    vi.spyOn(workItems, 'getDeferredDecision').mockResolvedValue(failedDecision({ workItemId: item.id }));
    vi.spyOn(workItems, 'retryDeferredDecision').mockResolvedValue(
      failedDecision({ workItemId: item.id, status: 'retry' }),
    );
    await expect(run('factory_retry_decision', { decisionId: 'decision-1' })).resolves.toEqual({
      decisionId: 'decision-1',
      status: 'retry',
      workItemId: item.id,
    });
  });

  it('approves and dismisses proposals as the caller, audited as consent', async () => {
    const { run, workItems, auditRecorder } = await setup();
    const approve = vi
      .spyOn(workItems, 'approveDeferredDecision')
      .mockResolvedValue(failedDecision({ status: 'pending', workItemId: 'item-1' }));
    const dismiss = vi
      .spyOn(workItems, 'dismissDeferredDecision')
      .mockResolvedValue(failedDecision({ status: 'dismissed', workItemId: 'item-1' }));

    await run('factory_resolve_proposal', { decisionId: 'decision-1', action: 'approve' });
    await run('factory_dismiss_decision', { decisionId: 'decision-1' });

    expect(approve).toHaveBeenCalledWith('org-1', 'project-1', 'decision-1', expect.any(Date), 'user-1');
    expect(dismiss).toHaveBeenCalledWith('org-1', 'project-1', 'decision-1', expect.any(Date));
    expect(auditRecorder.record.mock.calls.map(([input]) => (input as { action: string }).action)).toEqual([
      'factory.run.approved',
      'factory.run.dismissed',
    ]);
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        actorType: 'human',
        targets: [{ type: 'work_item', id: 'item-1' }],
      }),
    );
  });
});

describe('subscriptions', () => {
  it('follows and stops following an item', async () => {
    const { run, fileItem, workItems } = await setup();
    const { item } = await fileItem('project-1', 'Follow me');

    await expect(run('factory_subscribe_work_item', { workItem: item.id })).resolves.toMatchObject({
      subscribed: true,
      reason: 'subscribed',
    });
    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: item.id })).toEqual([
      expect.objectContaining({ sessionId: 'session-1', reason: 'subscribed' }),
    ]);

    await expect(run('factory_unsubscribe_work_item', { workItem: item.id })).resolves.toMatchObject({
      subscribed: false,
      wasSubscribed: true,
    });
    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: item.id })).toEqual([]);
  });

  it('keeps "created" when a session subscribes to an item it filed', async () => {
    const { run } = await setup();
    const created = await run<{ id: string }>('factory_create_work_item', { title: 'Mine', brief: 'b' });
    await expect(run('factory_subscribe_work_item', { workItem: created.id })).resolves.toMatchObject({
      reason: 'created',
    });
  });
});

describe('another Factory', () => {
  it('is out of reach for every tool', async () => {
    const { run, fileItem, workItems, transitionService } = await setup();
    const { item: foreign } = await fileItem('project-2', 'Not yours');
    const notFound = `No work item ${foreign.id} was found in this Factory.`;

    await expect(run('factory_transition_work_item', { workItem: foreign.id, stage: 'triage' })).rejects.toThrow(
      notFound,
    );
    await expect(run('factory_subscribe_work_item', { workItem: foreign.id })).rejects.toThrow(notFound);
    await expect(run('factory_unsubscribe_work_item', { workItem: foreign.id })).rejects.toThrow(notFound);
    expect(transitionService.transition).not.toHaveBeenCalled();
    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: foreign.id })).toEqual([]);

    // Decisions are looked up within this Factory only; another Factory's id reads as missing.
    await expect(run('factory_retry_decision', { decisionId: 'foreign-decision' })).rejects.toThrow(
      'belongs to another Factory',
    );
    await expect(run('factory_dismiss_decision', { decisionId: 'foreign-decision' })).rejects.toThrow(
      'belongs to another Factory',
    );
    await expect(
      run('factory_resolve_proposal', { decisionId: 'foreign-decision', action: 'approve' }),
    ).rejects.toThrow('belongs to another Factory');
  });
});
