import { describe, expect, it, vi } from 'vitest';

import { FACTORY_SUPERVISOR_INSTRUCTIONS } from './instructions.js';
import { FactorySupervisorService, factorySupervisorThreadId } from './service.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const ORG_ID = 'org-1';

function fixture(options: { projectExists?: boolean; liveState?: Record<string, unknown> } = {}) {
  const threadId = factorySupervisorThreadId(PROJECT_ID);
  let state = {
    pluginInstructions: ['Existing instruction.'],
    factoryProjectId: PROJECT_ID,
    factoryOrgId: ORG_ID,
    factorySupervisor: true,
    ...options.liveState,
  };
  const session = {
    identity: { getResourceId: () => `${PROJECT_ID}-supervisor` },
    thread: {
      getId: vi.fn(() => threadId),
      getById: vi.fn(async () => ({
        id: threadId,
        resourceId: `${PROJECT_ID}-supervisor`,
        metadata: { factoryProjectId: PROJECT_ID, factoryOrgId: ORG_ID, factorySupervisor: 'true' },
      })),
      rename: vi.fn(async () => undefined),
      switch: vi.fn(async () => undefined),
    },
    state: {
      get: vi.fn(() => state),
      set: vi.fn(async (updates: Record<string, unknown>) => {
        state = { ...state, ...updates };
      }),
    },
  };
  let live = options.liveState ? session : undefined;
  // A factory-level (non-supervisor) session always occupies the bare factory
  // id in practice — the supervisor must never resolve or collide with it.
  const factoryLevelSession = { state: { get: vi.fn(() => ({})) } };
  const controller = {
    getSessionByResource: vi.fn(async (resourceId: string) =>
      resourceId === `${PROJECT_ID}-supervisor` ? live : resourceId === PROJECT_ID ? factoryLevelSession : undefined,
    ),
    createSession: vi.fn(async (_input: Record<string, unknown>) => {
      live = session;
      return session;
    }),
  };
  const projects = {
    ensureReady: vi.fn(async () => undefined),
    get: vi.fn(async ({ orgId, id }: { orgId: string; id: string }) =>
      options.projectExists === false || orgId !== ORG_ID || id !== PROJECT_ID
        ? null
        : { id, defaultModelId: 'openai/gpt-4.1' },
    ),
  };
  const workItems = {
    ensureReady: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
  };
  const approvals = { list: vi.fn(async () => []), get: vi.fn(), resolve: vi.fn() };
  const primeCredentials = vi.fn(async () => undefined);
  const service = new FactorySupervisorService({
    controller: controller as never,
    projects: projects as never,
    workItems: workItems as never,
    approvals,
    primeCredentials,
  });
  return { service, controller, projects, session, primeCredentials, getState: () => state };
}

describe('FactorySupervisorService', () => {
  it('creates the deterministic repo-less singleton and installs supervisor instructions', async () => {
    const { service, controller, session, primeCredentials, getState } = fixture();
    const address = await service.ensureSession({ orgId: ORG_ID, userId: 'user-1', factoryProjectId: PROJECT_ID });

    expect(address).toEqual({
      factoryProjectId: PROJECT_ID,
      resourceId: `${PROJECT_ID}-supervisor`,
      sessionId: `${PROJECT_ID}-supervisor`,
      threadId: `${PROJECT_ID}-supervisor`,
    });
    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `${PROJECT_ID}-supervisor`,
        ownerId: `factory:${ORG_ID}`,
        resourceId: `${PROJECT_ID}-supervisor`,
        threadId: `${PROJECT_ID}-supervisor`,
        tags: {
          factoryProjectId: PROJECT_ID,
          factoryOrgId: ORG_ID,
          factorySupervisor: 'true',
          currentModelId: 'openai/gpt-4.1',
        },
      }),
    );
    expect(controller.createSession.mock.calls[0]?.[0]).not.toHaveProperty('scope');
    expect(controller.createSession.mock.calls[0]?.[0]).not.toHaveProperty('workspace');
    // Regression: the bare factory id belongs to the factory-level session
    // provisioned by /ensure; the supervisor must address its own resource.
    expect(controller.getSessionByResource).toHaveBeenCalledWith(`${PROJECT_ID}-supervisor`);
    expect(controller.getSessionByResource).not.toHaveBeenCalledWith(PROJECT_ID);
    expect(primeCredentials).toHaveBeenCalledWith({ orgId: ORG_ID, userId: 'user-1' });
    expect(session.thread.rename).toHaveBeenCalledWith({ title: 'Factory Supervisor' });
    expect(getState()).toMatchObject({
      factoryProjectId: PROJECT_ID,
      factoryOrgId: ORG_ID,
      factorySupervisor: true,
      projectPath: undefined,
      projectRepositoryId: undefined,
      worktreePath: undefined,
    });
    expect(getState().pluginInstructions).toContain(FACTORY_SUPERVISOR_INSTRUCTIONS);
  });

  it('coalesces concurrent creation and reuses the transcript across users', async () => {
    const { service, controller, primeCredentials } = fixture();
    const [first, second] = await Promise.all([
      service.ensureSession({ orgId: ORG_ID, userId: 'user-1', factoryProjectId: PROJECT_ID }),
      service.ensureSession({ orgId: ORG_ID, userId: 'user-2', factoryProjectId: PROJECT_ID }),
    ]);
    const third = await service.ensureSession({ orgId: ORG_ID, userId: 'user-2', factoryProjectId: PROJECT_ID });

    expect(first).toEqual(second);
    expect(third.threadId).toBe(first.threadId);
    expect(controller.createSession).toHaveBeenCalledOnce();
    expect(primeCredentials).toHaveBeenCalledWith({ orgId: ORG_ID, userId: 'user-1' });
    expect(primeCredentials).toHaveBeenCalledWith({ orgId: ORG_ID, userId: 'user-2' });
  });

  it('fails closed for another tenant or a mismatched live resource', async () => {
    const missing = fixture({ projectExists: false });
    await expect(
      missing.service.ensureSession({ orgId: ORG_ID, userId: 'user-1', factoryProjectId: OTHER_PROJECT_ID }),
    ).rejects.toThrow('Factory project not found');

    const mismatched = fixture({ liveState: { factoryOrgId: 'org-other' } });
    await expect(
      mismatched.service.ensureSession({ orgId: ORG_ID, userId: 'user-1', factoryProjectId: PROJECT_ID }),
    ).rejects.toThrow('non-canonical session');
    expect(mismatched.controller.createSession).not.toHaveBeenCalled();
  });

  it('returns bounded Factory state scoped through tenant-aware storage calls', async () => {
    const { service } = fixture();
    const state = await service.getState({ orgId: ORG_ID, factoryProjectId: PROJECT_ID });
    expect(state).toEqual({
      factoryProjectId: PROJECT_ID,
      totalItems: 0,
      counts: { byBoard: {}, byStage: {} },
      pendingApprovalCount: 0,
      pendingApprovals: [],
      snapshotAt: expect.any(String),
    });
  });
});
