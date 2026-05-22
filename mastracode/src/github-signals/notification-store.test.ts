import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';

import {
  deriveGithubNotificationAccountKey,
  GithubNotificationStore,
  normalizeGithubInboxNotification,
  parseGithubNotificationPr,
} from './notification-store.js';

function createTestDbUrl() {
  return `file:${join(mkdtempSync(join(tmpdir(), 'github-notifications-')), 'cache.db')}`;
}

function createStore(now = new Date('2026-01-01T00:00:00.000Z'), url = createTestDbUrl()) {
  return new GithubNotificationStore({
    client: createClient({ url }),
    now: () => now,
  });
}

function notification(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: input.id ?? 'n1',
    reason: input.reason ?? 'comment',
    updated_at: input.updated_at ?? '2026-01-01T00:00:00.000Z',
    url: input.url ?? 'https://api.github.com/notifications/threads/1',
    latest_comment_url: input.latest_comment_url,
    repository: { full_name: input.repo ?? 'mastra-ai/mastra' },
    subject: {
      title: input.title ?? 'A PR notification',
      type: input.subject_type ?? 'PullRequest',
      url: Object.hasOwn(input, 'subject_url')
        ? input.subject_url
        : 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
      latest_comment_url: input.subject_latest_comment_url,
    },
  };
}

