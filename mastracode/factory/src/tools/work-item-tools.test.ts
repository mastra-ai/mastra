import assert from 'node:assert';

import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { DispatcherBoardEngine } from '../board-engine/engine.js';
import { createBoardRegistry } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { boardRegistryOf } from '../boards/registry.js';
import { compileStoredBoard } from '../boards/stored-board.js';
import { workSeedWithTriage } from '../boards/work-seeds.js';
import { workBoard } from '../boards/work.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FACTORY_TOOLS_WITHOUT_APPROVAL } from './permissions.js';
import { createFactoryReadTools } from './read-tools.js';
import { workItemReportRecipients } from './reports.js';
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
  actorProfile,
  interactive = true,
  intakeOrder = false,
  boards = createBoardRegistry(),
}: {
  boards?: BoardRegistry;
  interactive?: boolean;
  /** Files by intake order over the project's stored rules, which start out empty. */
  intakeOrder?: boolean;
  transition?: Transition;
  actorProfile?: FactoryToolScope['actorProfile'];
} = {}) {
  const seed = await createFactoryStorageForTests();
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
      boardEngine: { requestMove: transitionService.transition },
      auditRecorder,
      sessions: { getSourceControlBySessionId: async () => sourceControl },
      // Without intake rules to read, the route list, as before intake order.
      ...(intakeOrder
        ? { intakeRoutes: seed.boards, intakeEvaluator: 'intake-order' as const }
        : { intakeEvaluator: 'route-list' as const }),
    },
  ) as Record<string, { requireApproval?: boolean; execute: (input: unknown, context: unknown) => Promise<unknown> }>;
  const run = <T>(name: string, input: unknown) => tools[name]!.execute(input, {}) as Promise<T>;
  if (intakeOrder) {
    const project = { orgId: 'org-1', factoryProjectId: 'project-1' };
    for (const route of (await seed.boards.listIntakeRoutes(project)).toReversed()) {
      await seed.boards.deleteIntakeRoute(project, route.id, { expectedRevision: route.revision });
    }
  }
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
  it('files on the board the person names when no intake rule takes the item', async () => {
    const { run, workItems } = await setup({ intakeOrder: true });
    await expect(run('factory_create_work_item', { title: 'Odd one', description: 'x' })).rejects.toThrow(
      /Pick the board/,
    );

    const created = await run<{ id: string }>('factory_create_work_item', {
      title: 'Odd one',
      description: 'x',
      board: 'work',
    });
    expect(await workItems.getForProject('org-1', 'project-1', created.id)).toMatchObject({
      board: 'work',
      stages: ['intake'],
    });
  });

  it('files on a renamed board by the name people see, and refuses a name two boards share', async () => {
    const renamed = (key: string, name: string) =>
      compileStoredBoard({ ...workSeedWithTriage(), key, name }, workBoard);
    const { run, workItems } = await setup({
      intakeOrder: true,
      boards: boardRegistryOf([renamed('work', 'Open source')]),
    });
    const created = await run<{ id: string }>('factory_create_work_item', {
      title: 'Odd one',
      description: 'x',
      board: 'OPEN source',
    });
    expect(await workItems.getForProject('org-1', 'project-1', created.id)).toMatchObject({
      board: 'work',
      stages: ['intake'],
    });

    const shared = await setup({
      intakeOrder: true,
      boards: boardRegistryOf([renamed('work', 'Platform'), renamed('platform-two', 'Platform')]),
    });
    await expect(
      shared.run('factory_create_work_item', { title: 'Odd one', description: 'x', board: 'platform' }),
    ).rejects.toThrow(/matches more than one board; use its id instead: work \(Platform\), platform-two \(Platform\)/);
  });

  it('stamps the caller’s name and avatar on what it records, so the board can show who filed and moved it', async () => {
    const actorProfile = { name: 'Caleb', avatarUrl: 'https://example.com/caleb.png' };
    const { run, transitionService, auditRecorder } = await setup({ actorProfile });

    const created = await run<{ id: string }>('factory_create_work_item', {
      title: 'Fix the login redirect',
      description: 'Users land on /404.',
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

  it("files the item as the caller in the board's first phase, stores the description and follows it", async () => {
    const { run, workItems, transitionService, auditRecorder } = await setup();

    const created = await run<{ id: string; stage: string; title: string }>('factory_create_work_item', {
      title: 'Fix the login redirect',
      description: 'Users land on /404 after signing in.',
    });

    expect(created).toMatchObject({ title: 'Fix the login redirect', stage: 'intake' });
    const item = await workItems.getForProject('org-1', 'project-1', created.id);
    expect(item).toMatchObject({
      createdBy: 'user-1',
      board: 'work',
      stages: ['intake'],
      description: 'Users land on /404 after signing in.',
    });
    expect(transitionService.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        workItemId: created.id,
        stage: 'intake',
        initialEntry: true,
        cause: 'work_item_created',
        actor: { type: 'human', id: 'user-1' },
      }),
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

    await expect(run('factory_create_work_item', { title: 'Nope', description: 'x' })).rejects.toThrow(
      'Intake is closed.',
    );
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: 'project-1' })).toEqual([]);
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it('takes no stage, only a board: every item enters through its board’s first phase', async () => {
    const { tools } = await setup();
    const schema = (
      tools.factory_create_work_item as unknown as {
        inputSchema: { safeParse(input: unknown): { success: boolean } };
      }
    ).inputSchema;
    expect(schema.safeParse({ title: 't', description: 'b' }).success).toBe(true);
    expect(schema.safeParse({ title: 't', description: 'b', stage: 'execute' }).success).toBe(false);
    expect(schema.safeParse({ title: 't', description: 'b', board: 'review' }).success).toBe(true);
  });
});

