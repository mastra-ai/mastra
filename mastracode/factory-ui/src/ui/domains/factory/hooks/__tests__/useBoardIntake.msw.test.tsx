/**
 * BDD coverage for the Intake swimlane's provider gating: a board only offers a
 * provider feed when one of its sources is routed to the Factory project being
 * viewed (with the single-Factory/no-binding fallback the server also applies).
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import type { JiraIssue } from '../../services/jira';
import { useBoardIntake } from '../useBoardIntake';

const repository = { projectRepositoryId: 'repo-1', slug: 'acme/app' } as LinkedRepositoryPayload;

function stubIntake(
  bindings: Array<{ integrationId: string; sourceId: string; factoryProjectId: string }>,
  factoryIds: string[] = ['factory-1', 'factory-2'],
) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: factoryIds.map(id => ({ id, name: id, repositories: [] })),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: false, sourceIds: null },
          linear: { enabled: true, sourceIds: ['proj-1'] },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: true, connected: true, workspace: { name: 'Acme', urlKey: 'acme' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/issues`, () => HttpResponse.json({ issues: [], nextCursor: null })),
    http.get(`${TEST_BASE_URL}/web/projects/repo-1/issues`, () => HttpResponse.json({ issues: [] })),
  );
}

const renderIntake = (factoryProjectId: string) =>
  renderHookWithProviders(() =>
    useBoardIntake({ factoryProjectId, repository, kind: 'work', knownSourceKeys: new Set<string>() }),
  );

describe('useBoardIntake Linear gating', () => {
  it('given a source routed to the viewed project, when the board loads, then the Linear feed is offered', async () => {
    stubIntake([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1' }]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toContain('linear'));
  });

  it('given the source is routed elsewhere, when the board loads, then the Linear feed is withheld', async () => {
    stubIntake([{ integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1' }]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
    expect(result.current.available).not.toContain('linear');
  });

  it('given no routing and a single Factory, when the board loads, then the Linear feed stays available', async () => {
    stubIntake([], ['factory-1']);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toContain('linear'));
  });

  it('given no routing and several Factories, when the board loads, then the Linear feed is withheld', async () => {
    stubIntake([]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
  });
});

const jiraIssue: JiraIssue = {
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

function stubJiraIntake(
  bindings: Array<{ integrationId: string; sourceId: string; factoryProjectId: string }>,
  {
    factoryIds = ['factory-1', 'factory-2'],
    githubEnabled = false,
    issues = [jiraIssue],
  }: { factoryIds?: string[]; githubEnabled?: boolean; issues?: JiraIssue[] } = {},
) {
  const requestedFactoryIds: Array<string | null> = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: factoryIds.map(id => ({ id, name: id, repositories: [] })),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: githubEnabled, sourceIds: githubEnabled ? ['acme/app'] : null },
          linear: { enabled: false, sourceIds: null },
          jira: { enabled: true, sourceIds: ['10001'] },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
    http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
      HttpResponse.json({ enabled: true, configured: true, site: 'acme.atlassian.net', reason: 'ready' }),
    ),
    http.get(`${TEST_BASE_URL}/web/jira/issues`, ({ request }) => {
      requestedFactoryIds.push(new URL(request.url).searchParams.get('factoryProjectId'));
      return HttpResponse.json({ issues, nextCursor: null });
    }),
    http.get(`${TEST_BASE_URL}/web/projects/repo-1/issues`, () => HttpResponse.json({ issues: [] })),
  );
  return requestedFactoryIds;
}

describe('useBoardIntake Jira gating', () => {
  it('given a source routed to the viewed project, when the board loads, then the Jira feed is offered with Factory-scoped requests', async () => {
    const requestedFactoryIds = stubJiraIntake([
      { integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' },
    ]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toContain('jira'));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(requestedFactoryIds).toEqual(['factory-1']);
  });

  it('given the source is routed elsewhere, when the board loads, then the Jira feed is withheld and nothing is fetched', async () => {
    const requestedFactoryIds = stubJiraIntake([
      { integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' },
    ]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
    expect(result.current.available).not.toContain('jira');
    expect(requestedFactoryIds).toEqual([]);
  });

  it('given no routing and several Factories, when the board loads, then the Jira feed is withheld', async () => {
    stubJiraIntake([]);

    const { result } = renderIntake('factory-2');

    await waitFor(() => expect(result.current.available).toEqual([]));
  });

  it('given no routing and a single Factory, when the board loads, then the Jira feed stays available', async () => {
    stubJiraIntake([], { factoryIds: ['factory-1'] });

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toContain('jira'));
  });

  it('given an issue routed here, when candidates map, then they carry the jira source identity and read-tool run hint', async () => {
    stubJiraIntake([{ integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' }]);

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    const candidate = result.current.candidates[0]!;
    expect(candidate.sourceKey).toBe('jira:ENG-42');
    expect(candidate.source).toBe('jira-issue');
    expect(candidate.url).toBe('https://acme.atlassian.net/browse/ENG-42');
    expect(candidate.metadata).toMatchObject({ identifier: 'ENG-42' });
    const investigate = candidate.runActions[0]!;
    expect(investigate.label).toBe('Investigate');
    expect(JSON.stringify(investigate.invocation)).toContain('jira_get_issue');
  });

  it('given the issue is already a card, when candidates map, then the known source key is dropped', async () => {
    stubJiraIntake([{ integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' }]);

    const { result } = renderHookWithProviders(() =>
      useBoardIntake({
        factoryProjectId: 'factory-1',
        repository,
        kind: 'work',
        knownSourceKeys: new Set(['jira:ENG-42']),
      }),
    );

    await waitFor(() => expect(result.current.participantCandidates).toHaveLength(1));
    expect(result.current.candidates).toEqual([]);
  });

  it('given another feed is active, when the board loads, then Jira issues still feed participant candidates', async () => {
    stubJiraIntake([{ integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' }], {
      githubEnabled: true,
    });

    const { result } = renderIntake('factory-1');

    await waitFor(() => expect(result.current.available).toEqual(['github', 'jira']));
    expect(result.current.active).toBe('github');

    // The Jira feed is not displayed, but its issues are fetched for teammate filtering.
    await waitFor(() =>
      expect(result.current.participantCandidates.map(candidate => candidate.sourceKey)).toContain('jira:ENG-42'),
    );
    expect(result.current.candidates.map(candidate => candidate.sourceKey)).not.toContain('jira:ENG-42');
  });
});
