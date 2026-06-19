import { Hono, Store, WebhookDispatcher, authMiddleware, createApiErrorHandler, createErrorHandler, serve } from '@emulators/core';
import { slackPlugin } from '@emulators/slack';
import type { StorageThreadType } from '@mastra/core/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SLACK_SIGNALS_METADATA_KEY, SlackSignalsProvider } from './index.js';
import type { SlackSignalsThreadStore } from './index.js';
import { SlackWebApiSyncClient } from './slack-client.js';

const token = 'xoxb-slack-signals-emulator';

type EmulatedSlack = {
  url: string;
  close: () => Promise<void>;
  post: (method: string, body?: Record<string, string | number | boolean | undefined>) => Promise<any>;
};

async function startEmulatedSlack(): Promise<EmulatedSlack> {
  const port = 49213;
  const url = `http://127.0.0.1:${port}`;
  const tokenMap = new Map([
    [
      token,
      {
        id: 1,
        login: 'U000000001',
        scopes: ['chat:write', 'channels:read', 'channels:history', 'users:read'],
      },
    ],
  ]);
  const app = new Hono();
  app.onError(createApiErrorHandler());
  app.use('*', createErrorHandler());
  app.use('*', authMiddleware(tokenMap));
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  slackPlugin.register(app, store, webhooks, url, tokenMap);
  slackPlugin.seed?.(store, url);
  const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });

  return {
    url,
    close: () => new Promise(resolve => server.close(resolve)),
    post: async (method, body = {}) => {
      const response = await fetch(`${url}/api/${method}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(
          Object.entries(body)
            .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
            .map(([key, value]) => [key, String(value)]),
        ),
      });
      return response.json();
    },
  };
}

function createThreadStore(thread: StorageThreadType): SlackSignalsThreadStore {
  return {
    getThreadById: vi.fn(async () => thread),
    saveThread: vi.fn(async ({ thread: nextThread }: { thread: StorageThreadType }) => {
      thread = nextThread;
      return nextThread;
    }),
  };
}

function createThread(): StorageThreadType {
  return {
    id: 'thread-emulated-slack',
    resourceId: 'resource-emulated-slack',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {},
  };
}

function getSavedSlackMetadata(threadStore: SlackSignalsThreadStore) {
  const savedThread = vi.mocked(threadStore.saveThread).mock.calls.at(-1)![0].thread;
  return (savedThread.metadata?.mastra as any)[SLACK_SIGNALS_METADATA_KEY];
}

describe('Slack signals with @emulators/slack', () => {
  let emulator: EmulatedSlack;

  beforeEach(async () => {
    emulator = await startEmulatedSlack();
  });

  afterEach(async () => {
    await emulator.close();
  });

  it('round trips workspace, channel discovery, posted messages, and provider notifications', async () => {
    const syncClient = new SlackWebApiSyncClient({ token, baseUrl: `${emulator.url}/api/` });

    await expect(syncClient.getWorkspace()).resolves.toEqual(
      expect.objectContaining({
        teamId: 'T000000001',
        teamName: 'Emulate',
        userId: 'U000000001',
      }),
    );

    const conversations = await syncClient.listConversations({ types: ['public_channel'], limit: 10 });
    const general = conversations.conversations.find(conversation => conversation.name === 'general');
    expect(general).toEqual(expect.objectContaining({ id: 'C000000001', type: 'public_channel' }));

    const thread = createThread();
    const threadStore = createThreadStore(thread);
    const sendNotificationSignal = vi.fn(async () => undefined);
    const provider = new SlackSignalsProvider({
      token,
      threadStore,
      syncClient,
      include: { privateChannels: false, dms: false, groupDms: false },
      maxMessagesPerChannel: 10,
    });
    provider.connect({ sendNotificationSignal } as any);

    await provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId });
    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual(
      expect.objectContaining({ notificationsSent: 0, channelsFailed: 0 }),
    );
    expect(sendNotificationSignal).not.toHaveBeenCalled();

    const posted = await emulator.post('chat.postMessage', {
      channel: general!.id,
      text: 'hello from emulated Slack',
    });
    expect(posted).toEqual(expect.objectContaining({ ok: true, channel: general!.id }));

    await expect(
      syncClient.listMessages({ conversation: general!, oldest: undefined, inclusive: false, limit: 10 }),
    ).resolves.toEqual(
      expect.objectContaining({
        latestTs: posted.ts,
        messages: [expect.objectContaining({ text: 'hello from emulated Slack', ts: posted.ts })],
      }),
    );

    await expect(provider.pollThreadNow({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toEqual(
      expect.objectContaining({ notificationsSent: 1, channelsFailed: 0 }),
    );
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'slack',
        kind: 'slack-message',
        sourceId: `T000000001:${general!.id}:${posted.ts}`,
        dedupeKey: `T000000001:${general!.id}:${posted.ts}`,
        coalesceKey: `T000000001:${general!.id}`,
        summary: 'U000000001 in #general: hello from emulated Slack',
        payload: expect.objectContaining({
          channelId: general!.id,
          messageTs: posted.ts,
          text: 'hello from emulated Slack',
        }),
      }),
      { resourceId: thread.resourceId, threadId: thread.id },
    );

    const slackMetadata = getSavedSlackMetadata(threadStore);
    expect(slackMetadata.subscription.channels[general!.id]).toEqual(
      expect.objectContaining({ latestTs: posted.ts, lastSyncStatus: 'success' }),
    );
    expect(JSON.stringify(slackMetadata)).not.toContain('next_cursor');
  });
});