describe('repositories', () => {
  it('files the item in the repository it names, so its runs know where to work', async () => {
    const { run, workItems } = await setup();

    const created = await run<{ id: string }>('factory_create_work_item', {
      title: 'Fix the login redirect',
      description: 'Users land on /404 after signing in.',
      repository: 'mastra-ai/platform',
    });

    const item = await workItems.getForProject('org-1', 'project-1', created.id);
    expect(item!.metadata).toMatchObject({ repository: 'mastra-ai/platform' });
  });

  it('refuses a repository the Factory does not link, before filing anything', async () => {
    const { run, workItems } = await setup();

    await expect(
      run('factory_create_work_item', { title: 'x', description: 'y', repository: 'someone/else' }),
    ).rejects.toThrow(
      'someone/else is not linked to this Factory. Linked repositories: mastra-ai/mastra, mastra-ai/platform.',
    );
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: 'project-1' })).toEqual([]);
  });
});

describe('factory_update_work_item', () => {
  it("sets and clears a card's description", async () => {
    const { run, workItems, fileItem } = await setup();
    const { item } = await fileItem('project-1', 'Card');

    const set = await run('factory_update_work_item', { workItem: item.id, description: '  Repro: sign in twice.  ' });
    expect(set).toMatchObject({ updated: ['description'] });
    expect((await workItems.getForProject('org-1', 'project-1', item.id))?.description).toBe('Repro: sign in twice.');

    await run('factory_update_work_item', { workItem: item.id, description: '' });
    expect((await workItems.getForProject('org-1', 'project-1', item.id))?.description).toBeNull();
  });

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
    });
    expect(result).not.toHaveProperty('plansPreapproved');
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
    const { run, workItems } = await setup();
    const { item } = await workItems.upsert({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      userId: 'user-1',
      input: {
        title: 'Issue card',
        stages: ['intake'],
        externalSource: { integrationId: 'github', type: 'issue', externalId: '42' },
        metadata: { githubRepositoryId: '2', repository: 'mastra-ai/mastra' },
      },
    });

    await expect(
      run('factory_update_work_item', { workItem: item.id, repository: 'mastra-ai/platform' }),
    ).rejects.toThrow("This card runs in mastra-ai/mastra, which comes from its linked issue and can't be changed.");
  });

  it('detaches a card from its parent, and refuses the retired plan pre-approval', async () => {
    const { run, workItems, fileItem } = await setup();
    const { item: parent } = await fileItem('project-1', 'Epic');
    const { item } = await fileItem('project-1', 'Child');
    await workItems.update({ orgId: 'org-1', id: item.id, userId: 'user-1', patch: { parentWorkItemId: parent.id } });

    // Plans always wait for a person (or the board's exit tool), so there is nothing to pre-approve.
    await expect(
      run('factory_update_work_item', { workItem: item.id, parentWorkItem: null, plansPreapproved: true }),
    ).resolves.toMatchObject({ error: true });
    expect((await workItems.get({ orgId: 'org-1', id: item.id }))?.parentWorkItemId).toBe(parent.id);

    const result = await run('factory_update_work_item', { workItem: item.id, parentWorkItem: null });

    expect(result).toMatchObject({ parentWorkItemId: null });
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

  it("does not offer plan pre-approval it can't perform", async () => {
    const { tools } = await setup();

    expect(tools.factory_update_work_item.description).not.toMatch(/pre-?approv/i);
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
        'factory_list_audit_events',
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
        'factory_recreate_sandbox',
        'factory_sandbox_port_url',
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

    expect(result).toEqual({ workItemId: item.id, url: null, stage: 'triage', revision: item.revision + 1 });
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

  // The move can start a phase session the Factory owns; following is how this session hears it wait.
  it('follows the card it moved, so the session hears from the run the move starts', async () => {
    const { run, fileItem, workItems } = await setup();
    const { item } = await fileItem('project-1', 'Move me');

    await run('factory_transition_work_item', { workItem: item.id, stage: 'triage' });

    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: item.id })).toEqual([
      expect.objectContaining({ sessionId: 'session-1', userId: 'user-1', reason: 'moved' }),
    ]);
  });

  it('still reports the move when following the card fails, so the agent does not move it twice', async () => {
    const { run, fileItem, workItems } = await setup();
    const { item } = await fileItem('project-1', 'Move me');
    vi.spyOn(workItems, 'subscribeToWorkItem').mockRejectedValue(new Error('storage is away'));

    await expect(run('factory_transition_work_item', { workItem: item.id, stage: 'triage' })).resolves.toEqual({
      workItemId: item.id,
      url: null,
      stage: 'triage',
      revision: item.revision + 1,
      warnings: ['This session does not follow it yet: storage is away'],
    });
  });

  it('keeps "created" when a session moves a card it filed', async () => {
    const { run, workItems } = await setup();
    const created = await run<{ id: string }>('factory_create_work_item', { title: 'Mine', description: 'b' });

    await run('factory_transition_work_item', { workItem: created.id, stage: 'triage' });

    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: created.id })).toEqual([
      expect.objectContaining({ sessionId: 'session-1', reason: 'created' }),
    ]);
  });

  it('does not follow a card whose move the board refused', async () => {
    const { run, fileItem, workItems } = await setup({
      transition: async request => ({
        status: 'rejected',
        transitionId: 't',
        itemId: request.workItemId,
        code: 'stale',
        reason: 'The item changed.',
      }),
    });
    const { item } = await fileItem('project-1', 'Stale');

    await expect(run('factory_transition_work_item', { workItem: item.id, stage: 'triage' })).rejects.toThrow();

    expect(await workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: item.id })).toEqual([]);
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
      url: null,
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
    const created = await run<{ id: string }>('factory_create_work_item', { title: 'Mine', description: 'b' });
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

  it('refuses to approve or dismiss proposals, and changes nothing', async () => {
    const { run, workItems, fileItem, auditRecorder } = await setup({ interactive: false });
    const { item } = await fileItem('project-1', 'Keep my gate');
    const approve = vi.spyOn(workItems, 'approveDeferredDecision');
    const dismiss = vi.spyOn(workItems, 'dismissDeferredDecision');

    await expect(run('factory_resolve_proposal', { decisionId: DECISION_ID, action: 'approve' })).rejects.toThrow(
      'Only a person can approve or dismiss a proposed run',
    );
    await expect(run('factory_dismiss_decision', { decisionId: DECISION_ID })).rejects.toThrow(
      'Only a person can dismiss a proposed run',
    );

    expect(approve).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
    expect((await workItems.get({ orgId: 'org-1', id: item.id }))?.revision).toBe(item.revision);
  });
});

