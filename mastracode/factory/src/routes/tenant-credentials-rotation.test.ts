import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { createMastraCode } from '@mastra/code-sdk';
import { resolveAuthenticatedCredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import { ACCOUNT_SWITCH_PART_TYPE } from '@mastra/code-sdk/auth/account-rotation-processor';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { registerTenantCredentialResolver, resetTenantCredentialResolverForTests } from './tenant-credentials.js';

vi.setConfig({ testTimeout: 60_000 });

const OWNER = { workosId: 'user-a', organizationId: 'org-1' };
const TENANT = { orgId: OWNER.organizationId, userId: OWNER.workosId };
const OPUS = 'anthropic/claude-opus-5.5';
const RATE_LIMITED = {
  error: { message: 'Rate limited', type: 'rate_limit_error' },
  status: 429,
  retryAfter: 1,
};
const subscription = (token: string) => ({
  type: 'oauth' as const,
  access: token,
  refresh: `refresh-${token}`,
  expires: Date.now() + 3_600_000,
});

let directory: string;
let mock: LLMock;
let seed: FactoryStorageTestSeed;
let stops: Array<() => Promise<void> | void>;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'factory-subscription-rotation-'));
  mock = new LLMock({ port: 0 });
  await mock.start();
  vi.stubEnv('ANTHROPIC_BASE_URL', `${mock.url.replace(/\/+$/, '')}/v1`);
  vi.stubEnv('ANTHROPIC_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  // The Claude subscription provider swaps in a fixed API key under test; this
  // test needs the real OAuth fetch so each request carries its account's token.
  vi.stubEnv('VITEST', '');
  vi.stubEnv('NODE_ENV', 'development');
  stops = [];
  seed = await createFactoryStorageForTests();
  recordTokensSent();
  registerTenantCredentialResolver(seed.credentials, new Set(), async requestContext =>
    resolveAuthenticatedCredentialTenant(requestContext),
  );
});

afterEach(async () => {
  resetTenantCredentialResolverForTests();
  for (const stop of stops.splice(0).reverse()) await stop();
  await mock.stop();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

async function startSession() {
  const settingsPath = path.join(directory, 'settings.json');
  writeFileSync(
    settingsPath,
    JSON.stringify({
      onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
      models: { activeModelPackId: null, modeDefaults: { build: OPUS, plan: OPUS } },
    }),
  );
  const code = await createMastraCode({
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath,
    storage: new LibSQLStore({ id: 'subscription-rotation', url: `file:${path.join(directory, 'mastra.db')}` }),
    storageBackend: 'libsql',
    pubsub: new EventEmitterPubSub(),
    disableMcp: true,
    disableHooks: true,
    disableEnvFile: true,
    disablePlugins: true,
    disableGithubSignals: true,
    createInitialThread: false,
  });
  stops.push(() => code.controller.shutdown?.());
  const session = await code.controller.createSession({
    id: 'session-a',
    resourceId: 'session-a',
    ownerId: OWNER.workosId,
    requestContext: new RequestContext([['user', { ...OWNER }]]),
  });
  const errors: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
  });
  const threadId = session.thread.getId()!;
  const send = async (content: string) => {
    await session.sendMessage({ content, requestContext: new RequestContext([['user', { ...OWNER }]]) });
    await vi.waitFor(() => expect(session.run.isRunning()).toBe(false), { timeout: 30_000 });
  };
  const messages = () => session.thread.listMessages({ threadId });
  const lastReply = async () =>
    (await messages())
      .filter(message => message.role === 'assistant')
      .at(-1)
      ?.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : []))
      .join('');
  const switches = async () =>
    (await messages())
      .flatMap(message => message.content.parts)
      .filter(part => part.type === ACCOUNT_SWITCH_PART_TYPE)
      .map(part => (part as { data?: unknown }).data);
  return { send, lastReply, switches, errors };
}

/** What reached Anthropic, one entry per request: the token it carried and the answer. The mock's journal redacts tokens. */
let tokensSent: string[];

function recordTokensSent() {
  tokensSent = [];
  const originalFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const response = await originalFetch(input, init);
    if (String(input).endsWith('/v1/messages')) {
      tokensSent.push(`${new Headers(init?.headers).get('authorization')} ${response.status}`);
    }
    return response;
  });
}

describe('a member with two Claude subscriptions whose first one is rate-limited', () => {
  it('finishes the turn on the second subscription and keeps using it next turn', async () => {
    await seed.credentials.addAccount(TENANT, 'anthropic', subscription('work-token'), { label: 'work@example.com' });
    await seed.credentials.addAccount(TENANT, 'anthropic', subscription('home-token'), { label: 'home@example.com' });
    mock.on({ model: /claude/, sequenceIndex: 0 }, RATE_LIMITED);
    mock.on({ model: /claude/, sequenceIndex: 1 }, { content: 'Reviewed on the second subscription' });
    const { send, lastReply, switches, errors } = await startSession();

    await send('Review the diff.');

    expect(errors).toEqual([]);
    expect(await lastReply()).toBe('Reviewed on the second subscription');
    expect(tokensSent).toEqual(['Bearer work-token 429', 'Bearer home-token 200']);
    expect(await switches()).toEqual([
      expect.objectContaining({
        provider: 'anthropic',
        from: expect.objectContaining({ label: 'work@example.com' }),
        to: expect.objectContaining({ label: 'home@example.com' }),
        reason: 'rate-limit',
      }),
    ]);

    mock.clearFixtures();
    tokensSent = [];
    mock.on({ model: /claude/ }, { content: 'Still on the second subscription' });
    await send('Again.');

    expect(await lastReply()).toBe('Still on the second subscription');
    expect(new Set(tokensSent)).toEqual(new Set(['Bearer home-token 200']));
  });

  it('reports the rate limit once every subscription is spent', async () => {
    await seed.credentials.addAccount(TENANT, 'anthropic', subscription('work-token'));
    await seed.credentials.addAccount(TENANT, 'anthropic', subscription('home-token'));
    mock.on({ model: /claude/ }, RATE_LIMITED);
    const { send, errors } = await startSession();

    await send('Review the diff.');

    expect(errors).toHaveLength(1);
    expect(tokensSent).toEqual(['Bearer work-token 429', 'Bearer home-token 429']);
  });
});
