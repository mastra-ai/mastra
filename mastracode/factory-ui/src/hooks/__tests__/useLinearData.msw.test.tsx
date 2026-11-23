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

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { IntakeConfig } from '../../ui/domains/factory/services/intake';
import type { LinearIssueDetail, LinearProject, LinearStatus } from '../../ui/domains/factory/services/linear';
import { useIntakeConfigQuery, useSaveIntakeSelectionMutation } from '../useIntakeConfig';
import { useLinearIssueDetail, useLinearProjectsQuery, useLinearStatusQuery } from '../useLinearData';

const STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const ISSUE_DETAIL_URL = `${TEST_BASE_URL}/web/linear/issues/:identifier`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/linear/projects`;
const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;

const projects: LinearProject[] = [
  { id: 'proj-1', name: 'Q3 Roadmap', state: 'started', teams: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }] },
];

const issueDetail: LinearIssueDetail = {
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://linear.app/acme/issue/ENG-42',
  description: 'Keep the board in sync.',
};

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

describe('useLinearIssueDetail', () => {
  it('does not retry a missing issue', async () => {
    const hit = vi.fn();
    server.use(
      http.get(ISSUE_DETAIL_URL, () => {
        hit();
        return HttpResponse.json({ error: 'issue_not_found' }, { status: 404 });
      }),
    );

    const { result } = renderHookWithProviders(() => useLinearIssueDetail('project-1', 'ENG-42', 'issue-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(hit).toHaveBeenCalledTimes(1);
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

describe('useIntakeConfigQuery / useSaveIntakeSelectionMutation', () => {
  const config: IntakeConfig = {
    github: { enabled: true, sourceIds: null },
    gitlab: { enabled: false, sourceIds: null },
    linear: { enabled: true, sourceIds: null },
    jira: { enabled: false, sourceIds: null },
    incidentio: { enabled: false, sourceIds: null },
  };

  it('given a saved config, when the query resolves, then it exposes the config', async () => {
    server.use(http.get(CONFIG_URL, () => HttpResponse.json({ config })));

    const { result } = renderHookWithProviders(() => useIntakeConfigQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(config);
  });

  it('given a Linear save, when it succeeds, then only Linear is sent and the cache takes the server config', async () => {
    const updated: IntakeConfig = {
      github: { enabled: false, sourceIds: null },
      gitlab: { enabled: false, sourceIds: null },
      linear: { enabled: true, sourceIds: ['proj-1'] },
      jira: { enabled: false, sourceIds: null },
      incidentio: { enabled: false, sourceIds: null },
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
      save: useSaveIntakeSelectionMutation('linear'),
    }));

    await waitFor(() => expect(result.current.query.data).toBeDefined());

    result.current.save.mutate(updated.linear);

    await waitFor(() => expect(result.current.query.data).toEqual(updated));
    expect(putBody).toEqual({ linear: updated.linear });
  });

  it('given the save fails, when it settles, then the mutation surfaces the server message', async () => {
    server.use(http.put(CONFIG_URL, () => HttpResponse.json({ error: 'invalid_config' }, { status: 400 })));

    const { result } = renderHookWithProviders(() => useSaveIntakeSelectionMutation('linear'));

    result.current.mutate(config.linear);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('invalid_config');
  });
});
