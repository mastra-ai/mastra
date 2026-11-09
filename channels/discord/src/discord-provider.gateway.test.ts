import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { DiscordProvider } from './index';
import { runGatewayLoop } from './gateway-loop';

/**
 * Gateway lifecycle wiring: the provider owns the reconnect loop (core's
 * `AgentChannels` loop is disabled on the adapter entry), exactly one loop
 * exists per installation, and every teardown path — disconnect, credential
 * rotation/revocation, Mastra re-attach — aborts it. The loop body itself is
 * covered by `gateway-loop.test.ts`; here it is mocked to a promise that
 * resolves on abort, which is exactly the real loop's contract.
 */
vi.mock('./gateway-loop', async importOriginal => {
  const actual = await importOriginal<typeof import('./gateway-loop')>();
  return {
    ...actual,
    runGatewayLoop: vi.fn(
      (_deps: unknown, signal: AbortSignal) =>
        new Promise<void>(resolve => {
          if (signal.aborted) return resolve();
          signal.addEventListener('abort', () => resolve(), { once: true });
        }),
    ),
  };
});

const mockRunGatewayLoop = vi.mocked(runGatewayLoop);

const API_ORIGIN = 'https://discord.com';
const APP = {
  botToken: 'bot-token-abcdef',
  publicKey: '0123456789abcdef',
  applicationId: '111111111111111111',
};
const GUILD = '222222222222222222';

let mockAgent: MockAgent;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  mockRunGatewayLoop.mockClear();
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
  savedEnv = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY,
    DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID,
    MASTRA_ENCRYPTION_KEY: process.env.MASTRA_ENCRYPTION_KEY,
  };
  delete process.env.DISCORD_BOT_TOKEN;
  delete process.env.DISCORD_PUBLIC_KEY;
  delete process.env.DISCORD_APPLICATION_ID;
  delete process.env.MASTRA_ENCRYPTION_KEY;
});

afterEach(async () => {
  await mockAgent.close();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function stubValidateApp(opts: { ok?: boolean } = {}) {
  const { ok = true } = opts;
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: '/api/v10/applications/@me', method: 'GET' })
    .reply(
      ok ? 200 : 401,
      ok
        ? { id: APP.applicationId, name: 'Test App', verify_key: APP.publicKey }
        : { message: '401: Unauthorized', code: 0 },
    );
}

function stubGuild(guildId: string, present: boolean) {
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/api/v10/guilds/${guildId}`, method: 'GET' })
    .reply(
      present ? 200 : 403,
      present ? { id: guildId, name: 'Test Guild' } : { message: 'Missing Access', code: 50001 },
    );
}

function stubGuildCommands(guildId: string) {
  mockAgent
    .get(API_ORIGIN)
    .intercept({ path: `/api/v10/applications/${APP.applicationId}/guilds/${guildId}/commands`, method: 'PUT' })
    .reply(200, [])
    .persist();
}

/** Provider + a resolvable agent, eager-bound to GUILD (active install, loop started). */
async function connectedProvider(config: Partial<ConstructorParameters<typeof DiscordProvider>[0]> = {}) {
  const agent = new Agent({
    id: 'agent-1',
    name: 'agent-1',
    instructions: 'x',
    model: createMockModel({ mockText: 'x' }),
  });
  const storage = new InMemoryChannelsStorage();
  const provider = new DiscordProvider({ storage, app: APP, ...config });
  const mastra = new Mastra({ agents: { 'agent-1': agent }, channels: { discord: provider } });
  stubValidateApp();
  stubGuild(GUILD, true);
  stubGuildCommands(GUILD);
  await provider.connect('agent-1', { guildId: GUILD });
  return { agent, provider, mastra, storage };
}

function loopSignal(call: number): AbortSignal {
  return mockRunGatewayLoop.mock.calls[call]![1];
}

describe('DiscordProvider — gateway loop ownership', () => {
  it('starts exactly one provider-owned loop on activation and disables core’s loop on the adapter entry', async () => {
    const { agent } = await connectedProvider();

    expect(mockRunGatewayLoop).toHaveBeenCalledTimes(1);
    expect(loopSignal(0).aborted).toBe(false);
    // Core's AgentChannels loop reconnects with no backoff and cannot be
    // aborted — the entry must always opt out, even with gateway on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = agent.getChannels()!.channelConfig.adapters.discord as any;
    expect(entry.gateway).toBe(false);
  });

  it('gateway: false disables the provider loop as well', async () => {
    const { agent } = await connectedProvider({ gateway: false });

    expect(mockRunGatewayLoop).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = agent.getChannels()!.channelConfig.adapters.discord as any;
    expect(entry.gateway).toBe(false);
  });

  it('disconnect aborts the installation’s loop', async () => {
    const { provider } = await connectedProvider();
    const signal = loopSignal(0);

    await provider.disconnect('agent-1');
    expect(signal.aborted).toBe(true);
  });

  it('a credential rotation replaces the loop instead of stacking a second one', async () => {
    // This was the leak that multiplied the connect storm: every rotation
    // re-initialized and spawned a fresh core loop while the old one kept
    // IDENTIFYing with the stale token forever.
    const { provider } = await connectedProvider();
    expect(mockRunGatewayLoop).toHaveBeenCalledTimes(1);

    // Rotate the public key (same app): adapters rebuild, loops must follow.
    await provider.configure({ publicKey: 'fedcba9876543210' });
    expect(mockRunGatewayLoop).toHaveBeenCalledTimes(2);
    expect(loopSignal(0).aborted).toBe(true);
    expect(loopSignal(1).aborted).toBe(false);

    // And again — rotations keep replacing, never stacking.
    await provider.configure({ publicKey: '00112233445566778899aabbccddeeff' });
    expect(mockRunGatewayLoop).toHaveBeenCalledTimes(3);
    expect(loopSignal(1).aborted).toBe(true);
    expect(loopSignal(2).aborted).toBe(false);
  });

  it('configure(null) — credential revocation — aborts every loop and starts none', async () => {
    const { provider } = await connectedProvider();
    const signal = loopSignal(0);

    await provider.configure(null);
    expect(signal.aborted).toBe(true);
    expect(mockRunGatewayLoop).toHaveBeenCalledTimes(1);
  });

  it('attaching a new Mastra instance aborts loops bound to the superseded one', async () => {
    const { agent, provider } = await connectedProvider();
    const signal = loopSignal(0);

    new Mastra({ agents: { 'agent-1': agent }, channels: { discord: provider } });
    expect(signal.aborted).toBe(true);
  });

  it('maps the REST token check: 200 → valid, 401 → invalid (park), 5xx/network → unreachable', async () => {
    await connectedProvider();
    const deps = mockRunGatewayLoop.mock.calls[0]![0];

    stubValidateApp();
    expect(await deps.checkToken()).toBe('valid');
    stubValidateApp({ ok: false });
    expect(await deps.checkToken()).toBe('invalid');
    mockAgent
      .get(API_ORIGIN)
      .intercept({ path: '/api/v10/applications/@me', method: 'GET' })
      .reply(500, { message: 'oops', code: 0 });
    expect(await deps.checkToken()).toBe('unreachable');
    // No interceptor left and net connects disabled → the request throws.
    expect(await deps.checkToken()).toBe('unreachable');
  });
});
