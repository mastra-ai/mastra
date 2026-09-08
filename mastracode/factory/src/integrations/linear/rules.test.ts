import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../../boards/index.js';
import { createTestBoard } from '../../boards/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { resolveLinearRules } from './default-rules.js';
import type { LinearRuleOverrides } from './default-rules.js';
import { LinearRules } from './rules.js';

const issue = {
  id: 'issue-1',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  creator: 'grace',
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

async function setup(overrides?: LinearRuleOverrides, boards = createBoardRegistry()) {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'acme/repo' },
  });
  const service = new LinearRules({
    projects: seeded.projects,
    storage: seeded.workItems,
    configVersion: 'factory-config-v1',
    boards,
    linearRules: resolveLinearRules(overrides),
  });
  return { project, service, workItems: seeded.workItems };
}

describe('LinearRules', () => {
  it('accepts installed custom linked targets and preserves committed ingress after uninstall', async () => {
    const decision = {
      type: 'upsertLinkedWorkItem' as const,
      idempotencyKey: 'release-observed',
      board: 'release',
      stage: 'shipping',
      source: 'linear-issue' as const,
      sourceKey: 'linear:ENG-43',
      title: 'Release ENG-43',
      url: issue.url,
    };
    const linearRules = resolveLinearRules({ issueObserved: () => decision });
    const { project, service, workItems } = await setup(
      { issueObserved: () => decision },
      createBoardRegistry({ boards: [createTestBoard()], includeDefaultBoards: false }),
    );
    const input = { orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] };
    await expect(service.ingest(input)).resolves.toEqual({ status: 'committed', ingested: 1 });
    const before = await workItems.listDeferredDecisions('org-1', project.id);
    expect(before).toMatchObject([{ decision }]);
    const restarted = new LinearRules({
      projects: { get: async () => project },
      storage: workItems,
      configVersion: 'replacement-config',
      boards: createBoardRegistry({ includeDefaultBoards: false }),
      linearRules,
    });
    await expect(restarted.ingest(input)).resolves.toEqual({ status: 'replayed', ingested: 1 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual(before);
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toEqual([]);
  });

  it.each([
    { board: 'missing', stage: 'shipping' },
    { board: 'release', stage: 'missing' },
    { board: 'release', stage: 'planning' },
  ])('rejects a linked target $board/$stage before accepting effects', async target => {
    const { project, service, workItems } = await setup(
      {
        issueObserved: () => ({
          type: 'upsertLinkedWorkItem',
          idempotencyKey: 'invalid-target',
          ...target,
          source: 'linear-issue',
          sourceKey: 'linear:ENG-43',
          title: 'Release ENG-43',
          url: issue.url,
        }),
      },
      createBoardRegistry({ boards: [createTestBoard()] }),
    );
    const commit = vi.spyOn(workItems, 'commitRuleEvaluation');
    await service.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] });
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: expect.objectContaining({ status: 'rejected', code: 'rule_error' }),
        decisions: [],
      }),
    );
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    expect(await workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).toEqual([]);
  });

  it.each([true, false])('validates a transition using the persisted board (echo context: %s)', async echoContext => {
    const { project, service, workItems } = await setup(
      {
        issueClosed: context => ({
          type: 'transition',
          board: echoContext ? (context.board ?? '') : 'work',
          stage: echoContext ? 'shipped' : 'done',
          idempotencyKey: 'board-context',
        }),
      },
      createBoardRegistry({ boards: [createTestBoard()] }),
    );
    const { item } = await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        title: issue.title,
        board: 'release',
        stages: ['shipping'],
        sessions: {},
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42', url: issue.url },
      },
    });
    const commit = vi.spyOn(workItems, 'commitRuleEvaluation');
    await service.ingest({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      issues: [{ ...issue, stateType: 'completed' }],
    });
    if (echoContext) {
      expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
        { decision: { type: 'transition', board: 'release', stage: 'shipped' } },
      ]);
      expect(await workItems.get({ orgId: 'org-1', id: item.id })).toEqual(item);
      return;
    }
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: expect.objectContaining({ status: 'rejected', code: 'rule_error' }),
        decisions: [],
      }),
    );
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    expect(await workItems.get({ orgId: 'org-1', id: item.id })).toEqual(item);
  });

  it.each(['completed', 'canceled'])('closes linked issues in state %s with shared audit metadata', async stateType => {
    const { project, service, workItems } = await setup();
    await workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        title: issue.title,
        stages: ['planning'],
        sessions: {},
        externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-42', url: issue.url },
      },
    });
    const commit = vi.spyOn(workItems, 'commitRuleEvaluation');
    await service.ingest({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      issues: [{ ...issue, stateType }],
    });
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        configVersion: 'factory-config-v1',
        ingress: { identity: `linear:${issue.id}:${issue.updatedAt}`, triggerType: 'linear.issueObserved' },
      }),
    );
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      { decision: { type: 'transition', stage: stateType === 'completed' ? 'done' : 'canceled' } },
    ]);
  });

  it.each(['completed', 'canceled'])(
    'does not invoke overrides or create intake for unlinked %s issues',
    async stateType => {
      const handler = vi.fn();
      const { project, service, workItems } = await setup({ issueClosed: handler });
      await expect(
        service.ingest({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: project.id,
          issues: [{ ...issue, stateType }],
        }),
      ).resolves.toEqual({ status: 'missing', ingested: 1 });
      expect(handler).not.toHaveBeenCalled();
      expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
    },
  );

  it('retains ingestion bookkeeping when an event is disabled', async () => {
    const { project, service, workItems } = await setup({ issueObserved: null });
    const input = { orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] };
    await expect(service.ingest(input)).resolves.toEqual({ status: 'committed', ingested: 1 });
    await expect(service.ingest(input)).resolves.toEqual({ status: 'replayed', ingested: 1 });
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
  });

  it('persists replacement decisions without composing the default intake', async () => {
    const handler = vi.fn(() => ({
      type: 'notify' as const,
      idempotencyKey: 'custom-notify',
      title: 'Custom observation',
    }));
    const { project, service, workItems } = await setup({ issueObserved: handler });
    const commit = vi.spyOn(workItems, 'commitRuleEvaluation');
    const input = { orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, issues: [issue] };
    await service.ingest(input);
    await service.ingest(input);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ outcome: { status: 'accepted' } }));
    expect(await workItems.listDeferredDecisions('org-1', project.id)).toMatchObject([
      { decision: { type: 'notify', idempotencyKey: 'custom-notify' } },
    ]);
  });

  it.each(['throw', 'invalid', 'timeout'] as const)(
    'records %s handler failures without dispatching decisions',
    async failure => {
      const handler = () => {
        if (failure === 'throw') throw new Error('handler failed');
        if (failure === 'timeout') return new Promise<never>(() => {});
        return { type: 'notify' as const, idempotencyKey: '', title: 'invalid decision' };
      };
      const { project, service, workItems } = await setup({ issueObserved: handler });
      const commit = vi.spyOn(workItems, 'commitRuleEvaluation');
      if (failure === 'timeout') vi.useFakeTimers();
      try {
        const pending = service.ingest({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: project.id,
          issues: [issue],
        });
        if (failure === 'timeout') await vi.advanceTimersByTimeAsync(5_001);
        await pending;
        expect(commit).toHaveBeenCalledWith(
          expect.objectContaining({
            outcome: expect.objectContaining({
              status: 'rejected',
              code: failure === 'timeout' ? 'timeout' : 'rule_error',
            }),
            decisions: [],
          }),
        );
        expect(await workItems.listDeferredDecisions('org-1', project.id)).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('commits one triage decision and replays an unchanged observation', async () => {
    const { project, service, workItems } = await setup();
    const input = { orgId: 'org-1', factoryProjectId: project.id, userId: 'user-1', issues: [issue] };

    await expect(service.ingest(input)).resolves.toEqual({ status: 'committed', ingested: 1 });
    await expect(service.ingest(input)).resolves.toEqual({ status: 'replayed', ingested: 1 });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      actor: { type: 'human', id: 'user-1' },
      decision: {
        type: 'upsertLinkedWorkItem',
        source: 'linear-issue',
        sourceKey: 'linear:ENG-42',
        stage: 'triage',
      },
    });
  });

  it('fails closed when the active Factory project belongs to another organization', async () => {
    const { project, service, workItems } = await setup();

    await expect(
      service.ingest({
        orgId: 'org-2',
        factoryProjectId: project.id,
        userId: 'user-2',
        issues: [issue],
      }),
    ).resolves.toEqual({ status: 'missing', ingested: 0 });
    await expect(workItems.listDeferredDecisions('org-2', project.id)).resolves.toEqual([]);
  });

  it('commits a new observation when Linear reports a later update', async () => {
    const { project, service, workItems } = await setup();
    const input = { orgId: 'org-1', factoryProjectId: project.id, userId: 'user-1', issues: [issue] };

    await service.ingest(input);
    await expect(
      service.ingest({
        ...input,
        issues: [{ ...issue, state: 'In Progress', updatedAt: '2026-07-03T00:00:00Z' }],
      }),
    ).resolves.toEqual({ status: 'committed', ingested: 1 });

    const decisions = await workItems.listDeferredDecisions('org-1', project.id);
    expect(decisions).toHaveLength(2);
  });
});
