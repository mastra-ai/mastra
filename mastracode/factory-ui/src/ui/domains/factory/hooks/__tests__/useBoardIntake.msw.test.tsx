/**
 * BDD coverage for the board intake feed's Jira readiness + candidate mapping.
 *
 * Drives the real hooks + services through React Query; only the network is
 * mocked (MSW). The Linear feed's behavior is covered indirectly by the board
 * page tests — these specs pin down the Jira feed added alongside it.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { IntakeConfig } from '../../services/intake';
import type { JiraIssue, JiraStatus } from '../../services/jira';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import { useBoardIntake } from '../useBoardIntake';

const CONFIG_URL = `${TEST_BASE_URL}/web/intake/config`;
const LINEAR_STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const JIRA_STATUS_URL = `${TEST_BASE_URL}/web/jira/status`;
const JIRA_ISSUES_URL = `${TEST_BASE_URL}/web/jira/issues`;
const GITHUB_ISSUES_URL = `${TEST_BASE_URL}/web/github/projects/ghp-1/issues`;

const repository: LinkedRepositoryPayload = { projectRepositoryId: 'ghp-1', slug: 'acme/mastra' };

const configuredJiraStatus: JiraStatus = {
  enabled: true,
  configured: true,
  site: 'acme.atlassian.net',
  reason: 'ready',
};

const jiraIssue: JiraIssue = {
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

/** GitHub deselected so the Jira feed is the only one in play; jira selection configurable. */
function jiraOnlyConfig(jira: IntakeConfig['jira']): IntakeConfig {
  return {
    github: { enabled: true, sourceIds: null },
    linear: { enabled: false, sourceIds: null },
    jira,
  };
}

function useFeedHandlers({ config, jiraStatus }: { config: IntakeConfig; jiraStatus?: JiraStatus }) {
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json({ config })),
    // Linear env group absent — routes not mounted, service degrades to disabled.
    http.get(LINEAR_STATUS_URL, () => HttpResponse.json(null, { status: 404 })),
    // The always-on triage feed (auto-triaged label) polls the GitHub issues route.
    http.get(GITHUB_ISSUES_URL, () => HttpResponse.json({ issues: [], nextPage: null })),
    ...(jiraStatus ? [http.get(JIRA_STATUS_URL, () => HttpResponse.json(jiraStatus))] : []),
  );
}

function renderBoardIntake(knownSourceKeys: ReadonlySet<string> = new Set()) {
  return renderHookWithProviders(() =>
    useBoardIntake({ factoryProjectId: 'fp-1', repository, kind: 'work', knownSourceKeys }),
  );
}

describe('useBoardIntake — Jira feed', () => {
  it('given Jira is configured, enabled, and has selected projects, then the feed is available and maps candidates', async () => {
    useFeedHandlers({
      config: jiraOnlyConfig({ enabled: true, sourceIds: ['10001'] }),
      jiraStatus: configuredJiraStatus,
    });
    server.use(http.get(JIRA_ISSUES_URL, () => HttpResponse.json({ issues: [jiraIssue], nextCursor: null })));

    const { result } = renderBoardIntake();

    await waitFor(() => expect(result.current.available).toContain('jira'));
    expect(result.current.active).toBe('jira');

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    const candidate = result.current.candidates[0]!;
    expect(candidate.sourceKey).toBe('jira:ENG-1');
    expect(candidate.source).toBe('jira-issue');
    expect(candidate.title).toBe('Login button unresponsive on Safari');
    expect(candidate.url).toBe('https://acme.atlassian.net/browse/ENG-1');
    expect(candidate.meta).toBe('ENG-1 · To Do · Ada Lovelace');
    expect(candidate.branch).toBe('factory/jira-eng-1');
    expect(candidate.column).toBe('intake');
  });

  it('given the deployment has no Jira env group (status 404), then the feed never becomes available and no issues are fetched', async () => {
    const hit = vi.fn();
    // No jiraStatus handler — the ambient 404 stands in for unmounted routes.
    useFeedHandlers({ config: jiraOnlyConfig({ enabled: true, sourceIds: ['10001'] }) });
    server.use(
      http.get(JIRA_ISSUES_URL, () => {
        hit();
        return HttpResponse.json({ issues: [jiraIssue], nextCursor: null });
      }),
    );

    const { result, client } = renderBoardIntake();

    await waitFor(() => expect(result.current.isPending).toBe(false));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.available).not.toContain('jira');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given no Jira projects are selected, then the feed is not available', async () => {
    useFeedHandlers({
      config: jiraOnlyConfig({ enabled: true, sourceIds: null }),
      jiraStatus: configuredJiraStatus,
    });

    const { result, client } = renderBoardIntake();

    await waitFor(() => expect(result.current.isPending).toBe(false));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.available).not.toContain('jira');
  });

  it('given an issue is already on the board, then its candidate is dropped from the feed', async () => {
    useFeedHandlers({
      config: jiraOnlyConfig({ enabled: true, sourceIds: ['10001'] }),
      jiraStatus: configuredJiraStatus,
    });
    server.use(http.get(JIRA_ISSUES_URL, () => HttpResponse.json({ issues: [jiraIssue], nextCursor: null })));

    const { result } = renderBoardIntake(new Set(['jira:ENG-1']));

    await waitFor(() => expect(result.current.active).toBe('jira'));
    await waitFor(() => expect(result.current.jiraIssues.data).toHaveLength(1));
    expect(result.current.candidates).toHaveLength(0);
  });
});
