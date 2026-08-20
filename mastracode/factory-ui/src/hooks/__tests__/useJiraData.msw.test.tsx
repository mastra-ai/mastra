/**
 * BDD coverage for the Jira intake data hooks and the Jira side of the intake
 * config hooks.
 *
 * Drives the real services + React Query cache; only the network is mocked
 * (MSW). Handlers register on the ApiConfig base URL the test providers inject
 * (`TEST_BASE_URL`), matching how the app wires it. The ambient MSW handlers
 * answer `/web/jira/*` with 404 — a server without the `JIRA_*` env group —
 * so unconfigured-deployment behavior needs no per-test setup.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { IntakeConfig } from '../../ui/domains/factory/services/intake';
import { isJiraAuthError } from '../../ui/domains/factory/services/jira';
import type { JiraIssue, JiraProject, JiraStatus } from '../../ui/domains/factory/services/jira';
import { useIntakeConfigQuery, useSaveIntakeBindingMutation, useSaveIntakeConfigMutation } from '../useIntakeConfig';
import { useJiraIssuesQuery, useJiraProjectsQuery, useJiraStatusQuery } from '../useJiraData';

const STATUS_URL = `${TEST_BASE_URL}/web/jira/status`;
const ISSUES_URL = `${TEST_BASE_URL}/web/jira/issues`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/jira/projects`;
const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const BINDINGS_URL = `${TEST_BASE_URL}/web/intake/bindings`;

const FACTORY_A = '11111111-1111-4111-8111-111111111111';

const issue: JiraIssue = {
  id: '10010',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://acme.atlassian.net/browse/ENG-42',
  state: 'To Do',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  project: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

const projects: JiraProject[] = [{ id: '10001', key: 'ENG', name: 'Engineering' }];

const readyStatus: JiraStatus = {
  enabled: true,
  configured: true,
  site: 'acme.atlassian.net',
  reason: 'ready',
};

describe('useJiraStatusQuery', () => {
  it('given a configured server, when the hook resolves, then it exposes the status', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json(readyStatus)));

    const { result } = renderHookWithProviders(() => useJiraStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(readyStatus);
  });

  it('given a server without the Jira env group (ambient 404), when the hook resolves, then it degrades to disabled', async () => {
    const { result } = renderHookWithProviders(() => useJiraStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toMatchObject({ enabled: false, configured: false });
  });

  it('given the request fails, when the hook resolves, then it degrades to disabled instead of erroring', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

    const { result } = renderHookWithProviders(() => useJiraStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toMatchObject({ enabled: false, configured: false });
  });
});

describe('useJiraIssuesQuery', () => {
  it('given a factory, when pages are fetched, then every request carries the factoryProjectId and pages accumulate', async () => {
    const pageTwoIssue: JiraIssue = { ...issue, id: '10011', identifier: 'ENG-43', title: 'Page two issue' };
    const requested: Array<{ factoryProjectId: string | null; after: string | null }> = [];
    server.use(
      http.get(ISSUES_URL, ({ request }) => {
        const url = new URL(request.url);
        const after = url.searchParams.get('after');
        requested.push({ factoryProjectId: url.searchParams.get('factoryProjectId'), after });
        return after === 'cursor-2'
          ? HttpResponse.json({ issues: [pageTwoIssue], nextCursor: null })
          : HttpResponse.json({ issues: [issue], nextCursor: 'cursor-2' });
      }),
    );

    const { result } = renderHookWithProviders(() => useJiraIssuesQuery(FACTORY_A));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([issue]);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data).toEqual([issue, pageTwoIssue]);
    expect(result.current.hasNextPage).toBe(false);
    expect(requested).toEqual([
      { factoryProjectId: FACTORY_A, after: null },
      { factoryProjectId: FACTORY_A, after: 'cursor-2' },
    ]);
  });

  it('given no factory, when the hook mounts, then no request is made', async () => {
    const hit = vi.fn();
    server.use(
      http.get(ISSUES_URL, () => {
        hit();
        return HttpResponse.json({ issues: [issue], nextCursor: null });
      }),
    );

    const { result, client } = renderHookWithProviders(() => useJiraIssuesQuery(undefined));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given two factories, when both hooks resolve, then each caches its own page (no cross-factory bleed)', async () => {
    const FACTORY_B = '22222222-2222-4222-8222-222222222222';
    const issueB: JiraIssue = { ...issue, id: '10012', identifier: 'OPS-7', title: 'Factory B issue', project: 'OPS' };
    server.use(
      http.get(ISSUES_URL, ({ request }) => {
        const factoryProjectId = new URL(request.url).searchParams.get('factoryProjectId');
        return factoryProjectId === FACTORY_A
          ? HttpResponse.json({ issues: [issue], nextCursor: null })
          : HttpResponse.json({ issues: [issueB], nextCursor: null });
      }),
    );

    const { result } = renderHookWithProviders(() => ({
      a: useJiraIssuesQuery(FACTORY_A),
      b: useJiraIssuesQuery(FACTORY_B),
    }));

    await waitFor(() => expect(result.current.a.data).toBeDefined());
    await waitFor(() => expect(result.current.b.data).toBeDefined());
    expect(result.current.a.data).toEqual([issue]);
    expect(result.current.b.data).toEqual([issueB]);
  });

  it('given the credentials are rejected, when the hook resolves, then the error is recognized as a Jira auth error', async () => {
    server.use(
      http.get(ISSUES_URL, () =>
        HttpResponse.json({ error: 'jira_auth_failed', message: 'Jira rejected the configured credentials' }, { status: 409 }),
      ),
    );

    const { result } = renderHookWithProviders(() => useJiraIssuesQuery(FACTORY_A));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isJiraAuthError(result.current.error)).toBe(true);
    expect((result.current.error as Error).message).toBe('Jira rejected the configured credentials');
  });

  it('given the server fails, when the hook resolves, then it surfaces the server message without claiming an auth error', async () => {
    server.use(
      http.get(ISSUES_URL, () => HttpResponse.json({ error: 'jira_fetch_failed', message: 'boom' }, { status: 502 })),
    );

    const { result } = renderHookWithProviders(() => useJiraIssuesQuery(FACTORY_A));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('boom');
    expect(isJiraAuthError(result.current.error)).toBe(false);
  });
});

describe('useJiraProjectsQuery', () => {
  it('given a configured server, when the hook resolves, then it exposes the projects', async () => {
    server.use(http.get(PROJECTS_URL, () => HttpResponse.json({ projects })));

    const { result } = renderHookWithProviders(() => useJiraProjectsQuery(true));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(projects);
  });
});

describe('intake config and bindings drive the Jira issue cache', () => {
  const config: IntakeConfig = {
    github: { enabled: true, sourceIds: null },
    linear: { enabled: false, sourceIds: null },
    jira: { enabled: true, sourceIds: ['10001'] },
  };

  it('given a server that omits the jira key, when the config resolves, then jira normalizes to disabled', async () => {
    server.use(http.get(CONFIG_URL, () => HttpResponse.json({ config: {} })));

    const { result } = renderHookWithProviders(() => useIntakeConfigQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.jira).toEqual({ enabled: false, sourceIds: null });
  });

  it('given a config save, when it succeeds, then the mounted jira issue feed refetches', async () => {
    let issueHits = 0;
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json({ config })),
      http.put(CONFIG_URL, async ({ request }) => HttpResponse.json({ config: (await request.json()) as IntakeConfig })),
      http.get(ISSUES_URL, () => {
        issueHits += 1;
        return HttpResponse.json({ issues: [issue], nextCursor: null });
      }),
    );

    const { result } = renderHookWithProviders(() => ({
      issues: useJiraIssuesQuery(FACTORY_A),
      save: useSaveIntakeConfigMutation(),
    }));

    await waitFor(() => expect(result.current.issues.data).toBeDefined());
    expect(issueHits).toBe(1);

    result.current.save.mutate(config);

    await waitFor(() => expect(issueHits).toBe(2));
  });

  it('given a binding save, when it succeeds, then the mounted jira issue feed refetches', async () => {
    let issueHits = 0;
    server.use(
      http.get(BINDINGS_URL, () => HttpResponse.json({ bindings: [] })),
      http.put(BINDINGS_URL, () =>
        HttpResponse.json({
          bindings: [{ integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_A }],
        }),
      ),
      http.get(ISSUES_URL, () => {
        issueHits += 1;
        return HttpResponse.json({ issues: [issue], nextCursor: null });
      }),
    );

    const { result } = renderHookWithProviders(() => ({
      issues: useJiraIssuesQuery(FACTORY_A),
      bind: useSaveIntakeBindingMutation(),
    }));

    await waitFor(() => expect(result.current.issues.data).toBeDefined());
    expect(issueHits).toBe(1);

    result.current.bind.mutate({ integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_A });

    await waitFor(() => expect(issueHits).toBe(2));
  });
});
