import { describe, expect, it, vi } from 'vitest';

import { LinearIntegration, type LinearIssue, type LinearIssueDetail } from './integration';

function integration(): LinearIntegration {
  return new LinearIntegration({ clientId: 'linear-client', clientSecret: 'linear-secret' });
}

const issue: LinearIssue = {
  id: 'issue-1',
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

describe('LinearIntegration capability surface', () => {
  it('normalizes Linear issues through the shared Intake contract', async () => {
    const linear = integration();
    const listActiveIssues = vi
      .spyOn(linear, 'listActiveIssues')
      .mockResolvedValue({ issues: [issue], nextCursor: 'cursor-2' });

    await expect(
      linear.intake.listIssues({ connection, sourceIds: ['project-1'], cursor: 'cursor-1' }),
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
    expect(listActiveIssues).toHaveBeenCalledWith('linear-token', 'cursor-1', ['project-1']);
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
});
