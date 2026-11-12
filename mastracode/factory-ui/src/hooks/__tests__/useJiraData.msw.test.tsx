/**
 * BDD coverage for the Jira intake data hooks and the Jira side of the intake
 * config hooks.
 *
 * Drives the real services + React Query cache; only the network is mocked
 * (MSW). Handlers register on the ApiConfig base URL the test providers inject
 * (`TEST_BASE_URL`), matching how the app wires it. The ambient MSW handlers
 * answer `/web/jira/*` with 404 — a server without Platform integration
 * credentials — so unavailable-feature behavior needs no per-test setup.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { IntakeConfig } from '../../ui/domains/factory/services/intake';
import { isJiraAuthError } from '../../ui/domains/factory/services/jira';
import type { JiraProject, JiraStatus } from '../../ui/domains/factory/services/jira';
import { useIntakeConfigQuery, useSaveIntakeBindingMutation, useSaveIntakeSelectionMutation } from '../useIntakeConfig';
import { useJiraIssueDetail, useJiraProjectsQuery, useJiraStatusQuery } from '../useJiraData';

const STATUS_URL = `${TEST_BASE_URL}/web/jira/status`;
const ISSUES_URL = `${TEST_BASE_URL}/web/jira/issues`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/jira/projects`;
const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const BINDINGS_URL = `${TEST_BASE_URL}/web/intake/bindings`;

const FACTORY_A = '11111111-1111-4111-8111-111111111111';

const issue = {
  id: '10010',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://acme.atlassian.net/browse/ENG-42',
  author: 'grace',
  state: 'To Do',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'ada',
  project: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

const projects: JiraProject[] = [
  { id: 'jira-source-acme-eng', key: 'ENG', name: 'Engineering', connectionId: 'a1b_acme', site: 'acme.atlassian.net' },
];

const readyStatus: JiraStatus = {
  enabled: true,
  configured: true,
  site: 'acme.atlassian.net',
  sites: ['acme.atlassian.net'],
  connections: [
    {
      id: 'a1b_acme',
      integrationId: 'jira',
      status: 'active',
      accountLabel: 'acme.atlassian.net',
    },
  ],
  reason: 'ready',
};

describe('useJiraStatusQuery', () => {
  it('given a configured server, when the hook resolves, then it exposes the status', async () => {
    server.use(http.get(STATUS_URL, () => HttpResponse.json(readyStatus)));

    const { result } = renderHookWithProviders(() => useJiraStatusQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(readyStatus);
  });

  it('given a server without Platform Jira support (ambient 404), when the hook resolves, then it degrades to disabled', async () => {
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

describe('useJiraIssueDetail', () => {
  it('loads a routed Jira issue description with its opaque issue reference', async () => {
    const requested = vi.fn();
    server.use(
      http.get(`${ISSUES_URL}/:identifier`, ({ params, request }) => {
        const url = new URL(request.url);
        requested({
          identifier: params.identifier,
          factoryProjectId: url.searchParams.get('factoryProjectId'),
          issueRef: url.searchParams.get('issueRef'),
        });
        return HttpResponse.json({
          identifier: 'ENG-42',
          title: 'Fix intake sync',
          url: issue.url,
          description: 'Detailed Jira task body',
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useJiraIssueDetail(FACTORY_A, issue.identifier, 'jira-issue:encoded-reference'),
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.description).toBe('Detailed Jira task body');
    expect(requested).toHaveBeenCalledWith({
      identifier: 'ENG-42',
      factoryProjectId: FACTORY_A,
      issueRef: 'jira-issue:encoded-reference',
    });
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
    gitlab: { enabled: false, sourceIds: null },
    linear: { enabled: false, sourceIds: null },
    jira: { enabled: true, sourceIds: ['10001'] },
    incidentio: { enabled: false, sourceIds: null },
  };

  it('given a server that omits the jira key, when the config resolves, then jira normalizes to disabled', async () => {
    server.use(http.get(CONFIG_URL, () => HttpResponse.json({ config: {} })));

    const { result } = renderHookWithProviders(() => useIntakeConfigQuery());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.jira).toEqual({ enabled: false, sourceIds: null });
  });
});
