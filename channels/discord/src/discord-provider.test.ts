import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import {
  DEFAULT_COMMANDS,
  DiscordInstallStore,
  DiscordProvider,
  buildInviteUrl,
  decrypt,
  encrypt,
  hashCommands,
  isEncrypted,
  normalizeCommands,
  resolveDiscordAdapterConfig,
} from './index';

const API_ORIGIN = 'https://discord.com';
const APP = {
  botToken: 'bot-token-abcdef',
  publicKey: '0123456789abcdef',
  applicationId: '111111111111111111',
};
const GUILD = '222222222222222222';
const OTHER_GUILD = '333333333333333333';

let mockAgent: MockAgent;
/** Saved DISCORD_* env so a real machine's creds can't leak into the tests. */
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  savedEnv = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY,
    DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID,
  };
  delete process.env.DISCORD_BOT_TOKEN;
  delete process.env.DISCORD_PUBLIC_KEY;
  delete process.env.DISCORD_APPLICATION_ID;
});

afterEach(async () => {
  await mockAgent.close();
  Object.assign(process.env, savedEnv);
});

/** Fresh provider + its own in-memory storage (returned so tests can inspect it). */
function makeProvider(config: Partial<ConstructorParameters<typeof DiscordProvider>[0]> = {}) {
  const storage = new InMemoryChannelsStorage();
  const provider = new DiscordProvider({ storage, app: APP, ...config });
  return { provider, storage };
}

/** Stub `GET /applications/@me` — the bot-token validation call. */
function stubValidateApp(opts: { ok?: boolean; name?: string } = {}) {
  const { ok = true, name = 'Test App' } = opts;
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: '/api/v10/applications/@me', method: 'GET' })
    .reply(ok ? 200 : 401, ok ? { id: APP.applicationId, name } : { message: '401: Unauthorized', code: 0 });
}

/** Stub `GET /guilds/{id}` —200 when the bot is a member, 403 otherwise. */
function stubGuild(guildId: string, present: boolean) {
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/api/v10/guilds/${guildId}`, method: 'GET' })
    .reply(
      present ? 200 : 403,
      present ? { id: guildId, name: 'Test Guild' } : { message: 'Missing Access', code: 50001 },
    );
}

/** Persistently stub the guild command PUT, capturing every payload. */
function stubGuildCommands(guildId: string, appId: string = APP.applicationId): () => Record<string, unknown>[] {
  const calls: Record<string, unknown>[] = [];
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/api/v10/applications/${appId}/guilds/${guildId}/commands`, method: 'PUT' })
    .reply(200, opts => {
      calls.push(JSON.parse(String(opts.body)));
      return [];
    })
    .persist();
  return () => calls;
}

