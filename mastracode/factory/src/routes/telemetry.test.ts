import type { ApiRoute, IMastraAuthProvider } from '@mastra/core/server';
import { Hono } from 'hono';
import type { PostHog } from 'posthog-node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAuthRoutes } from '../auth.js';
import type { FactoryAuthUser } from '../auth.js';
import { TelemetryRoutes } from './telemetry.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import type { TestAuthUser } from './test-utils.js';

const { capture } = vi.hoisted(() => ({ capture: vi.fn<PostHog['capture']>() }));
vi.mock('posthog-node', () => ({
  PostHog: class {
    capture = capture;
  },
}));

const user = { workosId: 'user_123', organizationId: 'org_123' };
const body = { activity: 'page_view', page: 'work' };

function buildApp(options: { user?: TestAuthUser; enabled?: boolean; providerName?: string } = {}) {
  const app = new Hono<{ Variables: { factoryAuthUser: TestAuthUser } }>();
  app.use('*', async (c, next) => {
    if (options.user) c.set('factoryAuthUser', options.user);
    await next();
  });
  const routes = new TelemetryRoutes({
    auth: fakeRouteAuth({ enabled: options.enabled }),
    providerName: options.providerName ?? 'mastra-studio',
    publicOrigin: 'http://localhost:4111',
    allowedOrigins: ['http://localhost:5173'],
  }).routes();
  // The generic route-test helper mounts handlers; mount middleware as well so
  // oversized requests exercise the same body limit as the production adapter.
  for (const route of routes) {
    if (route.middleware) app.use(route.path, ...[route.middleware].flat());
  }
  mountApiRoutes(app, routes);
  return app;
}

function request(payload: unknown = body, headers: Record<string, string> = {}) {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) };
}

