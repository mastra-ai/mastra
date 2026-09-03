import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import { defaultFactoryRules } from '../rules/defaults.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { SupervisorMessageReader } from './read-tools.js';
import { createFactorySupervisorReadTools } from './read-tools.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const SCOPE = { orgId: 'org-1', factoryProjectId: PROJECT_ID };
const NOW = new Date('2026-09-03T12:00:00.000Z');
const CLAIM_NOW = new Date('2100-01-01T00:00:00.000Z');

async function createItem(storage: WorkItemsStorage, number: number, stage = 'intake') {
  return (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: `github-issue:${number}` },
        title: `Issue ${number}`,
        stages: [stage],
        sessions: {},
        metadata: { number, githubIssueNumber: number, labels: ['bug'] },
      },
    })
  ).item;
}

/** Queue one invokeSkill decision on a fresh card by moving it into Execute under a rule override. */
async function queueFailedPlan(storage: WorkItemsStorage, number: number) {
  const item = await createItem(storage, number);
  const rules = defaultFactoryRules({
    version: 'rules-v1',
    overrides: {
      work: {
        execute: {
          issue: {
            onEnter: () => ({
              type: 'invokeSkill',
              role: 'plan',
              skillName: 'factory-plan',
              idempotencyKey: `plan-${number}`,
            }),
          },
        },
      },
    },
  });
  const transitions = new FactoryTransitionService({ storage, rules });
  const result = await transitions.transition({
    ...SCOPE,
    workItemId: item.id,
    board: 'work',
    stage: 'execute',
    expectedRevision: item.revision,
    actor: { type: 'human', id: 'user-1' },
    ingress: { type: 'human', identity: `move-${number}` },
    cause: 'board_drag',
  });
  expect(result.status).toBe('accepted');
  const [claimed] = await storage.claimDeferredDecisions({
    ownerId: 'test',
    now: CLAIM_NOW,
    leaseExpiresAt: new Date(CLAIM_NOW.getTime() + 30_000),
    limit: 1,
  });
  const failed = await storage.failDeferredDecision({
    id: claimed!.id,
    orgId: 'org-1',
    factoryProjectId: PROJECT_ID,
    ownerId: 'test',
    now: NOW,
    availableAt: NOW,
    lastError: 'No active Factory binding for role plan.',
    failureCode: 'session_unavailable',
    terminal: true,
  });
  return { item: (await storage.get({ orgId: 'org-1', id: item.id }))!, decision: failed! };
}

function execute<T>(tool: unknown, input: unknown): Promise<T> {
  return (tool as { execute: (input: unknown, ctx: unknown) => Promise<T> }).execute(input, {});
}

