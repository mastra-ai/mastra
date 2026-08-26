import { describe, expect, it } from 'vitest';

import { isWorkItemComment, isWorkItemCommentPage } from './commentsWire';

const comment = {
  id: 'comment-1',
  workItemId: 'item-1',
  kind: 'comment',
  body: 'hello',
  author: { kind: 'user', id: 'user-1', displayName: 'Ada' },
  mentions: [],
  occurredAt: '2026-08-26T10:00:00.000Z',
  editedAt: null,
  deletedAt: null,
};

describe('isWorkItemComment', () => {
  it('accepts a minimal comment and one with every optional field', () => {
    expect(isWorkItemComment(comment)).toBe(true);
    expect(
      isWorkItemComment({
        ...comment,
        replyTo: { commentId: 'comment-0', quote: 'earlier', authorId: 'user-2', authorName: 'Alan' },
        mentions: [{ kind: 'user', id: 'user-2' }],
        origin: { integrationId: 'slack-1', type: 'slack', url: 'https://example.com' },
        editedAt: '2026-08-26T11:00:00.000Z',
        deletedAt: '2026-08-26T12:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('rejects a missing author and a malformed mention', () => {
    expect(isWorkItemComment({ ...comment, author: undefined })).toBe(false);
    expect(isWorkItemComment({ ...comment, author: { kind: 'ghost', id: 'x' } })).toBe(false);
    expect(isWorkItemComment({ ...comment, mentions: [{ kind: 'user' }] })).toBe(false);
  });

  it('requires editedAt and deletedAt to be string or null, not absent', () => {
    const { editedAt: _editedAt, ...withoutEditedAt } = comment;
    expect(isWorkItemComment(withoutEditedAt)).toBe(false);
  });
});

describe('isWorkItemCommentPage', () => {
  it('accepts pages with and without a cursor', () => {
    expect(isWorkItemCommentPage({ comments: [comment] })).toBe(true);
    expect(isWorkItemCommentPage({ comments: [], nextCursor: 'iso_id' })).toBe(true);
  });

  it('rejects a page whose rows are malformed', () => {
    expect(isWorkItemCommentPage({ comments: [{ id: 'x' }] })).toBe(false);
    expect(isWorkItemCommentPage({ comments: 'nope' })).toBe(false);
  });
});
