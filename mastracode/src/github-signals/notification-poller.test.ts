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

function notification(id = 'n1') {
  return {
    id,
    updated_at: '2026-01-01T00:00:00.000Z',
    reason: 'comment',
    repository: { full_name: 'mastra-ai/mastra' },
    subject: {
      title: 'New PR comment',
      type: 'PullRequest',
      url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
    },
  };
}

describe('GithubNotificationPoller', () => {
  it('lets one master poll the inbox and clients read cached PR notifications', async () => {
    const url = `file:${process.cwd()}/.tmp-notification-poller-${Date.now()}-${Math.random()}.db`;
    const commandRunner = vi.fn(async () => ({ stdout: ghResponse([notification('n1')]) }));
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
    expect(commandRunner).toHaveBeenCalledTimes(1);
  });

  it('uses ETags and treats 304 as unchanged', async () => {
    const store = createSharedStore();
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: ghResponse([notification('n1')], '"etag-1"') })
      .mockResolvedValueOnce({ stdout: 'HTTP/2.0 304 Not Modified\netag: "etag-1"\n\n' });
    const first = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1' });

    await expect(first.poll()).resolves.toMatchObject({ updated: true });
    await store.releaseMasterLease('account-1');
    await expect(first.poll()).resolves.toMatchObject({ role: 'master', updated: false });

    expect(commandRunner.mock.calls[1]?.[0]).toContain('If-None-Match: "etag-1"');
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
