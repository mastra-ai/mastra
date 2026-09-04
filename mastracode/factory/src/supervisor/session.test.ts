import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  hydrateSupervisorSession,
  parseSupervisorResourceId,
  resolveSupervisorScope,
  supervisorResourceId,
  supervisorThreadId,
} from './session.js';

function requestContext(
  overrides: Partial<{ orgId: string; resourceId: string; user: boolean; state: Record<string, unknown> }> = {},
) {
  const context = new RequestContext();
  // `user: false` models a signal-driven turn (e.g. notification delivery),
  // whose reconstructed context carries only the controller entry.
  if (overrides.user !== false) {
    context.set('user', { workosId: 'user-1', organizationId: overrides.orgId ?? 'org-1' });
  }
  context.set('controller', {
    resourceId: overrides.resourceId ?? 'resource-1',
    threadId: 'thread-1',
    scope: '/',
    session: { id: 'session-1', ownerId: 'code', modeId: 'build' },
    state: overrides.state ?? {},
    getState: () => overrides.state ?? {},
  });
  return context;
}

async function seedProject(defaultModelId: string | null = 'anthropic/claude-sonnet-4') {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'Mastra', ...(defaultModelId ? { defaultModelId } : {}) },
  });
  return { ...seed, project };
}

describe('supervisor resource ids', () => {
  it('round-trips a project id and shares it with the thread', () => {
    expect(supervisorResourceId('p-1')).toBe('factory-supervisor:p-1');
    expect(supervisorThreadId('p-1')).toBe('factory-supervisor:p-1');
    expect(parseSupervisorResourceId('factory-supervisor:p-1')).toBe('p-1');
    expect(parseSupervisorResourceId('factory-supervisor:')).toBeNull();
    expect(parseSupervisorResourceId('channel:slack:C1')).toBeNull();
    expect(parseSupervisorResourceId(undefined)).toBeNull();
  });
});

describe('resolveSupervisorScope', () => {
  it('scopes a supervisor session to the project its org owns', async () => {
    const { projects, project } = await seedProject();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({ resourceId: supervisorResourceId(project.id) }),
        projects,
      }),
    ).resolves.toEqual({ orgId: 'org-1', factoryProjectId: project.id, via: 'auth' });
  });

  it('yields nothing for ordinary sessions, foreign orgs, or unknown projects', async () => {
    const { projects, project } = await seedProject();
    await expect(resolveSupervisorScope({ requestContext: requestContext(), projects })).resolves.toBeNull();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({ resourceId: supervisorResourceId(project.id), orgId: 'org-2' }),
        projects,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({ resourceId: supervisorResourceId('missing') }),
        projects,
      }),
    ).resolves.toBeNull();
  });
});

describe('resolveSupervisorScope on signal turns (no factory auth)', () => {
  it('trusts hydration-stamped state once storage confirms ownership', async () => {
    const { projects, project } = await seedProject();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({
          user: false,
          resourceId: supervisorResourceId(project.id),
          state: { factoryProjectId: project.id, factoryOrgId: 'org-1' },
        }),
        projects,
      }),
    ).resolves.toEqual({ orgId: 'org-1', factoryProjectId: project.id, via: 'session-state' });
  });

  it('yields nothing without stamped state', async () => {
    const { projects, project } = await seedProject();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({ user: false, resourceId: supervisorResourceId(project.id) }),
        projects,
      }),
    ).resolves.toBeNull();
  });

  it('rejects state whose project id does not match the resourceId', async () => {
    const { projects, project } = await seedProject();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({
          user: false,
          resourceId: supervisorResourceId(project.id),
          state: { factoryProjectId: 'some-other-project', factoryOrgId: 'org-1' },
        }),
        projects,
      }),
    ).resolves.toBeNull();
  });

  it('rejects forged state naming an org that does not own the project', async () => {
    const { projects, project } = await seedProject();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({
          user: false,
          resourceId: supervisorResourceId(project.id),
          state: { factoryProjectId: project.id, factoryOrgId: 'org-evil' },
        }),
        projects,
      }),
    ).resolves.toBeNull();
  });

  it('rejects stale state when the project no longer exists', async () => {
    const { projects } = await seedProject();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({
          user: false,
          resourceId: supervisorResourceId('deleted-project'),
          state: { factoryProjectId: 'deleted-project', factoryOrgId: 'org-1' },
        }),
        projects,
      }),
    ).resolves.toBeNull();
  });

  it('never falls back to state for an authenticated caller with a foreign org', async () => {
    const { projects, project } = await seedProject();
    await expect(
      resolveSupervisorScope({
        requestContext: requestContext({
          orgId: 'org-2',
          resourceId: supervisorResourceId(project.id),
          state: { factoryProjectId: project.id, factoryOrgId: 'org-1' },
        }),
        projects,
      }),
    ).resolves.toBeNull();
  });
});

describe('hydrateSupervisorSession', () => {
  function sessionDouble(resourceId: string) {
    const state: Record<string, unknown> = {};
    return {
      identity: { getResourceId: () => resourceId },
      state: {
        get: () => state,
        set: vi.fn(async (updates: Record<string, unknown>) => void Object.assign(state, updates)),
      },
      model: { switch: vi.fn().mockResolvedValue(undefined) },
      om: {
        observer: { modelId: () => undefined, switchModel: vi.fn().mockResolvedValue(undefined) },
        reflector: { modelId: () => undefined, switchModel: vi.fn().mockResolvedValue(undefined) },
      },
      readState: () => state,
    };
  }

  it('stamps the project and org and applies the factory default model', async () => {
    const { projects, project } = await seedProject();
    const session = sessionDouble(supervisorResourceId(project.id));

    await hydrateSupervisorSession(session as never, { projects });

    expect(session.readState()).toMatchObject({
      factoryProjectId: project.id,
      factoryOrgId: 'org-1',
    });
    expect(session.model.switch).toHaveBeenCalledWith({ modelId: 'anthropic/claude-sonnet-4' });
  });

  it('keeps the current model when the project has no default model', async () => {
    const { projects, project } = await seedProject(null);
    const session = sessionDouble(supervisorResourceId(project.id));

    await hydrateSupervisorSession(session as never, { projects });

    expect(session.state.set).toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('leaves sessions that are not supervisors alone', async () => {
    const { projects } = await seedProject();
    const session = sessionDouble('session-1');

    await hydrateSupervisorSession(session as never, { projects });

    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.model.switch).not.toHaveBeenCalled();
  });
});
