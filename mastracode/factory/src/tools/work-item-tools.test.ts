import { EventEmitterPubSub } from '@mastra/core/events';
import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { feedTopic } from '../feed-events.js';
import { fakeRouteAuth } from '../routes/test-utils.js';
import type { FactoryTransitionService } from '../rules/transition-service.js';
import { CommentsDomain } from '../storage/domains/comments/domain.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
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

const DECISION_ID = '7b1d2c3e-4f50-4a61-8b72-9c83d4e5f601';
const FOREIGN_DECISION_ID = '0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b';

async function setup({
  transition,
  feed,
  actorProfile,
  interactive = true,
}: {
  interactive?: boolean;
  transition?: Transition;
  feed?: Pick<CommentsDomain, 'createComment'>;
  actorProfile?: FactoryToolScope['actorProfile'];
} = {}) {
  const seed = await createFactoryStorageForTests();
  const pubsub = new EventEmitterPubSub();
  const publish = vi.spyOn(pubsub, 'publish');
  const commentsDomain = new CommentsDomain({
    auth: fakeRouteAuth(),
    comments: seed.comments,
    workItems: seed.workItems,
    projects: seed.projects,
    pubsub,
  });
  const boards = createBoardRegistry();
  // Two linked repositories, so a card that names neither is ambiguous. Only
  // the reads the repository check makes are stubbed.
  const linked = [
    { id: 'link-1', repositoryId: 'repo-1', externalId: '2', slug: 'mastra-ai/mastra' },
    { id: 'link-2', repositoryId: 'repo-2', externalId: '3', slug: 'mastra-ai/platform' },
  ];
  const sourceControl = {
    integrationId: 'github',
    connections: {
      list: async () => [{ id: 'connection-1', integrationId: 'github' }],
    },
    projectRepositories: {
      list: async () => linked.map(({ id, repositoryId }) => ({ id, repositoryId, inEnvironment: true })),
    },
    repositories: {
      get: async ({ id }: { id: string }) => {
        const link = linked.find(candidate => candidate.repositoryId === id);
        return link ? { id, externalId: link.externalId, slug: link.slug } : null;
      },
    },
  } as unknown as SourceControlStorageHandle;
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
  const tools = createFactoryWorkItemTools(
    { ...scope, interactive, ...(actorProfile ? { actorProfile } : {}) },
    {
      workItems: seed.workItems,
      boards,
      transitionService,
      auditRecorder,
      feed: feed ?? commentsDomain,
      sessions: { getSourceControlBySessionId: async () => sourceControl },
    },
  ) as Record<string, { requireApproval?: boolean; execute: (input: unknown, context: unknown) => Promise<unknown> }>;
  const run = <T>(name: string, input: unknown) => tools[name]!.execute(input, {}) as Promise<T>;
  const fileItem = (factoryProjectId: string, title: string) =>
    seed.workItems.upsert({
      orgId: 'org-1',
      userId: 'someone-else',
      factoryProjectId,
      input: { title, stages: ['intake'], metadata: {} },
    });
  return { ...seed, boards, tools, run, transitionService, auditRecorder, fileItem, publish };
}

