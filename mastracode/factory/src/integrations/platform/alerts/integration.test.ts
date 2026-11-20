import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformAlertsIntegration, alertsClientConfigFromEnv } from './integration.js';

describe('alertsClientConfigFromEnv', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('talks to the Platform api Platform injected, not the integrations service', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'tok');
    vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', 'https://integrations.example');
    vi.stubEnv('MASTRA_SHARED_API_URL', 'https://api.example/v1');
    vi.stubEnv('MASTRA_ALERTS_API_URL', '');
    expect(alertsClientConfigFromEnv()).toEqual({ baseUrl: 'https://api.example' });
  });

  it('prefers MASTRA_ALERTS_API_URL, and falls back to production', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'tok');
    vi.stubEnv('MASTRA_SHARED_API_URL', 'https://api.example/v1');
    vi.stubEnv('MASTRA_ALERTS_API_URL', 'https://alerts.example/');
    expect(alertsClientConfigFromEnv().baseUrl).toBe('https://alerts.example');
    vi.stubEnv('MASTRA_ALERTS_API_URL', '');
    vi.stubEnv('MASTRA_SHARED_API_URL', '');
    expect(alertsClientConfigFromEnv().baseUrl).toBe('https://platform.mastra.ai');
  });
});


describe('PlatformAlertsIntegration connect', () => {
  afterEach(() => vi.unstubAllEnvs());

  // Platform takes the Factory's project from a project token, but an org secret key must name it.
  it("names the deployment's project, so an org secret key can connect too", async () => {
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj-factory');
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ organizationId: 'org-1', factoryProjectId: 'proj-factory', connectedAt: 'now' }),
    );
    const integration = new PlatformAlertsIntegration({
      connect: { baseUrl: 'https://api.example', accessToken: 'sk_org', fetch },
    });

    await integration.connect();

    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://api.example/v1/server/alerts/connection');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ factoryProjectId: 'proj-factory' });
  });
});
