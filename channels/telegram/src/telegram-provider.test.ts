import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import {
  DEFAULT_ALLOWED_UPDATES,
  DEFAULT_COMMANDS,
  TelegramProvider,
  normalizeCommands,
  resolveTelegramAdapterConfig,
} from './index';

const API_ORIGIN = 'https://api.telegram.org';
const BASE_URL = 'https://bot.example.com';
const BOT_TOKEN = '123456:ABC-DEF';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

/** Fresh provider + its own in-memory storage (returned so tests can inspect it). */
function makeProvider(config: Partial<ConstructorParameters<typeof TelegramProvider>[0]> = {}) {
  const storage = new InMemoryChannelsStorage();
  const provider = new TelegramProvider({ storage, baseUrl: BASE_URL, ...config });
  return { provider, storage };
}

function stubGetMe(token: string, opts: { ok?: boolean; username?: string } = {}) {
  const { ok = true, username = 'my_test_bot' } = opts;
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/bot${token}/getMe`, method: 'GET' })
    .reply(
      ok ? 200 : 401,
      ok
        ? { ok: true, result: { id: 42, is_bot: true, first_name: 'Test', username } }
        : { ok: false, error_code: 401, description: 'Unauthorized' },
    );
}

/** Stub a Bot API method that returns `{ ok: true }`, capturing the JSON body. */
function stubMethod(token: string, method: string): () => Record<string, unknown> | undefined {
  let captured: Record<string, unknown> | undefined;
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/bot${token}/${method}`, method: 'POST' })
    .reply(200, opts => {
      captured = JSON.parse(String(opts.body));
      return { ok: true, result: true };
    });
  return () => captured;
}

/** Stub the full happy-path control plane for an active connect (webhook mode). */
function stubActiveConnect(token: string) {
  stubGetMe(token);
  return {
    setWebhook: stubMethod(token, 'setWebhook'),
    setMyCommands: stubMethod(token, 'setMyCommands'),
  };
}

describe('TelegramProvider — discovery + skeleton', () => {
  it('exposes the telegram channel id', () => {
    expect(makeProvider().provider.id).toBe('telegram');
  });

  it('reports discovery metadata (not configured until a bot is registered)', () => {
    expect(makeProvider().provider.getInfo()).toMatchObject({
      id: 'telegram',
      name: 'Telegram',
      isConfigured: false,
    });
  });

  it('mounts a single POST webhook route', () => {
    const routes = makeProvider().provider.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      path: '/telegram/events/:webhookId',
      method: 'POST',
      requiresAuth: false,
    });
  });
});