function failedDecision(overrides: Partial<FactoryDeferredDecisionRecord> = {}): FactoryDeferredDecisionRecord {
  const now = new Date();
  return {
    id: DECISION_ID,
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
  it('stamps the caller’s name and avatar on what it records, so the board can show who filed and moved it', async () => {
    const actorProfile = { name: 'Caleb', avatarUrl: 'https://example.com/caleb.png' };
    const { run, transitionService, auditRecorder } = await setup({ actorProfile });

    const created = await run<{ id: string }>('factory_create_work_item', {
      title: 'Fix the login redirect',
      brief: 'Users land on /404.',
    });
    await run('factory_transition_work_item', { workItem: created.id, stage: 'triage' });

    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'factory.work_item.created', actorId: 'user-1', actorProfile }),
    );
    for (const [request] of vi.mocked(transitionService.transition).mock.calls) {
      expect(request).toMatchObject({ actor: { type: 'human', id: 'user-1' }, actorProfile });
    }
    expect(transitionService.transition).toHaveBeenCalledTimes(2);
  });

  it("files the item as the caller in the board's first phase, posts the brief and follows it", async () => {
    const { run, workItems, comments, transitionService, auditRecorder, publish } = await setup();

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
    // Through the comments domain: open boards get a feed touch for the new card.
    expect(publish).toHaveBeenCalledWith(
      feedTopic('org-1', 'project-1'),
      expect.objectContaining({ type: 'factory.feed.touched', data: { workItemId: created.id } }),
    );
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

  it('reports the item with a warning instead of failing when the brief cannot be posted', async () => {
    const { run, workItems } = await setup({
      feed: { createComment: vi.fn(async () => Promise.reject(new Error('feed is down'))) },
    });

    const created = await run<{ id: string; warnings?: string[] }>('factory_create_work_item', {
      title: 'Card that exists anyway',
      brief: 'Brief that fails to post.',
    });

    expect(created.warnings).toEqual(['The brief was not posted: feed is down']);
    await expect(workItems.getForProject('org-1', 'project-1', created.id)).resolves.not.toBeNull();
    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: created.id })).toEqual([
      expect.objectContaining({ sessionId: 'session-1', reason: 'created' }),
    ]);
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

describe('repositories', () => {
  it('files the item in the repository it names, so its runs know where to work', async () => {
    const { run, workItems } = await setup();

    const created = await run<{ id: string }>('factory_create_work_item', {
      title: 'Fix the login redirect',
      brief: 'Users land on /404 after signing in.',
      repository: 'mastra-ai/platform',
    });

    const item = await workItems.getForProject('org-1', 'project-1', created.id);
    expect(item!.metadata).toMatchObject({ repository: 'mastra-ai/platform' });
  });

  it('refuses a repository the Factory does not link, before filing anything', async () => {
    const { run, workItems } = await setup();

    await expect(
      run('factory_create_work_item', { title: 'x', brief: 'y', repository: 'someone/else' }),
    ).rejects.toThrow(
      'someone/else is not linked to this Factory. Linked repositories: mastra-ai/mastra, mastra-ai/platform.',
    );
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: 'project-1' })).toEqual([]);
  });
});

describe('factory_update_work_item', () => {
  it("sets a card's repository, title and parent as the caller and audits the fields", async () => {
    const { run, workItems, fileItem, auditRecorder } = await setup();
    const { item } = await fileItem('project-1', 'Old title');
    const { item: parent } = await fileItem('project-1', 'Epic');

    const result = await run('factory_update_work_item', {
      workItem: item.id,
      title: 'New title',
      repository: 'mastra-ai/mastra',
      parentWorkItem: parent.id,
    });

    expect(result).toMatchObject({
      workItem: { id: item.id, title: 'New title' },
      updated: ['title', 'repository', 'parentWorkItemId'],
      repository: 'mastra-ai/mastra',
      parentWorkItemId: parent.id,
      plansPreapproved: false,
    });
    const stored = await workItems.getForProject('org-1', 'project-1', item.id);
    expect(stored).toMatchObject({ title: 'New title', parentWorkItemId: parent.id, stages: item.stages });
    expect(stored!.metadata).toMatchObject({ repository: 'mastra-ai/mastra' });
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'factory.work_item.updated',
        actorId: 'user-1',
        actorType: 'human',
        targets: [{ type: 'work_item', id: item.id, name: 'New title' }],
        metadata: { fields: ['title', 'metadata', 'parentWorkItemId'], cause: 'factory_tools' },
      }),
    );
  });

  it('keeps the rest of the metadata when it sets the repository', async () => {
    const { run, workItems, fileItem } = await setup();
    const { item } = await fileItem('project-1', 'Card');
    await workItems.update({ orgId: 'org-1', id: item.id, userId: 'user-1', patch: { metadata: { note: 'keep' } } });

    await run('factory_update_work_item', { workItem: item.id, repository: 'mastra-ai/platform' });

    const stored = await workItems.getForProject('org-1', 'project-1', item.id);
    expect(stored!.metadata).toMatchObject({ note: 'keep', repository: 'mastra-ai/platform' });
  });

  it('refuses a repository the Factory does not link and leaves the card alone', async () => {
    const { run, workItems, fileItem } = await setup();
    const { item } = await fileItem('project-1', 'Card');

    await expect(run('factory_update_work_item', { workItem: item.id, repository: 'someone/else' })).rejects.toThrow(
      'someone/else is not linked to this Factory. Linked repositories: mastra-ai/mastra, mastra-ai/platform.',
    );
    expect((await workItems.getForProject('org-1', 'project-1', item.id))!.metadata).toEqual({});
  });

  it("refuses to repoint a card synced from an issue, which follows the issue's repository", async () => {
    const { run, workItems, fileItem } = await setup();
    const { item } = await fileItem('project-1', 'Issue card');
    await workItems.update({
      orgId: 'org-1',
      id: item.id,
      userId: 'user-1',
      patch: { metadata: { githubRepositoryId: '2', repository: 'mastra-ai/mastra' } },
    });

    await expect(
      run('factory_update_work_item', { workItem: item.id, repository: 'mastra-ai/platform' }),
    ).rejects.toThrow("This card runs in mastra-ai/mastra, which comes from its linked issue and can't be changed.");
  });

  it('detaches a card from its parent and pre-approves its plans', async () => {
    const { run, workItems, fileItem } = await setup();
    const { item: parent } = await fileItem('project-1', 'Epic');
    const { item } = await fileItem('project-1', 'Child');
    await workItems.update({ orgId: 'org-1', id: item.id, userId: 'user-1', patch: { parentWorkItemId: parent.id } });

    const result = await run('factory_update_work_item', {
      workItem: item.id,
      parentWorkItem: null,
      plansPreapproved: true,
    });

    expect(result).toMatchObject({ parentWorkItemId: null, plansPreapproved: true });
  });

  it('refuses a parent from another Factory and a card that would be its own ancestor', async () => {
    const { run, workItems, fileItem } = await setup();
    const { item: foreign } = await fileItem('project-2', 'Elsewhere');
    const { item: parent } = await fileItem('project-1', 'Epic');
    const { item: child } = await fileItem('project-1', 'Child');
    await workItems.update({ orgId: 'org-1', id: child.id, userId: 'user-1', patch: { parentWorkItemId: parent.id } });

    await expect(run('factory_update_work_item', { workItem: child.id, parentWorkItem: foreign.id })).rejects.toThrow(
      'was found in this Factory',
    );
    await expect(run('factory_update_work_item', { workItem: parent.id, parentWorkItem: child.id })).rejects.toThrow(
      'The parent was refused',
    );
  });

  it('takes no stage, board or sessions, and needs at least one field', async () => {
    const { tools, fileItem } = await setup();
    const { item } = await fileItem('project-1', 'Card');
    const schema = (
      tools.factory_update_work_item as unknown as { inputSchema: { safeParse: (v: unknown) => { success: boolean } } }
    ).inputSchema;

    expect(schema.safeParse({ workItem: item.id }).success).toBe(false);
    expect(schema.safeParse({ workItem: item.id, stage: 'done' }).success).toBe(false);
    expect(schema.safeParse({ workItem: item.id, board: 'work' }).success).toBe(false);
    expect(schema.safeParse({ workItem: item.id, sessions: {} }).success).toBe(false);
    expect(schema.safeParse({ workItem: item.id, title: 'ok' }).success).toBe(true);
  });
});