/**
 * A person asks a chat session (Slack, the web) for a card's work, through the board's real rules
 * engine and storage. The session must do what the board's own buttons do: a move into a stage, or,
 * for the stage the card is in, its Start/Review button (`reenter`), approved by that person.
 */
describe("a card's work requested from a chat", () => {
  const PULL_REQUEST_URL = 'https://github.com/mastra-ai/mastra/pull/30578';

  async function boardSetup({ interactive = true }: { interactive?: boolean } = {}) {
    const seed = await createFactoryStorageForTests();
    const boards = createBoardRegistry();
    const service = new FactoryTransitionService({
      configVersion: 'chat-request-test',
      boards,
      storage: seed.workItems,
    });
    const toolScope = { ...scope, interactive };
    const tools = {
      ...createFactoryWorkItemTools(toolScope, {
        workItems: seed.workItems,
        boards,
        boardEngine: new DispatcherBoardEngine({ transitionService: service, workItems: seed.workItems, boards }),
        auditRecorder: { record: vi.fn(async () => null) } as never,
        sessions: { getSourceControlBySessionId: async () => null },
        intakeEvaluator: 'route-list',
      }),
      ...createFactoryReadTools(toolScope, { workItems: seed.workItems, audit: seed.audit, boards }),
    } as Record<string, { execute: (input: unknown, context: unknown) => Promise<unknown> }>;
    const run = <T>(name: string, input: unknown) => tools[name]!.execute(input, {}) as Promise<T>;
    const runs = async (workItemId: string) =>
      (await seed.workItems.listDeferredDecisions('org-1', 'project-1', { workItemId })).filter(
        record => record.decision.type === 'invokeSkill',
      );
    return { ...seed, service, run, runs };
  }

  /**
   * A pull request's card as intake leaves it: in Review, its review run held for a person's approval
   * because nobody consented to it (the dispatcher parks it as a proposal).
   */
  async function heldReviewCard(env: Awaited<ReturnType<typeof boardSetup>>, url = PULL_REQUEST_URL) {
    const number = Number(url.split('/').at(-1));
    const { item } = await env.workItems.upsert({
      orgId: 'org-1',
      userId: 'someone-else',
      factoryProjectId: 'project-1',
      input: {
        title: `PR ${number}`,
        stages: ['pr-review'],
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: `pr-${number}`, url },
        metadata: { githubPullRequestNumber: number },
      },
    });
    const entered = await env.service.transition({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: item.id,
      board: 'work',
      stage: 'pr-review',
      expectedRevision: item.revision,
      actor: { type: 'system', id: 'factory' },
      ingress: { type: 'rule', identity: `intake:${item.id}` },
      cause: 'intake',
      initialEntry: true,
    });
    assert(entered.status === 'accepted');
    const now = new Date();
    const claimed = await env.workItems.claimDeferredDecisions({
      ownerId: 'dispatcher',
      now,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      limit: 10,
    });
    for (const record of claimed) {
      await env.workItems.proposeDeferredDecision(
        { id: record.id, orgId: record.orgId, factoryProjectId: record.factoryProjectId, ownerId: 'dispatcher' },
        now,
      );
    }
    const [held] = await env.runs(item.id);
    assert(held?.status === 'proposed' && held.approvedAt === null);
    return (await env.workItems.get({ orgId: 'org-1', id: item.id }))!;
  }

  // Slack, 2026-11-16: "review: <pull request link>" on a card whose review was held for approval
  // ended in a side session's review posted in Slack; the card never ran its review.
  it('starts the review held on a pull request card when someone asks for it by its link', async () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://factory.example.com');
    onTestFinished(() => void vi.unstubAllEnvs());
    const env = await boardSetup();
    const card = await heldReviewCard(env);

    // The card's link comes back with the move, so the chat can link the card it started.
    await expect(
      env.run('factory_transition_work_item', { workItem: PULL_REQUEST_URL, stage: 'pr-review', rerun: true }),
    ).resolves.toMatchObject({
      workItemId: card.id,
      url: `https://factory.example.com/factories/project-1/cards/${card.id}`,
      stage: 'pr-review',
      reran: true,
    });

    // What the dispatcher reads: a review run approved by the person, which it starts without asking.
    const queued = (await env.runs(card.id)).filter(record => record.status === 'pending');
    expect(queued).toEqual([
      expect.objectContaining({
        approvedBy: 'user-1',
        approvedAt: expect.any(Date),
        decision: expect.objectContaining({ type: 'invokeSkill', role: 'review', cancelInFlight: true }),
      }),
    ]);
    expect((await env.workItems.get({ orgId: 'org-1', id: card.id }))?.stages).toEqual(['pr-review']);
    expect(await env.workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: card.id })).toEqual([
      expect.objectContaining({ sessionId: 'session-1', reason: 'moved' }),
    ]);
  });

  // Slack, 2026-11-16: "find the work item for this PR and move it to review" on a card that had
  // already been reviewed. Moving a card to the stage it is in must not start another pass unasked.
  it('tells the agent the card is already in that stage, and that its run waits for approval, without rerunning it', async () => {
    const env = await boardSetup();
    const card = await heldReviewCard(env);

    await expect(
      env.run('factory_transition_work_item', { workItem: PULL_REQUEST_URL, stage: 'pr-review' }),
    ).resolves.toMatchObject({
      workItemId: card.id,
      unchanged: true,
      message: expect.stringContaining('waiting for approval'),
    });
    expect((await env.runs(card.id)).map(record => record.status)).toEqual(['proposed']);
  });

  it('refuses a second run while the first is still queued, as the board refuses a busy card', async () => {
    const env = await boardSetup();
    const card = await heldReviewCard(env);
    const rerun = { workItem: card.id, stage: 'pr-review', rerun: true };
    await env.run('factory_transition_work_item', rerun);

    await expect(env.run('factory_transition_work_item', rerun)).rejects.toThrow('The move was refused (card_busy)');
    expect((await env.runs(card.id)).filter(record => record.status === 'pending')).toHaveLength(1);
  });

  it('leaves the held run alone on a turn nobody signed in started', async () => {
    const env = await boardSetup({ interactive: false });
    const card = await heldReviewCard(env);

    await expect(
      env.run('factory_transition_work_item', { workItem: card.id, stage: 'pr-review', rerun: true }),
    ).rejects.toThrow('needs a person in this turn');
    expect((await env.runs(card.id)).map(record => record.status)).toEqual(['proposed']);
  });

  // Slack, 2026-11-16: the session approved the held review run and said it would post when the
  // review finished, but approving didn't follow the card, so the review's report never reached it.
  it("follows the card whose held run it approves, so the run's report reaches this chat", async () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://factory.example.com');
    onTestFinished(() => void vi.unstubAllEnvs());
    const env = await boardSetup();
    const card = await heldReviewCard(env);
    const [held] = await env.runs(card.id);

    await expect(
      env.run('factory_resolve_proposal', { decisionId: held!.id, action: 'approve' }),
    ).resolves.toMatchObject({
      workItemId: card.id,
      status: 'pending',
      url: `https://factory.example.com/factories/project-1/cards/${card.id}`,
    });

    // Who the card's review session reports to when its run ends.
    expect(
      await workItemReportRecipients(env.workItems, {
        orgId: 'org-1',
        workItemId: card.id,
        senderSessionId: 'review-session',
      }),
    ).toEqual([{ sessionId: 'session-1', threadId: 'thread-1' }]);
  });

  it("follows the card whose failed run it retries, so the retry's report reaches this chat", async () => {
    const env = await boardSetup();
    const card = await heldReviewCard(env);
    const [held] = await env.runs(card.id);
    // Approved on the board by someone else, then failed before a session started.
    const now = new Date();
    await env.workItems.approveDeferredDecision('org-1', 'project-1', held!.id, now, 'someone-else');
    await env.workItems.claimDeferredDecisions({
      ownerId: 'dispatcher',
      now,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      limit: 10,
    });
    await env.workItems.failDeferredDecision({
      id: held!.id,
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      ownerId: 'dispatcher',
      now,
      availableAt: now,
      lastError: 'No session for the review run.',
      failureCode: 'session_unavailable',
      terminal: true,
    });

    await expect(env.run('factory_retry_decision', { decisionId: held!.id })).resolves.toMatchObject({
      workItemId: card.id,
    });

    expect(
      await workItemReportRecipients(env.workItems, {
        orgId: 'org-1',
        workItemId: card.id,
        senderSessionId: 'review-session',
      }),
    ).toEqual([{ sessionId: 'session-1', threadId: 'thread-1' }]);
  });

  // The run is approved before the card is read: a failed read must not report the approval as failed.
  it('still reports the approved run when reading its card fails afterwards', async () => {
    const env = await boardSetup();
    const card = await heldReviewCard(env);
    const [held] = await env.runs(card.id);
    vi.spyOn(env.workItems, 'getForProject').mockRejectedValueOnce(new Error('storage is away'));

    await expect(env.run('factory_resolve_proposal', { decisionId: held!.id, action: 'approve' })).resolves.toEqual({
      decisionId: held!.id,
      status: 'pending',
      workItemId: card.id,
      url: null,
      warnings: ['This session does not follow it yet: storage is away'],
    });
    expect((await env.runs(card.id)).map(record => record.status)).toEqual(['pending']);
  });

  it('does not follow a card whose held run it dismisses', async () => {
    const env = await boardSetup();
    const card = await heldReviewCard(env);
    const [held] = await env.runs(card.id);

    await env.run('factory_resolve_proposal', { decisionId: held!.id, action: 'dismiss' });

    expect(await env.workItems.listWorkItemSubscribers({ orgId: 'org-1', workItemId: card.id })).toEqual([]);
  });

  it('lists the stages the card can move to, and that its own stage can run again', async () => {
    const env = await boardSetup();
    const card = await heldReviewCard(env);

    const inspected = await env.run<{ moves: unknown }>('factory_inspect_work_item', { workItem: PULL_REQUEST_URL });

    expect(inspected.moves).toMatchObject({
      board: { key: 'work' },
      stage: { key: 'pr-review', kind: 'working' },
      canRerun: true,
      next: expect.arrayContaining([expect.objectContaining({ key: 'done', kind: 'terminal' })]),
    });
    expect(card.stages).toEqual(['pr-review']);
  });

  // With two repositories linked, a bare number names the issue's card first; the link names the pull request.
  it('finds the pull request a link names when an issue in another repository has the same number', async () => {
    const env = await boardSetup();
    const { item: issue } = await env.workItems.upsert({
      orgId: 'org-1',
      userId: 'someone-else',
      factoryProjectId: 'project-1',
      input: {
        title: 'An old issue',
        stages: ['intake'],
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'issue-5001',
          url: 'https://github.com/mastra-ai/mastra/issues/5001',
        },
        metadata: { githubIssueNumber: 5001 },
      },
    });
    const pullRequest = await heldReviewCard(env, 'https://github.com/mastra-ai/platform/pull/5001');

    const inspect = (workItem: string) =>
      env.run<{ item: { id: string } }>('factory_inspect_work_item', { workItem }).then(result => result.item.id);
    expect(await inspect('#5001')).toBe(issue.id);
    expect(await inspect('https://github.com/mastra-ai/platform/pull/5001')).toBe(pullRequest.id);
    expect(await inspect('https://github.com/mastra-ai/platform/pull/5001/files#diff-1')).toBe(pullRequest.id);
    expect(await inspect('mastra-ai/platform#5001')).toBe(pullRequest.id);
    expect(await inspect('https://github.com/mastra-ai/mastra/issues/5001')).toBe(issue.id);
    await expect(inspect('https://github.com/mastra-ai/mastra/pull/9999')).rejects.toThrow('No work item');

    const listed = await env.run<{ items: Array<{ id: string }> }>('factory_list_work_items', {
      query: 'https://github.com/mastra-ai/platform/pull/5001',
    });
    expect(listed.items.map(row => row.id)).toEqual([pullRequest.id]);
  });

  it("finds a pull request attached to its issue's card through that card", async () => {
    const env = await boardSetup();
    const { item: issue } = await env.workItems.upsert({
      orgId: 'org-1',
      userId: 'someone-else',
      factoryProjectId: 'project-1',
      input: {
        title: 'Fix the login page',
        stages: ['execute'],
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'issue-12',
          url: 'https://github.com/mastra-ai/mastra/issues/12',
        },
        metadata: { githubIssueNumber: 12 },
      },
    });
    await env.workItems.attachSource({
      orgId: 'org-1',
      id: issue.id,
      source: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: 'pr-40',
        url: 'https://github.com/mastra-ai/mastra/pull/40',
      },
      metadata: { githubPullRequestNumber: 40 },
    });

    await expect(
      env.run('factory_inspect_work_item', { workItem: 'https://github.com/mastra-ai/mastra/pull/40' }),
    ).resolves.toMatchObject({ item: { id: issue.id } });
  });
});
