import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { SupervisorRoutes } from './supervisor.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const user = { workosId: 'user-1', organizationId: 'org-1' };
let seed: FactoryStorageTestSeed;
let projectId: string;

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  projectId = (await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Factory project' } })).id;
});

function appFor(authUser: typeof user | null, service: { ensureSession: Function; getState: Function }) {
  const app = new Hono();
  const requestContext = new RequestContext();
  app.use('*', async (context, next) => {
    if (authUser) context.set('factoryAuthUser' as never, authUser as never);
    context.set('requestContext' as never, requestContext as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new SupervisorRoutes({ auth: fakeRouteAuth(), projects: seed.projects, service: service as never }).routes(),
  );
  return { app, requestContext };
}

describe('Factory supervisor routes', () => {
  it('ensures and returns the canonical session using authenticated identity', async () => {
    const ensureSession = vi.fn(async (input: Record<string, unknown>) => ({
      factoryProjectId: input.factoryProjectId,
      resourceId: input.factoryProjectId,
      sessionId: `${input.factoryProjectId}-supervisor`,
      threadId: `${input.factoryProjectId}-supervisor`,
    }));
    const { app, requestContext } = appFor(user, { ensureSession, getState: vi.fn() });
    const response = await app.request(`/web/factory/projects/${projectId}/supervisor/session`, { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      session: {
        factoryProjectId: projectId,
        resourceId: projectId,
        sessionId: `${projectId}-supervisor`,
        threadId: `${projectId}-supervisor`,
      },
    });
    expect(ensureSession).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: projectId,
      requestContext,
    });
  });

  it('returns the bounded state summary', async () => {
    const getState = vi.fn(async () => ({
      factoryProjectId: projectId,
      totalItems: 2,
      counts: { byBoard: { work: 2 }, byStage: { execute: 1, intake: 1 } },
      pendingApprovals: [],
    }));
    const { app } = appFor(user, { ensureSession: vi.fn(), getState });
    const response = await app.request(`/web/factory/projects/${projectId}/supervisor/state`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ state: { totalItems: 2, pendingApprovals: [] } });
    expect(getState).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1', factoryProjectId: projectId });
  });

  it('returns 404 across tenant boundaries and 401 without authentication', async () => {
    const service = { ensureSession: vi.fn(), getState: vi.fn() };
    const other = appFor({ workosId: 'user-2', organizationId: 'org-2' }, service);
    const crossTenant = await other.app.request(`/web/factory/projects/${projectId}/supervisor/session`, {
      method: 'POST',
    });
    expect(crossTenant.status).toBe(404);
    expect(service.ensureSession).not.toHaveBeenCalled();

    const anonymous = appFor(null, service);
    const unauthorized = await anonymous.app.request(`/web/factory/projects/${projectId}/supervisor/state`);
    expect(unauthorized.status).toBe(401);
  });

  it('maps canonical-session conflicts to a bounded 409 response', async () => {
    const { app } = appFor(user, {
      ensureSession: vi.fn(async () => {
        throw new Error('Factory supervisor resource is already bound to a non-canonical session.');
      }),
      getState: vi.fn(),
    });
    const response = await app.request(`/web/factory/projects/${projectId}/supervisor/session`, { method: 'POST' });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'supervisor_session_unavailable',
      message: 'Factory supervisor resource is already bound to a non-canonical session.',
    });
  });
});
