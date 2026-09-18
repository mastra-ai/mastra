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

function requestContext(overrides: Partial<{ orgId: string; resourceId: string }> = {}) {
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: overrides.orgId ?? 'org-1' });
  context.set('controller', {
    resourceId: overrides.resourceId ?? 'resource-1',
    threadId: 'thread-1',
    scope: '/',
    session: { id: 'session-1', ownerId: 'code', modeId: 'build' },
    getState: () => ({}),
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
    ).resolves.toEqual({ orgId: 'org-1', factoryProjectId: project.id });
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
