/**
 * BDD coverage for the Jira intake data hooks and the `jira` intake-config key.
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
import type { JiraIssue, JiraProject, JiraStatus } from '../../ui/domains/factory/services/jira';
import { isJiraAuthError } from '../../ui/domains/factory/services/jira';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../useIntakeConfig';
import { useJiraIssuesQuery, useJiraProjectsQuery, useJiraStatusQuery } from '../useJiraData';

const STATUS_URL = `${TEST_BASE_URL}/web/jira/status`;
const ISSUES_URL = `${TEST_BASE_URL}/web/jira/issues`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/jira/projects`;
const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;

const issue: JiraIssue = {
  id: '20001',
  identifier: 'ENG-1',
  title: 'Login button unresponsive on Safari',
  url: 'https://acme.atlassian.net/browse/ENG-1',
  state: 'To Do',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'Ada Lovelace',
  project: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

const projects: JiraProject[] = [
  { id: '10001', name: 'Engineering', key: 'ENG' },
  { id: '10002', name: 'Operations', key: 'OPS' },
];

const readyStatus: JiraStatus = {
  enabled: true,
  configured: true,
  site: 'acme.atlassian.net',
  reason: 'ready',
};

describe('useJiraStatusQuery', () => {
  it('given a configured deployment, when the hook resolves, then it exposes the status', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json(readyStatus)));

    const { result } = renderHookWithProviders(() => useJiraStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(readyStatus);
  });

  it('given the routes are not mounted (no env group), when the hook resolves, then it degrades to disabled instead of erroring', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json({ error: 'not_found' }, { status: 404 })));

    const { result } = renderHookWithProviders(() => useJiraStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toMatchObject({ enabled: false, configured: false });
  });
});

describe('useJiraIssuesQuery', () => {
  it('given cursor pages, when fetchNextPage is called, then pages accumulate in order', async () => {
    const pageTwoIssue: JiraIssue = { ...issue, id: '20002', identifier: 'ENG-2', title: 'Page two issue' };
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

    const { result } = renderHookWithProviders(() => useJiraIssuesQuery(true));

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

    const { result, client } = renderHookWithProviders(() => useJiraIssuesQuery(false));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given Jira rejects the credentials, when the hook errors, then isJiraAuthError recognizes the code', async () => {
    server.use(
      http.get(ISSUES_URL, () =>
        HttpResponse.json({ error: 'jira_auth_failed', message: 'Jira rejected the configured credentials.' }, { status: 409 }),
      ),
    );

    const { result } = renderHookWithProviders(() => useJiraIssuesQuery(true));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('Jira rejected the configured credentials.');
    expect(isJiraAuthError(result.current.error)).toBe(true);
  });

  it('given the server fails, when the hook resolves, then it surfaces the server message without the auth code', async () => {
    server.use(
      http.get(ISSUES_URL, () => HttpResponse.json({ error: 'jira_fetch_failed', message: 'boom' }, { status: 502 })),
    );

    const { result } = renderHookWithProviders(() => useJiraIssuesQuery(true));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('boom');
    expect(isJiraAuthError(result.current.error)).toBe(false);
  });
});

describe('useJiraProjectsQuery', () => {
  it('given a configured site, when the hook resolves, then it exposes the projects', async () => {
    server.use(http.get(PROJECTS_URL, () => HttpResponse.json({ projects })));

    const { result } = renderHookWithProviders(() => useJiraProjectsQuery(true));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(projects);
  });
});

describe('intake config with the jira key', () => {
  it('given a server config without a jira key, when the query resolves, then jira defaults to disabled', async () => {
    server.use(
      http.get(CONFIG_URL, () =>
        HttpResponse.json({ config: { github: { enabled: true, sourceIds: null } } }),
      ),
    );

    const { result } = renderHookWithProviders(() => useIntakeConfigQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.jira).toEqual({ enabled: false, sourceIds: null });
  });

  it('given the deployment registers only github and jira, when the config is saved, then unregistered keys are not sent', async () => {
    // The server rejects keys for unregistered integrations (invalid_config),
    // so the save must trim the fixed client shape down to the GET's keys.
    const registered = { github: { enabled: true, sourceIds: null }, jira: { enabled: false, sourceIds: null } };
    let putBody: unknown;
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json({ config: registered })),
      http.put(CONFIG_URL, async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ config: putBody });
      }),
    );

    const { result } = renderHookWithProviders(() => useSaveIntakeConfigMutation());

    result.current.mutate({
      github: { enabled: true, sourceIds: null },
      linear: { enabled: false, sourceIds: null },
      jira: { enabled: true, sourceIds: ['10001'] },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(putBody).toEqual({
      github: { enabled: true, sourceIds: null },
      jira: { enabled: true, sourceIds: ['10001'] },
    });
  });

  it('given a jira selection is saved, when it succeeds, then the config cache updates and jira issues invalidate', async () => {
    const initial: IntakeConfig = {
      github: { enabled: true, sourceIds: null },
      linear: { enabled: false, sourceIds: null },
      jira: { enabled: false, sourceIds: null },
    };
    const updated: IntakeConfig = { ...initial, jira: { enabled: true, sourceIds: ['10001'] } };
    let putBody: unknown;
    const issueRequests = vi.fn();
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json({ config: initial })),
      http.put(CONFIG_URL, async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({ config: updated });
      }),
      http.get(ISSUES_URL, () => {
        issueRequests();
        return HttpResponse.json({ issues: [issue], nextCursor: null });
      }),
    );

    const { result } = renderHookWithProviders(() => ({
      query: useIntakeConfigQuery(),
      issues: useJiraIssuesQuery(true),
      save: useSaveIntakeConfigMutation(),
    }));

    await waitFor(() => expect(result.current.query.data).toBeDefined());
    await waitFor(() => expect(result.current.issues.data).toBeDefined());
    const issueFetchesBeforeSave = issueRequests.mock.calls.length;

    result.current.save.mutate(updated);

    await waitFor(() => expect(result.current.query.data).toEqual(updated));
    expect(putBody).toEqual(updated);
    // The save invalidates the jira issues cache, triggering a refetch.
    await waitFor(() => expect(issueRequests.mock.calls.length).toBeGreaterThan(issueFetchesBeforeSave));
  });
});
