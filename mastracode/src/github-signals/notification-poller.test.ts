import { createClient } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';

import { GithubNotificationPoller } from './notification-poller.js';
import { GithubNotificationStore } from './notification-store.js';

function createSharedStore(url = `file::memory:`) {
  return new GithubNotificationStore({
    client: createClient({ url }),
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  });
}

function ghResponse(body: unknown[], etag = '"etag-1"') {
  return `HTTP/2.0 200 OK\netag: ${etag}\n\n${JSON.stringify(body)}`;
}

function notification(id = 'n1', latestCommentUrl?: string) {
  return {
    id,
    updated_at: '2026-01-01T00:00:00.000Z',
    reason: 'comment',
    repository: { full_name: 'mastra-ai/mastra' },
    subject: {
      title: 'New PR comment',
      type: 'PullRequest',
      url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
      latest_comment_url: latestCommentUrl,
    },
  };
}

describe('GithubNotificationPoller', () => {
  it('lets one master poll the inbox and clients read cached PR notifications', async () => {
    const url = `file:${process.cwd()}/.tmp-notification-poller-${Date.now()}-${Math.random()}.db`;
    const commandRunner = vi.fn(async (_args: string[]) => ({ stdout: ghResponse([notification('n1')]) }));
    const master = new GithubNotificationPoller({
      store: createSharedStore(url),
      commandRunner,
      accountKey: 'account-1',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const client = new GithubNotificationPoller({
      store: createSharedStore(url),
      commandRunner,
      accountKey: 'account-1',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(master.poll()).resolves.toMatchObject({ role: 'master', updated: true });
    await expect(client.poll()).resolves.toMatchObject({ role: 'client', updated: false });

    await expect(client.store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: 'n1', title: 'New PR comment' },
    ]);
    expect(commandRunner.mock.calls.filter(call => call[0].includes('/notifications'))).toHaveLength(1);
    expect(commandRunner.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(['api', '--method', 'GET', '/notifications', '-F', 'participating=true']),
    );
  });

  it('enriches inbox notifications with latest comment bodies', async () => {
    const latestCommentUrl = 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1';
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) return { stdout: ghResponse([notification('n1', latestCommentUrl)]) };
      if (args[1] === latestCommentUrl) {
        return {
          stdout: JSON.stringify({
            user: { login: 'coderabbitai[bot]' },
            body: 'Review details from CodeRabbit.',
            created_at: '2026-01-01T00:00:00.000Z',
            html_url: 'https://github.com/mastra-ai/mastra/pull/123#discussion_r1',
          }),
        };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store: createSharedStore(), commandRunner, accountKey: 'account-1' });

    await expect(poller.poll()).resolves.toMatchObject({ updated: true });

    await expect(poller.store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      {
        id: 'n1',
        latestCommentUrl,
        commentAuthor: 'coderabbitai[bot]',
        commentBody: 'Review details from CodeRabbit.',
        commentHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123#discussion_r1',
      },
    ]);
  });

  it('enriches inbox notifications with PR state and failed check runs from the PR head SHA', async () => {
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) return { stdout: ghResponse([notification('n1')]) };
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return {
          stdout: JSON.stringify({
            state: 'closed',
            merged: true,
            closed_at: '2026-01-01T00:01:00.000Z',
            merged_at: '2026-01-01T00:01:00.000Z',
            html_url: 'https://github.com/mastra-ai/mastra/pull/123',
            mergeable: false,
            mergeable_state: 'dirty',
            head: { sha: 'sha-1' },
          }),
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return {
          stdout: JSON.stringify({
            check_runs: [
              { name: 'lint', conclusion: 'failure', details_url: 'https://github.com/checks/lint' },
              { name: 'test', conclusion: 'success' },
            ],
          }),
        };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store: createSharedStore(), commandRunner, accountKey: 'account-1' });

    await expect(poller.poll()).resolves.toMatchObject({ updated: true });

    await expect(poller.store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      {
        id: 'n1',
        prState: 'closed',
        prMerged: true,
        prClosedAt: '2026-01-01T00:01:00.000Z',
        prMergedAt: '2026-01-01T00:01:00.000Z',
        prHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123',
        prMergeable: false,
        prMergeableState: 'dirty',
        prHeadSha: 'sha-1',
        failedChecks: [{ name: 'lint', status: 'failure', url: 'https://github.com/checks/lint' }],
      },
    ]);
  });

  it('uses ETags and treats 304 as unchanged', async () => {
    const store = createSharedStore();
    const commandRunner = vi
      .fn(async (_args: string[]) => ({ stdout: '' }))
      .mockResolvedValueOnce({ stdout: ghResponse([notification('n1')], '"etag-1"') })
      .mockRejectedValueOnce(new Error('Command failed: gh api --method GET /notifications\ngh: HTTP 304'));
    const first = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1' });

    await expect(first.poll()).resolves.toMatchObject({ updated: true });
    await store.releaseMasterLease('account-1');
    await expect(first.poll()).resolves.toMatchObject({ role: 'master', updated: false });

    expect(commandRunner.mock.calls.find(call => call[0].includes('If-None-Match: "etag-1"'))?.[0]).toContain(
      'If-None-Match: "etag-1"',
    );
  });

  it('backfills missing enrichment for cached PR notifications after a fresh inbox poll', async () => {
    const store = createSharedStore();
    await store.upsertNotifications('account-1', [
      {
        id: 'old-conflicted-pr',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'Old conflicted PR row',
        subjectType: 'PullRequest',
        reason: 'author',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) return { stdout: ghResponse([notification('new-pr')], '"etag-2"') };
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return {
          stdout: JSON.stringify({
            state: 'open',
            merged: false,
            html_url: 'https://github.com/mastra-ai/mastra/pull/123',
            mergeable: false,
            mergeable_state: 'dirty',
            head: { sha: 'sha-1' },
          }),
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1' });

    await expect(poller.poll()).resolves.toMatchObject({
      role: 'master',
      updated: true,
      notifications: expect.arrayContaining([
        expect.objectContaining({
          id: 'old-conflicted-pr',
          prMergeable: false,
          prMergeableState: 'dirty',
          prHeadSha: 'sha-1',
        }),
      ]),
    });

    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'old-conflicted-pr',
          prMergeable: false,
          prMergeableState: 'dirty',
          prHeadSha: 'sha-1',
        }),
      ]),
    );
  });

  it('backfills failed check enrichment for cached PR notifications when GitHub returns 304', async () => {
    const store = createSharedStore();
    await store.upsertNotifications('account-1', [
      {
        id: 'n1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'New PR comment',
        subjectType: 'PullRequest',
        reason: 'author',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await store.updateAccountState('account-1', { etag: '"etag-1"' });
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications'))
        throw new Error('Command failed: gh api --method GET /notifications\ngh: HTTP 304');
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-1' } }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return {
          stdout: JSON.stringify({
            check_runs: [{ name: 'lint', conclusion: 'failure', details_url: 'https://github.com/checks/lint' }],
          }),
        };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1' });

    await expect(poller.poll()).resolves.toMatchObject({ role: 'master', updated: true });

    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: 'n1', failedChecks: [{ name: 'lint', status: 'failure', url: 'https://github.com/checks/lint' }] },
    ]);
  });

  it('persists empty failed checks and nullable mergeability so backfill does not refetch every poll', async () => {
    const store = createSharedStore();
    await store.upsertNotifications('account-1', [
      {
        id: 'n1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'New PR comment',
        subjectType: 'PullRequest',
        reason: 'author',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await store.updateAccountState('account-1', { etag: '"etag-1"' });
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications'))
        throw new Error('Command failed: gh api --method GET /notifications\ngh: HTTP 304');
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return {
          stdout: JSON.stringify({
            mergeable: null,
            mergeable_state: 'unknown',
            head: { sha: 'sha-1' },
          }),
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1' });

    await expect(poller.poll()).resolves.toMatchObject({ role: 'master', updated: true });
    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: 'n1', failedChecks: [], prMergeable: undefined, prMergeableState: 'unknown', prHeadSha: 'sha-1' },
    ]);

    await store.releaseMasterLease('account-1');
    await expect(poller.poll()).resolves.toMatchObject({ role: 'master', updated: false });
    expect(
      commandRunner.mock.calls.filter(call => call[0][1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123'),
    ).toHaveLength(1);
    expect(
      commandRunner.mock.calls.filter(
        call => call[0][1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs',
      ),
    ).toHaveLength(1);
  });

  it('refreshes stale mergeability for a subscribed cached PR row', async () => {
    const store = createSharedStore();
    await store.upsertNotifications('account-1', [
      {
        id: 'n1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'Stale PR row',
        subjectType: 'PullRequest',
        reason: 'author',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-01T00:00:00.000Z',
        prMergeable: true,
        prMergeableState: 'blocked',
        prHeadSha: 'old-sha',
        prMergeabilityCheckedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return {
          stdout: JSON.stringify({
            state: 'open',
            merged: false,
            html_url: 'https://github.com/mastra-ai/mastra/pull/123',
            mergeable: false,
            mergeable_state: 'dirty',
            head: { sha: 'new-sha' },
          }),
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/new-sha/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({
      store,
      commandRunner,
      accountKey: 'account-1',
      now: () => new Date('2026-01-01T00:06:00.000Z'),
    });

    await expect(poller.refreshPullRequestNotifications('mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: 'n1', prMergeable: false, prMergeableState: 'dirty', prHeadSha: 'new-sha' },
    ]);

    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      {
        id: 'n1',
        failedChecks: [],
        prMergeable: false,
        prMergeableState: 'dirty',
        prHeadSha: 'new-sha',
        prMergeabilityCheckedAt: '2026-01-01T00:06:00.000Z',
      },
    ]);
  });

  it('does not send invalid empty ETags for conditional notification polling', async () => {
    const store = createSharedStore();
    await store.updateAccountState('account-1', { etag: 'W/""' });
    const commandRunner = vi.fn(async (_args: string[]) => ({ stdout: ghResponse([notification('n1')], 'W/""') }));
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1' });

    await expect(poller.poll()).resolves.toMatchObject({ updated: true });

    const firstCallArgs = (commandRunner.mock.calls as Array<[string[]]>)[0]?.[0];
    expect(firstCallArgs).not.toContain('If-None-Match: W/""');
    await expect(store.getAccountState('account-1')).resolves.toMatchObject({ etag: undefined });
  });

  it('stores shared rate-limit state and skips readers while limited', async () => {
    const store = createSharedStore();
    const commandRunner = vi.fn(async () => {
      throw new Error('HTTP 403: API rate limit exceeded\nx-ratelimit-reset: 1767229200');
    });
    const poller = new GithubNotificationPoller({
      store,
      commandRunner,
      accountKey: 'account-1',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(poller.poll()).resolves.toMatchObject({ rateLimitedUntil: '2026-01-01T01:00:00.000Z' });
    await store.releaseMasterLease('account-1');
    await expect(poller.poll()).resolves.toMatchObject({
      role: 'client',
      rateLimitedUntil: '2026-01-01T01:00:00.000Z',
    });
    expect(commandRunner).toHaveBeenCalledTimes(1);
  });
});
