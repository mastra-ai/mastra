import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules, requireSupervisorApproval } from './defaults.js';
import { createFactoryTransitionTools } from './tools.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

type ExecutableTool = {
  execute: (input: unknown, context: unknown) => Promise<unknown>;
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
};

function requestContext(
  overrides: Partial<{ orgId: string; projectId: string; threadId: string; resourceId: string; scope: string }> = {},
) {
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: overrides.orgId ?? 'org-1' });
  context.set('controller', {
    resourceId: overrides.resourceId ?? 'resource-1',
    threadId: overrides.threadId ?? 'thread-1',
    scope: overrides.scope ?? '/worktree',
    session: { id: 'session-1', ownerId: 'code', modeId: 'build' },
    getState: () => ({ factoryProjectId: overrides.projectId ?? PROJECT_ID }),
  });
  return context;
}

async function prepareBoundItem(storage: WorkItemsStorage, source: 'github-issue' | 'github-pr' = 'github-issue') {
  return storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: {
          integrationId: 'github',
          type: source === 'github-pr' ? 'pull-request' : 'issue',
          externalId: `${source}:1`,
        },
        title: 'Factory item',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
    role: source === 'github-pr' ? 'review' : 'work',
    session: { sessionId: 'resource-1', branch: 'factory/item', threadId: 'thread-1' },
    resourceId: 'resource-1',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
}

async function execute(tool: ExecutableTool, context: RequestContext, input: unknown, toolCallId = 'tool-call-1') {
  return tool.execute(input, { requestContext: context, agent: { toolCallId } });
}

