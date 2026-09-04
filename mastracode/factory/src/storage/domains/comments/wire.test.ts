import { describe, expect, it } from 'vitest';

import type { WorkItemCommentRow } from './base.js';
import { toWireComment } from './wire.js';

function comment(body: string, integrationId = 'slack'): WorkItemCommentRow {
  const date = new Date('2026-09-04T19:00:00.000Z');
  return {
    id: 'comment-1',
    orgId: 'org-1',
    factoryProjectId: 'factory-1',
    workItemId: 'item-1',
    kind: 'comment',
    body,
    bodyFormat: 'markdown',
    author: { kind: 'user', id: 'slack:U-abhi', displayName: 'Abhi Aiyer' },
    replyTo: null,
    mentions: [],
    externalSource: { integrationId, type: 'message', externalId: 'C-1:1700.99' },
    sourceKey: null,
    occurredAt: date,
    editedAt: null,
    deletedAt: null,
    deletedBy: null,
    revision: 1,
    createdAt: date,
    updatedAt: date,
  };
}

describe('Slack comment emoji rendering', () => {
  it('decodes the heart in an already stored Slack comment without changing storage', () => {
    const stored = comment(':heart: u @Yujohn Nattrass');

    expect(toWireComment(stored, 'viewer-1').body).toBe('❤️ u @Yujohn Nattrass');
    expect(stored.body).toBe(':heart: u @Yujohn Nattrass');
  });

  it.each([
    [':+1: :thumbsup: :tada:', '👍 👍 🎉'],
    [':slightly_smiling_face: :rocket:', '🙂 🚀'],
    [':+1::skin-tone-4:', '👍🏽'],
    ['❤️ 👍🏽 👨‍👩‍👧‍👦', '❤️ 👍🏽 👨‍👩‍👧‍👦'],
    [':mastra_custom_emoji: hello', ':mastra_custom_emoji: hello'],
  ])('renders %s as %s', (body, expected) => {
    expect(toWireComment(comment(body), 'viewer-1').body).toBe(expected);
  });

  it.each(['github', 'linear'])('preserves shortcodes from %s', integrationId => {
    expect(toWireComment(comment(':heart:', integrationId), 'viewer-1').body).toBe(':heart:');
  });

  it('preserves shortcodes in locally written comments', () => {
    const local = { ...comment(':heart:'), externalSource: null };
    expect(toWireComment(local, 'viewer-1').body).toBe(':heart:');
  });
});