describe('GithubNotificationStore', () => {
  it('derives stable account keys without leaking tokens', () => {
    expect(deriveGithubNotificationAccountKey('ghp_secret')).toHaveLength(24);
    expect(deriveGithubNotificationAccountKey('ghp_secret')).toBe(deriveGithubNotificationAccountKey('ghp_secret'));
    expect(deriveGithubNotificationAccountKey('ghp_secret')).not.toContain('ghp');
  });

  it('matches notifications to pull, issue, and latest-comment URLs', () => {
    expect(parseGithubNotificationPr(notification())?.prNumber).toBe(123);
    expect(
      parseGithubNotificationPr(
        notification({ subject_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/456' }),
      )?.prNumber,
    ).toBe(456);
    expect(
      parseGithubNotificationPr(
        notification({
          subject_url: undefined,
          latest_comment_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/789/comments/1',
        }),
      )?.prNumber,
    ).toBe(789);
    expect(
      parseGithubNotificationPr(
        notification({
          subject_url: undefined,
          subject_latest_comment_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/790/comments/1',
        }),
      )?.prNumber,
    ).toBe(790);
  });

  it('normalizes inbox notifications into bounded PR records', async () => {
    const store = createStore();
    const accountKey = 'account-1';
    const normalized = normalizeGithubInboxNotification(
      notification({
        id: 'n1',
        subject_latest_comment_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
      }),
    );
    expect(normalized).toMatchObject({
      id: 'n1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      latestCommentUrl: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
    });

    await store.upsertNotifications(accountKey, [normalized!]);

    await expect(store.readPrNotifications(accountKey, 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: 'n1', repo: 'mastra-ai/mastra', prNumber: 123, title: 'A PR notification' },
    ]);
  });

  it('round-trips enriched PR mergeability fields', async () => {
    const store = createStore();
    await store.upsertNotifications('account-1', [
      {
        id: 'n1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'Conflicted PR',
        subjectType: 'PullRequest',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-01T00:00:00.000Z',
        prMergeable: false,
        prMergeableState: 'dirty',
        prHeadSha: 'sha-1',
      },
    ]);

    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: 'n1', prMergeable: false, prMergeableState: 'dirty', prHeadSha: 'sha-1' },
    ]);
  });

  it('drops notifications older than the cache age window', async () => {
    const store = createStore(new Date('2026-01-10T00:00:00.000Z'));
    await store.upsertNotifications('account-1', [
      normalizeGithubInboxNotification(notification({ id: 'old', updated_at: '2026-01-01T00:00:00.000Z' }))!,
      normalizeGithubInboxNotification(notification({ id: 'fresh', updated_at: '2026-01-09T00:00:00.000Z' }))!,
    ]);

    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: 'fresh' },
    ]);
  });

  it('keeps only the newest 50 notifications per PR', async () => {
    const store = createStore();
    const notifications = Array.from(
      { length: 55 },
      (_, index) =>
        normalizeGithubInboxNotification(
          notification({
            id: `n${index}`,
            updated_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
          }),
        )!,
    );

    await store.upsertNotifications('account-1', notifications);
    const stored = await store.readPrNotifications('account-1', 'mastra-ai/mastra', 123);

    expect(stored).toHaveLength(50);
    expect(stored[0]?.id).toBe('n5');
    expect(stored.at(-1)?.id).toBe('n54');
  });

  it('round-trips shared PR snapshot cache rows', async () => {
    const store = createStore();

    await store.upsertPrSnapshot('account-1', {
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      title: 'Cached PR',
      url: 'https://github.com/mastra-ai/mastra/pull/123',
      state: 'open',
      merged: false,
      mergeable: false,
      mergeableState: 'dirty',
      headSha: 'sha-1',
      failedChecks: [{ name: 'test', status: 'failure', url: 'https://github.com/checks/test' }],
      reviews: [{ id: 'r1', author: 'coderabbitai[bot]', state: 'COMMENTED', submittedAt: '2026-01-01T00:01:00.000Z' }],
      checkedAt: '2026-01-01T00:02:00.000Z',
      checksCheckedAt: '2026-01-01T00:03:00.000Z',
      heavyCheckedAt: '2026-01-01T00:04:00.000Z',
      updatedAt: '2026-01-01T00:04:00.000Z',
    });

    await expect(store.readPrSnapshot('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject({
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      title: 'Cached PR',
      mergeable: false,
      mergeableState: 'dirty',
      headSha: 'sha-1',
      failedChecks: [{ name: 'test', status: 'failure', url: 'https://github.com/checks/test' }],
      reviews: [{ id: 'r1', author: 'coderabbitai[bot]', state: 'COMMENTED' }],
    });
    await expect(
      store.readFreshPrSnapshot(
        'account-1',
        'mastra-ai/mastra',
        123,
        '2026-01-01T00:01:59.000Z',
        '2026-01-01T00:02:59.000Z',
        '2026-01-01T00:03:59.000Z',
      ),
    ).resolves.toMatchObject({ headSha: 'sha-1' });
    await expect(
      store.readFreshPrSnapshot(
        'account-1',
        'mastra-ai/mastra',
        123,
        '2026-01-01T00:01:59.000Z',
        '2026-01-01T00:03:01.000Z',
        '2026-01-01T00:03:59.000Z',
      ),
    ).resolves.toBeUndefined();
    await expect(
      store.readFreshPrSnapshot(
        'account-1',
        'mastra-ai/mastra',
        123,
        '2026-01-01T00:01:59.000Z',
        '2026-01-01T00:02:59.000Z',
        '2026-01-01T00:04:01.000Z',
      ),
    ).resolves.toBeUndefined();
    await expect(
      store.readFreshPrSnapshot('account-1', 'mastra-ai/mastra', 123, '2026-01-01T00:02:01.000Z'),
    ).resolves.toBeUndefined();
  });

  it('claims notification delivery once per thread and notification update', async () => {
    const url = createTestDbUrl();
    const first = createStore(undefined, url);
    const second = createStore(undefined, url);
    const claim = {
      accountKey: 'account-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      notificationId: 'notification-1',
      notificationUpdatedAt: '2026-01-01T00:00:00.000Z',
    };

    await expect(first.claimNotificationDelivery(claim)).resolves.toBe(true);
    await expect(second.claimNotificationDelivery(claim)).resolves.toBe(false);
    await expect(
      second.claimNotificationDelivery({ ...claim, notificationUpdatedAt: '2026-01-01T00:01:00.000Z' }),
    ).resolves.toBe(true);
  });

  it('uses the account table as a master lease', async () => {
    const url = createTestDbUrl();
    const first = createStore(undefined, url);
    const second = createStore(undefined, url);

    await expect(first.acquireMasterLease('account-1', 60_000)).resolves.toBe(true);
    await expect(second.acquireMasterLease('account-1', 60_000)).resolves.toBe(false);
    await first.releaseMasterLease('account-1');
    await expect(second.acquireMasterLease('account-1', 60_000)).resolves.toBe(true);
  });

  it('recovers the master lease after the previous owner expires', async () => {
    const url = createTestDbUrl();
    let now = new Date('2026-01-01T00:00:00.000Z');
    const first = new GithubNotificationStore({ client: createClient({ url }), now: () => now });
    const second = new GithubNotificationStore({ client: createClient({ url }), now: () => now });

    await expect(first.acquireMasterLease('account-1', 1_000)).resolves.toBe(true);
    await expect(second.acquireMasterLease('account-1', 1_000)).resolves.toBe(false);

    now = new Date('2026-01-01T00:00:02.000Z');
    await expect(second.acquireMasterLease('account-1', 1_000)).resolves.toBe(true);
  });
});
