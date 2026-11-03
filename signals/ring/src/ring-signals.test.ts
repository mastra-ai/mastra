import { Agent } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import { Mastra } from '@mastra/core/mastra';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import type { ApiRoute } from '@mastra/core/server';
import type { ChannelsStorage } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeLinkNonce, computeWebhookSignature } from './crypto';
import { RingSignals } from './index';
import type { RingSignalsOptions, RingWebhookEvent } from './index';

const HMAC_KEY = 'test-hmac-key';
const DEVICE_ID = 'device-front-door';
const ACCOUNT_ID = 'ring-account-1';
const SNAPSHOT_BYTES = Buffer.from('jpeg-bytes');
const CLIP_BYTES = Buffer.from('mp4-bytes-0123456789');

type RingApiCall = { method: string; url: string; body: string };

/** Stands in for the Ring Partner API and OAuth server, which can't be reached from tests. */
function fakeRingApi({ expiresIn = 3600, refreshGate }: { expiresIn?: number; refreshGate?: Promise<void> } = {}) {
  const calls: RingApiCall[] = [];
  let tokenCount = 0;

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body === undefined ? '' : String(init.body);
    calls.push({ method, url, body });

    if (url === 'https://oauth.ring.com/oauth/token') {
      if (body.includes('grant_type=refresh_token')) await refreshGate;
      tokenCount++;
      return Response.json({
        access_token: `access-${tokenCount}`,
        refresh_token: `refresh-${tokenCount}`,
        expires_in: tokenCount === 1 ? expiresIn : 3600,
      });
    }
    if (url === 'https://api.amazonvision.com/v1/users/me') return Response.json({ data: { id: ACCOUNT_ID } });
    if (url === 'https://api.amazonvision.com/v1/devices') return Response.json({ data: [{ id: DEVICE_ID }] });
    if (url === 'https://api.amazonvision.com/v1/accounts/me/app-integrations') return new Response('');
    if (url.endsWith('/media/image/download')) return new Response(new Uint8Array(SNAPSHOT_BYTES));
    if (url.endsWith('/media/video/download')) return new Response(new Uint8Array(CLIP_BYTES));
    return new Response('not found', { status: 404 });
  });

  return { calls, fetchMock };
}

function createApp(routes: ApiRoute[]) {
  const app = new Hono();
  for (const route of routes) {
    if ('handler' in route && route.handler) {
      app.on(route.method, route.path, route.handler as any);
    }
  }
  return app;
}

function ringEvent(overrides: Partial<RingWebhookEvent['data']> = {}, meta: Partial<RingWebhookEvent['meta']> = {}) {
  return {
    meta: { version: '1.0', time: new Date().toISOString(), request_id: 'request-1', account_id: ACCOUNT_ID, ...meta },
    data: {
      type: 'button_press',
      id: 'event-1',
      attributes: { source: DEVICE_ID, source_type: 'devices', timestamp: Date.now() - 60_000 },
      ...overrides,
    },
  } as RingWebhookEvent;
}

function setup(options: RingSignalsOptions = {}) {
  const ring = new RingSignals({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    hmacKey: HMAC_KEY,
    encryptionKey: 'test-encryption-key',
    baseUrl: 'https://agent.example.com/',
    hardwareId: 'hardware-1',
    ...options,
  });
  const agent = new Agent({
    id: 'home-agent',
    name: 'Home Agent',
    instructions: 'Watch the front door.',
    model: 'openai/gpt-5-mini',
    signals: [ring],
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ logger: false, agents: { agent }, storage });
  const notifications = vi.spyOn(agent, 'sendNotificationSignal').mockResolvedValue(undefined as any);
  const app = createApp(mastra.getServer()?.apiRoutes ?? []);

  const postWebhook = (event: RingWebhookEvent, signature?: string) => {
    const body = JSON.stringify(event);
    return app.request('/ring/webhook', {
      method: 'POST',
      headers: { 'X-Signature': signature ?? computeWebhookSignature(HMAC_KEY, body) },
      body,
    });
  };

  const linkAccount = async () => {
    const token = await app.request('/ring/token', {
      method: 'POST',
      body: new URLSearchParams({ code: 'auth-code' }),
    });
    expect(token.status).toBe(200);
    const time = String(Date.now());
    const nonce = computeLinkNonce(HMAC_KEY, time, ACCOUNT_ID);
    return app.request(`/ring/link?nonce=${nonce}&time=${time}`);
  };

  return { ring, agent, mastra, storage, notifications, app, postWebhook, linkAccount };
}

