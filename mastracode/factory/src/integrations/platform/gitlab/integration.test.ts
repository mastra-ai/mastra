import { afterEach, describe, expect, it, vi } from 'vitest';

import { encodeIssueReference, encodeSourceId } from '../../gitlab/integration.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformGitLabIntegration } from './integration.js';

const project = {
  id: 42,
  name: 'api',
  path_with_namespace: 'acme/api',
  web_url: 'https://gitlab.com/acme/api',
  default_branch: 'main',
};

const issue = {
  id: 9001,
  iid: 7,
  project_id: 42,
  title: 'Fix flaky deploy',
  state: 'opened',
  web_url: 'https://gitlab.com/acme/api/-/issues/7',
  author: { name: 'Ada Lovelace', username: 'ada' },
  labels: ['bug'],
  user_notes_count: 2,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T11:00:00Z',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function connection(
  id: string,
  integrationId: string,
  accountLabel: string | null = null,
  status: 'active' | 'needs_reauth' = 'active',
) {
  return { id, integrationId, status, accountLabel };
}

function integrationWithFetch(fetchImpl: typeof fetch): PlatformGitLabIntegration {
  return new PlatformGitLabIntegration({
    client: new PlatformApiClient({
      baseUrl: 'https://integrations.example.com',
      accessToken: 'platform-secret',
      fetchImpl,
    }),
    endpointHost: 'integrations.example.com',
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('PlatformGitLabIntegration', () => {
  it('discovers gitlab connections across provider variants and skips other providers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      json({
        connections: [
          connection('conn-oauth', 'gitlab', 'gitlab.com/acme'),
          connection('conn-group', 'gitlab-group', 'gitlab.com/beta'),
          connection('conn-token', 'gitlab-group-token', 'gitlab.example.io'),
          connection('conn-stale', 'gitlab', 'stale', 'needs_reauth'),
          connection('conn-jira', 'jira', 'acme.atlassian.net'),
        ],
      }),
    );
    const integration = integrationWithFetch(fetchImpl);

    await expect(integration.listConnections()).resolves.toEqual([
      expect.objectContaining({ id: 'conn-oauth' }),
      expect.objectContaining({ id: 'conn-group' }),
      expect.objectContaining({ id: 'conn-token' }),
      expect.objectContaining({ id: 'conn-stale' }),
    ]);
    await expect(integration.hasActiveConnections()).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrations.example.com/v2/connections',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer platform-secret' }),
      }),
    );
  });

  it('lists sources from every active connection through the /v2 proxy', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) {
        return json({
          connections: [
            connection('conn-a', 'gitlab', 'gitlab.com/acme'),
            connection('conn-b', 'gitlab-group', 'gitlab.com/beta'),
          ],
        });
      }
      if (url.includes('/v2/connections/conn-a/proxy/api/v4/projects')) return json([project]);
      if (url.includes('/v2/connections/conn-b/proxy/api/v4/projects')) return json([]);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const integration = integrationWithFetch(fetchImpl);

    const sources = await integration.intake.listSources({ orgId: 'org-1', userId: 'user-1' });
    expect(sources).toEqual([
      expect.objectContaining({
        id: encodeSourceId({ connectionId: 'conn-a', projectId: '42', projectPath: 'acme/api' }),
        name: 'acme/api',
        type: 'project',
        metadata: expect.objectContaining({ connectionId: 'conn-a', accountLabel: 'gitlab.com/acme' }),
      }),
    ]);
  });

  it('reads issues through the connection encoded in the issue reference', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/v2/connections')) {
        return json({ connections: [connection('conn-a', 'gitlab', 'gitlab.com/acme')] });
      }
      if (url.includes('/v2/connections/conn-a/proxy/api/v4/projects/42/issues/7/notes')) return json([]);
      if (url.includes('/v2/connections/conn-a/proxy/api/v4/projects/42/issues/7')) return json(issue);
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const integration = integrationWithFetch(fetchImpl);

    const detail = await integration.intake.getIssue({
      connection: { type: 'oauth', accessToken: 'gitlab-connection:conn-a' },
      issueId: encodeIssueReference({ connectionId: 'conn-a', projectId: '42', projectPath: 'acme/api', issueIid: 7 }),
    });
    expect(detail).toEqual(
      expect.objectContaining({ identifier: 'acme/api#7', title: 'Fix flaky deploy', stateType: 'unstarted' }),
    );
  });

  it('reports an unavailable connection for unknown or reauth-required connection IDs', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        json({ connections: [connection('conn-stale', 'gitlab', 'stale', 'needs_reauth')] }),
      );
    const integration = integrationWithFetch(fetchImpl);

    await expect(integration.hasActiveConnections()).resolves.toBe(false);
    await expect(
      integration.intake.getIssue({
        connection: { type: 'oauth', accessToken: 'gitlab-connection:conn-stale' },
        issueId: encodeIssueReference({
          connectionId: 'conn-stale',
          projectId: '42',
          projectPath: 'acme/api',
          issueIid: 7,
        }),
      }),
    ).rejects.toThrow(/unavailable or requires reauthentication/);
  });

  it('constructs from platform env credentials without deploy-time connection wiring', () => {
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-secret');
    expect(() => new PlatformGitLabIntegration()).not.toThrow();
  });
});
