import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_OBSERVATION_THRESHOLD, DEFAULT_REFLECTION_THRESHOLD } from '../session/memory-settings-hydration.js';
import { FactoryFeedReader } from '../storage/domains/comments/feed-context.js';
import { factoryMemorySettingsUserId } from '../storage/domains/memory-settings/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { defaultFactoryRules } from './defaults.js';
import { FactoryStartCoordinator } from './start-coordinator.js';
import { FactoryTransitionService } from './transition-service.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function makeController(sendMessage = vi.fn(async () => {})) {
  let threadId: string | undefined;
  const session = {
    thread: {
      list: vi.fn(async () => []),
      switch: vi.fn(async ({ threadId: id }: { threadId: string }) => {
        threadId = id;
      }),
      create: vi.fn(async () => {
        threadId = 'unexpected-thread';
        return { id: threadId };
      }),
      rename: vi.fn(async () => {}),
      setSetting: vi.fn(async () => {}),
      requireId: vi.fn(() => {
        if (!threadId) throw new Error('missing thread');
        return threadId;
      }),
    },
    getWorkspace: vi.fn(() => ({ skills: undefined })),
    state: { get: vi.fn(() => ({})), set: vi.fn(async () => {}) },
    permissions: { setForTool: vi.fn(async () => {}) },
    model: { switch: vi.fn(async () => {}) },
    om: {
      observer: { modelId: vi.fn(() => undefined), switchModel: vi.fn(async () => {}) },
      reflector: { modelId: vi.fn(() => undefined), switchModel: vi.fn(async () => {}) },
    },
    sendMessage,
  };
  return {
    controller: {
      createSession: vi.fn(
        async ({ threadId: exactThreadId }: { threadId: string; requestContext?: { get(key: string): unknown } }) => {
          threadId = exactThreadId;
          return session;
        },
      ),
    },
    session,
    sendMessage,
  };
}

function makeSourceControl() {
  const sessions = new Map([
    [
      'session-1',
      {
        id: 'source-session-1',
        sessionId: 'session-1',
        projectRepositoryId: 'project-repository-1',
        orgId: 'org-1',
        userId: 'user-1',
        branch: 'factory/issue-1',
        baseBranch: 'main',
      },
    ],
    [
      'session-2',
      {
        id: 'source-session-2',
        sessionId: 'session-2',
        projectRepositoryId: 'project-repository-2',
        orgId: 'org-2',
        userId: 'user-1',
        branch: 'factory/issue-2',
        baseBranch: 'main',
      },
    ],
  ]);
  return {
    sessions: { getBySessionId: vi.fn(async (sessionId: string) => sessions.get(sessionId) ?? null) },
    projectRepositories: {
      get: vi.fn(async ({ id }: { id: string }) => ({ id, connectionId: `connection-${id}` })),
    },
    connections: { get: vi.fn(async () => ({ factoryProjectId: PROJECT_ID })) },
  };
}

function startRequest(
  overrides: Partial<{
    sessionId: string;
    kickoffKey: string;
    role: string;
    kickoffMessage: string | null;
    defaultModelId: string;
    id: string;
  }> = {},
) {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    sessionId: overrides.sessionId ?? 'session-1',
    threadTitle: 'Investigate issue 1',
    threadTags: { role: overrides.role ?? 'work' },
    kickoffKey: overrides.kickoffKey ?? 'kickoff-1',
    invocation:
      overrides.kickoffMessage === null
        ? undefined
        : { type: 'prompt' as const, prompt: overrides.kickoffMessage ?? 'Start work' },
    destinationStage: 'intake' as const,
    defaultModelId: overrides.defaultModelId,
    workItem: {
      id: overrides.id,
      role: overrides.role ?? 'work',
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue' as const,
          externalId: '1',
        },
        title: 'Fix issue 1',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    },
  };
}

