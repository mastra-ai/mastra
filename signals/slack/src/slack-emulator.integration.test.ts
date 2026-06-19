import { Hono, Store, WebhookDispatcher, authMiddleware, createApiErrorHandler, createErrorHandler, serve } from '@emulators/core';
import { slackPlugin } from '@emulators/slack';
import type { StorageThreadType } from '@mastra/core/memory';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SLACK_SIGNALS_METADATA_KEY, SlackSignalsProvider } from './index.js';
import type { SlackSignalsThreadStore } from './index.js';
import { SlackWebApiSyncClient } from './slack-client.js';

const token = 'xoxp-slack-signals-emulator';

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

  beforeAll(async () => {
    emulator = await startEmulatedSlack();
  });

  afterAll(async () => {
    await emulator.close();
  });

  it('sync client round-trips workspace, channel discovery, and message history against emulated Slack', async () => {
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
  });

  it('subscribe flow saves workspace subscription using emulated Slack auth.test', async () => {
    const syncClient = new SlackWebApiSyncClient({ token, baseUrl: `${emulator.url}/api/` });
    const thread = createThread();
    const threadStore = createThreadStore(thread);

    const provider = new SlackSignalsProvider({
      token,
      threadStore,
      syncClient,
      include: { privateChannels: false, dms: false, groupDms: false },
    });

    await expect(provider.subscribeThreadToSlack({ threadId: thread.id, resourceId: thread.resourceId })).resolves.toMatchObject({
      subscribed: true,
      workspaceId: 'T000000001',
      workspaceName: 'Emulate',
    });

    const slackMetadata = getSavedSlackMetadata(threadStore);
    expect(slackMetadata.subscription).toEqual(
      expect.objectContaining({
        workspaceId: 'T000000001',
        workspaceName: 'Emulate',
        conversationTypes: ['public_channel'],
      }),
    );
  });
});