/** Persistently stub the global command PUT, capturing every payload. */
function stubGlobalCommands(appId: string = APP.applicationId): () => Record<string, unknown>[] {
  const calls: Record<string, unknown>[] = [];
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/api/v10/applications/${appId}/commands`, method: 'PUT' })
    .reply(200, opts => {
      calls.push(JSON.parse(String(opts.body)));
      return [];
    })
    .persist();
  return () => calls;
}

describe('DiscordProvider — discovery + skeleton', () => {
  it('exposes the discord channel id', () => {
    expect(makeProvider().provider.id).toBe('discord');
  });

  it('reports discovery metadata (configured once app creds are present)', () => {
    expect(makeProvider().provider.getInfo()).toMatchObject({
      id: 'discord',
      name: 'Discord',
      isConfigured: true,
    });
  });

  it('is not configured without app credentials', () => {
    const provider = new DiscordProvider({ storage: new InMemoryChannelsStorage() });
    expect(provider.getInfo().isConfigured).toBe(false);
  });

  it('mounts a single POST interactions route (requiresAuth false — Ed25519, not bearer)', () => {
    const routes = makeProvider().provider.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      path: '/discord/events/:webhookId',
      method: 'POST',
      requiresAuth: false,
    });
  });
});

describe('DiscordProvider.connect', () => {
  it('throws when the app is not configured (Dev Portal only — no programmatic app creation)', async () => {
    const provider = new DiscordProvider({ storage: new InMemoryChannelsStorage() });
    await expect(provider.connect('agent-1')).rejects.toThrow(/not configured/i);
  });

  it('returns the OAuth2 bot-invite URL and a pending install when no guild is bound', async () => {
    const { provider } = makeProvider();
    stubValidateApp();

    const result = await provider.connect('agent-1');

    expect(result).toMatchObject({ type: 'oauth' });
    const url = new URL((result as { authorizationUrl: string }).authorizationUrl);
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe(APP.applicationId);
    expect(url.searchParams.get('scope')).toBe('bot applications.commands');
    expect(BigInt(url.searchParams.get('permissions')!)).toBeGreaterThan(0n);

    const installs = await provider.listInstallations();
    expect(installs).toHaveLength(1);
    expect(installs[0]).toMatchObject({ agentId: 'agent-1', platform: 'discord', status: 'pending' });
    expect(provider.getInfo().isConfigured).toBe(true);
  });

  it('validates the bot token via /applications/@me and persists nothing on rejection', async () => {
    const { provider, storage } = makeProvider();
    stubValidateApp({ ok: false });

    await expect(provider.connect('agent-1')).rejects.toThrow(/rejected the bot token/i);
    expect(await provider.listInstallations()).toHaveLength(0);
    // Invalid token ⇒ app config must not be persisted either.
    expect(await storage.getConfig('discord')).toBeNull();
  });

  it('binds immediately when the bot is already in the target guild', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    const commandCalls = stubGuildCommands(GUILD);

    const result = await provider.connect('agent-1', { guildId: GUILD });

    expect(result).toMatchObject({ type: 'immediate' });
    const inst = await provider.getInstallation('agent-1');
    expect(inst).toMatchObject({ status: 'active', guildIds: [GUILD] });
    // Guild commands registered instantly on bind (default /help seed).
    expect(commandCalls()).toHaveLength(1);
    expect((commandCalls()[0] as unknown as { name: string }[]).map(c => c.name)).toEqual(['help']);
  });

  it('falls back to the invite URL when the bot is not yet in the target guild', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, false);

    const result = await provider.connect('agent-1', { guildId: GUILD });

    expect(result).toMatchObject({ type: 'oauth' });
    const inst = await provider.getInstallation('agent-1');
    expect(inst).toMatchObject({ status: 'pending', guildIds: [] });
  });

  it('enforces one active install per agent (reconnect requires disconnect)', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    stubGuildCommands(GUILD);
    await provider.connect('agent-1', { guildId: GUILD });

    await expect(provider.connect('agent-1')).rejects.toThrow(/already connected/i);
  });

  it('never leaks secrets in listInstallations()', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    await provider.connect('agent-1');

    const installs = await provider.listInstallations();
    const json = JSON.stringify(installs);
    expect(json).not.toContain(APP.botToken);
    expect(json).not.toContain(APP.publicKey);
  });
});

describe('DiscordProvider — one app, many guilds (app secrets stored once)', () => {
  it('stores app creds once; a second agent connects with no creds supplied', async () => {
    const storage = new InMemoryChannelsStorage();
    // First provider carries the creds and persists them.
    const p1 = new DiscordProvider({ storage, app: APP });
    stubValidateApp();
    await p1.connect('agent-1');

    // Second provider shares storage but is given NO creds — reads the stored app.
    const p2 = new DiscordProvider({ storage });
    stubValidateApp();
    const result = await p2.connect('agent-2');
    expect(result).toMatchObject({ type: 'oauth' });
    expect((await p2.listInstallations()).map(i => i.agentId).sort()).toEqual(['agent-1', 'agent-2']);
  });

  it('encrypts the stored bot token at rest when an encryptionKey is set', async () => {
    const storage = new InMemoryChannelsStorage();
    const provider = new DiscordProvider({ storage, app: APP, encryptionKey: 'super-secret-passphrase' });
    stubValidateApp();
    await provider.connect('agent-1');

    const config = await storage.getConfig('discord');
    const stored = config?.data as { botToken?: string; applicationId?: string };
    expect(stored.botToken).toBeDefined();
    expect(stored.botToken).not.toBe(APP.botToken);
    expect(isEncrypted(stored.botToken!)).toBe(true);
    // applicationId is public — stored in the clear.
    expect(stored.applicationId).toBe(APP.applicationId);
  });
});

describe('DiscordProvider.activateGuild — lazy activation (first interaction)', () => {
  it('flips a pending install to active and records the guild, calling onInstall once', async () => {
    const seen: string[] = [];
    const { provider } = makeProvider({ onInstall: i => void seen.push(i.agentId) });
    stubValidateApp();
    await provider.connect('agent-1');
    const pending = await provider.getInstallation('agent-1');
    expect(pending?.status).toBe('pending');

    const activated = await provider.activateGuild(pending!.webhookId, GUILD);
    expect(activated).toMatchObject({ status: 'active', guildIds: [GUILD] });
    expect(seen).toEqual(['agent-1']);

    // Re-activation with another guild appends without re-firing onInstall.
    const again = await provider.activateGuild(pending!.webhookId, OTHER_GUILD);
    expect(again?.guildIds).toEqual([GUILD, OTHER_GUILD]);
    expect(seen).toEqual(['agent-1']);
  });

  it('returns null for an unknown webhookId', async () => {
    const { provider } = makeProvider();
    expect(await provider.activateGuild('no-such-webhook', GUILD)).toBeNull();
  });

  it('makes the install discoverable by guildId (tenancy key)', async () => {
    const { provider, storage } = makeProvider({ encryptionKey: 'k' });
    stubValidateApp();
    await provider.connect('agent-1');
    const pending = await provider.getInstallation('agent-1');
    await provider.activateGuild(pending!.webhookId, GUILD);

    // Reach the store the same way the route (mastra-discord-13x.3) will.
    const { DiscordInstallStore } = await import('../src/install-store');
    const store = new DiscordInstallStore(storage, 'k');
    const byGuild = await store.getByGuildId(GUILD);
    expect(byGuild?.agentId).toBe('agent-1');
  });
});

describe('DiscordProvider.disconnect', () => {
  it('removes the installation', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    stubGuildCommands(GUILD);
    await provider.connect('agent-1', { guildId: GUILD });

    await provider.disconnect('agent-1');
    expect(await provider.listInstallations()).toHaveLength(0);
    // App config persists (one app, many guilds) → still configured.
    expect(provider.isConfigured()).toBe(true);
  });

  it('throws when no installation exists', async () => {
    await expect(makeProvider().provider.disconnect('ghost')).rejects.toThrow(/no discord installation/i);
  });
});

describe('buildInviteUrl', () => {
  it('builds an OAuth2 authorize URL with bot + applications.commands scopes', () => {
    const url = new URL(buildInviteUrl({ applicationId: APP.applicationId }));
    expect(url.searchParams.get('client_id')).toBe(APP.applicationId);
    expect(url.searchParams.get('scope')).toBe('bot applications.commands');
    expect(BigInt(url.searchParams.get('permissions')!)).toBeGreaterThan(0n);
  });

  it('honors an explicit permissions bitfield', () => {
    const url = new URL(buildInviteUrl({ applicationId: APP.applicationId, permissions: 8n }));
    expect(url.searchParams.get('permissions')).toBe('8');
  });
});

describe('normalizeCommands', () => {
  it('lowercases, strips the leading slash, and defaults the description', () => {
    expect(normalizeCommands(['/Help'])).toEqual([{ name: 'help', description: 'Run /help' }]);
  });

  it('keeps dashes (Discord allows them), drops other invalid chars, clamps to 32', () => {
    const [cmd] = normalizeCommands([{ name: 'My-Cmd!', description: 'x' }]);
    expect(cmd.name).toBe('my-cmd');
    const [long] = normalizeCommands(['a'.repeat(40)]);
    expect(long.name).toHaveLength(32);
  });

  it('drops empties and duplicates', () => {
    expect(normalizeCommands(['/', 'help', 'help'])).toEqual([{ name: 'help', description: 'Run /help' }]);
  });

  it('clamps descriptions to 100 chars', () => {
    const [cmd] = normalizeCommands([{ name: 'x', description: 'd'.repeat(200) }]);
    expect(cmd.description).toHaveLength(100);
  });

  it('normalizes the default seed', () => {
    expect(normalizeCommands(DEFAULT_COMMANDS).map(c => c.name)).toEqual(['help']);
  });
});

describe('resolveDiscordAdapterConfig (stream binding + gateway)', () => {
  it("enables streaming + typing + gateway and defaults toolDisplay to 'cards' (native embeds)", () => {
    expect(resolveDiscordAdapterConfig({})).toEqual({
      streaming: true,
      typingStatus: true,
      toolDisplay: 'cards',
      gateway: true,
    });
  });

  it('respects explicit overrides', () => {
    expect(resolveDiscordAdapterConfig({ streaming: false })).toMatchObject({ streaming: false });
    expect(resolveDiscordAdapterConfig({ typingStatus: false })).toMatchObject({ typingStatus: false });
    expect(resolveDiscordAdapterConfig({ toolDisplay: 'text' })).toMatchObject({ toolDisplay: 'text' });
    expect(resolveDiscordAdapterConfig({ gateway: false })).toMatchObject({ gateway: false });
    expect(resolveDiscordAdapterConfig({ streaming: { updateIntervalMs: 800 } })).toMatchObject({
      streaming: { updateIntervalMs: 800 },
    });
  });
});

describe('hashCommands', () => {
  it('is stable and order-independent', () => {
    expect(hashCommands(normalizeCommands(['a', 'b']))).toBe(hashCommands(normalizeCommands(['b', 'a'])));
  });

  it('changes when a command changes', () => {
    expect(hashCommands(normalizeCommands(['a']))).not.toBe(hashCommands(normalizeCommands(['b'])));
  });
});

describe('DiscordProvider — command registration (guild/global + hash skip)', () => {
  it('registers guild commands lazily for each newly-seen guild', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    const g1 = stubGuildCommands(GUILD);
    const g2 = stubGuildCommands(OTHER_GUILD);

    await provider.connect('agent-1'); // oauth pending — no guild yet, so no PUT
    expect(g1()).toHaveLength(0);

    const inst = await provider.getInstallation('agent-1');
    await provider.activateGuild(inst!.webhookId, GUILD);
    expect(g1()).toHaveLength(1);
    await provider.activateGuild(inst!.webhookId, OTHER_GUILD);
    expect(g2()).toHaveLength(1);

    const after = await provider.getInstallation('agent-1');
    expect(Object.keys(after!.commandVersions ?? {}).sort()).toEqual([GUILD, OTHER_GUILD].sort());
  });

  it('skips re-registering a known guild whose commands are unchanged (rate-limit aware)', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    const cmds = stubGuildCommands(GUILD);

    await provider.connect('agent-1', { guildId: GUILD });
    expect(cmds()).toHaveLength(1);

    const inst = await provider.getInstallation('agent-1');
    await provider.activateGuild(inst!.webhookId, GUILD); // already active + known → no PUT
    expect(cmds()).toHaveLength(1);
  });

  it("registers global commands once when commandScope is 'global'", async () => {
    const { provider } = makeProvider({ commandScope: 'global' });
    stubValidateApp();
    const g = stubGlobalCommands();

    await provider.connect('agent-1'); // global doesn't need a guild
    expect(g()).toHaveLength(1);
    const inst = await provider.getInstallation('agent-1');
    expect(inst!.commandVersions?.global).toBeDefined();
  });

  it('registers a per-agent command override (normalized to CHAT_INPUT)', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    const cmds = stubGuildCommands(GUILD);

    await provider.connect('agent-1', {
      guildId: GUILD,
      commands: ['/ask', { name: 'summarize', description: 'Summarize a link' }],
    });

    const payload = cmds()[0] as unknown as { name: string; description: string; type: number }[];
    expect(payload.map(c => c.name)).toEqual(['ask', 'summarize']);
    expect(payload.every(c => c.type === 1)).toBe(true);
  });
});

describe('crypto (bot-token at rest)', () => {
  it('round-trips a value and passes plaintext through', () => {
    const enc = encrypt(APP.botToken, 'pass');
    expect(isEncrypted(enc)).toBe(true);
    expect(decrypt(enc, 'pass')).toBe(APP.botToken);
    expect(decrypt(APP.botToken, 'pass')).toBe(APP.botToken);
  });
});

describe('DiscordInstallStore — encryption key lifecycle', () => {
  it('round-trips the bot token through storage when keyed', async () => {
    const storage = new InMemoryChannelsStorage();
    await new DiscordInstallStore(storage, 'pass').saveAppConfig(APP);

    // Stored ciphertext, not the token.
    const raw = (await storage.getConfig('discord'))?.data as { botToken: string };
    expect(isEncrypted(raw.botToken)).toBe(true);
    expect(raw.botToken).not.toContain(APP.botToken);

    expect(await new DiscordInstallStore(storage, 'pass').getAppConfig()).toEqual(APP);
  });

  it('throws a configuration error rather than returning ciphertext when the key is lost', async () => {
    const storage = new InMemoryChannelsStorage();
    await new DiscordInstallStore(storage, 'pass').saveAppConfig(APP);

    // Same storage, no key — e.g. MASTRA_ENCRYPTION_KEY dropped from the env.
    // Without the guard this returns ciphertext, which is then sent to Discord
    // as a bot token and surfaces as an opaque 401.
    await expect(new DiscordInstallStore(storage, undefined).getAppConfig()).rejects.toThrow(/no encryption key/i);
  });

  it('still reads plaintext values written without a key', async () => {
    const storage = new InMemoryChannelsStorage();
    await new DiscordInstallStore(storage, undefined).saveAppConfig(APP);
    expect(await new DiscordInstallStore(storage, undefined).getAppConfig()).toEqual(APP);
  });
});

describe('DiscordProvider.configure — cache invalidation', () => {
  it('drops adapters built on superseded credentials', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    stubGuildCommands(GUILD);
    await provider.connect('agent-1', { guildId: GUILD });

    const install = await provider.getInstallation('agent-1');
    const before = provider.getAdapter(install!.id);
    expect(before).toBeDefined();

    // A rotated public key must not leave an adapter verifying Ed25519 against
    // the old one (nor authenticating with the old bot token).
    await provider.configure({ publicKey: 'fedcba9876543210' });
    expect(provider.getAdapter(install!.id)).not.toBe(before);
  });

  it('keeps adapters when the credentials are unchanged', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    stubGuildCommands(GUILD);
    await provider.connect('agent-1', { guildId: GUILD });

    const install = await provider.getInstallation('agent-1');
    const before = provider.getAdapter(install!.id);

    await provider.configure({ publicKey: APP.publicKey });
    expect(provider.getAdapter(install!.id)).toBe(before);
  });

  it('drops adapters when the app config is cleared', async () => {
    const { provider } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    stubGuildCommands(GUILD);
    await provider.connect('agent-1', { guildId: GUILD });

    const install = await provider.getInstallation('agent-1');
    expect(provider.getAdapter(install!.id)).toBeDefined();

    await provider.configure(null);
    expect(provider.getAdapter(install!.id)).toBeUndefined();
    expect(provider.isConfigured()).toBe(false);
  });
});

describe('DiscordProvider — interactions route (raw-body → adapter.handleWebhook)', () => {
  /** An Ed25519 keypair; `publicKeyHex` goes in the app config, `privateKey` signs requests. */
  function makeKeypair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
    return { privateKey, publicKeyHex: Buffer.from(jwk.x, 'base64url').toString('hex') };
  }

  /** Hono-ish context carrying a real interaction as the RAW request body + signature headers. */
  function makeCtx(webhookId: string | undefined, headers: Record<string, string>, body: string) {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      req: {
        param: (k: string) => (k === 'webhookId' ? webhookId : undefined),
        header: (k: string) => lower[k.toLowerCase()],
        raw: new Request(`https://app.example.com/discord/events/${webhookId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body,
        }),
      },
      json: (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } }),
    };
  }

  /** Sign `timestamp + body` the way Discord does (Ed25519 over the raw bytes). */
  function signed(privateKey: ReturnType<typeof makeKeypair>['privateKey'], timestamp: string, body: string) {
    return sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
  }

  const stubMastra = { getAgentById: () => undefined, getStorage: () => undefined, getServer: () => undefined };

  /** A connected (pending) provider whose app public key matches `privateKey`, plus its route handler. */
  async function connectedHandler() {
    const { privateKey, publicKeyHex } = makeKeypair();
    const provider = new DiscordProvider({
      storage: new InMemoryChannelsStorage(),
      app: { ...APP, publicKey: publicKeyHex },
    });
    stubValidateApp();
    await provider.connect('agent-1');
    const install = await provider.getInstallation('agent-1');
    const route = provider.getRoutes()[0];
    if (!('createHandler' in route)) throw new Error('expected a createHandler route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = await route.createHandler({ mastra: stubMastra as any });
    return { handler, privateKey, webhookId: install!.webhookId };
  }

  it('404s an unknown webhookId', async () => {
    const { handler } = await connectedHandler();
    const res = await handler(makeCtx('does-not-exist', {}, '{}'));
    expect(res.status).toBe(404);
  });

  it('passes RAW bytes through: a validly-signed PING returns a type-1 PONG', async () => {
    const { handler, privateKey, webhookId } = await connectedHandler();
    const body = JSON.stringify({ type: 1 });
    const timestamp = '1700000000';
    const ctx = makeCtx(
      webhookId,
      {
        'x-signature-ed25519': signed(privateKey, timestamp, body),
        'x-signature-timestamp': timestamp,
      },
      body,
    );

    const res = await handler(ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ type: 1 });
  });

  it('rejects a bad Ed25519 signature with 401 (adapter verified the raw bytes)', async () => {
    const { handler, webhookId } = await connectedHandler();
    const body = JSON.stringify({ type: 1 });
    const ctx = makeCtx(
      webhookId,
      {
        'x-signature-ed25519': '00'.repeat(64),
        'x-signature-timestamp': '1700000000',
      },
      body,
    );

    const res = await handler(ctx);
    expect(res.status).toBe(401);
  });

  it("activates the guild from an interaction's guild_id (lazy activation via the route)", async () => {
    const { privateKey, publicKeyHex } = makeKeypair();
    const drained: Promise<unknown>[] = [];
    const provider = new DiscordProvider({
      storage: new InMemoryChannelsStorage(),
      app: { ...APP, publicKey: publicKeyHex },
      gateway: false,
      waitUntil: p => void drained.push(Promise.resolve(p)),
    });
    stubValidateApp();
    const cmds = stubGuildCommands(GUILD);
    await provider.connect('agent-1'); // pending — no guild yet
    const inst = await provider.getInstallation('agent-1');

    const route = provider.getRoutes()[0];
    if (!('createHandler' in route)) throw new Error('expected a createHandler route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = await route.createHandler({ mastra: stubMastra as any });

    // A signed guild interaction (no agent wired → adapter path); the route reads
    // guild_id off a CLONE and schedules activation via waitUntil.
    const body = JSON.stringify({ type: 2, guild_id: GUILD, data: { name: 'help' } });
    const timestamp = '1700000001';
    await handler(
      makeCtx(
        inst!.webhookId,
        {
          'x-signature-ed25519': signed(privateKey, timestamp, body),
          'x-signature-timestamp': timestamp,
        },
        body,
      ),
    );
    await Promise.all(drained); // drain the scheduled activation

    const after = await provider.getInstallation('agent-1');
    expect(after!.status).toBe('active');
    expect(after!.guildIds).toContain(GUILD);
    expect(cmds().length).toBeGreaterThanOrEqual(1); // commands registered for the newly-seen guild
  });
});