beforeEach(() => {
  capture.mockReset();
  for (const name of [
    'MASTRA_TELEMETRY_DISABLED',
    'MASTRA_PROJECT_ID',
    'MASTRA_DEPLOYMENT_ID',
    'MASTRA_PLATFORM_REGION',
  ]) {
    vi.stubEnv(name, '');
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Factory web activity', () => {
  it('attributes hosted usage to the authenticated account and server metadata', async () => {
    vi.stubEnv('MASTRA_PROJECT_ID', ' project_123 ');
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', ' deployment_123 ');
    vi.stubEnv('MASTRA_PLATFORM_REGION', ' us-east ');
    const response = await buildApp({ user }).request('/web/telemetry/activity', request());
    expect(response.status).toBe(204);
    expect(capture).toHaveBeenCalledExactlyOnceWith({
      distinctId: 'factory:platform:user_123',
      event: 'factory_web_activity',
      properties: {
        schema_version: 1,
        activity: 'page_view',
        page: 'work',
        platform_user_id: 'user_123',
        platform_org_id: 'org_123',
        platform_hosted: true,
        platform_project_id: 'project_123',
        deployment_id: 'deployment_123',
        platform_region: 'us-east',
      },
    });
  });

  it('does not mistake a platform-backed local server for platform hosting', async () => {
    vi.stubEnv('MASTRA_PROJECT_ID', 'project_123');
    vi.stubEnv('MASTRA_PLATFORM_REGION', 'us-east');
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', '  ');
    await buildApp({ user }).request('/web/telemetry/activity', request());
    expect(capture.mock.calls[0]?.[0].properties).toMatchObject({
      platform_hosted: false,
      platform_project_id: 'project_123',
    });
    expect(capture.mock.calls[0]?.[0].properties?.deployment_id).toBeUndefined();
  });

  it('keeps the same person across projects, organizations, and hosting locations', async () => {
    await buildApp({ user }).request('/web/telemetry/activity', request());
    vi.stubEnv('MASTRA_PROJECT_ID', 'other-project');
    vi.stubEnv('MASTRA_DEPLOYMENT_ID', 'other-deployment');
    await buildApp({ user: { ...user, organizationId: 'other-org' } }).request('/web/telemetry/activity', request());
    await buildApp({ user: { ...user, workosId: 'other-user' } }).request('/web/telemetry/activity', request());
    expect(capture.mock.calls.map(([event]) => event.distinctId)).toEqual([
      'factory:platform:user_123',
      'factory:platform:user_123',
      'factory:platform:other-user',
    ]);
  });

  it.each([{}, { user, enabled: false }])('rejects unauthenticated or no-auth usage (%j)', async options => {
    expect((await buildApp(options).request('/web/telemetry/activity', request())).status).toBe(401);
    expect(capture).not.toHaveBeenCalled();
  });

  it.each(['1', 'true', ' YES '])('honors the telemetry opt-out (%s)', async value => {
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', value);
    expect((await buildApp({ user }).request('/web/telemetry/activity', request())).status).toBe(204);
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not merge custom-provider accounts with platform accounts', async () => {
    await buildApp({ user, providerName: 'workos' }).request('/web/telemetry/activity', request());
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    { ...body, userId: 'someone-else' },
    { ...body, platform_project_id: 'forged' },
    { ...body, orgId: 'forged' },
    { ...body, factoryId: 'forged' },
    { ...body, page: '/work?token=private' },
    { ...body, activity: 'login' },
  ])('rejects unknown properties and unbounded values (%j)', async payload => {
    expect((await buildApp({ user }).request('/web/telemetry/activity', request(payload))).status).toBe(400);
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects oversized, malformed, non-JSON, and foreign-origin requests', async () => {
    const app = buildApp({ user });
    expect((await app.request('/web/telemetry/activity', request({ ...body, extra: 'x'.repeat(600) }))).status).toBe(
      413,
    );
    expect((await app.request('/web/telemetry/activity', { ...request(), body: '{' })).status).toBe(400);
    expect((await app.request('/web/telemetry/activity', request(body, { 'Content-Type': 'text/plain' }))).status).toBe(
      415,
    );
    expect(
      (await app.request('/web/telemetry/activity', request(body, { Origin: 'https://other.example' }))).status,
    ).toBe(403);
    expect(capture).not.toHaveBeenCalled();
    expect(
      (await app.request('/web/telemetry/activity', request(body, { Origin: 'http://localhost:5173' }))).status,
    ).toBe(204);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('bounds per-account captures and recovers after the rate window', async () => {
    vi.useFakeTimers();
    const app = buildApp({ user });
    for (let i = 0; i < 65; i++) await app.request('/web/telemetry/activity', request());
    expect(capture).toHaveBeenCalledTimes(60);
    vi.advanceTimersByTime(60_000);
    await app.request('/web/telemetry/activity', request());
    expect(capture).toHaveBeenCalledTimes(61);
  });

  it('does not fail the endpoint when the analytics client fails', async () => {
    capture.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    expect((await buildApp({ user }).request('/web/telemetry/activity', request())).status).toBe(204);
  });
});

describe('authenticated telemetry capability', () => {
  function authApp(providerName: string, authenticated = true) {
    const provider: IMastraAuthProvider<FactoryAuthUser> = {
      name: providerName,
      authenticateToken: async () => (authenticated ? { id: 'user_123', organizationId: 'org_123' } : null),
      authorizeUser: () => true,
    };
    const app = new Hono();
    const routes: ApiRoute[] = buildAuthRoutes(provider);
    mountApiRoutes(app, routes);
    return app;
  }

  it('advertises capture only for signed-in platform accounts with telemetry enabled', async () => {
    const app = authApp('mastra-studio');
    expect(await (await app.request('/auth/me')).json()).toMatchObject({ authenticated: true, telemetryEnabled: true });
    vi.stubEnv('MASTRA_TELEMETRY_DISABLED', 'true');
    expect(await (await app.request('/auth/me')).json()).toMatchObject({
      authenticated: true,
      telemetryEnabled: false,
    });
  });

  it('does not enable capture for custom providers or signed-out visitors', async () => {
    expect(await (await authApp('workos').request('/auth/me')).json()).toMatchObject({ telemetryEnabled: false });
    expect(await (await authApp('mastra-studio', false).request('/auth/me')).json()).toEqual({
      authenticated: false,
      user: null,
      provider: 'mastra-studio',
    });
  });
});