describe('createFactorySupervisorReadTools', () => {
  it('factory_overview counts stages, decisions and seats for the project only', async () => {
    const seed = await createFactoryStorageForTests();
    const { workItems } = seed;
    await queueFailedPlan(workItems, 1);
    await createItem(workItems, 2, 'triage');
    await workItems.upsert({
      orgId: 'org-2',
      userId: 'user-9',
      factoryProjectId: PROJECT_ID,
      input: { title: 'Other tenant', stages: ['intake'], sessions: {}, metadata: {} },
    });
    const tools = createFactorySupervisorReadTools({ scope: SCOPE, ...seed, now: () => NOW });

    const overview = await execute<any>(tools.factory_overview, {});

    expect(overview.workItems.total).toBe(2);
    expect(overview.workItems.byStage).toMatchObject({ execute: 1, triage: 1, intake: 0 });
    expect(overview.decisions).toEqual({ failed: 1 });
    expect(overview.failedDecisions).toHaveLength(1);
    expect(overview.failedDecisions[0]).toMatchObject({ type: 'invokeSkill', role: 'plan', canRetry: true });
    expect(overview.checkedAt).toBe(NOW.toISOString());
  });

  it('factory_health_check returns the deterministic report', async () => {
    const seed = await createFactoryStorageForTests();
    await queueFailedPlan(seed.workItems, 1);
    const tools = createFactorySupervisorReadTools({ scope: SCOPE, ...seed, now: () => NOW });

    const report = await execute<any>(tools.factory_health_check, {});

    expect(report.findings.map((f: any) => f.kind).sort()).toEqual(['decision-failed', 'seat-missing']);
  });

  it('factory_inspect_work_item resolves a card by number with its seats, decisions, audit and feed', async () => {
    const seed = await createFactoryStorageForTests();
    const { workItems, audit, comments } = seed;
    const { item, decision } = await queueFailedPlan(workItems, 22874);
    await audit.record({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      actorId: 'user-1',
      action: 'factory.work_item.stage_moved',
      targets: [{ type: 'work_item', id: item.id, name: item.title }],
      metadata: { to: 'execute' },
    });
    await comments.create({
      ...SCOPE,
      workItemId: item.id,
      author: { kind: 'user', id: 'user-1', displayName: 'Abhi' },
      body: 'Why is this red?',
    });
    const tools = createFactorySupervisorReadTools({ scope: SCOPE, ...seed, now: () => NOW });

    const detail = await execute<any>(tools.factory_inspect_work_item, { number: 22874 });

    expect(detail.item).toMatchObject({ id: item.id, number: 22874, stage: 'execute', source: 'github:issue' });
    expect(detail.labels).toEqual(['bug']);
    expect(detail.stageHistory.map((entry: any) => entry.stage)).toEqual(['intake', 'execute']);
    expect(detail.decisions).toEqual([
      expect.objectContaining({
        id: decision.id,
        status: 'failed',
        failureCode: 'session_unavailable',
        failureLabel: expect.any(String),
        lastError: 'No active Factory binding for role plan.',
      }),
    ]);
    expect(detail.audit).toEqual([
      expect.objectContaining({ action: 'factory.work_item.stage_moved', actorId: 'user-1' }),
    ]);
    expect(detail.feed).toEqual([expect.objectContaining({ body: 'Why is this red?' })]);
  });

  it('factory_inspect_work_item refuses ids from another project', async () => {
    const seed = await createFactoryStorageForTests();
    const other = await seed.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: '99999999-2222-4333-8444-555555555555',
      input: { title: 'Elsewhere', stages: ['intake'], sessions: {}, metadata: {} },
    });
    const tools = createFactorySupervisorReadTools({ scope: SCOPE, ...seed });

    await expect(execute(tools.factory_inspect_work_item, { id: other.item.id })).rejects.toThrow(/No work item/);
  });

  it('factory_list_attention groups failures that share a code and error into one incident', async () => {
    const seed = await createFactoryStorageForTests();
    const a = await queueFailedPlan(seed.workItems, 1);
    const b = await queueFailedPlan(seed.workItems, 2);
    const tools = createFactorySupervisorReadTools({ scope: SCOPE, ...seed });

    const attention = await execute<any>(tools.factory_list_attention, { limit: 10 });

    expect(attention.incidents).toHaveLength(1);
    expect(attention.incidents[0]).toMatchObject({ failureCode: 'session_unavailable', count: 2 });
    expect(attention.incidents[0].decisions.map((d: any) => d.id).sort()).toEqual(
      [a.decision.id, b.decision.id].sort(),
    );
    expect(attention.incidents[0].decisions.map((d: any) => d.number).sort()).toEqual([1, 2]);
    expect(attention.proposals).toEqual([]);
  });

  it("factory_read_session reads the card's thread newest-last with text and tool names, bounded", async () => {
    const seed = await createFactoryStorageForTests();
    const { workItems } = seed;
    await workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:5' },
          title: 'Issue 5',
          stages: ['intake'],
          sessions: {},
          metadata: { number: 5 },
        },
      },
      role: 'plan',
      session: { sessionId: 'session-5', branch: 'factory/issue-5', threadId: 'thread-5' },
      resourceId: 'resource-5',
      kickoffKey: 'kickoff-5',
      kickoffMessage: null,
    });
    const seen: unknown[] = [];
    const messageReader: SupervisorMessageReader = {
      async listMessages(input) {
        seen.push(input);
        const messages = [
          {
            id: 'm2',
            role: 'assistant',
            createdAt: new Date('2026-09-03T11:00:00Z'),
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'x'.repeat(2_000) },
                {
                  type: 'tool-invocation',
                  toolInvocation: { toolName: 'factory_transition_work_item', state: 'result' },
                },
              ],
            },
          },
          {
            id: 'm1',
            role: 'user',
            createdAt: new Date('2026-09-03T10:00:00Z'),
            content: { format: 2, parts: [{ type: 'text', text: 'Plan it' }] },
          },
        ] as unknown as MastraDBMessage[];
        return { messages, hasMore: true };
      },
    };
    const tools = createFactorySupervisorReadTools({ scope: SCOPE, ...seed, messageReader });

    const transcript = await execute<any>(tools.factory_read_session, { number: 5, limit: 2 });

    expect(seen).toEqual([
      expect.objectContaining({
        threadId: 'thread-5',
        resourceId: 'session-5',
        perPage: 2,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      }),
    ]);
    expect(transcript.threadId).toBe('thread-5');
    expect(transcript.hasOlder).toBe(true);
    expect(transcript.turns.map((t: any) => t.id)).toEqual(['m1', 'm2']);
    expect(transcript.turns[1].text.length).toBeLessThan(700);
    expect(transcript.turns[1].tools).toEqual([{ tool: 'factory_transition_work_item', state: 'result' }]);

    await expect(execute(tools.factory_read_session, { threadId: 'someone-elses-thread' })).rejects.toThrow(
      /not bound to a card/,
    );
  });
});
