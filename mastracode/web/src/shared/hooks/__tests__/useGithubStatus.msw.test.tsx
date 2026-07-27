/**
 * BDD coverage for the GitHub status query hook.
 *
 * Drives the real `fetchGithubStatus` service + React Query cache; only the
 * network is mocked (MSW). Handlers register on the ApiConfig base URL the
 * test providers inject (`TEST_BASE_URL`), matching how the app wires it.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { GithubStatus } from '../../../web/ui/domains/workspaces/services/github';
import { useGithubStatusQuery } from '../useGithubStatus';

const ORIGIN = TEST_BASE_URL;
const STATUS_URL = `${ORIGIN}/web/github/status`;

const connectedStatus: GithubStatus = {
  enabled: true,
  sandboxEnabled: true,
  connected: true,
  installations: [{ installationId: 42, accountLogin: 'mastra-ai', accountType: 'Organization' }],
};

const disabledStatus: GithubStatus = {
  enabled: false,
  connected: false,
  installations: [],
};

describe('useGithubStatusQuery', () => {
  it('given the feature is enabled and connected, when the hook resolves, then it exposes the server status', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json(connectedStatus)));

    const { result } = renderHookWithProviders(() => useGithubStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(connectedStatus);
  });

  it('given the server returns 401, when the hook resolves, then the status reports authRequired with reason', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json({ error: 'auth_required' }, { status: 401 })));

    const { result } = renderHookWithProviders(() => useGithubStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ ...disabledStatus, authRequired: true, reason: 'auth_required' });
    expect(result.current.isError).toBe(false);
  });

  it('given the server returns 404, when the hook resolves, then a disabled status is returned without an error state', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json({ error: 'not_found' }, { status: 404 })));

    const { result } = renderHookWithProviders(() => useGithubStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(disabledStatus);
    expect(result.current.isError).toBe(false);
  });

  it('given two consumers share the cache, when both mount, then the endpoint is hit once', async () => {
    const hit = vi.fn();
    server.use(
      http.get(STATUS_URL, () => {
        hit();
        return HttpResponse.json(connectedStatus);
      }),
    );

    const { result } = renderHookWithProviders(() => {
      const first = useGithubStatusQuery();
      const second = useGithubStatusQuery();
      return { first, second };
    });

    await waitFor(() => expect(result.current.first.data).toBeDefined());
    await waitFor(() => expect(result.current.second.data).toBeDefined());
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('given the query is disabled, when the hook mounts, then no request is made', async () => {
    const hit = vi.fn();
    server.use(
      http.get(STATUS_URL, () => {
        hit();
        return HttpResponse.json(connectedStatus);
      }),
    );

    const { result, client } = renderHookWithProviders(() => useGithubStatusQuery(false));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(hit).not.toHaveBeenCalled();
  });

  it('given the feature is disabled for missing config, when the hook resolves, then it exposes reason and diagnostics', async () => {
    const missingConfigStatus: GithubStatus = {
      enabled: false,
      connected: false,
      installations: [],
      reason: 'missing_config',
      diagnostics: {
        githubAppConfigured: false,
        factoryAuthEnabled: true,
        appDbConfigured: true,
        stateSecretConfigured: true,
        sandboxEnabled: true,
        sandboxProvider: 'local',
        missingGithubAppEnvVars: ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY'],
      },
    };
    server.use(http.get(STATUS_URL, () => HttpResponse.json(missingConfigStatus)));

    const { result } = renderHookWithProviders(() => useGithubStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(missingConfigStatus);
    expect(result.current.data?.reason).toBe('missing_config');
    expect(result.current.data?.diagnostics?.missingGithubAppEnvVars).toEqual([
      'GITHUB_APP_ID',
      'GITHUB_APP_PRIVATE_KEY',
    ]);
  });

  it('given the user lacks an org, when the hook resolves, then it exposes organizationRequired with reason', async () => {
    const orgRequiredStatus: GithubStatus = {
      enabled: true,
      sandboxEnabled: true,
      organizationRequired: true,
      connected: false,
      installations: [],
      reason: 'organization_required',
    };
    server.use(http.get(STATUS_URL, () => HttpResponse.json(orgRequiredStatus)));

    const { result } = renderHookWithProviders(() => useGithubStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.organizationRequired).toBe(true);
    expect(result.current.data?.reason).toBe('organization_required');
  });

  it('given the feature is enabled but not connected, when the hook resolves, then it exposes reason not_connected', async () => {
    const notConnectedStatus: GithubStatus = {
      enabled: true,
      sandboxEnabled: true,
      connected: false,
      installations: [],
      reason: 'not_connected',
    };
    server.use(http.get(STATUS_URL, () => HttpResponse.json(notConnectedStatus)));

    const { result } = renderHookWithProviders(() => useGithubStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.reason).toBe('not_connected');
  });
});