describe('TelegramProvider.connect', () => {
  it('without a token returns a BotFather deep link + a pending install', async () => {
    const { provider } = makeProvider();
    const result = await provider.connect('agent-1');

    expect(result).toMatchObject({ type: 'deep_link', url: 'https://t.me/botfather' });
    const installs = await provider.listInstallations();
    expect(installs).toHaveLength(1);
    expect(installs[0]).toMatchObject({ agentId: 'agent-1', platform: 'telegram', status: 'pending' });
    expect(provider.getInfo().isConfigured).toBe(false);
  });

  it('with a token validates via getMe, registers a webhook, and activates', async () => {
    const { provider } = makeProvider();
    stubGetMe(BOT_TOKEN, { username: 'chowderr_bot' });
    const setWebhookBody = stubMethod(BOT_TOKEN, 'setWebhook');
    stubMethod(BOT_TOKEN, 'setMyCommands');

    const result = await provider.connect('agent-1', { botToken: BOT_TOKEN });
    expect(result).toMatchObject({ type: 'immediate' });

    const body = setWebhookBody();
    expect(String(body?.url).startsWith(BASE_URL)).toBe(true);
    expect(String(body?.url)).toContain('/telegram/events/');
    expect(typeof body?.secret_token).toBe('string');
    expect(body?.allowed_updates).toContain('message');

    const installs = await provider.listInstallations();
    expect(installs[0]).toMatchObject({ status: 'active', displayName: 'chowderr_bot' });
    expect(JSON.stringify(installs[0])).not.toContain(BOT_TOKEN);
    expect(installs[0]).not.toHaveProperty('secretToken');
    expect(provider.getInfo().isConfigured).toBe(true);
  });

  it('rejects an invalid bot token (no install persisted)', async () => {
    const { provider } = makeProvider();
    stubGetMe(BOT_TOKEN, { ok: false });

    await expect(provider.connect('agent-1', { botToken: BOT_TOKEN })).rejects.toThrow(/rejected the bot token/i);
    expect(await provider.listInstallations()).toHaveLength(0);
  });

  it('enforces one bot per agent (reconnect requires disconnect)', async () => {
    const { provider } = makeProvider();
    stubActiveConnect(BOT_TOKEN);
    await provider.connect('agent-1', { botToken: BOT_TOKEN });

    await expect(provider.connect('agent-1', { botToken: BOT_TOKEN })).rejects.toThrow(/already connected/i);
  });

  it('upgrades a pending install to active when a token arrives (same id, same webhookId)', async () => {
    const { provider, storage } = makeProvider();
    const pending = await provider.connect('agent-1');
    const pendingWebhookId = (await storage.getInstallationByAgent('telegram', 'agent-1'))?.webhookId;

    stubActiveConnect(BOT_TOKEN);
    const active = await provider.connect('agent-1', { botToken: BOT_TOKEN });

    expect(active.installationId).toBe(pending.installationId);
    const record = await storage.getInstallationByAgent('telegram', 'agent-1');
    expect(record?.status).toBe('active');
    expect(record?.webhookId).toBe(pendingWebhookId);
  });

  it('polling mode clears any webhook and stores no webhookUrl (exclusion)', async () => {
    const { provider, storage } = makeProvider({ mode: 'polling' });
    stubGetMe(BOT_TOKEN);
    const deleteBody = stubMethod(BOT_TOKEN, 'deleteWebhook');
    stubMethod(BOT_TOKEN, 'setMyCommands');

    await provider.connect('agent-1', { botToken: BOT_TOKEN });

    expect(deleteBody()).toMatchObject({ drop_pending_updates: true });
    const record = await storage.getInstallationByAgent('telegram', 'agent-1');
    expect(record?.data.webhookUrl).toBeUndefined();
  });

  it('webhook mode without a baseUrl throws', async () => {
    const provider = new TelegramProvider({ storage: new InMemoryChannelsStorage(), mode: 'webhook' });
    stubGetMe(BOT_TOKEN);
    await expect(provider.connect('agent-1', { botToken: BOT_TOKEN })).rejects.toThrow(/baseUrl/i);
  });
});

describe('TelegramProvider — setMyCommands', () => {
  it('seeds /start /help /settings by default', async () => {
    const { provider } = makeProvider();
    stubGetMe(BOT_TOKEN);
    stubMethod(BOT_TOKEN, 'setWebhook');
    const commandsBody = stubMethod(BOT_TOKEN, 'setMyCommands');

    await provider.connect('agent-1', { botToken: BOT_TOKEN });

    const names = ((commandsBody()?.commands as { command: string }[]) ?? []).map(c => c.command);
    expect(names).toEqual(['start', 'help', 'settings']);
  });

  it('registers a per-agent command list when provided', async () => {
    const { provider } = makeProvider();
    stubGetMe(BOT_TOKEN);
    stubMethod(BOT_TOKEN, 'setWebhook');
    const commandsBody = stubMethod(BOT_TOKEN, 'setMyCommands');

    await provider.connect('agent-1', {
      botToken: BOT_TOKEN,
      commands: ['/ask', { command: 'summarize', description: 'Summarize a link' }],
    });

    expect(commandsBody()?.commands).toEqual([
      { command: 'ask', description: 'Run /ask' },
      { command: 'summarize', description: 'Summarize a link' },
    ]);
  });
});

describe('normalizeCommands', () => {
  it('lowercases, strips the leading slash, and defaults the description', () => {
    expect(normalizeCommands(['/Start'])).toEqual([{ command: 'start', description: 'Run /start' }]);
  });

  it('drops invalid characters and clamps command length to 32', () => {
    const [cmd] = normalizeCommands([{ command: 'My-Cmd!', description: 'x' }]);
    expect(cmd.command).toBe('mycmd');
    const [long] = normalizeCommands(['a'.repeat(40)]);
    expect(long.command).toHaveLength(32);
  });

  it('drops empties and duplicates', () => {
    expect(normalizeCommands(['/', 'help', 'help'])).toEqual([{ command: 'help', description: 'Run /help' }]);
  });

  it('clamps descriptions to 256 chars', () => {
    const [cmd] = normalizeCommands([{ command: 'x', description: 'd'.repeat(300) }]);
    expect(cmd.description).toHaveLength(256);
  });

  it('normalizes the default seed', () => {
    expect(normalizeCommands(DEFAULT_COMMANDS).map(c => c.command)).toEqual(['start', 'help', 'settings']);
  });
});

