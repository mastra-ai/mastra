import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FactoryIntegration } from '../integrations/base.js';
import { PlatformLinearIntegration } from '../integrations/platform/linear/integration.js';
import { builtInFactoryRules } from '../rules/defaults.js';
import { assembleFactoryApiRoutes, linearTaskContextIntegration } from './surface.js';
import type { FactoryApiRoutesDeps, IntegrationRegistration } from './surface.js';
import { fakeRouteAuth } from './test-utils.js';

function deps(integrations: IntegrationRegistration[] = []): FactoryApiRoutesDeps {
  return {
    controllerId: 'controller',
    controller: {} as never,
    auth: fakeRouteAuth(),
    authStorage: {} as never,
    audit: { emit: vi.fn() },
    publicOrigin: 'https://factory.example',
    fleet: {} as never,
    integrationStorage: { forIntegration: vi.fn(() => ({})) } as never,
    sourceControlStorage: { forIntegration: vi.fn(() => ({})) } as never,
    domains: {
      intake: {} as never,
      modelCredentials: {} as never,
      modelPacks: {} as never,
      projects: {} as never,
      queueHealth: {} as never,
      workItems: {} as never,
    },
    integrations,
    intakeReady: false,
    factoryReady: true,
    rules: builtInFactoryRules(),
  };
}

function registration(integration: FactoryIntegration): IntegrationRegistration {
  return { integration, ready: true, ensureReady: vi.fn(async () => {}) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('assembleFactoryApiRoutes task context', () => {
  it('mounts the real task-context route without provider integrations', () => {
    const routes = assembleFactoryApiRoutes(deps());

    expect(routes.some(route => route.path === '/web/factory/projects/:id/threads/:threadId/context')).toBe(true);
  });

  it('recognizes the concrete Platform Linear integration without making a provider request', () => {
    vi.stubEnv('MASTRA_SHARED_API_URL', 'https://platform.example.com/v1');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-token');
    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchImpl);
    const integration = new PlatformLinearIntegration();

    expect(linearTaskContextIntegration(integration)).toBe(integration);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('recognizes a structurally compatible Linear integration', () => {
    const linear = {
      id: 'linear',
      routes: () => [],
      diagnostics: () => ({}),
      taskContext: { getIssue: vi.fn() },
      loadConnection: vi.fn(),
      getFreshAccessToken: vi.fn(),
    } satisfies FactoryIntegration & {
      loadConnection: ReturnType<typeof vi.fn>;
      getFreshAccessToken: ReturnType<typeof vi.fn>;
    };

    expect(linearTaskContextIntegration(registration(linear).integration)).toBe(linear);
  });
});
