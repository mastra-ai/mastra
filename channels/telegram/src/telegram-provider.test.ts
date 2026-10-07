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
import { PLATFORM } from './install-store';

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

/**
 * Read the request body handed to an undici mock reply callback as UTF-8 text.
 *
 * undici 8 no longer surfaces a `fetch` string body verbatim to mock replies: an
 * iterable/async-iterable body (what `fetch` uses internally) arrives as a
 * stream/chunk array, so `String(opts.body)` yields "[object Object]" and parsing
 * throws. Reply callbacks that need the body must therefore be async and read it.
 */
async function readMockBody(body: unknown): Promise<string> {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');

  const chunks: Uint8Array[] = [];
  const collect = (chunk: unknown) => {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk as Uint8Array));
  };

  if (Array.isArray(body)) {
    for (const chunk of body) collect(chunk);
  } else if (typeof body === 'object' && Symbol.asyncIterator in body) {
    for await (const chunk of body as AsyncIterable<unknown>) collect(chunk);
  } else {
    return String(body);
  }
  // Join the raw bytes before decoding: a multibyte character split across two
  // chunks would otherwise decode into two replacement characters.
  return Buffer.concat(chunks).toString('utf8');
}

function stubGetMe(token: string, opts: { ok?: boolean; username?: string } = {}) {
  const { ok = true, username = 'my_test_bot' } = opts;
  const status = ok ? 200 : 401;
  const body = ok
    ? { ok: true, result: { id: 42, is_bot: true, first_name: 'Test', username } }
    : { ok: false, error_code: 401, description: 'Unauthorized' };
  // Persist GET (Mastra control-plane) and POST (chat-sdk 4.40+ telegramFetch).
  for (const method of ['GET', 'POST'] as const) {
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${token}/getMe`, method })
      .reply(status, body)
      .persist();
  }
}

/** Stub a Bot API method that returns `{ ok: true }`, capturing the JSON body. */
function stubMethod(token: string, method: string): () => Record<string, unknown> | undefined {
  let captured: Record<string, unknown> | undefined;
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/bot${token}/${method}`, method: 'POST' })
    .reply(200, async opts => {
      captured = JSON.parse(await readMockBody(opts.body));
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

  it('is configured with a default botToken (self-managed credential source)', () => {
    expect(makeProvider({ botToken: BOT_TOKEN }).provider.getInfo().isConfigured).toBe(true);
  });

  it('is configured with a tokenResolver (delegated mode, e.g. @mastra/connect)', () => {
    const { provider } = makeProvider({ tokenResolver: async () => BOT_TOKEN });
    expect(provider.getInfo().isConfigured).toBe(true);
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

  it.each(['default', 'explicit'] as const)(
    'rejects reuse of an active %s bot token before changing its webhook',
    async source => {
      const { provider, storage } = makeProvider({ botToken: BOT_TOKEN });
      const first = stubActiveConnect(BOT_TOKEN);
      await provider.connect('agent-1');
      const original = await provider.getInstallation('agent-1');

      // A fresh provider must also detect the persisted installation.
      const restored = new TelegramProvider({ storage, baseUrl: BASE_URL, botToken: BOT_TOKEN });
      const second = stubActiveConnect(BOT_TOKEN);
      await expect(restored.connect('agent-2', source === 'explicit' ? { botToken: BOT_TOKEN } : {})).rejects.toThrow(
        /already connected to agent "agent-1"/i,
      );
      expect(first.setWebhook()?.url).toBe(original?.webhookUrl);
      expect(second.setWebhook()).toBeUndefined();
      expect(second.setMyCommands()).toBeUndefined();
      expect(await provider.getInstallation('agent-1')).toEqual(original);
      expect(await restored.getInstallation('agent-2')).toBeNull();
    },
  );

  it('rejects concurrent webhook connections using the same default bot token', async () => {
    const { provider } = makeProvider({ botToken: BOT_TOKEN });
    stubActiveConnect(BOT_TOKEN);
    const second = stubActiveConnect(BOT_TOKEN);

    const results = await Promise.allSettled([provider.connect('agent-1'), provider.connect('agent-2')]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(second.setWebhook()).toBeUndefined();
    expect(second.setMyCommands()).toBeUndefined();
    expect(await provider.listInstallations()).toHaveLength(1);
  });

  it('allows a default bot token to be reused after disconnect', async () => {
    const { provider } = makeProvider({ botToken: BOT_TOKEN });
    stubActiveConnect(BOT_TOKEN);
    await provider.connect('agent-1');
    stubMethod(BOT_TOKEN, 'deleteWebhook');
    await provider.disconnect('agent-1');

    stubActiveConnect(BOT_TOKEN);
    await expect(provider.connect('agent-2')).resolves.toMatchObject({ type: 'immediate' });
    expect(await provider.listInstallations()).toMatchObject([{ agentId: 'agent-2', status: 'active' }]);
  });

  it('releases a bot token after webhook registration fails so it can be retried', async () => {
    const { provider } = makeProvider({ botToken: BOT_TOKEN });
    stubGetMe(BOT_TOKEN);
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${BOT_TOKEN}/setWebhook`, method: 'POST' })
      .reply(500, {
        ok: false,
        description: 'Registration failed',
      });
    await expect(provider.connect('agent-1')).rejects.toThrow();

    stubActiveConnect(BOT_TOKEN);
    await expect(provider.connect('agent-1')).resolves.toMatchObject({ type: 'immediate' });
  });

  it('lets a second agent override the default with a distinct bot token', async () => {
    const { provider } = makeProvider({ botToken: BOT_TOKEN });
    const otherToken = '654321:OTHER';
    stubActiveConnect(BOT_TOKEN);
    stubActiveConnect(otherToken);

    await Promise.all([provider.connect('agent-1'), provider.connect('agent-2', { botToken: otherToken })]);
    expect(await provider.listInstallations()).toHaveLength(2);
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

  it('polling mode rejects connecting a second agent to the same bot token', async () => {
    const { provider } = makeProvider({ mode: 'polling' });
    stubGetMe(BOT_TOKEN);
    stubMethod(BOT_TOKEN, 'deleteWebhook');
    stubMethod(BOT_TOKEN, 'setMyCommands');
    await provider.connect('agent-1', { botToken: BOT_TOKEN });

    await expect(provider.connect('agent-2', { botToken: BOT_TOKEN })).rejects.toThrow(
      /already connected to agent "agent-1"/i,
    );
    expect(await provider.getInstallation('agent-2')).toBeNull();
  });

  it('webhook mode without a baseUrl throws', async () => {
    const provider = new TelegramProvider({ storage: new InMemoryChannelsStorage(), mode: 'webhook' });
    stubGetMe(BOT_TOKEN);
    await expect(provider.connect('agent-1', { botToken: BOT_TOKEN })).rejects.toThrow(/baseUrl/i);
  });

  it('registers the webhook against MASTRA_SERVER_URL when no baseUrl or server override is set', async () => {
    process.env.MASTRA_SERVER_URL = 'https://my-app.server.example.com/';
    try {
      const provider = new TelegramProvider({ storage: new InMemoryChannelsStorage(), mode: 'webhook' });
      stubGetMe(BOT_TOKEN);
      const webhookBody = stubMethod(BOT_TOKEN, 'setWebhook');
      stubMethod(BOT_TOKEN, 'setMyCommands');

      await provider.connect('agent-1', { botToken: BOT_TOKEN });

      expect(String(webhookBody()?.url)).toMatch(/^https:\/\/my-app\.server\.example\.com\/telegram\/events\//);
    } finally {
      delete process.env.MASTRA_SERVER_URL;
    }
  });

  it('explicit server.studio* config beats MASTRA_SERVER_URL', async () => {
    process.env.MASTRA_SERVER_URL = 'https://env-var.example.com';
    try {
      const provider = new TelegramProvider({ storage: new InMemoryChannelsStorage(), mode: 'webhook' });
      new Mastra({
        server: { studioProtocol: 'https', studioHost: 'config-override.example.com', studioPort: 443 },
        channels: { telegram: provider },
      });
      stubGetMe(BOT_TOKEN);
      const webhookBody = stubMethod(BOT_TOKEN, 'setWebhook');
      stubMethod(BOT_TOKEN, 'setMyCommands');

      await provider.connect('agent-1', { botToken: BOT_TOKEN });

      expect(String(webhookBody()?.url)).toMatch(/^https:\/\/config-override\.example\.com\/telegram\/events\//);
    } finally {
      delete process.env.MASTRA_SERVER_URL;
    }
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

  it('falls back to the provider-config botToken when connect() supplies none', async () => {
    // Regression: mirrors SlackProvider / DiscordProvider — the bot token can
    // live on `new TelegramProvider({ botToken })` (e.g. filled in by
    // `channels()` from a Mastra Connect credential) so per-agent connect()
    // sites don't need to repeat it.
    const { provider } = makeProvider({ botToken: BOT_TOKEN });
    stubGetMe(BOT_TOKEN);
    stubMethod(BOT_TOKEN, 'setWebhook');
    stubMethod(BOT_TOKEN, 'setMyCommands');

    const result = await provider.connect('agent-1');

    expect(result).toMatchObject({ type: 'immediate' });
    const installations = await provider.listInstallations();
    expect(installations).toHaveLength(1);
    expect(installations[0]).toMatchObject({ agentId: 'agent-1', status: 'active' });
  });

  it('lets a per-call botToken override the provider-config default', async () => {
    // The per-agent token wins so an operator can point one Mastra process at
    // multiple bots when they want to; the config default is just a fallback.
    const OTHER_TOKEN = '888:XYZ-token-override';
    const { provider, storage } = makeProvider({ botToken: BOT_TOKEN });
    stubGetMe(OTHER_TOKEN);
    stubMethod(OTHER_TOKEN, 'setWebhook');
    stubMethod(OTHER_TOKEN, 'setMyCommands');

    const result = await provider.connect('agent-1', { botToken: OTHER_TOKEN });

    expect(result).toMatchObject({ type: 'immediate' });
    const records = await storage.listInstallations(PLATFORM);
    expect(records[0]!.data.botToken).toBe(OTHER_TOKEN);
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
      .reply(200, async opts => {
        const body = JSON.parse(await readMockBody(opts.body)) as Record<string, unknown>;
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
      // Buffer instead of stream so the reply lands in a single deterministic sendRichMessage.
      streaming: false,
      waitUntil: (p: Promise<unknown>) => {
        pending.push(Promise.resolve(p));
      },
    });
    const mastra = new Mastra({ agents: { 'agent-1': agent }, channels: { telegram: provider } });

    // Control-plane (connect) + reply-path (typing + send) Bot API stubs.
    stubActiveConnect(BOT_TOKEN);
    stubSend(BOT_TOKEN, 'sendChatAction');
    const sends = stubSend(BOT_TOKEN, 'sendRichMessage');

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
    expect(sends).toHaveLength(1);
    expect(String(sends[0].chat_id)).toBe('4242');
    expect(sends[0].rich_message).toEqual({ markdown: 'Hello from the mock agent' });
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

describe('TelegramProvider — delegated credentials (tokenResolver)', () => {
  it('connects with the resolver-supplied token and never persists it', async () => {
    const { provider } = makeProvider({ tokenResolver: async () => BOT_TOKEN });
    const { setWebhook } = stubActiveConnect(BOT_TOKEN);

    const result = await provider.connect('agent-1');
    expect(result).toMatchObject({ type: 'immediate' });
    // The Bot API was driven with the resolved token (the stubs are token-scoped).
    expect(setWebhook()).toMatchObject({ url: expect.stringContaining(`${BASE_URL}/telegram/events/`) });

    // The token is externally managed — never written to the install store.
    const installation = await provider.getInstallation('agent-1');
    expect(installation).not.toBeNull();
    expect(installation!.botToken).toBeUndefined();
    expect(installation!.botUserId).toBe(42);
    expect(provider.isConfigured()).toBe(true);
  });

  it('rejects a per-connect botToken in delegated mode', async () => {
    const { provider } = makeProvider({ tokenResolver: async () => BOT_TOKEN });
    await expect(provider.connect('agent-1', { botToken: '999:other' })).rejects.toThrow(/managed externally/i);
  });

  it('rejects configure({ botToken }) but still allows non-credential settings', async () => {
    const { provider } = makeProvider({ tokenResolver: async () => BOT_TOKEN });
    await expect(provider.configure?.({ botToken: '999:other' })).rejects.toThrow(/managed externally/i);
    // Non-credential settings stay configurable in delegated mode.
    await expect(provider.configure?.({ baseUrl: 'https://elsewhere.example.com' })).resolves.toBeUndefined();
  });

  it('blocks a second agent from connecting the same delegated bot (by bot user id)', async () => {
    const { provider } = makeProvider({ tokenResolver: async () => BOT_TOKEN });
    stubActiveConnect(BOT_TOKEN);
    await provider.connect('agent-1');
    await expect(provider.connect('agent-2')).rejects.toThrow(/already connected to agent "agent-1"/i);
  });

  it('re-resolves the current token for disconnect (picks up upstream swaps)', async () => {
    let currentToken = BOT_TOKEN;
    const { provider } = makeProvider({ tokenResolver: async () => currentToken });
    stubActiveConnect(BOT_TOKEN);
    await provider.connect('agent-1');

    // The platform credential is swapped after connect; disconnect must use
    // the *current* token, not a stale stored one (there is none). This is a
    // rotation for the *same* bot (getMe still returns id 42), so the
    // disconnect-time identity check passes and the webhook is deleted.
    const rotated = '777888:ROTATED';
    currentToken = rotated;
    stubGetMe(rotated);
    const deleteBody = stubMethod(rotated, 'deleteWebhook');

    await provider.disconnect('agent-1');
    expect(deleteBody()).toMatchObject({ drop_pending_updates: true });
    expect(await provider.getInstallation('agent-1')).toBeNull();
  });

  it('surfaces resolver failures from connect()', async () => {
    const { provider } = makeProvider({
      tokenResolver: async () => {
        throw new Error('platform credential unavailable');
      },
    });
    await expect(provider.connect('agent-1')).rejects.toThrow(/platform credential unavailable/);
  });

  it('rejects combining botToken with a tokenResolver at compile time', () => {
    const resolver = async () => BOT_TOKEN;
    // @ts-expect-error — botToken and tokenResolver are mutually exclusive
    const invalid: import('./types').TelegramProviderConfig = { botToken: BOT_TOKEN, tokenResolver: resolver };
    expect(invalid).toBeDefined();
  });

  it('rejects a constructor config that carries both botToken and tokenResolver', () => {
    // Simulates a caller crossing the compile-time union boundary (e.g. via
    // @mastra/connect passing Record<string, unknown>): a static token AND a
    // resolver must never coexist at runtime.
    expect(
      () =>
        new TelegramProvider({
          botToken: BOT_TOKEN,
          tokenResolver: async () => BOT_TOKEN,
        } as unknown as ConstructorParameters<typeof TelegramProvider>[0]),
    ).toThrow(/both `botToken` and `tokenResolver`/);
  });

  it('throws when the resolver returns an empty token instead of falling through to a deep link', async () => {
    const { provider } = makeProvider({ tokenResolver: async () => '' });
    await expect(provider.connect('agent-1')).rejects.toThrow(/empty bot token/);
    // No pending install should have been persisted for a delegated-mode credential error.
    expect(await provider.listInstallations()).toHaveLength(0);
  });

  it('skips deleteWebhook on disconnect when the resolver now points at a different bot', async () => {
    let currentToken = BOT_TOKEN;
    const { provider } = makeProvider({ tokenResolver: async () => currentToken });
    stubActiveConnect(BOT_TOKEN);
    await provider.connect('agent-1'); // installation is bot id 42

    // Upstream credential swapped to a bot with a different user id.
    const otherToken = '999:OTHER';
    currentToken = otherToken;
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${otherToken}/getMe`, method: 'GET' })
      .reply(200, { ok: true, result: { id: 43, is_bot: true, first_name: 'Other', username: 'other_bot' } })
      .persist();
    // Fail loudly if disconnect tries to hit the *other* bot's webhook.
    let otherDeleteHit = false;
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${otherToken}/deleteWebhook`, method: 'POST' })
      .reply(200, () => {
        otherDeleteHit = true;
        return { ok: true, result: true };
      })
      .persist();

    await provider.disconnect('agent-1');
    expect(otherDeleteHit).toBe(false);
    expect(await provider.getInstallation('agent-1')).toBeNull();
  });

  it('migrates a legacy self-managed installation to delegated mode on restore', async () => {
    // Seed a record from before tokenResolver mode: has a stored botToken and
    // — pre-r2 records may not — has a botUserId. Restart under a resolver.
    const { provider: seed, storage } = makeProvider({ botToken: BOT_TOKEN });
    stubActiveConnect(BOT_TOKEN);
    await seed.connect('agent-1', { botToken: BOT_TOKEN });

    const restored = new TelegramProvider({ storage, baseUrl: BASE_URL, tokenResolver: async () => BOT_TOKEN });
    // getMe called by initialize() identity check, then by the adapter itself.
    stubGetMe(BOT_TOKEN);
    await restored.initialize();

    const migrated = await restored.getInstallation('agent-1');
    expect(migrated).not.toBeNull();
    expect(migrated!.botToken).toBeUndefined();
    expect(migrated!.botUserId).toBe(42);
  });

  it('skips activation when the delegated credential now points at a different bot', async () => {
    const { provider: seed, storage } = makeProvider({ tokenResolver: async () => BOT_TOKEN });
    stubActiveConnect(BOT_TOKEN);
    await seed.connect('agent-1');

    // Restart under a resolver that returns a *different* bot's token.
    const otherToken = '999:OTHER';
    const restored = new TelegramProvider({ storage, baseUrl: BASE_URL, tokenResolver: async () => otherToken });
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${otherToken}/getMe`, method: 'GET' })
      .reply(200, { ok: true, result: { id: 43, is_bot: true, first_name: 'Other', username: 'other_bot' } })
      .persist();
    await restored.initialize();

    // The installation record is left as-is so the operator can reconnect;
    // the adapter is not activated (nothing was bound to the new bot).
    const stillThere = await restored.getInstallation('agent-1');
    expect(stillThere).not.toBeNull();
    expect(stillThere!.botUserId).toBe(42);
    expect(restored.getAdapter(stillThere!.id)).toBeUndefined();
  });

  it('refuses migration of a legacy record without botUserId when the resolver points at a different bot', async () => {
    // Seed a pre-r2 legacy record: has botToken but no botUserId (old schema).
    const storage = new InMemoryChannelsStorage();
    const legacyToken = BOT_TOKEN;
    await storage.saveInstallation({
      id: 'legacy-install-id',
      platform: 'telegram',
      agentId: 'agent-1',
      status: 'active',
      webhookId: 'legacy-webhook',
      data: {
        botToken: legacyToken,
        // no botUserId — this is the vulnerable shape
        secretToken: 'legacy-secret',
        username: 'legacy_bot',
        webhookUrl: `${BASE_URL}/telegram/events/legacy-webhook`,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Legacy token still resolves to bot 42 (the original bot).
    stubGetMe(legacyToken);
    // Resolver now points at a *different* bot's token.
    const otherToken = '999:OTHER';
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${otherToken}/getMe`, method: 'GET' })
      .reply(200, { ok: true, result: { id: 43, is_bot: true, first_name: 'Other', username: 'other_bot' } })
      .persist();

    const restored = new TelegramProvider({ storage, baseUrl: BASE_URL, tokenResolver: async () => otherToken });
    await restored.initialize();

    // The record is left untouched — no silent retarget, no lost token.
    const stillThere = await restored.getInstallation('agent-1');
    expect(stillThere).not.toBeNull();
    expect(stillThere!.botToken).toBe(legacyToken);
    expect(stillThere!.botUserId).toBeUndefined();
    expect(restored.getAdapter(stillThere!.id)).toBeUndefined();
  });

  it('leaves a legacy record untouched when the stored-token getMe lookup fails', async () => {
    // Legacy record: botToken present, botUserId undefined. Its stored token
    // has been revoked upstream, so getMe(stored) 401s — we cannot prove the
    // resolver still points at the same bot, so we must not migrate.
    const storage = new InMemoryChannelsStorage();
    const revokedToken = BOT_TOKEN;
    await storage.saveInstallation({
      id: 'revoked-install-id',
      platform: 'telegram',
      agentId: 'agent-1',
      status: 'active',
      webhookId: 'revoked-webhook',
      data: {
        botToken: revokedToken,
        secretToken: 'revoked-secret',
        username: 'revoked_bot',
        webhookUrl: `${BASE_URL}/telegram/events/revoked-webhook`,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Stored token getMe fails (revoked / rotated upstream).
    stubGetMe(revokedToken, { ok: false });
    // Resolver returns a different bot's token.
    const otherToken = '999:OTHER';
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/bot${otherToken}/getMe`, method: 'GET' })
      .reply(200, { ok: true, result: { id: 43, is_bot: true, first_name: 'Other', username: 'other_bot' } })
      .persist();

    const restored = new TelegramProvider({ storage, baseUrl: BASE_URL, tokenResolver: async () => otherToken });
    await restored.initialize();

    // Untouched: legacy token still there, no botUserId assignment happened.
    const stillThere = await restored.getInstallation('agent-1');
    expect(stillThere).not.toBeNull();
    expect(stillThere!.botToken).toBe(revokedToken);
    expect(stillThere!.botUserId).toBeUndefined();
  });

  it('migrates a legacy record without botUserId when the resolver still points at the same bot', async () => {
    // Same legacy shape, but the resolver returns the same bot's token: the
    // stored-token identity (42) matches the resolved-token identity (42), so
    // migration proceeds and drops the persisted token.
    const storage = new InMemoryChannelsStorage();
    await storage.saveInstallation({
      id: 'legacy-happy-id',
      platform: 'telegram',
      agentId: 'agent-1',
      status: 'active',
      webhookId: 'legacy-happy-webhook',
      data: {
        botToken: BOT_TOKEN,
        secretToken: 'legacy-secret',
        username: 'legacy_bot',
        webhookUrl: `${BASE_URL}/telegram/events/legacy-happy-webhook`,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    stubGetMe(BOT_TOKEN);
    const restored = new TelegramProvider({ storage, baseUrl: BASE_URL, tokenResolver: async () => BOT_TOKEN });
    await restored.initialize();

    const migrated = await restored.getInstallation('agent-1');
    expect(migrated).not.toBeNull();
    expect(migrated!.botToken).toBeUndefined();
    expect(migrated!.botUserId).toBe(42);
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        polled,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('getUpdates was never called')), 4000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    expect(getUpdatesCalls).toBeGreaterThan(0);

    // disconnect() must stop the loop (stopPolling), or it keeps hitting getUpdates.
    await provider.disconnect('poll-agent');
    // Let any in-flight long poll settle before sampling the baseline.
    await new Promise(r => setTimeout(r, 50));
    const afterStop = getUpdatesCalls;
    await new Promise(r => setTimeout(r, 100));
    expect(getUpdatesCalls).toBe(afterStop);
  });
});