describe('DEFAULT_ALLOWED_UPDATES', () => {
  it('requests edited_channel_post alongside channel_post (the adapter routes both)', () => {
    expect(DEFAULT_ALLOWED_UPDATES).toContain('channel_post');
    // Regression guard: the adapter's processUpdate falls through to
    // update.edited_channel_post, so omitting it silently drops edited channel posts.
    expect(DEFAULT_ALLOWED_UPDATES).toContain('edited_channel_post');
  });

  it('requests message_reaction explicitly (Telegram excludes it by default)', () => {
    expect(DEFAULT_ALLOWED_UPDATES).toContain('message_reaction');
  });
});

describe('resolveTelegramAdapterConfig (stream binding)', () => {
  it('enables streaming + typing by default', () => {
    expect(resolveTelegramAdapterConfig({})).toEqual({ streaming: true, typingStatus: true });
  });

  it('respects explicit overrides', () => {
    expect(resolveTelegramAdapterConfig({ streaming: false })).toEqual({ streaming: false, typingStatus: true });
    expect(resolveTelegramAdapterConfig({ typingStatus: false })).toMatchObject({ typingStatus: false });
    expect(resolveTelegramAdapterConfig({ streaming: { updateIntervalMs: 800 } })).toMatchObject({
      streaming: { updateIntervalMs: 800 },
    });
  });
});

describe('TelegramProvider.disconnect', () => {
  it('removes the webhook and the installation', async () => {
    const { provider } = makeProvider();
    stubActiveConnect(BOT_TOKEN);
    await provider.connect('agent-1', { botToken: BOT_TOKEN });

    const deleteBody = stubMethod(BOT_TOKEN, 'deleteWebhook');
    await provider.disconnect('agent-1');

    expect(deleteBody()).toBeDefined();
    expect(await provider.listInstallations()).toHaveLength(0);
    expect(provider.getInfo().isConfigured).toBe(false);
  });

  it('throws when no installation exists', async () => {
    await expect(makeProvider().provider.disconnect('ghost')).rejects.toThrow(/no telegram installation/i);
  });
});

