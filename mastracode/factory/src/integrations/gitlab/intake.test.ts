import { describe, expect, it } from 'vitest';

import type { IntakeIssueTargetState } from '../../capabilities/intake.js';
import type { GitLabIssue, GitLabNote } from './client.js';
import { toIntakeComment, toIntakeIssue, toIntakeIssueDetail, toIntakeItem, toStateEvent } from './intake.js';

function issue(overrides: Partial<GitLabIssue> = {}): GitLabIssue {
  return {
    id: 9001,
    iid: 7,
    project_id: 42,
    title: 'Fix intake sync',
    description: 'Steps to reproduce…',
    state: 'opened',
    web_url: 'https://gitlab.com/group/project/-/issues/7',
    references: { full: 'group/project#7' },
    author: { username: 'grace' },
    assignee: { username: 'ada' },
    assignees: [{ username: 'ada' }, { username: 'linus' }],
    labels: ['bug', 'intake'],
    user_notes_count: 3,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    ...overrides,
  };
}

describe('toIntakeIssue', () => {
  it('normalizes a GitLab issue onto the provider-neutral contract', () => {
    expect(toIntakeIssue(issue())).toEqual({
      // The board addresses the issue by the `projectId!iid` ref, not by iid:
      // an iid is only unique within its project.
      id: '42!7',
      identifier: 'group/project#7',
      title: 'Fix intake sync',
      url: 'https://gitlab.com/group/project/-/issues/7',
      author: 'grace',
      state: 'opened',
      stateType: 'unstarted',
      priority: null,
      assignee: 'ada',
      assignees: ['ada', 'linus'],
      source: '42',
      labels: ['bug', 'intake'],
      commentCount: 3,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    });
  });

  it('collapses GitLab two states onto the contract four workflow families', () => {
    // `opened` is deliberately `unstarted`, never `started`: GitLab carries no
    // in-progress signal, so claiming one would make the board lie.
    expect(toIntakeIssue(issue({ state: 'opened' })).stateType).toBe('unstarted');
    expect(toIntakeIssue(issue({ state: 'closed' })).stateType).toBe('completed');
  });

  it('synthesizes an identifier when GitLab omits the references block', () => {
    expect(toIntakeIssue(issue({ references: undefined })).identifier).toBe('42#7');
    expect(toIntakeIssue(issue({ references: {} })).identifier).toBe('42#7');
  });

  it('reports absent optional fields as null rather than inventing values', () => {
    const sparse = toIntakeIssue(
      issue({ author: null, assignee: null, assignees: undefined, user_notes_count: undefined }),
    );
    expect(sparse.author).toBeNull();
    expect(sparse.assignee).toBeNull();
    expect(sparse.assignees).toEqual([]);
    expect(sparse.commentCount).toBeNull();
    // GitLab models urgency as labels, so there is never a priority to report.
    expect(sparse.priority).toBeNull();
  });
});

describe('toIntakeComment', () => {
  it('maps a note onto the contract comment shape', () => {
    const note: GitLabNote = {
      id: 5,
      body: 'Reproduced on 17.2.',
      system: false,
      author: { username: 'ada' },
      created_at: '2026-07-03T00:00:00Z',
    };
    expect(toIntakeComment(note)).toEqual({
      author: 'ada',
      body: 'Reproduced on 17.2.',
      createdAt: '2026-07-03T00:00:00Z',
    });
  });

  it('tolerates a note whose author was deleted', () => {
    const note: GitLabNote = { id: 6, body: 'orphaned', system: false, author: null, created_at: '2026-07-03Z' };
    expect(toIntakeComment(note).author).toBeNull();
  });
});

describe('toIntakeIssueDetail', () => {
  it('extends the issue with its description and discussion', () => {
    const notes: GitLabNote[] = [
      { id: 1, body: 'first', system: false, author: { username: 'ada' }, created_at: '2026-07-03T00:00:00Z' },
      { id: 2, body: 'second', system: false, author: { username: 'grace' }, created_at: '2026-07-04T00:00:00Z' },
    ];
    const detail = toIntakeIssueDetail(issue(), notes);
    expect(detail).toMatchObject({ id: '42!7', description: 'Steps to reproduce…' });
    expect(detail.comments).toEqual([
      { author: 'ada', body: 'first', createdAt: '2026-07-03T00:00:00Z' },
      { author: 'grace', body: 'second', createdAt: '2026-07-04T00:00:00Z' },
    ]);
  });

  it('keeps a null description null instead of coercing to an empty string', () => {
    expect(toIntakeIssueDetail(issue({ description: null }), []).description).toBeNull();
  });
});

describe('toIntakeItem', () => {
  it('builds a board row addressable by the stored external id', () => {
    expect(toIntakeItem(issue())).toEqual({
      source: {
        type: 'issue',
        externalId: '42!7',
        url: 'https://gitlab.com/group/project/-/issues/7',
      },
      sourceId: '42',
      title: 'group/project#7: Fix intake sync',
      status: 'opened',
      labels: ['bug', 'intake'],
      assignee: 'ada',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
      metadata: { iid: 7, stateType: 'unstarted', projectId: 42 },
    });
  });

  it('carries the iid in metadata so branch naming never parses the path identifier', () => {
    // `workItemBranch` reads `metadata.iid`; a path like `group/project#7`
    // cannot go in a branch name.
    expect(toIntakeItem(issue({ iid: 128 })).metadata).toMatchObject({ iid: 128 });
  });
});

describe('toStateEvent', () => {
  it.each([
    [{ kind: 'byType', stateType: 'completed' }, 'close'],
    [{ kind: 'byType', stateType: 'canceled' }, 'close'],
    [{ kind: 'byType', stateType: 'unstarted' }, 'reopen'],
  ] as const)('translates %j into the %s state event', (state, expected) => {
    expect(toStateEvent(state as IntakeIssueTargetState)).toBe(expected);
  });

  it.each([
    // No in-progress state to move to.
    [{ kind: 'byType', stateType: 'started' }],
    // No custom workflow states to match a name against.
    [{ kind: 'byName', name: 'In Review' }],
  ] as const)('reports %j as not applicable rather than throwing', state => {
    // `Intake.updateIssue` contractually treats null as "nothing to do", which
    // is what keeps the executor idempotency guard from retrying forever.
    expect(toStateEvent(state as IntakeIssueTargetState)).toBeNull();
  });
});