describe('approval', () => {
  it('never asks before running a work-item tool', async () => {
    const { tools } = await setup();
    const flags = Object.fromEntries(
      Object.entries(tools).map(([name, tool]) => [name, tool.requireApproval === true]),
    );
    expect(flags).toEqual({
      factory_create_work_item: false,
      factory_update_work_item: false,
      factory_transition_work_item: false,
      factory_retry_decision: false,
      factory_dismiss_decision: false,
      factory_resolve_proposal: false,
      factory_subscribe_work_item: false,
      factory_unsubscribe_work_item: false,
    });
  });

  it('allow-lists every user-session tool, so none of them asks', () => {
    expect([...FACTORY_TOOLS_WITHOUT_APPROVAL].sort()).toEqual(
      [
        'factory_list_work_items',
        'factory_inspect_work_item',
        'factory_list_attention',
        'factory_create_work_item',
        'factory_update_work_item',
        'factory_transition_work_item',
        'factory_retry_decision',
        'factory_dismiss_decision',
        'factory_resolve_proposal',
        'factory_subscribe_work_item',
        'factory_unsubscribe_work_item',
        'factory_signal_session',
        'factory_message_origin',
        'factory_start_session',
        'factory_answer_approval',
        'factory_switch_session_model',
        'factory_list_side_sessions',
        'factory_subscribe_session',
        'factory_unsubscribe_session',
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
  it('rejects a decision id that is not a UUID before it reaches storage', async () => {
    const { run, workItems } = await setup();
    const getDeferredDecision = vi.spyOn(workItems, 'getDeferredDecision');
    await expect(run('factory_retry_decision', { decisionId: 'decision-1' })).resolves.toMatchObject({ error: true });
    expect(getDeferredDecision).not.toHaveBeenCalled();
  });

  it('refuses to retry a decision that is not a retryable failure', async () => {
    const { run, workItems } = await setup();
    vi.spyOn(workItems, 'getDeferredDecision').mockResolvedValue(failedDecision({ status: 'succeeded' }));
    const retry = vi.spyOn(workItems, 'retryDeferredDecision');
    await expect(run('factory_retry_decision', { decisionId: DECISION_ID })).rejects.toThrow('not a retryable failure');
    expect(retry).not.toHaveBeenCalled();
  });

  it('refuses to retry a run the item has moved on from', async () => {
    const { run, workItems } = await setup();
    // The decided-for item no longer exists, which counts as overtaken.
    vi.spyOn(workItems, 'getDeferredDecision').mockResolvedValue(failedDecision());
    const retry = vi.spyOn(workItems, 'retryDeferredDecision');
    await expect(run('factory_retry_decision', { decisionId: DECISION_ID })).rejects.toThrow('moved on');
    expect(retry).not.toHaveBeenCalled();
  });

  it('retries a retryable failure', async () => {
    const { run, workItems, fileItem } = await setup();
    const { item } = await fileItem('project-1', 'Retry me');
    vi.spyOn(workItems, 'getDeferredDecision').mockResolvedValue(failedDecision({ workItemId: item.id }));
    vi.spyOn(workItems, 'retryDeferredDecision').mockResolvedValue(
      failedDecision({ workItemId: item.id, status: 'retry' }),
    );
    await expect(run('factory_retry_decision', { decisionId: DECISION_ID })).resolves.toEqual({
      decisionId: DECISION_ID,
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

    await run('factory_resolve_proposal', { decisionId: DECISION_ID, action: 'approve' });
    await run('factory_dismiss_decision', { decisionId: DECISION_ID });

    expect(approve).toHaveBeenCalledWith('org-1', 'project-1', DECISION_ID, expect.any(Date), 'user-1');
    expect(dismiss).toHaveBeenCalledWith('org-1', 'project-1', DECISION_ID, expect.any(Date));
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
    await expect(run('factory_retry_decision', { decisionId: FOREIGN_DECISION_ID })).rejects.toThrow(
      'belongs to another Factory',
    );
    await expect(run('factory_dismiss_decision', { decisionId: FOREIGN_DECISION_ID })).rejects.toThrow(
      'belongs to another Factory',
    );
    await expect(
      run('factory_resolve_proposal', { decisionId: FOREIGN_DECISION_ID, action: 'approve' }),
    ).rejects.toThrow('belongs to another Factory');
  });
});

describe('on a turn nobody signed in started', () => {
  it("moves the item as this session's agent, so the plan and done gates apply and nothing is armed", async () => {
    const { run, fileItem, transitionService } = await setup({ interactive: false });
    const { item } = await fileItem('project-1', 'Move me');

    await run('factory_transition_work_item', { workItem: item.id, stage: 'triage' });

    expect(transitionService.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { type: 'agent', bindingId: 'session:session-1', role: 'session' },
        ingress: expect.objectContaining({ type: 'agent', identity: expect.stringMatching(/^session:session-1:/) }),
      }),
    );
  });

  it('edits a card, audited as the session rather than the person', async () => {
    const { run, fileItem, auditRecorder } = await setup({ interactive: false });
    const { item } = await fileItem('project-1', 'Rename me');

    await expect(run('factory_update_work_item', { workItem: item.id, title: 'Renamed' })).resolves.toMatchObject({
      workItem: { title: 'Renamed' },
      updated: ['title'],
    });
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'agent:session:session-1', actorType: 'agent' }),
    );
  });

  it('refuses to pre-approve plans, approve or dismiss proposals, and changes nothing', async () => {
    const { run, workItems, fileItem, auditRecorder } = await setup({ interactive: false });
    const { item } = await fileItem('project-1', 'Keep my gate');
    const approve = vi.spyOn(workItems, 'approveDeferredDecision');
    const dismiss = vi.spyOn(workItems, 'dismissDeferredDecision');

    await expect(run('factory_update_work_item', { workItem: item.id, plansPreapproved: true })).rejects.toThrow(
      'Only a person can pre-approve plans',
    );
    await expect(run('factory_resolve_proposal', { decisionId: DECISION_ID, action: 'approve' })).rejects.toThrow(
      'Only a person can approve or dismiss a proposed run',
    );
    await expect(run('factory_dismiss_decision', { decisionId: DECISION_ID })).rejects.toThrow(
      'Only a person can dismiss a proposed run',
    );

    expect(approve).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
    const stored = await workItems.get({ orgId: 'org-1', id: item.id });
    expect(stored?.plansPreapprovedAt).toBeNull();
  });
});