describe('TelegramProvider webhook route — secret verification', () => {
  const stubMastra = {
    getAgentById: () => undefined,
    getStorage: () => undefined,
    getServer: () => undefined,
  };

  function makeCtx(webhookId: string | undefined, secret: string | undefined) {
    return {
      req: {
        param: (k: string) => (k === 'webhookId' ? webhookId : undefined),
        header: (k: string) => (k.toLowerCase() === 'x-telegram-bot-api-secret-token' ? secret : undefined),
        raw: new Request(`${BASE_URL}/telegram/events/${webhookId}`, { method: 'POST', body: '{}' }),
      },
      json: (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    };
  }

  async function connectedHandler() {
    const { provider, storage } = makeProvider();
    stubActiveConnect(BOT_TOKEN);
    await provider.connect('agent-1', { botToken: BOT_TOKEN });
    const record = await storage.getInstallationByAgent('telegram', 'agent-1');

    const route = provider.getRoutes()[0];
    if (!('createHandler' in route)) throw new Error('expected a createHandler route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = await route.createHandler({ mastra: stubMastra as any });
    return { handler, webhookId: record!.webhookId!, secret: String(record!.data.secretToken) };
  }

  it('404s an unknown webhookId', async () => {
    const { handler } = await connectedHandler();
    expect((await handler(makeCtx('does-not-exist', 'whatever'))).status).toBe(404);
  });

  it('401s a missing or wrong secret token', async () => {
    const { handler, webhookId } = await connectedHandler();
    expect((await handler(makeCtx(webhookId, undefined))).status).toBe(401);
    expect((await handler(makeCtx(webhookId, 'wrong-secret'))).status).toBe(401);
  });

  it('accepts a matching secret (past verification; 200 when no agent is wired)', async () => {
    const { handler, webhookId, secret } = await connectedHandler();
    expect((await handler(makeCtx(webhookId, secret))).status).toBe(200);
  });
});

describe('TelegramProvider webhook route — happy path (update → agent → reply)', () => {
  /** Hono-ish context carrying a real Telegram update as the raw request body. */
  function makeUpdateCtx(webhookId: string, secret: string, update: unknown) {
    return {
      req: {
        param: (k: string) => (k === 'webhookId' ? webhookId : undefined),
        header: (k: string) => (k.toLowerCase() === 'x-telegram-bot-api-secret-token' ? secret : undefined),
        raw: new Request(`${BASE_URL}/telegram/events/${webhookId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
          body: JSON.stringify(update),
        }),
      },
      json: (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
    };
  }

  /** Persistently stub an outbound Bot API send method, capturing every JSON body. */
  function stubSend(token: string, method: string): Record<string, unknown>[] {
    const calls: Record<string, unknown>[] = [];
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${token}/${method}`, method: 'POST' })
      .reply(200, opts => {
        const body = JSON.parse(String(opts.body)) as Record<string, unknown>;
        calls.push(body);
        return {
          ok: true,
          result: { message_id: 555, date: 0, chat: { id: body.chat_id ?? 0, type: 'private' }, text: body.text ?? '' },
        };
      })
      .persist();
    return calls;
  }

  it('routes a message update through handleWebhookEvent to the agent and sends the reply', async () => {
    const modelCalls: unknown[] = [];
    const agent = new Agent({
      id: 'agent-1',
      name: 'agent-1',
      instructions: 'Reply concisely.',
      model: createMockModel({
        mockText: 'Hello from the mock agent',
        spyGenerate: p => modelCalls.push(p),
        spyStream: p => modelCalls.push(p),
      }),
    });

    const storage = new InMemoryChannelsStorage();
    const pending: Promise<unknown>[] = [];
    const provider = new TelegramProvider({
      storage,
      baseUrl: BASE_URL,
      // Buffer instead of stream so the reply lands in a single deterministic sendMessage.
      streaming: false,
      waitUntil: (p: Promise<unknown>) => {
        pending.push(Promise.resolve(p));
      },
    });
    const mastra = new Mastra({ agents: { 'agent-1': agent }, channels: { telegram: provider } });

    // Control-plane (connect) + reply-path (typing + send) Bot API stubs.
    stubActiveConnect(BOT_TOKEN);
    stubSend(BOT_TOKEN, 'sendChatAction');
    const sends = stubSend(BOT_TOKEN, 'sendMessage');

    await provider.connect('agent-1', { botToken: BOT_TOKEN });
    const record = await storage.getInstallationByAgent('telegram', 'agent-1');
    const webhookId = record!.webhookId!;
    const secret = String(record!.data.secretToken);

    const route = provider.getRoutes()[0];
    if (!('createHandler' in route)) throw new Error('expected a createHandler route');
    const handler = await route.createHandler({ mastra });

    const update = {
      update_id: 1,
      message: {
        message_id: 10,
        date: 0,
        chat: { id: 4242, type: 'private' },
        from: { id: 4242, is_bot: false, first_name: 'Tester' },
        text: 'hello bot',
      },
    };

    const res = await handler(makeUpdateCtx(webhookId, secret, update));
    expect(res.status).toBe(200);

    // Drain the background agent run + reply send scheduled via waitUntil.
    await Promise.all(pending);

    // The agent's model was actually invoked…
    expect(modelCalls.length).toBeGreaterThan(0);
    // …and a reply was posted back to the sender's chat with the agent's text.
    expect(sends.length).toBeGreaterThan(0);
    const replied = sends.some(b => String(b.chat_id) === '4242' && String(b.text).includes('from the mock agent'));
    expect(replied).toBe(true);
  });
});

describe('TelegramProvider — ChannelConfig passthrough (parity with @mastra/slack)', () => {
  function wiredAgent(id: string) {
    return new Agent({ id, name: id, instructions: 'x', model: createMockModel({ mockText: 'x' }) });
  }

  it('forwards the curated ChannelConfig subset + adapter overrides to AgentChannels', async () => {
    const agent = wiredAgent('cfg-agent');
    const storage = new InMemoryChannelsStorage();
    const handlers = { onDirectMessage: async () => {} };
    const inlineMedia = ['image/png', 'image/jpeg'];
    const threadContext = { maxMessages: 5 };
    const chatOptions = { dedupeTtlMs: 1000 };
    const cors = { origin: 'https://example.com' };
    const formatError = (e: Error) => `oops: ${e.message}`;

    const provider = new TelegramProvider({
      storage,
      baseUrl: BASE_URL,
      handlers,
      inlineMedia,
      threadContext,
      chatOptions,
      cors,
      formatError,
    });
    // Registering on Mastra attaches the provider so connect() can resolve the agent.
    const mastra = new Mastra({ agents: { 'cfg-agent': agent }, channels: { telegram: provider } });
    expect(mastra).toBeDefined();

    stubActiveConnect(BOT_TOKEN);
    await provider.connect('cfg-agent', { botToken: BOT_TOKEN });

    const cc = agent.getChannels()!.channelConfig;
    // Channel-level options
    expect(cc.handlers).toBe(handlers);
    expect(cc.inlineMedia).toEqual(inlineMedia);
    expect(cc.threadContext).toEqual(threadContext);
    expect(cc.chatOptions).toEqual(chatOptions);
    // Adapter-entry-level options (plus the default stream binding, untouched)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = cc.adapters.telegram as any;
    expect(entry.cors).toEqual(cors);
    expect(entry.formatError).toBe(formatError);
    expect(entry.streaming).toBe(true);
    expect(entry.typingStatus).toBe(true);
  });

  it('does not forward options that were never set (stays undefined, not clobbered)', async () => {
    const agent = wiredAgent('bare-agent');
    const storage = new InMemoryChannelsStorage();
    const provider = new TelegramProvider({ storage, baseUrl: BASE_URL });
    const mastra = new Mastra({ agents: { 'bare-agent': agent }, channels: { telegram: provider } });
    expect(mastra).toBeDefined();

    stubActiveConnect(BOT_TOKEN);
    await provider.connect('bare-agent', { botToken: BOT_TOKEN });

    const cc = agent.getChannels()!.channelConfig;
    expect(cc.handlers).toBeUndefined();
    expect(cc.inlineMedia).toBeUndefined();
    expect(cc.state).toBeUndefined();
  });

  it('calls onInstall with the persisted installation after connect', async () => {
    const agent = wiredAgent('install-agent');
    const storage = new InMemoryChannelsStorage();
    const seen: { agentId?: string; status?: string; hasToken?: boolean } = {};
    const provider = new TelegramProvider({
      storage,
      baseUrl: BASE_URL,
      onInstall: inst => {
        seen.agentId = inst.agentId;
        seen.status = inst.status;
        seen.hasToken = Boolean(inst.botToken);
      },
    });
    const mastra = new Mastra({ agents: { 'install-agent': agent }, channels: { telegram: provider } });
    expect(mastra).toBeDefined();

    stubActiveConnect(BOT_TOKEN);
    await provider.connect('install-agent', { botToken: BOT_TOKEN });

    expect(seen.agentId).toBe('install-agent');
    expect(seen.status).toBe('active');
    expect(seen.hasToken).toBe(true);
  });

  /** Connect an agent with a given provider config and return its resolved channelConfig. */
  async function channelConfigFor(config: Partial<ConstructorParameters<typeof TelegramProvider>[0]>, agentId: string) {
    const agent = wiredAgent(agentId);
    const storage = new InMemoryChannelsStorage();
    const provider = new TelegramProvider({ storage, baseUrl: BASE_URL, ...config });
    const mastra = new Mastra({ agents: { [agentId]: agent }, channels: { telegram: provider } });
    expect(mastra).toBeDefined();
    stubActiveConnect(BOT_TOKEN);
    await provider.connect(agentId, { botToken: BOT_TOKEN });
    return agent.getChannels()!.channelConfig;
  }

  it("defaults toolDisplay to 'text' (no Block Kit on Telegram) and honors an override", async () => {
    const def = await channelConfigFor({}, 'td-default');
    expect((def.adapters.telegram as { toolDisplay?: string }).toolDisplay).toBe('text');
    const overridden = await channelConfigFor({ toolDisplay: 'hidden' }, 'td-override');
    expect((overridden.adapters.telegram as { toolDisplay?: string }).toolDisplay).toBe('hidden');
  });

  it('forwards the tools flag (reaction tools add_reaction/remove_reaction)', async () => {
    const on = await channelConfigFor({ tools: true }, 'tools-on');
    expect(on.tools).toBe(true);
    const off = await channelConfigFor({ tools: false }, 'tools-off');
    expect(off.tools).toBe(false);
  });
});

describe('TelegramProvider — public method parity (getInstallation / isConfigured / getAdapter)', () => {
  it('reflects state before and after connect', async () => {
    const agent = new Agent({
      id: 'm-agent',
      name: 'm-agent',
      instructions: 'x',
      model: createMockModel({ mockText: 'x' }),
    });
    const storage = new InMemoryChannelsStorage();
    const provider = new TelegramProvider({ storage, baseUrl: BASE_URL });
    const mastra = new Mastra({ agents: { 'm-agent': agent }, channels: { telegram: provider } });
    expect(mastra).toBeDefined();

    // Before connect: not configured, no installation.
    expect(provider.isConfigured()).toBe(false);
    expect(await provider.getInstallation('m-agent')).toBeNull();

    stubActiveConnect(BOT_TOKEN);
    await provider.connect('m-agent', { botToken: BOT_TOKEN });

    // After connect: configured, full installation (with token), live adapter.
    expect(provider.isConfigured()).toBe(true);
    const inst = await provider.getInstallation('m-agent');
    expect(inst).not.toBeNull();
    expect(inst!.agentId).toBe('m-agent');
    expect(inst!.botToken).toBe(BOT_TOKEN);
    expect(provider.getAdapter(inst!.id)).toBeDefined();
    expect(provider.getAdapter('no-such-id')).toBeUndefined();
  });
});

describe('TelegramProvider — polling mode (getUpdates loop)', () => {
  function persist(method: 'GET' | 'POST', path: string, body: () => Record<string, unknown>) {
    mockAgent.get(API_ORIGIN).intercept({ path, method }).reply(200, body).persist();
  }

  it('starts the getUpdates poll loop in polling mode and stops it on disconnect', async () => {
    const storage = new InMemoryChannelsStorage();
    const provider = new TelegramProvider({ storage, baseUrl: BASE_URL, mode: 'polling' });
    const agent = new Agent({
      id: 'poll-agent',
      name: 'poll-agent',
      instructions: 'x',
      model: createMockModel({ mockText: 'x' }),
    });
    const mastra = new Mastra({ agents: { 'poll-agent': agent }, channels: { telegram: provider } });
    expect(mastra).toBeDefined();

    // getMe is called by connect() and again by the adapter's initialize().
    persist('GET', `/bot${BOT_TOKEN}/getMe`, () => ({
      ok: true,
      result: { id: 42, is_bot: true, first_name: 'T', username: 'poll_bot' },
    }));
    persist('POST', `/bot${BOT_TOKEN}/deleteWebhook`, () => ({ ok: true, result: true }));
    persist('POST', `/bot${BOT_TOKEN}/setMyCommands`, () => ({ ok: true, result: true }));

    let getUpdatesCalls = 0;
    let firstPoll: () => void = () => {};
    const polled = new Promise<void>(resolve => {
      firstPoll = resolve;
    });
    persist('POST', `/bot${BOT_TOKEN}/getUpdates`, () => {
      getUpdatesCalls++;
      firstPoll();
      return { ok: true, result: [] };
    });

    await provider.connect('poll-agent', { botToken: BOT_TOKEN });

    // The adapter's initialize() auto-starts polling → getUpdates fires.
    await Promise.race([
      polled,
      new Promise((_, reject) => setTimeout(() => reject(new Error('getUpdates was never called')), 4000)),
    ]);
    expect(getUpdatesCalls).toBeGreaterThan(0);

    // disconnect() must stop the loop (stopPolling), or it keeps hitting getUpdates.
    await provider.disconnect('poll-agent');
    const afterStop = getUpdatesCalls;
    await new Promise(r => setTimeout(r, 50));
    expect(getUpdatesCalls).toBe(afterStop);
  });
});
