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
  guildHealthCheck,
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
  // Node coerces env assignments to strings, so Object.assign would restore an
  // absent var as the literal 'undefined' — truthy, and #suppliedAppConfig()
  // would then read it as a real credential in any test sharing this worker.
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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

    // Reach the store the same way the route will.
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

  it('reports corrupt iv and auth-tag segments as a decryption failure', () => {
    // Base64 decoding doesn't throw on a mangled segment, it just yields the
    // wrong byte count. A short iv reaches final(), but a short tag is rejected
    // by setAuthTag — which ran outside the guard, so it escaped as Node's
    // "Invalid authentication tag length". Both must give the operator the same
    // actionable message.
    const [prefix, salt, iv, tag, ct] = encrypt(APP.botToken, 'pass').split(':');
    const shortened = (segment: string) => segment.slice(0, 4);

    for (const corrupt of [
      [prefix, salt, shortened(iv!), tag, ct].join(':'),
      [prefix, salt, iv, shortened(tag!), ct].join(':'),
    ]) {
      expect(isEncrypted(corrupt)).toBe(true);
      expect(() => decrypt(corrupt, 'pass')).toThrow(/Failed to decrypt a stored Discord secret/);
    }
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

  it('persists rotated credentials so rebuilt adapters do not use the old ones', async () => {
    const { provider, storage } = makeProvider();
    stubValidateApp();
    stubGuild(GUILD, true);
    stubGuildCommands(GUILD);
    await provider.connect('agent-1', { guildId: GUILD });

    // connect() persisted the app config. Every credential consumer reads the
    // STORED config, so a rotation that only updated #config.app would leave
    // Ed25519 verifying against the superseded public key.
    await provider.configure({ publicKey: 'fedcba9876543210' });

    const stored = await new DiscordInstallStore(storage, undefined).getAppConfig();
    expect(stored?.publicKey).toBe('fedcba9876543210');
    expect(stored?.botToken).toBe(APP.botToken); // untouched fields survive
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

/**
 * Wrap a storage so every call takes a beat. Real durable storage is a network
 * hop; the in-memory one resolves in a microtask, which closes the window
 * between claiming the pending fallback and finishing the migration writes —
 * the window the concurrency test needs open.
 */
function withLatency(storage: InMemoryChannelsStorage, ms = 20): InMemoryChannelsStorage {
  return new Proxy(storage, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        await new Promise(resolve => setTimeout(resolve, ms));
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

describe('DiscordProvider — storage resolution', () => {
  it('re-resolves off the in-memory fallback once Mastra attaches', async () => {
    // No storage configured and no Mastra yet → connect() falls back to memory.
    const provider = new DiscordProvider({ app: APP });
    stubValidateApp();
    await provider.connect('agent-1');

    // Registration arrives afterwards, carrying real channels storage.
    const shared = new InMemoryChannelsStorage();
    const mastra = {
      getAgentById: () => undefined,
      getServer: () => undefined,
      getStorage: () => ({ init: async () => {}, getStore: async () => shared }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).__attach(mastra);

    // The next store access must use the real storage, not the pinned fallback,
    // otherwise installs are written to memory and lost on restart.
    stubValidateApp();
    await provider.connect('agent-2');
    const records = await shared.listInstallations('discord');
    expect(records.map(r => r.agentId)).toContain('agent-2');

    // …and the fallback's contents must come with it. Dropping the store would
    // lose the install connect() already returned to the caller, so its route
    // would answer "Unknown webhook" in the very process that created it.
    expect(records.map(r => r.agentId)).toContain('agent-1');
    expect(await provider.getInstallation('agent-1')).not.toBeNull();
    // The app config too — without it nothing can verify an interaction.
    expect(await shared.getConfig('discord')).not.toBeNull();
  });

  it('keeps what real storage already holds when the fallback disagrees', async () => {
    const shared = new InMemoryChannelsStorage();
    const persisted = new DiscordInstallStore(shared, process.env.MASTRA_ENCRYPTION_KEY);
    await persisted.save({
      id: 'i-persisted',
      agentId: 'agent-1',
      webhookId: 'w-persisted',
      status: 'active',
      guildIds: [GUILD],
      installedAt: new Date('2026-01-01T00:00:00Z'),
    });

    // A pre-registration connect() writes a competing row for the same agent.
    const provider = new DiscordProvider({ app: APP });
    stubValidateApp();
    await provider.connect('agent-1');

    const mastra = {
      getAgentById: () => undefined,
      getServer: () => undefined,
      getStorage: () => ({ init: async () => {}, getStore: async () => shared }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).__attach(mastra);

    // The durable row wins — a migration that clobbered it would revoke a live
    // webhook id on nothing more than the ordering of a process restart.
    const install = await provider.getInstallation('agent-1');
    expect(install?.webhookId).toBe('w-persisted');
    const records = await shared.listInstallations('discord');
    expect(records.filter(r => r.agentId === 'agent-1')).toHaveLength(1);
  });

  it('serializes concurrent store resolution against the fallback migration', async () => {
    // Pre-registration connect(): no Mastra yet, so the install lands in the
    // in-memory fallback and connect() hands its id back to the caller.
    const provider = new DiscordProvider({ app: APP });
    stubValidateApp();
    await provider.connect('agent-1');

    // Registration arrives with durable storage that answers at network speed —
    // which is what stretches the migration wide enough to be raced.
    const shared = new InMemoryChannelsStorage();
    const mastra = {
      getAgentById: () => undefined,
      getServer: () => undefined,
      getStorage: () => ({ init: async () => {}, getStore: async () => withLatency(shared) }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).__attach(mastra);

    // Both lookups land while the migration is still writing. Unserialized, the
    // second finds the pending fallback already claimed by the first, skips the
    // migration, builds a store over the still-empty durable storage, and
    // answers null for an installation connect() already returned — in
    // production a live interaction rejected as "Unknown webhook".
    const [first, second] = await Promise.all([
      provider.getInstallation('agent-1'),
      provider.getInstallation('agent-1'),
    ]);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.id).toBe(first?.id);

    // …and exactly one of them migrated: a double claim would duplicate the row.
    const records = await shared.listInstallations('discord');
    expect(records.filter(r => r.agentId === 'agent-1')).toHaveLength(1);
  });

  it('does not pin the store to the fallback when attach lands mid-resolution', async () => {
    const provider = new DiscordProvider({ app: APP });
    const shared = new InMemoryChannelsStorage();
    const mastra = {
      getAgentById: () => undefined,
      getServer: () => undefined,
      getStorage: () => ({ init: async () => {}, getStore: async () => shared }),
    };

    // A resolution started before registration (no Mastra → in-memory fallback)
    // is still in flight when __attach switches the storage target.
    const inFlight = provider.getInstallation('agent-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).__attach(mastra);
    expect(await inFlight).toBeNull();

    // That resolution must not cache its fallback. __attach's own guard cannot
    // catch this one — #store is still unset and #storeIsFallback still false
    // while it runs — so caching would send every later install to memory, lost
    // on restart, with no second attach coming to correct it.
    stubValidateApp();
    await provider.connect('agent-2');
    const records = await shared.listInstallations('discord');
    expect(records.map(r => r.agentId)).toContain('agent-2');
  });
});

describe('DiscordInstallStore.getByGuildId — deterministic routing', () => {
  it('returns the oldest claimant when two agents share a guild', async () => {
    const storage = new InMemoryChannelsStorage();
    const store = new DiscordInstallStore(storage, undefined);
    const older = new Date('2026-01-01T00:00:00Z');
    const newer = new Date('2026-06-01T00:00:00Z');

    // Saved newest-first so a naive .find() would return the wrong one.
    await store.save({
      id: 'i-new',
      agentId: 'agent-new',
      webhookId: 'w-new',
      status: 'active',
      guildIds: [GUILD],
      installedAt: newer,
    });
    await store.save({
      id: 'i-old',
      agentId: 'agent-old',
      webhookId: 'w-old',
      status: 'active',
      guildIds: [GUILD],
      installedAt: older,
    });

    expect((await store.getByGuildId(GUILD))?.agentId).toBe('agent-old');
    // Stable across repeated lookups, not dependent on row order.
    expect((await store.getByGuildId(GUILD))?.agentId).toBe('agent-old');
  });
});

describe('guildHealthCheck — absence vs transient failure', () => {
  it('reports absence on 404 and throws on a rate limit', async () => {
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/api/v10/guilds/${GUILD}`, method: 'GET' })
      .reply(404, { message: 'Unknown Guild', code: 10004 });
    await expect(guildHealthCheck(APP.botToken, GUILD)).resolves.toBe(false);

    // A 429 is not evidence the bot is absent — collapsing it to `false` would
    // send a caller whose bot IS in the guild down the invite path.
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: `/api/v10/guilds/${OTHER_GUILD}`, method: 'GET' })
      .reply(429, { message: 'You are being rate limited.', retry_after: 1.5 });
    await expect(guildHealthCheck(APP.botToken, OTHER_GUILD)).rejects.toThrow(/guild lookup failed/i);
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
    const response = await handler(
      makeCtx(
        inst!.webhookId,
        {
          'x-signature-ed25519': signed(privateKey, timestamp, body),
          'x-signature-timestamp': timestamp,
        },
        body,
      ),
    );
    // Assert the route succeeded — the activation assertions below run off the
    // waitUntil path and would still pass if the handler had 500'd.
    expect(response.status).toBe(200);
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
