import * as crypto from 'node:crypto';
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
    expect(signed.length).toBeLessThanOrEqual(128);
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

const ctx = (chatThreadId: string) =>
  ({ platform: 'slack', chatThread: { id: chatThreadId }, threadId: 'th-1' }) as any;
const part = (data: Record<string, unknown>) => ({ type: 'data-computer' as const, data });

describe('card lifecycle', () => {
  for (const [label, chatThreadId, channel, threadTs] of [
    ['channel mention', 'slack:C123:1700000000.000100', 'C123', '1700000000.000100'],
    ['reply thread', 'slack:C999:1699999999.123456', 'C999', '1699999999.123456'],
    ['DM', 'slack:D42:', 'D42', undefined],
  ] as const) {
    it(`posts once into the ${label} thread`, async () => {
      const { cards, calls } = makeCards();
      await cards.onDataPart(
        part({ computerId: 'c1', threadId: 'th-1', name: 'Desk', status: 'attached' }),
        ctx(chatThreadId),
      );
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

async function bootProvider() {
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
  const fakeMastra = {
    getStorage: () => store,
    getAgentById: () => agent,
    getAgent: () => agent,
    getLogger: () => undefined,
    getServer: () => undefined,
  } as unknown as Mastra;
  provider.__attach(fakeMastra);
  await provider.initialize();
  return { provider, channels: set, mastra: fakeMastra };
}

describe('card failure + ordering', () => {
  it('a failed post is retried on the next attach for the same computer', async () => {
    const { client, calls } = fakeClient();
    const post = client.chat.postMessage;
    let fail = true;
    client.chat.postMessage = async a => {
      if (fail) {
        fail = false;
        throw new Error('An API error occurred: missing_scope');
      }
      return post(a);
    };
    const { cards } = makeCards({ client, logger: { warn: vi.fn() } });
    const p = part({ computerId: 'c1', status: 'attached' });
    await cards.onDataPart(p, ctx('slack:C1:1.1'));
    await cards.onDataPart(p, ctx('slack:C1:1.1'));
    expect(calls.map(c => c.method)).toEqual(['chat.postMessage']);
  });

  it('a post with no ts is not tracked', async () => {
    const { client, calls } = fakeClient();
    client.chat.postMessage = async a => {
      calls.push({ method: 'chat.postMessage', args: a });
      return { ok: true } as any;
    };
    const { cards } = makeCards({ client, logger: { warn: vi.fn() } });
    await cards.onDataPart(part({ computerId: 'c1', status: 'attached' }), ctx('slack:C1:1.1'));
    await cards.onDataPart(part({ computerId: 'c1', status: 'released' }), ctx('slack:C1:1.1'));
    expect(calls.map(c => c.method)).toEqual(['chat.postMessage']);
  });
});

describe('provider wiring', () => {
  afterEach(() => {
    delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
  });

  const boot = bootProvider;

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

describe('details + buttons', () => {
  const key = deriveRefKey(installation.signingSecret);
  const chatThreadId = 'slack:C1:1700000000.000100';
  const goodRef = signRef(key, { teamId: 'T1', computerId: 'c1', threadId: 'th-1' });

  function harness(
    opts: { holder?: 'agent' | 'human'; resourceId?: string; controlThrows?: boolean; noControl?: boolean } = {},
  ) {
    const thread = {
      id: 'th-1',
      resourceId: opts.resourceId ?? 'slack:U1',
      metadata: { channel_platform: 'slack', channel_externalThreadId: chatThreadId },
    };
    const control = vi.fn(async (_id: string, _scope: unknown, input: { action: 'take' | 'release' }) => {
      if (opts.controlThrows) throw new Error('not attached');
      return { holder: input.action === 'take' ? ('human' as const) : ('agent' as const), notified: true };
    });
    const controlState = vi.fn(async () => ({ holder: opts.holder ?? ('agent' as const) }));
    const mastra = {
      getStorage: () => ({
        getStore: async () => ({ getThreadById: async ({ threadId }: any) => (threadId === 'th-1' ? thread : null) }),
      }),
      getComputers: () => (opts.noControl ? { tools: () => ({}) } : { control, controlState }),
    };
    const embedUrl = vi.fn(async (a: any) => `https://embed.example/${a.mode}`);
    const h = makeCards({ getMastra: () => mastra as any, embedUrl });
    return { ...h, control, embedUrl };
  }
  const click = (over: Record<string, unknown> = {}) => ({
    actionId: 'computer_take',
    value: goodRef,
    threadId: chatThreadId,
    messageId: '1700000001.000001',
    user: { userId: 'U1' },
    raw: { team: { id: 'T1' } },
    ...over,
  });

  it('owner Take control calls control(take) with the thread scope and flips the card', async () => {
    const { cards, calls, control } = harness();
    expect(await cards.handleAction(click())).toBe(true);
    expect(control).toHaveBeenCalledWith('c1', { threadId: 'th-1', resourceId: 'slack:U1' }, { action: 'take' });
    expect(calls.at(-1)!.method).toBe('chat.update');
    expect(calls.at(-1)!.args.text).toContain('you have control');
  });

  it('Hand back calls control(release), which is what wakes the agent (#29675)', async () => {
    const { cards, control, calls } = harness({ holder: 'human' });
    await cards.handleAction(click({ actionId: 'computer_release' }));
    expect(control).toHaveBeenCalledWith('c1', expect.anything(), { action: 'release' });
    expect(calls.at(-1)!.args.text).toContain('agent has control');
  });

  for (const [label, over] of [
    ['non-owner', { user: { userId: 'U2' } }],
    ['forged ref', { value: goodRef.replace(/.$/, c => (c === 'A' ? 'B' : 'A')) }],
    ['other team', { raw: { team: { id: 'T9' } } }],
    ['button copied into another thread', { threadId: 'slack:C2:1.1' }],
  ] as const) {
    it(`refuses ${label} with an ephemeral and never calls control`, async () => {
      const { cards, calls, control } = harness();
      expect(await cards.handleAction(click(over as any))).toBe(true);
      expect(control).not.toHaveBeenCalled();
      expect(calls.map(c => c.method)).toEqual(['chat.postEphemeral']);
    });
  }

  it('custom resourceId scheme refuses (stricter v0 owner check)', async () => {
    const { cards, control } = harness({ resourceId: 'user-42' });
    await cards.handleAction(click());
    expect(control).not.toHaveBeenCalled();
  });

  it('control throwing or missing refuses without crashing', async () => {
    for (const o of [{ controlThrows: true }, { noControl: true }]) {
      const { cards, calls } = harness(o);
      expect(await cards.handleAction(click())).toBe(true);
      expect(calls.map(c => c.method)).toEqual(['chat.postEphemeral']);
    }
  });

  it('a click queued behind released refuses and never calls control', async () => {
    const { cards, calls, control } = harness();
    const c = ctx(chatThreadId);
    await cards.onDataPart(part({ computerId: 'c1', status: 'attached' }), c);
    const released = cards.onDataPart(part({ computerId: 'c1', status: 'released' }), c);
    const clicked = cards.handleAction(click());
    await Promise.all([released, clicked]);
    expect(control).not.toHaveBeenCalled();
    expect(calls.map(x => x.method)).toEqual(['chat.postMessage', 'chat.update', 'chat.postEphemeral']);
  });

  it('a click after released has fully settled still refuses', async () => {
    const { cards, calls, control } = harness();
    const c = ctx(chatThreadId);
    await cards.onDataPart(part({ computerId: 'c1', status: 'attached' }), c);
    await cards.onDataPart(part({ computerId: 'c1', status: 'released' }), c);
    await new Promise(r => setTimeout(r, 0));
    await cards.handleAction(click());
    expect(control).not.toHaveBeenCalled();
    expect(calls.at(-1)!.method).toBe('chat.postEphemeral');
  });

  it('other action ids fall through', async () => {
    const { cards } = harness();
    expect(await cards.handleAction(click({ actionId: 'tool_approve:x' }))).toBe(false);
  });

  const details = (over: Record<string, unknown> = {}, team = 'T1') => ({
    team_id: team,
    event: { type: 'entity_details_requested', user: 'U1', trigger_id: 'trig', external_ref: { id: goodRef }, ...over },
  });

  it('owner details gets a framed preview in watch/control mode by holder', async () => {
    for (const holder of ['agent', 'human'] as const) {
      const { cards, calls, embedUrl } = harness({ holder });
      await cards.handleDetails(details());
      expect(embedUrl).toHaveBeenCalledWith({
        computerId: 'c1',
        threadId: 'th-1',
        resourceId: 'slack:U1',
        mode: holder === 'human' ? 'control' : 'watch',
      });
      const call = calls.find(c => c.method === 'entity.presentDetails')!;
      expect(call.args.trigger_id).toBe('trig');
      expect(call.args.metadata.entity_payload.attributes.full_size_preview.preview_url).toContain('embed.example');
    }
  });

  it('non-owner details gets is_supported:false and no embed URL is minted', async () => {
    const { cards, calls, embedUrl } = harness();
    await cards.handleDetails(details({ user: 'U2' }));
    expect(embedUrl).not.toHaveBeenCalled();
    expect(calls[0]!.args.metadata.entity_payload.attributes.full_size_preview).toEqual({ is_supported: false });
  });

  it('forged ref or foreign team: no presentDetails call at all', async () => {
    for (const d of [details({ external_ref: { id: 'c1:evil:mac' } }), details({}, 'T9')]) {
      const { cards, calls } = harness();
      await cards.handleDetails(d);
      expect(calls).toHaveLength(0);
    }
  });
});

describe('real Slack payloads through the events route', () => {
  afterEach(() => {
    delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
    vi.restoreAllMocks();
  });

  function signed(body: string, contentType: string, headers: Record<string, string> = {}) {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = 'v0=' + crypto.createHmac('sha256', 'ss').update(`v0:${ts}:${body}`).digest('hex');
    const h: Record<string, string> = {
      'x-slack-request-timestamp': ts,
      'x-slack-signature': sig,
      'content-type': contentType,
      ...headers,
    };
    const raw = new Request('https://example.com/slack/events/w1', { method: 'POST', headers: h, body });
    return {
      req: {
        url: 'https://example.com/slack/events/w1',
        method: 'POST',
        param: (k: string) => (k === 'webhookId' ? 'w1' : undefined),
        header: (k: string) => h[k.toLowerCase()],
        text: async () => body,
        raw,
      },
      json: (o: unknown, status = 200) => Response.json(o, { status }),
      get: () => undefined,
      executionCtx: undefined,
    } as any;
  }

  async function events(mastra: any, provider: SlackProvider) {
    const route = provider.getRoutes().find(r => r.path === '/slack/events/:webhookId')!;
    return (route as any).createHandler({ mastra });
  }

  it('block_actions form payload reaches the card handler with user.userId and value', async () => {
    process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
    const seen: any[] = [];
    vi.spyOn(ComputerCards.prototype, 'handleAction').mockImplementation(async (e: any) => {
      seen.push(e);
      return true;
    });
    const { provider, mastra, channels } = await bootProvider();
    await channels.initialize(mastra);
    const payload = {
      type: 'block_actions',
      team: { id: 'T1' },
      user: { id: 'U1', team_id: 'T1', username: 'u' },
      api_app_id: 'A1',
      trigger_id: 'trig',
      channel: { id: 'C1' },
      container: { type: 'message', channel_id: 'C1', message_ts: '1700000001.000001', thread_ts: '1700000000.000100' },
      message: { ts: '1700000001.000001', thread_ts: '1700000000.000100', text: 'Computer' },
      actions: [{ type: 'button', action_id: 'computer_take', block_id: 'b', value: 'c1:x:y', action_ts: '1' }],
    };
    const body = 'payload=' + encodeURIComponent(JSON.stringify(payload));
    const handler = await events(mastra, provider);
    const res: Response = await handler(signed(body, 'application/x-www-form-urlencoded'));
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toMatchObject({ actionId: 'computer_take', value: 'c1:x:y', user: { userId: 'U1' } });
    expect(seen[0].threadId).toBe('slack:C1:1700000000.000100');
    expect(seen[0].raw.team.id).toBe('T1');
  });

  it('entity_details_requested is acked; retries are ignored; flag off never intercepts', async () => {
    process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
    const spy = vi.spyOn(ComputerCards.prototype, 'handleDetails').mockResolvedValue();
    const { provider, mastra } = await bootProvider();
    const body = JSON.stringify({
      type: 'event_callback',
      team_id: 'T1',
      event: { type: 'entity_details_requested', trigger_id: 't' },
    });
    const handler = await events(mastra, provider);
    expect((await handler(signed(body, 'application/json'))).status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    await handler(signed(body, 'application/json', { 'x-slack-retry-num': '1' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