describe('DiscordProvider — AgentChannels wiring (parity with @mastra/slack)', () => {
  // gateway:false keeps these fully in-process (no real Gateway WebSocket).
  it('forwards the curated ChannelConfig subset + adapter overrides, gateway forwarded', async () => {
    const agent = new Agent({
      id: 'cfg-agent',
      name: 'cfg-agent',
      instructions: 'x',
      model: createMockModel({ mockText: 'x' }),
    });
    const storage = new InMemoryChannelsStorage();
    const handlers = { onDirectMessage: async () => {} };
    const inlineMedia = ['image/png', 'image/jpeg'];
    const threadContext = { maxMessages: 5 };
    const cors = { origin: 'https://example.com' };
    const formatError = (e: Error) => `oops: ${e.message}`;

    const provider = new DiscordProvider({
      storage,
      app: APP,
      gateway: false,
      handlers,
      inlineMedia,
      threadContext,
      cors,
      formatError,
    });
    const mastra = new Mastra({ agents: { 'cfg-agent': agent }, channels: { discord: provider } });
    expect(mastra).toBeDefined();

    stubValidateApp();
    stubGuild(GUILD, true);
    stubGuildCommands(GUILD);
    await provider.connect('cfg-agent', { guildId: GUILD });

    const cc = agent.getChannels()!.channelConfig;
    // Channel-level options
    expect(cc.handlers).toBe(handlers);
    expect(cc.inlineMedia).toEqual(inlineMedia);
    expect(cc.threadContext).toEqual(threadContext);
    // Adapter-entry-level options + the stream/gateway binding
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = cc.adapters.discord as any;
    expect(entry.cors).toEqual(cors);
    expect(entry.formatError).toBe(formatError);
    expect(entry.streaming).toBe(true);
    expect(entry.typingStatus).toBe(true);
    expect(entry.toolDisplay).toBe('cards');
    expect(entry.gateway).toBe(false);
    expect(provider.getAdapter((await provider.getInstallation('cfg-agent'))!.id)).toBeDefined();
  });
});
