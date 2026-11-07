import { createSlackAdapter } from '@chat-adapter/slack';
import type { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { SlackManifestClient } from './client';
import {
  CARD_WEB_CLIENT_OPTIONS,
  ComputerCards,
  buildCardBlocks,
  buildEntity,
  createCardClient,
  deriveRefKey,
  signRef,
  verifyRef,
} from './computer-card';
import type { CardWebClient } from './computer-card';
import { SlackProvider } from './provider';

const REF_CHARSET = /^[0-9a-zA-Z\-_:!/=]+$/;

describe('signed computer refs', () => {
  const key = deriveRefKey('signing-secret');
  const ref = { teamId: 'T1', computerId: 'comp/1 + ü', threadId: 'thread with space/é' };

  it('round-trips awkward ids and fits the Slack external_ref charset', () => {
    const signed = signRef(key, ref);
    expect(signed).toMatch(REF_CHARSET);
    expect(signed.length).toBeLessThanOrEqual(2000);
    expect(verifyRef(key, signed)).toEqual(ref);
  });

  it('rejects tampered payloads, wrong secrets, and junk', () => {
    const signed = signRef(key, ref);
    const [p, payload, mac] = signed.split(':');
    const forged = Buffer.from(JSON.stringify({ t: 'T1', c: 'other', h: ref.threadId })).toString('base64url');
    expect(verifyRef(key, `${p}:${forged}:${mac}`)).toBeNull();
    expect(verifyRef(deriveRefKey('other-secret'), signed)).toBeNull();
    expect(verifyRef(key, `${p}:${payload}`)).toBeNull();
    expect(verifyRef(key, undefined)).toBeNull();
    expect(verifyRef(key, 'x'.repeat(3000))).toBeNull();
  });
});

describe('card payloads', () => {
  it('entity always carries entity_payload.fields and only sets a preview url when given', () => {
    const plain = buildEntity({ ref: 'r', url: 'https://x/y', name: 'n' });
    expect(plain.entity_payload.fields).toEqual({});
    expect(plain.entity_payload.attributes.full_size_preview).toEqual({ is_supported: false });
    const framed = buildEntity({ ref: 'r', url: 'https://x/y', name: 'n', previewUrl: 'https://embed/1' });
    expect(framed.entity_payload.attributes.full_size_preview).toEqual({
      is_supported: true,
      mime_type: 'application/vnd.slack-embed',
      preview_url: 'https://embed/1',
    });
  });

  it('shows Take control for the agent, Hand back for the human, and no buttons once ended', () => {
    const agent = buildCardBlocks({ name: 'n', holder: 'agent', ended: false, ref: 'r', buttons: true });
    expect((agent[1] as any).elements[0]).toMatchObject({ action_id: 'computer_take', value: 'r' });
    const human = buildCardBlocks({ name: 'n', holder: 'human', ended: false, ref: 'r', buttons: true });
    expect((human[1] as any).elements[0]).toMatchObject({ action_id: 'computer_release', value: 'r' });
    expect(buildCardBlocks({ name: 'n', holder: 'agent', ended: true, ref: 'r', buttons: true })).toHaveLength(1);
    expect(buildCardBlocks({ name: 'n', holder: 'agent', ended: false, ref: 'r', buttons: false })).toHaveLength(1);
  });
});

describe('card-only Slack client', () => {
  it('is bounded while the conversation adapter keeps its defaults', () => {
    const creds = { botToken: 'xoxb-1', botUserId: 'UBOT', signingSecret: 's' };
    const { client } = createCardClient(creds) as unknown as { client: any };
    expect(client.retryConfig).toEqual({ retries: 0 });
    expect(client.rejectRateLimitedCalls).toBe(true);
    expect(client.axios.defaults.timeout).toBe(CARD_WEB_CLIENT_OPTIONS.timeout);
    const conversation = createSlackAdapter(creds).webClient as any;
    expect(conversation.retryConfig.retries).toBeGreaterThan(0);
    expect(conversation.rejectRateLimitedCalls).toBe(false);
    expect(conversation.axios.defaults.timeout).toBe(0);
  });
});

function fakeClient() {
  const calls: Array<{ method: string; args: Record<string, any> }> = [];
  let ts = 0;
  const client: CardWebClient = {
    chat: {
      postMessage: async args => {
        calls.push({ method: 'chat.postMessage', args });
        return { ok: true, ts: `1700000001.00000${++ts}` };
      },
      update: async args => {
        calls.push({ method: 'chat.update', args });
        return { ok: true };
      },
      postEphemeral: async args => {
        calls.push({ method: 'chat.postEphemeral', args });
        return { ok: true };
      },
    },
    apiCall: async (method, args) => {
      calls.push({ method, args });
      return { ok: true };
    },
  };
  return { client, calls };
}

const slack = createSlackAdapter({ botToken: 'xoxb-1', botUserId: 'UBOT', signingSecret: 's' });
const installation = { id: 'inst-1', teamId: 'T1', signingSecret: 'secret', webhookId: 'w1' };

function makeCards(overrides: Partial<ConstructorParameters<typeof ComputerCards>[0]> = {}) {
  const { client, calls } = fakeClient();
  const cards = new ComputerCards({
    installation,
    client,
    decodeThreadId: id => slack.decodeThreadId(id),
    getBaseUrl: () => 'https://example.com',
    getMastra: () => undefined,
    buttons: true,
    ...overrides,
  });
  return { cards, calls };
}

const ctx = (chatThreadId: string) => ({ platform: 'slack', chatThread: { id: chatThreadId }, threadId: 'th-1' }) as any;
const part = (data: Record<string, unknown>) => ({ type: 'data-computer' as const, data });

describe('card lifecycle', () => {
  for (const [label, chatThreadId, channel, threadTs] of [
    ['channel mention', 'slack:C123:1700000000.000100', 'C123', '1700000000.000100'],
    ['reply thread', 'slack:C999:1699999999.123456', 'C999', '1699999999.123456'],
    ['DM', 'slack:D42:', 'D42', undefined],
  ] as const) {
    it(`posts once into the ${label} thread`, async () => {
      const { cards, calls } = makeCards();
      await cards.onDataPart(part({ computerId: 'c1', threadId: 'th-1', name: 'Desk', status: 'attached' }), ctx(chatThreadId));
      expect(calls).toHaveLength(1);
      expect(calls[0]!.method).toBe('chat.postMessage');
      expect(calls[0]!.args.channel).toBe(channel);
      expect(calls[0]!.args.thread_ts).toBe(threadTs);
      expect(calls[0]!.args.metadata).toBeUndefined();
      expect(JSON.stringify(calls[0]!.args)).not.toMatch(/https?:\/\//);
    });
  }

  it('back-to-back attached + control(human) posts once then updates once', async () => {
    const { cards, calls } = makeCards();
    const c = ctx('slack:C1:1.1');
    const a = cards.onDataPart(part({ computerId: 'c1', status: 'attached', name: 'Desk' }), c);
    const b = cards.onDataPart(part({ computerId: 'c1', control: 'human' }), c);
    await Promise.all([a, b]);
    expect(calls.map(x => x.method)).toEqual(['chat.postMessage', 'chat.update']);
    expect(calls[1]!.args.ts).toBe('1700000001.000001');
    expect(calls[1]!.args.text).toContain('you have control');
  });

  it('released ends the card with no buttons; later control parts are ignored', async () => {
    const { cards, calls } = makeCards();
    const c = ctx('slack:C1:1.1');
    await cards.onDataPart(part({ computerId: 'c1', status: 'attached' }), c);
    await cards.onDataPart(part({ computerId: 'c1', status: 'released' }), c);
    await cards.onDataPart(part({ computerId: 'c1', control: 'human' }), c);
    expect(calls.map(x => x.method)).toEqual(['chat.postMessage', 'chat.update']);
    expect(calls[1]!.args.blocks).toHaveLength(1);
    expect(calls[1]!.args.text).toContain('session ended');
  });

  it('ignores parts for another thread and non-computer parts', async () => {
    const { cards, calls } = makeCards();
    await cards.onDataPart(part({ computerId: 'c1', threadId: 'other', status: 'attached' }), ctx('slack:C1:1.1'));
    await cards.onDataPart({ type: 'data-other', data: { computerId: 'c1', status: 'attached' } }, ctx('slack:C1:1.1'));
    expect(calls).toHaveLength(0);
  });

  it('with an embed hook, posts Work Object metadata whose url is the static page, never a viewer url', async () => {
    const embedUrl = vi.fn(async () => 'https://viewer.example/secret-token');
    const { cards, calls } = makeCards({ embedUrl });
    await cards.onDataPart(part({ computerId: 'c1', status: 'attached', name: 'Desk' }), ctx('slack:C1:1.1'));
    const entity = calls[0]!.args.metadata.entities[0];
    expect(entity.url).toMatch(/^https:\/\/example\.com\/slack\/computers\/w1\?ref=/);
    expect(entity.external_ref.id).toMatch(REF_CHARSET);
    expect(embedUrl).not.toHaveBeenCalled();
    expect(JSON.stringify(calls)).not.toContain('secret-token');
  });

  it('logs missing_scope once and keeps going', async () => {
    const warn = vi.fn();
    const { client } = fakeClient();
    client.chat.postMessage = async () => {
      throw new Error('An API error occurred: missing_scope');
    };
    const { cards } = makeCards({ client, logger: { warn } });
    await cards.onDataPart(part({ computerId: 'c1', status: 'attached' }), ctx('slack:C1:1.1'));
    await cards.onDataPart(part({ computerId: 'c2', status: 'attached' }), ctx('slack:C1:1.1'));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('provider wiring', () => {
  afterEach(() => {
    delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
  });

  async function boot() {
    vi.spyOn(SlackManifestClient.prototype, 'updateApp').mockResolvedValue(undefined as any);
    const store = new InMemoryStore();
    const channels = (await store.getStore('channels'))!;
    await channels.saveInstallation({
      id: 'inst-1',
      platform: 'slack',
      agentId: 'agent-1',
      status: 'active',
      webhookId: 'w1',
      configHash: 'x',
      data: {
        appId: 'A1',
        clientId: 'cid',
        clientSecret: 'cs',
        signingSecret: 'ss',
        teamId: 'T1',
        botToken: 'xoxb-test',
        botUserId: 'UBOT',
      },
    } as any);
    let set: any;
    const agent: any = {
      name: 'Helper',
      getDescription: () => 'Helps',
      getChannels: () => set,
      setChannels: (c: any) => (set = c),
    };
    const provider = new SlackProvider({ tokenResolver: async () => 'token' });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => agent,
      getAgent: () => agent,
      getLogger: () => undefined,
      getServer: () => undefined,
    } as unknown as Mastra);
    await provider.initialize();
    return { provider, channels: set };
  }

  it('flag off: adapter entry has no onDataPart and no computer route', async () => {
    const { provider, channels } = await boot();
    const entry = channels.channelConfig.adapters.slack;
    expect(entry && typeof entry === 'object' && 'onDataPart' in entry).toBe(false);
    expect(channels.channelConfig.handlers).toBeUndefined();
    expect(provider.getRoutes().some(r => r.path.startsWith('/slack/computers'))).toBe(false);
  });

  it('flag on: adapter entry gets onDataPart, buttons get a handler, static route serves fixed text', async () => {
    process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
    const { provider, channels } = await boot();
    expect(typeof channels.channelConfig.adapters.slack.onDataPart).toBe('function');
    expect(typeof channels.channelConfig.handlers.onAction).toBe('function');
    const route = provider.getRoutes().find(r => r.path === '/slack/computers/:webhookId')!;
    const handler = await (route as any).createHandler({ mastra: {} });
    const res: Response = await handler({});
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('Open this computer from its Slack card.');
  });
});
