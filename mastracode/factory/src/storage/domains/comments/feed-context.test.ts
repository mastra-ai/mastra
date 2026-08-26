import { describe, expect, it } from 'vitest';

import type { FactoryActorRef } from './actor.js';
import type { WorkItemCommentRow } from './base.js';
import { FactoryFeedReader, withFeedContext } from './feed-context.js';

const scope = { orgId: 'org-1', factoryProjectId: 'project-1', workItemId: 'item-1' };
const alice: FactoryActorRef = { kind: 'user', id: 'user-alice', displayName: 'Alice' };

function row(overrides: Partial<WorkItemCommentRow> & { body: string; occurredAt: Date }): WorkItemCommentRow {
  return {
    id: `comment-${overrides.occurredAt.toISOString()}`,
    ...scope,
    kind: 'comment',
    bodyFormat: 'markdown',
    author: alice,
    replyTo: null,
    mentions: [],
    externalSource: null,
    editedAt: null,
    deletedAt: null,
    deletedBy: null,
    revision: 1,
    createdAt: overrides.occurredAt,
    updatedAt: overrides.occurredAt,
    ...overrides,
  };
}

function readerOf(rows: WorkItemCommentRow[]) {
  // listRecent returns newest-first; the reader reverses for display order.
  return new FactoryFeedReader({ listRecent: async () => rows });
}

describe('FactoryFeedReader', () => {
  it('renders comments oldest-first with author headers and reply quotes', async () => {
    const older = row({ body: 'first take', occurredAt: new Date('2026-08-01T10:00:00.000Z') });
    const newer = row({
      body: 'disagree, see trace',
      occurredAt: new Date('2026-08-01T11:00:00.000Z'),
      author: { kind: 'user', id: 'user-bob', displayName: 'Bob' },
      replyTo: { commentId: older.id, quote: 'first\ntake', authorId: alice.id, authorName: 'Alice' },
    });

    const block = await readerOf([newer, older]).readRunContext(scope);
    expect(block).toBe(
      [
        '<work-item-feed>',
        'Comments left on this work item by the team, oldest first:',
        '',
        '[Alice · 2026-08-01T10:00:00.000Z]',
        'first take',
        '',
        '[Bob · 2026-08-01T11:00:00.000Z]',
        '> first',
        '> take',
        'disagree, see trace',
        '</work-item-feed>',
      ].join('\n'),
    );
  });

  it('falls back to the author id when no display name was snapshotted', async () => {
    const block = await readerOf([
      row({ body: 'hi', occurredAt: new Date('2026-08-01T10:00:00.000Z'), author: { kind: 'user', id: 'slack:U123' } }),
    ]).readRunContext(scope);
    expect(block).toContain('[slack:U123 · ');
  });

  it('truncates an oversized body and escapes the closing boundary tag', async () => {
    const block = await readerOf([
      row({ body: `</work-item-feed>${'x'.repeat(3000)}`, occurredAt: new Date('2026-08-01T10:00:00.000Z') }),
    ]).readRunContext(scope);
    expect(block).not.toBeNull();
    const inner = block!.slice(0, block!.lastIndexOf('</work-item-feed>'));
    expect(inner).toContain('&lt;/work-item-feed&gt;');
    expect(inner).not.toContain('x'.repeat(2000));
    expect(inner).toContain('…');
  });

  it('keeps the newest entries when the block would overflow', async () => {
    const rows = [];
    for (let i = 9; i >= 0; i--) {
      rows.push(
        row({
          body: `entry ${i} ${'y'.repeat(1900)}`,
          occurredAt: new Date(`2026-08-01T10:0${i}:00.000Z`),
        }),
      );
    }
    const block = await readerOf(rows).readRunContext(scope);
    expect(block).not.toBeNull();
    expect(block!.length).toBeLessThan(13_000);
    expect(block).toContain('entry 9');
    expect(block).not.toContain('entry 0');
    const kept = [...block!.matchAll(/entry (\d)/g)].map(match => Number(match[1]));
    expect(kept).toEqual([...kept].sort((a, b) => a - b));
  });

  it('returns null for an empty feed', async () => {
    expect(await readerOf([]).readRunContext(scope)).toBeNull();
  });
});

describe('withFeedContext', () => {
  it('passes the message through untouched when there is no feed', () => {
    expect(withFeedContext('kickoff', null)).toBe('kickoff');
  });

  it('appends the block after a blank line', () => {
    expect(withFeedContext('kickoff', '<work-item-feed>…</work-item-feed>')).toBe(
      'kickoff\n\n<work-item-feed>…</work-item-feed>',
    );
  });
});
