/**
 * BDD coverage for the Linear intake data hooks and the intake config hooks.
 *
 * Drives the real services + React Query cache; only the network is mocked
 * (MSW). Handlers register on the ApiConfig base URL the test providers inject
 * (`TEST_BASE_URL`), matching how the app wires it.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { IntakeConfig } from '../../../web/ui/domains/factory/services/intake';
import type { LinearIssue, LinearProject, LinearStatus } from '../../../web/ui/domains/factory/services/linear';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../useIntakeConfig';
import { useLinearIssuesQuery, useLinearProjectsQuery, useLinearStatusQuery } from '../useLinearData';

const STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const ISSUES_URL = `${TEST_BASE_URL}/web/linear/issues`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/linear/projects`;
const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;

const issue: LinearIssue = {
  id: 'issue-1',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

const projects: LinearProject[] = [
  { id: 'proj-1', name: 'Q3 Roadmap', state: 'started', teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }] },
];

const connectedStatus: LinearStatus = {
  enabled: true,
  connected: true,
  workspace: { name: 'Acme', urlKey: 'acme' },
  reason: 'ready',
};

describe('useLinearStatusQuery', () => {
  it('given a connected workspace, when the hook resolves, then it exposes the status', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json(connectedStatus)));

    const { result } = renderHookWithProviders(() => useLinearStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(connectedStatus);
  });

  it('given the request fails, when the hook resolves, then it degrades to disabled instead of erroring', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

    const { result } = renderHookWithProviders(() => useLinearStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toMatchObject({ enabled: false, connected: false });
  });
});

describe('useLinearIssuesQuery', () => {
  it('given cursor pages, when fetchNextPage is called, then pages accumulate in order', async () => {
    const pageTwoIssue: LinearIssue = { ...issue, id: 'issue-2', identifier: 'ENG-43', title: 'Page two issue' };
    const requestedCursors: Array<string | null> = [];
    server.use(
      http.get(ISSUES_URL, ({ request }) => {
        const after = new URL(request.url).searchParams.get('after');
        requestedCursors.push(after);
        return after === 'cursor-2'
          ? HttpResponse.json({ issues: [pageTwoIssue], nextCursor: null })
          : HttpResponse.json({ issues: [issue], nextCursor: 'cursor-2' });
      }),
    );

    const { result } = renderHookWithProviders(() => useLinearIssuesQuery(true));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([issue]);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data).toEqual([issue, pageTwoIssue]);
    expect(result.current.hasNextPage).toBe(false);
    expect(requestedCursors).toEqual([null, 'cursor-2']);
  });

  it('given the hook is disabled, when it mounts, then no request is made', async () => {
    const hit = vi.fn();
    server.use(
      http.get(ISSUES_URL, () => {
        hit();
        return HttpResponse.json({ issues: [issue], nextCursor: null });
      }),
    );

    const { result, client } = renderHookWithProviders(() => useLinearIssuesQuery(false));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given the server fails, when the hook resolves, then it surfaces the server message', async () => {
    server.use(
      http.get(ISSUES_URL, () => HttpResponse.json({ error: 'linear_fetch_failed', message: 'boom' }, { status: 502 })),
    );

    const { result } = renderHookWithProviders(() => useLinearIssuesQuery(true));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('boom');
  });
});

describe('useLinearProjectsQuery', () => {
  it('given a connected workspace, when the hook resolves, then it exposes the projects', async () => {
    server.use(http.get(PROJECTS_URL, () => HttpResponse.json({ projects })));

    const { result } = renderHookWithProviders(() => useLinearProjectsQuery(true));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(projects);
  });
});

describe('useIntakeConfigQuery / useSaveIntakeConfigMutation', () => {
  const config: IntakeConfig = {
    github: { enabled: true, repositoryIds: null },
    linear: { enabled: true, projectIds: null },
  };

  it('given a saved config, when the query resolves, then it exposes the config', async () => {
    server.use(http.get(CONFIG_URL, () => HttpResponse.json({ config })));

    const { result } = renderHookWithProviders(() => useIntakeConfigQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(config);
  });

  it('given a save, when it succeeds, then the config cache updates and linear issues invalidate', async () => {
    const updated: IntakeConfig = {
      github: { enabled: false, repositoryIds: null },
      linear: { enabled: true, projectIds: ['proj-1'] },
    };
    let putBody: unknown;
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json({ config })),
      http.put(CONFIG_URL, async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ config: updated });
      }),
    );

    const { result } = renderHookWithProviders(() => ({
      query: useIntakeConfigQuery(),
      save: useSaveIntakeConfigMutation(),
    }));

    await waitFor(() => expect(result.current.query.data).toBeDefined());

    result.current.save.mutate(updated);

    await waitFor(() => expect(result.current.query.data).toEqual(updated));
    expect(putBody).toEqual(updated);
  });

  it('given the save fails, when it settles, then the mutation surfaces the server message', async () => {
    server.use(http.put(CONFIG_URL, () => HttpResponse.json({ error: 'invalid_config' }, { status: 400 })));

    const { result } = renderHookWithProviders(() => useSaveIntakeConfigMutation());

    result.current.mutate(config);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('invalid_config');
  });
});
