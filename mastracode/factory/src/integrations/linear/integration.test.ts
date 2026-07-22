import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinearIntegration } from './integration.js';
import type { LinearIssue, LinearIssueDetail } from './integration.js';

function integration(): LinearIntegration {
  return new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });
}

const issue: LinearIssue = {
  id: 'issue-1',
  projectId: 'project-1',
  identifier: 'ENG-42',
  title: 'Fix intake',
  url: 'https://linear.app/acme/issue/ENG-42',
  state: 'Todo',
  stateType: 'unstarted',
  priorityLabel: 'High',
  assignee: 'Ada',
  team: 'ENG',
  labels: ['bug'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

const connection = { type: 'oauth' as const, accessToken: 'linear-token' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LinearIntegration capability surface', () => {
  it('normalizes Linear issues through the shared Intake contract', async () => {
    const linear = integration();
    const listActiveIssues = vi
      .spyOn(linear, 'listActiveIssues')
      .mockResolvedValue({ issues: [issue], nextCursor: 'cursor-2' });

    await expect(
      linear.intake.listIssues({
        connection,
        sourceIds: ['project-1'],
        cursor: 'cursor-1',
        labels: ['bug', 'urgent'],
      }),
    ).resolves.toEqual({
      issues: [
        expect.objectContaining({
          id: 'issue-1',
          identifier: 'ENG-42',
          source: 'ENG',
          priority: 'High',
          labels: ['bug'],
        }),
      ],
      nextCursor: 'cursor-2',
    });
    expect(listActiveIssues).toHaveBeenCalledWith('linear-token', 'cursor-1', ['project-1'], ['bug', 'urgent']);
  });

  it('passes label filters to Linear GraphQL', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const linear = integration();

    await linear.listActiveIssues('linear-token', 'cursor-1', ['project-1'], ['bug', 'urgent']);

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(request.query).toContain('labels: { name: { in: $labels } }');
    expect(request.variables).toMatchObject({ labels: ['bug', 'urgent'] });
  });

  it('fetches issue details and creates comments through the shared Intake contract', async () => {
    const linear = integration();
    const detail: LinearIssueDetail = {
      ...issue,
      description: 'Issue body',
      comments: [{ author: 'Grace', body: 'Looking now', createdAt: '2026-07-03T00:00:00Z' }],
    };
    vi.spyOn(linear, 'fetchIssueDetail').mockResolvedValue(detail);
    vi.spyOn(linear, 'createIssueComment').mockResolvedValue({
      id: 'comment-1',
      url: 'https://linear.app/acme/issue/ENG-42#comment-comment-1',
    });

    await expect(linear.intake.getIssue({ connection, issueId: 'ENG-42' })).resolves.toMatchObject({
      description: 'Issue body',
      commentCount: 1,
      comments: [{ author: 'Grace', body: 'Looking now' }],
    });
    await expect(linear.intake.createComment({ connection, issueId: 'ENG-42', body: 'Done' })).resolves.toEqual({
      id: 'comment-1',
      url: 'https://linear.app/acme/issue/ENG-42#comment-comment-1',
    });
  });

  it('rejects an installation connection instead of silently misusing it', async () => {
    const linear = integration();
    await expect(
      linear.intake.listIssues({
        connection: { type: 'app-installation', installationId: 7 },
        sourceIds: [],
      }),
    ).rejects.toThrow('Linear capabilities require an OAuth connection.');
  });

  it('provides intake without claiming source-control support', () => {
    const linear = integration();

    expect(linear.id).toBe('linear');
    expect(linear.intake).toBeDefined();
    expect('versionControl' in linear).toBe(false);
  });

  it('throws listing every missing required field', () => {
    expect(() => new LinearIntegration({ clientId: '', clientSecret: '' })).toThrow(/clientId, clientSecret/);
  });
});
