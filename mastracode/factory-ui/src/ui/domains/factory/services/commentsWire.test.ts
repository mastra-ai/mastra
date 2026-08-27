import { describe, expect, it } from 'vitest';

import { isWorkItemComment, isWorkItemCommentPage } from './commentsWire';

const comment = {
  id: 'comment-1',
  workItemId: 'item-1',
  kind: 'comment',
  body: 'hello',
  author: { kind: 'user', id: 'user-1', displayName: 'Ada' },
  mentions: [],
  revision: 1,
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
        clientToken: 'abcd1234-abcd-1234-abcd-123456789012',
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
    const { deletedAt: _deletedAt, ...withoutDeletedAt } = comment;
    expect(isWorkItemComment(withoutDeletedAt)).toBe(false);
  });

  it('requires a numeric revision', () => {
    const { revision: _revision, ...withoutRevision } = comment;
    expect(isWorkItemComment(withoutRevision)).toBe(false);
    expect(isWorkItemComment({ ...comment, revision: '1' })).toBe(false);
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
