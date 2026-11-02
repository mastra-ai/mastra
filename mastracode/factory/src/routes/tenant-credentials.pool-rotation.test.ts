/**
 * Runtime proof for provider pool rotation in a deployed Factory session: the
 * real `TenantCredentialStore` over libsql storage, the real Mastra Code
 * runtime, and an aimock Anthropic endpoint that rate-limits the first call.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { createMastraCode } from '@mastra/code-sdk';
import { resolveAuthenticatedCredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { registerTenantCredentialResolver, resetTenantCredentialResolverForTests } from './tenant-credentials.js';

vi.setConfig({ testTimeout: 60_000 });

const OWNER = { workosId: 'user-a', organizationId: 'org-1' };
const USER_TENANT = { orgId: OWNER.organizationId, userId: OWNER.workosId };
const MODEL_ID = 'anthropic/claude-sonnet-4-5';

let directory: string;
let mock: LLMock;
let stops: Array<() => Promise<void> | void>;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'factory-pool-rotation-'));
  mock = new LLMock({ port: 0 });
  mock.onMessage(/.*/, { content: 'Answered from the second account.' });
  await mock.start();
  vi.stubEnv('ANTHROPIC_BASE_URL', `${mock.url.replace(/\/+$/, '')}/v1`);
  vi.stubEnv('ANTHROPIC_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  stops = [];
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
      models: { activeModelPackId: null, modeDefaults: { build: MODEL_ID, plan: MODEL_ID } },
    }),
  );
  const storage = new LibSQLStore({ id: 'pool-rotation', url: `file:${path.join(directory, 'mastra.db')}` });
  const code = await createMastraCode({
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath,
    storage,
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
  return { session, errors, storage };
}

describe('a Factory session whose personal Anthropic pool hits a rate limit', () => {
  it('switches to the next pool account, retries the turn, and persists the switch', async () => {
    const seed = await createFactoryStorageForTests();
    const first = await seed.credentials.addAccount(USER_TENANT, 'anthropic', {
      credential: { type: 'api_key', key: 'key-first' },
      label: 'First key',
    });
    const second = await seed.credentials.addAccount(USER_TENANT, 'anthropic', {
      credential: { type: 'api_key', key: 'key-second' },
      label: 'Second key',
    });
    registerTenantCredentialResolver(seed.credentials, new Set(), async requestContext =>
      resolveAuthenticatedCredentialTenant(requestContext),
    );

    // aimock redacts credentials in its journal; read the key off the wire.
    const sentKeys: Array<string | null> = [];
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith(mock.url)) {
        sentKeys.push(new Headers(input instanceof Request ? input.headers : init?.headers).get('x-api-key'));
      }
      return realFetch(input, init);
    });

    const { session, errors, storage } = await startSession();
    // The first account stays rate-limited. StreamErrorRetryProcessor spends its
    // one retry of a retryable 429 on the same account; the second 429 reaches
    // AccountRotationProcessor, which rotates the pool.
    mock.nextRequestError(429, { type: 'rate_limit_error', message: 'Rate limited' });
    mock.nextRequestError(429, { type: 'rate_limit_error', message: 'Rate limited' });

    await session.sendMessage({ content: 'Say hi.', requestContext: new RequestContext([['user', { ...OWNER }]]) });
    await vi.waitFor(() => expect(session.run.isRunning()).toBe(false), { timeout: 30_000 });

    expect(errors).toEqual([]);
    const requests = mock.getRequests();
    expect(requests.map(request => request.response.status)).toEqual([429, 429, 200]);
    expect(sentKeys).toEqual(['key-first', 'key-first', 'key-second']);

    const pool = await seed.credentials.listAccounts(USER_TENANT, 'anthropic');
    expect(pool.find(account => account.active)?.id).toBe(second.id);
    expect(pool.find(account => account.id === first.id)).toMatchObject({ status: 'cooldown' });

    const memory = await storage.getStore('memory');
    const { messages } = await memory!.listMessages({ threadId: session.thread.getId() });
    const parts = messages.flatMap(message => message.content.parts ?? []);
    const switchPart = parts.find(part => part.type === 'data-mastracode-account-switch');
    expect(switchPart).toMatchObject({
      data: {
        provider: 'anthropic',
        from: { id: first.id, label: 'First key' },
        to: { id: second.id, label: 'Second key' },
        reason: 'rate-limit',
      },
    });
    expect(JSON.stringify(parts)).not.toMatch(/key-first|key-second/);
  });
});
