import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules } from './defaults.js';
import { createFactoryTransitionTools } from './tools.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

type ExecutableTool = {
  execute: (input: unknown, context: unknown) => Promise<unknown>;
  inputSchema: { safeParse: (input: unknown) => { success: boolean } };
  requireApproval: boolean;
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

/** A session recreated after a server crash: coordinates intact, state empty. */
function crashResumedContext(
  setState: (updates: Record<string, unknown>) => Promise<void>,
  overrides: Partial<{ threadId: string; resourceId: string }> = {},
) {
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  context.set('controller', {
    resourceId: overrides.resourceId ?? 'resource-1',
    threadId: overrides.threadId ?? 'thread-1',
    scope: '/worktree',
    session: { id: 'session-1', ownerId: 'code', modeId: 'build' },
    getState: () => ({}),
    setState,
  });
  return context;
}

async function prepareBoundItem(
  storage: WorkItemsStorage,
  source: 'github-issue' | 'github-pr' = 'github-issue',
  role: 'triage' | 'work' | 'plan' | 'review' = source === 'github-pr' ? 'review' : 'work',
) {
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
        metadata: { authorTrusted: true },
      },
    },
    role,
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

  it('requires approval before executing a bound transition', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    await prepareBoundItem(storage);

    const tools = await createFactoryTransitionTools({
      requestContext: requestContext(),
      storage,
      transitionService: service,
    });

    expect((tools.factory_transition_work_item as ExecutableTool).requireApproval).toBe(true);
  });

  it('requires triageType only for triage bindings', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage, 'github-issue', 'triage');
    const tools = await createFactoryTransitionTools({
      requestContext: requestContext(),
      storage,
      transitionService: new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) }),
    });
    const triageTool = tools.factory_transition_work_item as ExecutableTool;
    expect(
      triageTool.inputSchema.safeParse({ stage: 'intake', expectedRevision: 1, rationale: 'Await approval.' }).success,
    ).toBe(false);
    expect(
      triageTool.inputSchema.safeParse({
        stage: 'intake',
        expectedRevision: 1,
        rationale: 'Await approval.',
        triageType: 'feature request',
      }).success,
    ).toBe(true);
  });

  it('propagates a triage binding classification to the transition service', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage, 'github-issue', 'triage');
    const transition = vi.fn(async () => ({
      status: 'accepted' as const,
      transitionId: 'transition-1',
      itemId: prepared.item.id,
      revision: 2,
      stage: 'intake' as const,
      decisions: [],
    }));
    const context = requestContext();
    const tools = await createFactoryTransitionTools({
      requestContext: context,
      storage,
      transitionService: { transition },
    });
    await execute(tools.factory_transition_work_item as ExecutableTool, context, {
      stage: 'intake',
      expectedRevision: 1,
      rationale: 'Await approval.',
      triageType: 'feature request',
    });
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        workItemId: prepared.item.id,
        actor: { type: 'agent', bindingId: prepared.binding.id, role: 'triage' },
        triageType: 'feature request',
      }),
    );
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

  it('works without memory on the execution context', async () => {
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

    const result = await execute(tools.factory_transition_work_item as ExecutableTool, context, {
      stage: 'planning',
      expectedRevision: 1,
      rationale: 'Done planning.',
    });

    expect(result).toMatchObject({ status: 'accepted' });
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

  it('keeps working when the next role takes its turn in the same session', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage);
    const transition = vi.fn(async () => ({
      status: 'accepted' as const,
      transitionId: 'transition-2',
      itemId: prepared.item.id,
      revision: 2,
      stage: 'execute' as const,
      decisions: [],
    }));
    const context = requestContext();
    const tools = await createFactoryTransitionTools({
      requestContext: context,
      storage,
      transitionService: { transition },
    });

    // Handing planning its turn in the live session rotates the binding row.
    const rotated = await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        id: prepared.item.id,
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Factory item',
          stages: ['planning'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'plan',
      session: { sessionId: 'resource-1', branch: 'factory/item', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-2',
      kickoffMessage: null,
    });
    expect(rotated.binding.id).not.toBe(prepared.binding.id);

    await expect(
      execute(tools.factory_transition_work_item as ExecutableTool, context, {
        stage: 'execute',
        expectedRevision: 1,
        rationale: 'The plan is ready to build.',
      }),
    ).resolves.toMatchObject({ status: 'accepted' });
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        workItemId: prepared.item.id,
        actor: expect.objectContaining({ bindingId: rotated.binding.id }),
      }),
    );
  });

  it('rejects a session that has been re-pointed at a different work item', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    const context = requestContext();
    const tools = await createFactoryTransitionTools({ requestContext: context, storage, transitionService: service });

    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: PROJECT_ID,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:2' },
          title: 'A different item',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'resource-1', branch: 'factory/other', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-3',
      kickoffMessage: null,
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

  it('recovers a review binding after crash-resume wipes session state and heals the security posture', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const prepared = await prepareBoundItem(storage, 'github-pr');
    const transition = vi.fn(async () => ({ status: 'accepted' as const }));
    const setState = vi.fn(async () => {});
    const context = crashResumedContext(setState);
    const sessions = {
      getBySessionId: vi.fn(async () => ({ orgId: 'org-1', projectRepositoryId: 'repo-1', baseBranch: 'main' })),
    };

    const tools = await createFactoryTransitionTools({
      requestContext: context,
      storage,
      transitionService: { transition } as never,
      sessions,
    });

    expect(tools).toHaveProperty('factory_transition_work_item');
    expect(sessions.getBySessionId).toHaveBeenCalledWith('resource-1');
    expect(setState).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      factoryOrgId: 'org-1',
      projectRepositoryId: 'repo-1',
      untrustedCheckout: true,
      baseRef: 'main',
    });

    await execute(tools.factory_transition_work_item as ExecutableTool, context, {
      stage: 'review',
      expectedRevision: prepared.item.revision,
      rationale: 'Review complete.',
    });
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', factoryProjectId: PROJECT_ID, workItemId: prepared.item.id }),
    );
  });

  it('keeps untrustedCheckout on recovered review bindings when enrichment lookups fail', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage, 'github-pr');
    const setState = vi.fn(async () => {});
    vi.spyOn(storage, 'get').mockRejectedValue(new Error('transient storage outage'));

    const tools = await createFactoryTransitionTools({
      requestContext: crashResumedContext(setState),
      storage,
      transitionService: { transition: vi.fn(async () => ({ status: 'accepted' as const })) } as never,
      sessions: { getBySessionId: vi.fn(async () => Promise.reject(new Error('sessions down'))) },
    });

    expect(tools).toHaveProperty('factory_transition_work_item');
    expect(setState).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      factoryOrgId: 'org-1',
      untrustedCheckout: true,
    });
  });

  it('keeps untrustedCheckout when only the session lookup fails during enrichment', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage, 'github-pr');
    const setState = vi.fn(async () => {});
    const getBySessionId = vi.fn(async () => Promise.reject(new Error('sessions down')));

    const tools = await createFactoryTransitionTools({
      requestContext: crashResumedContext(setState),
      storage,
      transitionService: { transition: vi.fn(async () => ({ status: 'accepted' as const })) } as never,
      sessions: { getBySessionId },
    });

    expect(tools).toHaveProperty('factory_transition_work_item');
    expect(getBySessionId).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      factoryOrgId: 'org-1',
      untrustedCheckout: true,
    });
  });

  it('recovers a work binding without marking the checkout untrusted', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    await prepareBoundItem(storage);
    const setState = vi.fn(async () => {});

    const tools = await createFactoryTransitionTools({
      requestContext: crashResumedContext(setState),
      storage,
      transitionService: service,
    });

    expect(tools).toHaveProperty('factory_transition_work_item');
    expect(setState).toHaveBeenCalledWith({ factoryProjectId: PROJECT_ID, factoryOrgId: 'org-1' });
  });

  it('exposes nothing on crash-resume when no active binding matches the thread', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    await prepareBoundItem(storage);
    const setState = vi.fn(async () => {});

    await expect(
      createFactoryTransitionTools({
        requestContext: crashResumedContext(setState, { threadId: 'other-thread' }),
        storage,
        transitionService: service,
      }),
    ).resolves.toEqual({});
    expect(setState).not.toHaveBeenCalled();
  });

  it('never authorizes on crash-resume when bindings are ambiguous across factory projects', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    await prepareBoundItem(storage);
    await storage.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: '99999999-8888-4777-8666-555555555555',
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:2' },
          title: 'Second project item',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'resource-1', branch: 'factory/item', threadId: 'thread-1' },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-2',
      kickoffMessage: null,
    });

    await expect(
      createFactoryTransitionTools({
        requestContext: crashResumedContext(vi.fn(async () => {})),
        storage,
        transitionService: service,
      }),
    ).resolves.toEqual({});
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
    expect(schema.safeParse({ stage: 'planning', expectedRevision: 1, rationale: '   ' }).success).toBe(false);
  });

  it('accepts and clamps an overlong rationale instead of rejecting it', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    await prepareBoundItem(storage);
    const service = new FactoryTransitionService({ storage, rules: defaultFactoryRules({ version: 'rules-v1' }) });
    const tools = await createFactoryTransitionTools({
      requestContext: requestContext(),
      storage,
      transitionService: service,
    });
    const schema = (tools.factory_transition_work_item as ExecutableTool).inputSchema;

    const overlong = schema.safeParse({ stage: 'planning', expectedRevision: 1, rationale: 'x'.repeat(1_792) }) as {
      success: boolean;
      data?: { rationale: string };
    };
    expect(overlong.success).toBe(true);
    expect(overlong.data?.rationale).toHaveLength(1_000);
    expect(overlong.data?.rationale.endsWith('…')).toBe(true);

    const exact = schema.safeParse({ stage: 'planning', expectedRevision: 1, rationale: 'y'.repeat(1_000) }) as {
      success: boolean;
      data?: { rationale: string };
    };
    expect(exact.success).toBe(true);
    expect(exact.data?.rationale).toBe('y'.repeat(1_000));
  });
});
