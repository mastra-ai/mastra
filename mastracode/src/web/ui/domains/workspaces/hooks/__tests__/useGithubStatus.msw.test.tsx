/**
 * BDD coverage for the GitHub status query hook.
 *
 * Drives the real `fetchGithubStatus` service + React Query cache; only the
 * network is mocked (MSW). Handlers register on the jsdom origin
 * (`http://localhost:3000`) because the service fetches relative URLs.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders } from '../../../../../../../e2e/web-ui/render';
import type { GithubStatus } from '../../services/github';
import { useGithubStatusQuery } from '../useGithubStatus';

const ORIGIN = 'http://localhost:3000';
const STATUS_URL = `${ORIGIN}/api/web/github/status`;

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

  it('given the server returns 401, when the hook resolves, then the status reports authRequired instead of disabled', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json({ error: 'auth_required' }, { status: 401 })));

    const { result } = renderHookWithProviders(() => useGithubStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ ...disabledStatus, authRequired: true });
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
});
