/** MSW coverage for GitLab intake status and project discovery. */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { GitLabProject, GitLabStatus } from '../../ui/domains/factory/services/gitlab';
import { isGitLabAuthError, isGitLabReauthRequired } from '../../ui/domains/factory/services/gitlab';
import { useGitLabProjectsQuery, useGitLabStatusQuery } from '../useGitLabData';

const STATUS_URL = `${TEST_BASE_URL}/web/gitlab/status`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/gitlab/projects`;

const status: GitLabStatus = {
  enabled: true,
  configured: true,
  connections: [
    { id: 'a1b_acme', integrationId: 'gitlab', status: 'active', accountLabel: 'acme' },
    { id: 'a1b_old', integrationId: 'gitlab', status: 'needs_reauth', accountLabel: 'old' },
  ],
  accounts: ['acme'],
  reauthRequired: true,
  reason: 'ready',
};

const projects: GitLabProject[] = [
  {
    id: 'gitlab-project:encoded',
    name: 'acme/app',
    connectionId: 'a1b_acme',
    accountLabel: 'acme',
    defaultBranch: 'main',
  },
];

describe('useGitLabStatusQuery', () => {
  it('exposes configured connection status and reauthorization state', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json(status)));

    const { result } = renderHookWithProviders(() => useGitLabStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(status);
    expect(isGitLabReauthRequired(result.current.data)).toBe(true);
  });

  it('degrades an unavailable server endpoint to disabled data', async () => {
    const { result } = renderHookWithProviders(() => useGitLabStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toMatchObject({ enabled: false, configured: false, reauthRequired: false });
  });
});

describe('useGitLabProjectsQuery', () => {
  it('lists projects when enabled and stays idle when disabled', async () => {
    const hit = vi.fn();
    server.use(
      http.get(PROJECTS_URL, () => {
        hit();
        return HttpResponse.json({ projects });
      }),
    );

    const enabled = renderHookWithProviders(() => useGitLabProjectsQuery(true));
    await waitFor(() => expect(enabled.result.current.data).toEqual(projects));
    expect(hit).toHaveBeenCalledOnce();

    const disabled = renderHookWithProviders(() => useGitLabProjectsQuery(false));
    await waitFor(() => expect(disabled.client.isFetching()).toBe(0));
    expect(disabled.result.current.fetchStatus).toBe('idle');
    expect(hit).toHaveBeenCalledOnce();
  });

  it('recognizes a rejected GitLab account', async () => {
    server.use(
      http.get(PROJECTS_URL, () =>
        HttpResponse.json({ error: 'gitlab_auth_failed', message: 'GitLab rejected the token' }, { status: 409 }),
      ),
    );

    const { result } = renderHookWithProviders(() => useGitLabProjectsQuery(true));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isGitLabAuthError(result.current.error)).toBe(true);
    expect((result.current.error as Error).message).toBe('GitLab rejected the token');
  });
});