describe('FactoryStartCoordinator', () => {
  it('uses authenticated run_start ingress to approve a classified feature into Planning', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = (
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: startRequest().workItem.input,
      })
    ).item;
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({ version: 'rules-v1' }),
    });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'intake',
      expectedRevision: item.revision,
      actor: { type: 'agent', bindingId: 'triage', role: 'triage' },
      ingress: { type: 'agent', identity: 'triage-classify' },
      cause: 'await approval',
      triageType: 'feature request',
    });
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      transitionService,
      makeSourceControl() as never,
    );

    const prepared = await coordinator.prepare({
      ...startRequest({ id: item.id, role: 'plan' }),
      destinationStage: 'planning',
    });

    expect(prepared.workItemId).toBe(item.id);
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['planning']);
  });

  it('uses authenticated run_start ingress to approve a classified feature into Execute', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const item = (
      await storage.upsert({
        orgId: 'org-1',
        userId: 'user-1',
        factoryProjectId: PROJECT_ID,
        input: { ...startRequest().workItem.input, stages: ['planning'] },
      })
    ).item;
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({ version: 'rules-v1' }),
    });
    await transitionService.transition({
      orgId: 'org-1',
      factoryProjectId: PROJECT_ID,
      workItemId: item.id,
      board: 'work',
      stage: 'planning',
      expectedRevision: item.revision,
      actor: { type: 'agent', bindingId: 'triage', role: 'triage' },
      ingress: { type: 'agent', identity: 'triage-classify-execute' },
      cause: 'await approval',
      triageType: 'feature request',
    });
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      transitionService,
      makeSourceControl() as never,
    );

    await coordinator.prepare({
      ...startRequest({ id: item.id, role: 'work' }),
      destinationStage: 'execute',
    });

    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['execute']);
  });

  it('commits the item session, exact binding, and durable pending start', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    const prepared = await coordinator.prepare(startRequest());

    expect(prepared).toMatchObject({
      threadId: 'session-1',
      resourceId: 'session-1',
      sessionId: 'session-1',
      kickoffStatus: 'pending',
      replayed: false,
    });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('pending');
    const session = await vi.mocked(controller.createSession).mock.results[0]?.value;
    expect(session.permissions.setForTool).toHaveBeenCalledWith({
      toolName: 'factory_transition_work_item',
      policy: 'allow',
    });
    const requestContext = vi.mocked(controller.createSession).mock.calls[0]?.[0].requestContext;
    expect(requestContext?.get('user')).toEqual({
      workosId: 'user-1',
      organizationId: 'org-1',
      orgFirstCredentials: true,
    });
    expect(sendMessage).not.toHaveBeenCalled();
    const item = await storage.get({ orgId: 'org-1', id: prepared.workItemId });
    expect(item?.sessions.work).toMatchObject({
      threadId: 'session-1',
      sessionId: 'session-1',
      branch: 'factory/issue-1',
      startedBy: 'user-1',
    });
  });

  it('grants plan preapproval only on a hands-off start, and a later one upgrades the item', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    const plain = await coordinator.prepare(startRequest());
    expect((await storage.get({ orgId: 'org-1', id: plain.workItemId }))?.plansPreapprovedAt ?? null).toBeNull();

    const handsOff = await coordinator.prepare({
      ...startRequest({ kickoffKey: 'kickoff-2' }),
      preapprovePlans: true,
    });
    expect(handsOff.workItemId).toBe(plain.workItemId);
    expect((await storage.get({ orgId: 'org-1', id: handsOff.workItemId }))?.plansPreapprovedAt).toBeInstanceOf(Date);
  });

  it('seeds caller identity into an existing request context', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );
    const requestContext = new RequestContext();

    await coordinator.prepare({ ...startRequest(), requestContext });

    expect(requestContext.get('user')).toEqual({
      workosId: 'user-1',
      organizationId: 'org-1',
      orgFirstCredentials: true,
    });
  });

  it('keeps an authenticated identity but marks the run org-first for credentials', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'authenticated-user', organizationId: 'org-1' });

    await coordinator.prepare({ ...startRequest(), requestContext });

    expect(requestContext.get('user')).toEqual({
      workosId: 'authenticated-user',
      organizationId: 'org-1',
      orgFirstCredentials: true,
    });
  });

  it('applies the Factory default model before preparing a board run', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    await coordinator.prepare(startRequest({ defaultModelId: 'anthropic/claude-fable-5' }));

    expect(session.model.switch).toHaveBeenCalledWith({ modelId: 'anthropic/claude-fable-5' });
  });

  it('hydrates board runs with built-in memory defaults, never per-user settings', async () => {
    // The connection owner ("user-1") has personal OM settings stored — a
    // board run must not inherit them: it hydrates with the built-in defaults.
    const storage = await createFactoryStorageForTests();
    await storage.memorySettings.patch({
      orgId: 'org-1',
      userId: 'user-1',
      patch: {
        observerModelId: 'anthropic/claude-haiku-4-5',
        reflectorModelId: 'anthropic/claude-haiku-4-5',
        observationThreshold: 12_000,
        reflectionThreshold: 23_000,
        observeAttachments: false,
      },
    });
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage.workItems,
      undefined,
      makeSourceControl() as never,
      storage.memorySettings,
    );

    await coordinator.prepare(startRequest());

    expect(session.om.observer.switchModel).toHaveBeenCalledWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(session.om.reflector.switchModel).toHaveBeenCalledWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(session.state.set).toHaveBeenCalledWith({
      observationThreshold: DEFAULT_OBSERVATION_THRESHOLD,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
    });
  });

  it("hydrates board runs with the factory project's shared memory settings when stored", async () => {
    const storage = await createFactoryStorageForTests();
    await storage.memorySettings.patch({
      orgId: 'org-1',
      userId: factoryMemorySettingsUserId(PROJECT_ID),
      patch: {
        observerModelId: 'anthropic/claude-haiku-4-5',
        reflectorModelId: 'anthropic/claude-opus-5',
        observationThreshold: 12_000,
        reflectionThreshold: 23_000,
        observeAttachments: true,
      },
    });
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage.workItems,
      undefined,
      makeSourceControl() as never,
      storage.memorySettings,
    );

    await coordinator.prepare(startRequest());

    expect(session.om.observer.switchModel).toHaveBeenCalledWith({ modelId: 'anthropic/claude-haiku-4-5' });
    expect(session.om.reflector.switchModel).toHaveBeenCalledWith({ modelId: 'anthropic/claude-opus-5' });
    expect(session.state.set).toHaveBeenCalledWith({
      observationThreshold: 12_000,
      reflectionThreshold: 23_000,
      observeAttachments: true,
    });
  });

  it('continues preparing a board run when its saved default model is no longer available', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    session.model.switch.mockRejectedValueOnce(new Error('Unknown model'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    await expect(
      coordinator.prepare(startRequest({ defaultModelId: 'anthropic/claude-fable-5' })),
    ).resolves.toMatchObject({ threadId: 'session-1', kickoffStatus: 'pending' });
    expect(warn).toHaveBeenCalledWith('[Factory Start] Failed to apply factory default model', {
      modelId: 'anthropic/claude-fable-5',
      error: 'Unknown model',
    });
    warn.mockRestore();
  });

  it('binds before requesting the governed run-stage transition', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    let bindingsDuringRule = 0;
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: {
            execute: {
              issue: {
                onEnter: async () => {
                  bindingsDuringRule = (await storage.listRunBindings('org-1', PROJECT_ID)).length;
                },
              },
            },
          },
        },
      }),
    });
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      transitionService,
      makeSourceControl() as never,
    );

    const prepared = await coordinator.prepare({ ...startRequest(), destinationStage: 'execute' });

    expect(prepared.revision).toBe(2);
    expect((await storage.get({ orgId: 'org-1', id: prepared.workItemId }))?.stages).toEqual(['execute']);
    expect(bindingsDuringRule).toBe(1);
    expect(sendMessage).not.toHaveBeenCalled();
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]?.status).toBe('pending');
  });

  it('binds the controller session to the exact Factory session thread', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    const prepared = await coordinator.prepare(startRequest({ kickoffMessage: null }));

    expect(prepared).toMatchObject({ threadId: 'session-1', resourceId: 'session-1', sessionId: 'session-1' });
    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-1',
        resourceId: 'session-1',
        threadId: 'session-1',
        tags: { factoryProjectId: PROJECT_ID, projectRepositoryId: 'project-repository-1' },
      }),
    );
    // Bound-agent gates (transition tool, factory-phase processor) resolve the
    // session address from controller state — the coordinator must seed it
    // server-side, never relying on a browser connecting to set it.
    expect(session.state.set).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      projectRepositoryId: 'project-repository-1',
      factoryOrgId: 'org-1',
    });
    expect(session.thread.list).not.toHaveBeenCalled();
    expect(session.thread.switch).not.toHaveBeenCalled();
    expect(session.thread.create).not.toHaveBeenCalled();
  });

  it('tags pull-request review sessions with untrustedCheckout', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    const request = startRequest({ role: 'review', kickoffMessage: null });
    request.workItem.input.externalSource.type = 'pull-request' as never;
    await coordinator.prepare(request);

    // The PR checkout is attacker-writable third-party content — the SDK
    // reads this flag to skip AGENTS.md/CLAUDE.md ingestion for the session.
    // `baseRef` carries the trusted ref (the session's base branch) that the
    // SDK may serve instruction files from instead.
    expect(session.state.set).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      projectRepositoryId: 'project-repository-1',
      factoryOrgId: 'org-1',
      untrustedCheckout: true,
      baseRef: 'main',
    });
  });

  it.each(['factory-review', 'factory-rereview'] as const)(
    'tags %s skill kickoffs with untrustedCheckout',
    async skillName => {
      const storage = (await createFactoryStorageForTests()).workItems;
      const { controller, session } = makeController();
      session.getWorkspace.mockReturnValue({
        skills: {
          maybeRefresh: vi.fn(async () => {}),
          get: vi.fn(async () => ({ name: skillName, description: 'Review a PR', instructions: 'Review.' })),
        },
      } as never);
      const coordinator = new FactoryStartCoordinator(
        controller as never,
        storage,
        undefined,
        makeSourceControl() as never,
      );

      const request = startRequest({ kickoffMessage: null });
      request.invocation = { type: 'skill', skillName, arguments: 'PR #1' } as never;
      await coordinator.prepare(request);

      expect(session.state.set).toHaveBeenCalledWith({
        factoryProjectId: PROJECT_ID,
        projectRepositoryId: 'project-repository-1',
        factoryOrgId: 'org-1',
        untrustedCheckout: true,
        baseRef: 'main',
      });
    },
  );

  it('falls back to intake metadata for baseRef when the session record has no base branch', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const sourceControl = makeSourceControl();
    const record = await sourceControl.sessions.getBySessionId('session-1');
    record!.baseBranch = '';
    const coordinator = new FactoryStartCoordinator(controller as never, storage, undefined, sourceControl as never);

    const request = startRequest({ role: 'review', kickoffMessage: null });
    request.workItem.input.externalSource.type = 'pull-request' as never;
    request.workItem.input.metadata = { baseBranch: 'release-1.x' };
    await coordinator.prepare(request);

    expect(session.state.set).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      projectRepositoryId: 'project-repository-1',
      factoryOrgId: 'org-1',
      untrustedCheckout: true,
      baseRef: 'release-1.x',
    });
  });

  it('does not tag issue work sessions with untrustedCheckout', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    await coordinator.prepare(startRequest({ kickoffMessage: null }));

    expect(session.state.set).toHaveBeenCalledWith({
      factoryProjectId: PROJECT_ID,
      projectRepositoryId: 'project-repository-1',
      factoryOrgId: 'org-1',
    });
  });

  it('reuses the exact Factory session thread across roles', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, session } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    const triage = await coordinator.prepare(
      startRequest({ role: 'triage', kickoffKey: 'triage-1', kickoffMessage: null }),
    );
    const plan = await coordinator.prepare(
      startRequest({ id: triage.workItemId, role: 'plan', kickoffKey: 'plan-1', kickoffMessage: null }),
    );

    expect(plan.threadId).toBe('session-1');
    expect(plan.threadId).toBe(triage.threadId);
    expect(session.thread.create).not.toHaveBeenCalled();
    expect(session.thread.switch).not.toHaveBeenCalled();
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'factoryWorkItemId', value: triage.workItemId });
    const item = await storage.get({ orgId: 'org-1', id: triage.workItemId });
    expect(item?.sessions.triage?.threadId).toBe(triage.threadId);
    expect(item?.sessions.plan?.threadId).toBe(triage.threadId);
  });

  it('keeps the bound pending start recoverable and sends nothing when the governed transition rejects', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const transitionService = new FactoryTransitionService({
      storage,
      rules: defaultFactoryRules({
        version: 'rules-v1',
        overrides: {
          work: { execute: { issue: { onEnter: () => ({ type: 'reject', code: 'forbidden', reason: 'Blocked' }) } } },
        },
      }),
    });
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      transitionService,
      makeSourceControl() as never,
    );

    await expect(coordinator.prepare({ ...startRequest(), destinationStage: 'execute' })).rejects.toMatchObject({
      result: { status: 'rejected', code: 'forbidden' },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(await storage.listRunBindings('org-1', PROJECT_ID)).toHaveLength(1);
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({ status: 'failed' });
  });

  it('never sends a kickoff when the binding transaction fails', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    vi.spyOn(storage, 'prepareRunStart').mockRejectedValueOnce(new Error('commit failed'));
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );

    await expect(coordinator.prepare(startRequest())).rejects.toThrow('commit failed');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('replays the same durable pending kickoff and binding without dispatching it inline', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller, sendMessage } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );
    const input = startRequest();

    const first = await coordinator.prepare(input);
    const replay = await coordinator.prepare(input);

    expect(replay).toMatchObject({ workItemId: first.workItemId, bindingId: first.bindingId, replayed: true });
    expect((await storage.listPendingStarts('org-1', PROJECT_ID))[0]).toMatchObject({ status: 'pending' });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(await storage.listRunBindings('org-1', PROJECT_ID)).toHaveLength(1);
  });

  it('revokes only the prior binding for the same item role', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );
    const first = await coordinator.prepare(startRequest({ kickoffMessage: null }));

    await coordinator.prepare(
      startRequest({ id: first.workItemId, kickoffKey: 'kickoff-2', role: 'work', kickoffMessage: null }),
    );
    const bindings = await storage.listRunBindings('org-1', PROJECT_ID, first.workItemId);
    expect(bindings.map(binding => binding.status).sort()).toEqual(['active', 'revoked']);
    expect(bindings.every(binding => binding.role === 'work')).toBe(true);
  });

  it('scopes kickoff idempotency to tenant and project', async () => {
    const storage = (await createFactoryStorageForTests()).workItems;
    const { controller } = makeController();
    const coordinator = new FactoryStartCoordinator(
      controller as never,
      storage,
      undefined,
      makeSourceControl() as never,
    );
    const first = await coordinator.prepare(startRequest({ kickoffMessage: null }));
    const second = await coordinator.prepare({
      ...startRequest({ sessionId: 'session-2', kickoffMessage: null }),
      orgId: 'org-2',
      workItem: {
        ...startRequest().workItem,
        input: {
          ...startRequest().workItem.input,
          externalSource: { integrationId: 'github', type: 'issue' as const, externalId: '2' },
        },
      },
    });

    expect(second.replayed).toBe(false);
    expect(second.workItemId).not.toBe(first.workItemId);
    expect(await storage.listPendingStarts('org-1', PROJECT_ID)).toHaveLength(1);
    expect(await storage.listPendingStarts('org-2', PROJECT_ID)).toHaveLength(1);
  });

  describe('feed context injection', () => {
    async function seedItemWithComment() {
      const seed = await createFactoryStorageForTests();
      const item = (
        await seed.workItems.upsert({
          orgId: 'org-1',
          userId: 'user-1',
          factoryProjectId: PROJECT_ID,
          input: startRequest().workItem.input,
        })
      ).item;
      await seed.comments.create({
        orgId: 'org-1',
        factoryProjectId: PROJECT_ID,
        workItemId: item.id,
        author: { kind: 'user', id: 'user-2', displayName: 'Bob' },
        body: 'ship it behind the flag',
      });
      return { seed, item };
    }

    function coordinatorWith(
      seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>,
      reader?: FactoryFeedReader,
    ) {
      const { controller } = makeController();
      return new FactoryStartCoordinator(
        controller as never,
        seed.workItems,
        undefined,
        makeSourceControl() as never,
        undefined,
        reader,
      );
    }

    it('appends the feed to the kickoff of an existing item', async () => {
      const { seed, item } = await seedItemWithComment();
      const coordinator = coordinatorWith(seed, new FactoryFeedReader(seed.comments));

      await coordinator.prepare(startRequest({ id: item.id }));

      const message = (await seed.workItems.listPendingStarts('org-1', PROJECT_ID))[0]?.message;
      expect(message).toMatch(/^Start work\n\n<work-item-feed>\n/);
      expect(message).toContain('ship it behind the flag');
      expect(message).toContain('[Bob · ');
    });

    it('leaves a new item kickoff untouched even with a reader injected', async () => {
      const { seed } = await seedItemWithComment();
      const coordinator = coordinatorWith(seed, new FactoryFeedReader(seed.comments));

      await coordinator.prepare(startRequest());

      expect((await seed.workItems.listPendingStarts('org-1', PROJECT_ID))[0]?.message).toBe('Start work');
    });

    it('is byte-identical when no reader is injected', async () => {
      const { seed, item } = await seedItemWithComment();
      const coordinator = coordinatorWith(seed);

      await coordinator.prepare(startRequest({ id: item.id }));

      expect((await seed.workItems.listPendingStarts('org-1', PROJECT_ID))[0]?.message).toBe('Start work');
    });
  });
});