describe('factory_transition_work_item', () => {
  it('is exposed only for the exact active tenant/thread/resource/session binding', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    const prepared = await prepareBoundItem(storage);
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:99' },
        parentWorkItemId: prepared.item.id,
        title: 'Linked review',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });

    await expect(
      createFactoryTransitionTools({ requestContext: requestContext(), storage, transitionService: service }),
    ).resolves.toHaveProperty('factory_transition_work_item');
    await expect(
      createFactoryTransitionTools({
        requestContext: requestContext({ threadId: 'other-thread' }),
        storage,
        transitionService: service,
      }),
    ).resolves.toEqual({});
    await expect(
      createFactoryTransitionTools({
        requestContext: requestContext({ resourceId: 'other-resource' }),
        storage,
        transitionService: service,
      }),
    ).resolves.toEqual({});
    await expect(
      createFactoryTransitionTools({
        requestContext: requestContext({ orgId: 'other-org' }),
        storage,
        transitionService: service,
      }),
    ).resolves.toEqual({});
  });

  it('derives the item, board, actor, and immutable ingress from the binding and tool call', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    const transition = vi.fn(async () => ({
      status: 'accepted' as const,
      transitionId: 'transition-1',
      itemId: prepared.item.id,
      revision: 2,
      stage: 'planning' as const,
      decisions: [],
    }));
    const context = requestContext();
    const tools = await createFactoryTransitionTools({
      requestContext: context,
      storage,
      transitionService: { transition },
    });

    const result = await execute(
      tools.factory_transition_work_item as ExecutableTool,
      context,
      { stage: 'planning', expectedRevision: 1, rationale: 'The investigation is complete.' },
      'tool-call-9',
    );

    expect(result).toMatchObject({ status: 'accepted', itemId: prepared.item.id });
    expect(transition).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: prepared.item.id,
      board: 'work',
      stage: 'planning',
      expectedRevision: 1,
      actor: { type: 'agent', bindingId: prepared.binding.id, role: 'work' },
      ingress: { type: 'agent', identity: `${prepared.binding.id}:tool-call-9` },
      cause: 'The investigation is complete.',
    });
  });

  it('returns pending_approval immediately without suspending or requiring a retry', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const service = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: {
            planning: {
              issue: {
                onEnter: context =>
                  requireSupervisorApproval(context, { reason: 'Supervisor approval is required for planning.' }),
              },
            },
          },
        },
      }),
    });
    const context = requestContext();
    const tools = await createFactoryTransitionTools({ requestContext: context, storage, transitionService: service });

    const result = await execute(tools.factory_transition_work_item as ExecutableTool, context, {
      stage: 'planning',
      expectedRevision: 1,
      rationale: 'Investigation complete.',
    });

    expect(result).toMatchObject({
      status: 'pending_approval',
      approvalId: expect.any(String),
      stage: 'planning',
      revision: 1,
    });
    expect(await storage.listApprovals('org-1', PROJECT_ID, ['pending'])).toHaveLength(1);
  });

  it('rechecks authority at execution and rejects revoked or replaced bindings', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    const context = requestContext();
    const tools = await createFactoryTransitionTools({ requestContext: context, storage, transitionService: service });
    await expect(
      execute(tools.factory_transition_work_item as ExecutableTool, requestContext({ threadId: 'other-thread' }), {
        stage: 'planning',
        expectedRevision: 1,
        rationale: 'Continue.',
      }),
    ).rejects.toThrow(/binding is unavailable, revoked, or no longer matches/);

    await storage.revokeRunBinding({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      bindingId: prepared.binding.id,
      revokedAt: new Date(),
    });

    await expect(
      execute(tools.factory_transition_work_item as ExecutableTool, context, {
        stage: 'planning',
        expectedRevision: 1,
        rationale: 'Continue.',
      }),
    ).rejects.toThrow(/binding is unavailable, revoked, or no longer matches/);
  });

  it('returns canonical stale and rule rejection results from transition authority', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const service = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: {
            planning: {
              issue: { onEnter: () => ({ type: 'reject', code: 'forbidden', reason: 'Submit a plan first.' }) },
            },
          },
        },
      }),
    });
    const context = requestContext();
    const tools = await createFactoryTransitionTools({ requestContext: context, storage, transitionService: service });
    const tool = tools.factory_transition_work_item as ExecutableTool;

    await expect(
      execute(tool, context, { stage: 'planning', expectedRevision: 99, rationale: 'Continue.' }, 'stale-call'),
    ).resolves.toMatchObject({ status: 'rejected', code: 'stale' });
    await expect(
      execute(tool, context, { stage: 'planning', expectedRevision: 1, rationale: 'Continue.' }, 'rule-call'),
    ).resolves.toMatchObject({ status: 'rejected', code: 'forbidden', reason: 'Submit a plan first.' });
  });

  it('deduplicates repeated execution of one immutable bound tool call', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const onEnter = vi.fn(() => undefined);
    const service = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: { work: { planning: { issue: { onEnter } } } },
      }),
    });
    const context = requestContext();
    const tools = await createFactoryTransitionTools({ requestContext: context, storage, transitionService: service });
    const tool = tools.factory_transition_work_item as ExecutableTool;
    const input = { stage: 'planning', expectedRevision: 1, rationale: 'Investigation complete.' };

    const first = await execute(tool, context, input, 'immutable-call');
    const replay = await execute(tool, context, input, 'immutable-call');

    expect(replay).toEqual(first);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('derives the Review board for PR bindings and ignores linked-card presence for Work authority', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const review = await prepareBoundItem(storage, 'github-pr');
    const transition = vi.fn(async () => ({ status: 'accepted' as const }));
    const context = requestContext();
    const tools = await createFactoryTransitionTools({
      requestContext: context,
      storage,
      transitionService: { transition } as never,
    });

    await execute(tools.factory_transition_work_item as ExecutableTool, context, {
      stage: 'review',
      expectedRevision: review.item.revision,
      rationale: 'Review started.',
    });
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ board: 'review', workItemId: review.item.id }));
  });

  it('bounds stage, revision, and rationale at the schema boundary', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    const tools = await createFactoryTransitionTools({
      requestContext: requestContext(),
      storage,
      transitionService: service,
    });
    const schema = (tools.factory_transition_work_item as ExecutableTool).inputSchema;

    expect(schema.safeParse({ stage: 'planning', expectedRevision: 1, rationale: 'Ready.' }).success).toBe(true);
    expect(schema.safeParse({ stage: 'unknown', expectedRevision: 1, rationale: 'Ready.' }).success).toBe(false);
    expect(schema.safeParse({ stage: 'planning', expectedRevision: 0, rationale: 'Ready.' }).success).toBe(false);
    expect(
      schema.safeParse({ stage: 'planning', expectedRevision: 1, rationale: 'Ready.', workItemId: 'forged' }).success,
    ).toBe(false);
    expect(schema.safeParse({ stage: 'planning', expectedRevision: 1, rationale: 'x'.repeat(1_001) }).success).toBe(
      false,
    );
  });
});