describe('RingSignals', () => {
  let ringApi: ReturnType<typeof fakeRingApi>;

  beforeEach(() => {
    ringApi = fakeRingApi();
    vi.stubGlobal('fetch', ringApi.fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds its routes to the Mastra server', () => {
    const { mastra } = setup({ routePrefix: '/ring/' });

    expect(mastra.getServer()?.apiRoutes?.map(route => `${route.method} ${route.path}`)).toEqual([
      'POST /ring/token',
      'GET /ring/link',
      'POST /ring/webhook',
      'GET /ring/home',
      'GET /ring/media/:kind/:deviceId/:timestamp',
    ]);
  });

  describe('webhooks', () => {
    it('rejects a webhook with a bad signature', async () => {
      const { postWebhook, notifications } = setup();

      const response = await postWebhook(ringEvent(), 'sha256=0000');

      expect(response.status).toBe(401);
      expect(notifications).not.toHaveBeenCalled();
    });

    it('sends a signed doorbell press to the device thread by default', async () => {
      const { postWebhook, notifications } = setup();
      const event = ringEvent();

      const response = await postWebhook(event);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ delivered: 1 });
      expect(notifications).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'ring',
          kind: 'button_press',
          priority: 'high',
          summary: 'Doorbell was pressed.',
          attributes: { deviceId: DEVICE_ID, timestamp: event.data.attributes.timestamp },
          dedupeKey: `ring:request-1:${DEVICE_ID}`,
        }),
        { resourceId: 'home-agent', threadId: DEVICE_ID },
      );
    });

    it('sends events from a subscribed device to every subscribed thread instead of the target', async () => {
      const { ring, postWebhook, notifications } = setup({ target: { resourceId: 'owner', threadId: 'fallback' } });
      ring.subscribeThread({ resourceId: 'owner', threadId: 'kitchen' }, DEVICE_ID);
      ring.subscribeThread({ resourceId: 'owner', threadId: 'phone' }, DEVICE_ID);

      await postWebhook(
        ringEvent({
          type: 'motion_detected',
          attributes: { source: DEVICE_ID, source_type: 'devices', timestamp: 1, sub_type: 'human' },
        }),
      );

      expect(notifications.mock.calls.map(([, target]) => target)).toEqual([
        { resourceId: 'owner', threadId: 'kitchen' },
        { resourceId: 'owner', threadId: 'phone' },
      ]);
      expect(notifications.mock.calls[0]![0]).toMatchObject({
        kind: 'motion_detected',
        attributes: { motionType: 'human' },
      });

      expect(ring.unsubscribeThread({ resourceId: 'owner', threadId: 'kitchen' }, DEVICE_ID)).toBe(true);
      ring.unsubscribeThread({ resourceId: 'owner', threadId: 'phone' }, DEVICE_ID);
      notifications.mockClear();

      await postWebhook(ringEvent());

      expect(notifications.mock.calls.map(([, target]) => target)).toEqual([
        { resourceId: 'owner', threadId: 'fallback' },
      ]);
    });

    it('uses a target resolver and custom event settings', async () => {
      const { postWebhook, notifications } = setup({
        target: event =>
          event.data.type === 'device_offline' ? { resourceId: 'owner', threadId: 'alerts' } : undefined,
        events: {
          device_offline: {
            priority: 'low',
            summary: 'Device went offline.',
            coalesce: true,
            attributes: event => ({ eventId: event.data.id, nested: { dropped: true } }),
          },
        },
      });

      const ignored = await postWebhook(ringEvent({ type: 'device_added' }));
      expect(await ignored.json()).toEqual({ ignored: 'device_added' });

      await postWebhook(ringEvent());
      await postWebhook(ringEvent({ type: 'device_offline' }, { request_id: 'request-2' }));

      expect(notifications).toHaveBeenCalledTimes(1);
      expect(notifications).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'device_offline',
          priority: 'low',
          coalesceKey: `ring:device_offline:${DEVICE_ID}`,
          attributes: expect.objectContaining({ eventId: 'event-1' }),
        }),
        { resourceId: 'owner', threadId: 'alerts' },
      );
      expect(notifications.mock.calls[0]![0].attributes).not.toHaveProperty('nested');
    });

    it('rejects a signed webhook whose body is not JSON', async () => {
      const { app, notifications } = setup();
      const body = 'not json';

      const response = await app.request('/ring/webhook', {
        method: 'POST',
        headers: { 'X-Signature': computeWebhookSignature(HMAC_KEY, body) },
        body,
      });

      expect(response.status).toBe(400);
      expect(notifications).not.toHaveBeenCalled();
    });

    it('fails webhooks when credentials are missing', async () => {
      const { postWebhook } = setup({ hmacKey: '' });

      const response = await postWebhook(ringEvent(), 'sha256=anything');

      expect(response.status).toBe(500);
    });
  });

  describe('account linking', () => {
    it('links an account and stores its tokens encrypted', async () => {
      const { linkAccount, storage } = setup();

      const response = await linkAccount();

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Ring account linked');
      expect(ringApi.calls.filter(call => call.url.endsWith('/app-integrations')).map(call => call.method)).toEqual([
        'POST',
        'PATCH',
      ]);

      const channels = (await storage.getStore('channels')) as ChannelsStorage;
      const installations = await channels.listInstallations('ring');
      expect(installations).toHaveLength(1);
      expect(installations[0]).toMatchObject({ id: `ring:home-agent:${ACCOUNT_ID}`, status: 'active' });
      const stored = JSON.stringify(installations[0]!.data);
      expect(stored).not.toContain('access-1');
      expect(stored).not.toContain('refresh-1');
      expect(stored).toContain(DEVICE_ID);
    });

    it('rejects a link request with the wrong nonce', async () => {
      const { app, storage } = setup();
      await app.request('/ring/token', { method: 'POST', body: new URLSearchParams({ code: 'auth-code' }) });

      const response = await app.request(`/ring/link?nonce=wrong&time=${Date.now()}`);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Ring account link failed: nonce mismatch');
      const channels = (await storage.getStore('channels')) as ChannelsStorage;
      expect((await channels.listInstallations('ring')).map(installation => installation.status)).toEqual(['pending']);
    });

    it('rejects a link request dated more than 10 minutes in the future', async () => {
      const { app } = setup();
      await app.request('/ring/token', { method: 'POST', body: new URLSearchParams({ code: 'auth-code' }) });
      const time = String(Date.now() + 11 * 60_000);

      const response = await app.request(
        `/ring/link?nonce=${computeLinkNonce(HMAC_KEY, time, ACCOUNT_ID)}&time=${time}`,
      );

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Ring account link failed: link request expired');
    });

    it('removes stored tokens when the app is unlinked in Ring', async () => {
      const { linkAccount, postWebhook, storage } = setup();
      await linkAccount();

      await postWebhook(
        ringEvent({ type: 'app_integration_removed', attributes: { source: ACCOUNT_ID, source_type: 'accounts' } }),
      );

      const channels = (await storage.getStore('channels')) as ChannelsStorage;
      expect(await channels.listInstallations('ring')).toEqual([]);
    });
  });

  describe('media', () => {
    it('fetches a snapshot with the linked account and serves it from a signed link', async () => {
      const { ring, linkAccount, app } = setup();
      await linkAccount();
      const timestamp = Date.now() - 60_000;

      const result = await ring.getTools().ring_snapshot!.execute!({ deviceId: DEVICE_ID, timestamp }, {} as any);

      expect(result).toMatchObject({
        mediaId: `snapshot:${DEVICE_ID}:${timestamp}`,
        attached: false,
        shareLink: false,
      });
      const mediaCall = ringApi.calls.find(call => call.url.endsWith('/media/image/download'))!;
      expect(mediaCall.url).toBe(`https://api.amazonvision.com/v1/devices/${DEVICE_ID}/media/image/download`);

      const url = new URL((result as { url: string }).url);
      expect(url.origin + url.pathname).toBe(`https://agent.example.com/ring/media/snapshot/${DEVICE_ID}/${timestamp}`);

      const media = await app.request(url.pathname + url.search);
      expect(media.status).toBe(200);
      expect(media.headers.get('Content-Type')).toBe('image/jpeg');
      expect(Buffer.from(await media.arrayBuffer())).toEqual(SNAPSHOT_BYTES);

      url.searchParams.set('signature', 'tampered');
      expect((await app.request(url.pathname + url.search)).status).toBe(403);
    });

    it('serves byte ranges of a clip', async () => {
      const { ring, linkAccount, app } = setup();
      await linkAccount();
      const timestamp = Date.now() - 60_000;

      const result = await ring.getTools().ring_clip!.execute!({ deviceId: DEVICE_ID, timestamp }, {} as any);
      const url = new URL((result as { url: string }).url);

      const media = await app.request(url.pathname + url.search, { headers: { Range: 'bytes=0-3' } });

      expect(media.status).toBe(206);
      expect(media.headers.get('Content-Range')).toBe(`bytes 0-3/${CLIP_BYTES.length}`);
      expect(Buffer.from(await media.arrayBuffer())).toEqual(CLIP_BYTES.subarray(0, 4));
    });

    it('rejects an expired media link', async () => {
      const { ring, linkAccount, app } = setup({ mediaUrlTtlMs: -1 });
      await linkAccount();

      const result = await ring.getTools().ring_snapshot!.execute!({ deviceId: DEVICE_ID, timestamp: 1 }, {} as any);
      const url = new URL((result as { url: string }).url);
      const media = await app.request(url.pathname + url.search);

      expect(media.status).toBe(403);
      expect(await media.text()).toBe('Link expired');
    });

    describe('attachments', () => {
      async function channelThread(storage: InMemoryStore, platform = 'slack') {
        const memory = await storage.getStore('memory');
        await memory!.saveThread({
          thread: {
            id: 'chat-thread',
            resourceId: 'owner',
            title: 'Chat',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: { channel_platform: platform },
          },
        });
      }

      function toolContext(writer?: { custom: (chunk: any) => Promise<void> }) {
        return { agent: { threadId: 'chat-thread' }, ...(writer ? { writer } : {}) } as any;
      }

      function modelOutput(tool: any, result: unknown) {
        return tool.toModelOutput(result) as {
          value: Array<{ type: string; text?: string; data?: string; mediaType?: string }>;
        };
      }

      it('attaches a snapshot on a channel thread and gives the model the image', async () => {
        const { ring, linkAccount, storage } = setup();
        await linkAccount();
        await channelThread(storage);
        const writer = { custom: vi.fn(async () => {}) };
        const tool = ring.getTools().ring_snapshot!;

        const result = await tool.execute!({ deviceId: DEVICE_ID, timestamp: 1 }, toolContext(writer));

        expect(result).toMatchObject({ attached: true, shareLink: false });
        expect(writer.custom).toHaveBeenCalledTimes(1);
        const [chunk] = writer.custom.mock.calls[0] as unknown as [any];
        expect(chunk).toMatchObject({ type: 'file', payload: { mimeType: 'image/jpeg', filename: 'snapshot-1.jpg' } });
        expect(Buffer.from(chunk.payload.data, 'base64')).toEqual(SNAPSHOT_BYTES);

        const output = modelOutput(tool, result);
        expect(output.value[0]!.text).toContain('sent to the user as an attachment');
        expect(output.value[1]).toEqual({
          type: 'image-data',
          data: SNAPSHOT_BYTES.toString('base64'),
          mediaType: 'image/jpeg',
        });
      });

      it('tells the model to share a link when there is no writer to attach with', async () => {
        const { ring, linkAccount, storage } = setup();
        await linkAccount();
        await channelThread(storage);
        const tool = ring.getTools().ring_snapshot!;

        const result = await tool.execute!({ deviceId: DEVICE_ID, timestamp: 1 }, toolContext());

        expect(result).toMatchObject({ attached: false, shareLink: true });
        const text = modelOutput(tool, result).value[0]!.text!;
        expect(text).toContain('[View snapshot](https://agent.example.com/ring/media/snapshot/');
        expect(text).not.toContain('sent to the user as an attachment');
      });

      it("doesn't attach on a platform missing from the attachment list", async () => {
        const { ring, linkAccount, storage } = setup({ tools: { snapshot: { attachment: ['imessage'] } } });
        await linkAccount();
        await channelThread(storage, 'slack');
        const writer = { custom: vi.fn(async () => {}) };

        const result = await ring.getTools().ring_snapshot!.execute!(
          { deviceId: DEVICE_ID, timestamp: 1 },
          toolContext(writer),
        );

        expect(result).toMatchObject({ attached: false, shareLink: true });
        expect(writer.custom).not.toHaveBeenCalled();
      });

      it("doesn't attach a clip over maxAttachmentBytes, and gives the model the video", async () => {
        const { ring, linkAccount, storage } = setup({
          tools: { clip: { maxAttachmentBytes: CLIP_BYTES.length - 1, visibleToModel: true } },
        });
        await linkAccount();
        await channelThread(storage);
        const writer = { custom: vi.fn(async () => {}) };
        const tool = ring.getTools().ring_clip!;

        const result = await tool.execute!({ deviceId: DEVICE_ID, timestamp: 1 }, toolContext(writer));

        expect(result).toMatchObject({ attached: false, shareLink: true });
        expect(writer.custom).not.toHaveBeenCalled();
        const output = modelOutput(tool, result);
        expect(output.value[0]!.text).toContain('[Watch clip](https://agent.example.com/ring/media/clip/');
        expect(output.value[1]).toEqual({
          type: 'file-data',
          data: CLIP_BYTES.toString('base64'),
          mediaType: 'video/mp4',
        });
      });
    });

    it('fails a snapshot when no Ring account is linked, and succeeds once one is', async () => {
      const { ring, linkAccount } = setup();
      const snapshot = () => ring.getTools().ring_snapshot!.execute!({ deviceId: DEVICE_ID, timestamp: 1 }, {} as any);

      await expect(snapshot()).rejects.toThrow('No linked Ring account');

      await linkAccount();
      await expect(snapshot()).resolves.toMatchObject({ mediaId: `snapshot:${DEVICE_ID}:1` });
    });

    it('keeps rotated tokens when a new device sends a webhook during a token refresh', async () => {
      let releaseRefresh!: () => void;
      ringApi = fakeRingApi({ expiresIn: 30, refreshGate: new Promise(resolve => (releaseRefresh = resolve)) });
      vi.stubGlobal('fetch', ringApi.fetchMock);
      const { ring, linkAccount, postWebhook, storage } = setup({ encryptionKey: '' });
      await linkAccount();

      const snapshot = ring.getTools().ring_snapshot!.execute!({ deviceId: DEVICE_ID, timestamp: 1 }, {} as any);
      await vi.waitFor(() =>
        expect(ringApi.calls.some(call => call.body.includes('grant_type=refresh_token'))).toBe(true),
      );
      const webhook = postWebhook(
        ringEvent({ attributes: { source: 'device-back-door', source_type: 'devices', timestamp: 1 } }),
      );
      releaseRefresh();
      await Promise.all([snapshot, webhook]);

      const channels = (await storage.getStore('channels')) as ChannelsStorage;
      const [installation] = await channels.listInstallations('ring');
      expect(installation!.data).toMatchObject({
        refreshToken: 'refresh-2',
        deviceIds: [DEVICE_ID, 'device-back-door'],
      });
    });
  });

  it('only offers and describes the enabled tools', () => {
    const { ring } = setup({ tools: { clip: false } });
    const messageList = new MessageList();

    ring.processInputStep({ messageList } as unknown as ProcessInputStepArgs);

    expect(Object.keys(ring.getTools())).toEqual(['ring_snapshot']);
    const instructions = String(messageList.getSystemMessages('ring-signals')[0]?.content);
    expect(instructions).toContain('ring_snapshot');
    expect(instructions).not.toContain('ring_clip');
  });
});
