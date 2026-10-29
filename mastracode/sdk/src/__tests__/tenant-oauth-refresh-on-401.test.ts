import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAuthenticatedCredentialTenant, setCredentialStoreProvider } from '../agents/credential-resolver.js';
import type { RotationCredentialStore } from '../auth/account-rotation-processor.js';
import type { OAuthCredential } from '../auth/types.js';
import { createMastraCode } from '../index.js';

vi.setConfig({ testTimeout: 60_000 });

const OWNER = { workosId: 'user-a', organizationId: 'org-1' };

/**
 * A deployed per-tenant store, like Factory's `TenantCredentialStore`: one
 * OAuth credential per provider, no account registry, refreshes only on
 * expiry in `getApiKey`, plus a forced refresh for a rejected token.
 */
function tenantOAuthStore(providerId: string, extra: Record<string, unknown> = {}) {
  let credential: OAuthCredential = {
    type: 'oauth',
    access: 'revoked-access',
    refresh: 'refresh-1',
    // Unexpired: the provider rejects it anyway (revoked, rotated elsewhere, clock skew).
    expires: Date.now() + 3_600_000,
    ...extra,
  };
  const forcedRefreshes: string[] = [];
  // Tokens the OAuth fetch read through `getApiKey`, one per model request.
  const served: string[] = [];
  const store: RotationCredentialStore = {
    allowEnvironmentFallback: false,
    reload: () => {},
    get: provider => (provider === providerId ? credential : undefined),
    getStoredApiKey: () => undefined,
    getApiKey: async provider => {
      if (provider !== providerId) return undefined;
      served.push(credential.access);
      return credential.access;
    },
    forceRefreshActiveAccount: async provider => {
      forcedRefreshes.push(provider);
      credential = { ...credential, access: 'fresh-access', refresh: 'refresh-2', expires: Date.now() + 3_600_000 };
      return credential.access;
    },
  };
  return { store, forcedRefreshes, served };
}

let directory: string;
let mock: LLMock;
let tenant: ReturnType<typeof tenantOAuthStore>;
let stops: Array<() => Promise<void> | void>;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'mastracode-tenant-oauth-'));
  mock = new LLMock({ port: 0 });
  mock.onMessage(/.*/, { content: 'Refreshed and answered.' });
  await mock.start();
  vi.stubEnv('ANTHROPIC_BASE_URL', `${mock.url.replace(/\/+$/, '')}/v1`);
  vi.stubEnv('ANTHROPIC_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('OPENAI_API_KEY', 'process-env-key-must-not-be-used');
  // The Claude OAuth provider swaps in a static API key under test; take the
  // production OAuth fetch path so the bearer comes from the tenant store.
  vi.stubEnv('VITEST', '');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  stops = [];
  setCredentialStoreProvider(
    () => tenant.store,
    async requestContext => resolveAuthenticatedCredentialTenant(requestContext),
  );
});

afterEach(async () => {
  setCredentialStoreProvider(undefined);
  for (const stop of stops.splice(0).reverse()) await stop();
  await mock.stop();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(directory, { recursive: true, force: true });
});

async function startSession(modelId: string) {
  const settingsPath = path.join(directory, 'settings.json');
  writeFileSync(
    settingsPath,
    JSON.stringify({
      onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
      models: { activeModelPackId: null, modeDefaults: { build: modelId, plan: modelId } },
    }),
  );
  const code = await createMastraCode({
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath,
    storage: new LibSQLStore({ id: 'tenant-oauth', url: `file:${path.join(directory, 'mastra.db')}` }),
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
  expect(session.thread.getId()).toBeTruthy();
  const errors: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
  });
  return { session, errors };
}

async function sendAndSettle(session: Awaited<ReturnType<typeof startSession>>['session']) {
  await session.sendMessage({ content: 'Say hi.', requestContext: new RequestContext([['user', { ...OWNER }]]) });
  await vi.waitFor(() => expect(session.run.isRunning()).toBe(false), { timeout: 30_000 });
}

describe('a Factory session whose personal Anthropic OAuth token is rejected before it expires', () => {
  it('force-refreshes the tenant credential and retries the turn with the new token', async () => {
    tenant = tenantOAuthStore('anthropic');
    const { session, errors } = await startSession('anthropic/claude-sonnet-4-5');
    mock.nextRequestError(401, { error: { type: 'authentication_error', message: 'OAuth token revoked' } });

    await sendAndSettle(session);

    expect(errors).toEqual([]);
    expect(tenant.forcedRefreshes).toEqual(['anthropic']);
    expect(mock.getRequests().map(request => request.response.status)).toEqual([401, 200]);
    expect(tenant.served).toEqual(['revoked-access', 'fresh-access']);
  });
});

describe('a Factory session whose personal Codex OAuth token is rejected before it expires', () => {
  it('force-refreshes the tenant credential and retries the turn with the new bearer', async () => {
    tenant = tenantOAuthStore('openai-codex', { accountId: 'chatgpt-account-1' });
    // The Codex OAuth fetch always targets the ChatGPT backend; serve that host
    // from aimock and record the bearer it sent (aimock redacts it in its journal).
    const bearers: Array<string | null> = [];
    const realFetch = globalThis.fetch;
    const mockResponsesUrl = `${mock.url.replace(/\/+$/, '')}/v1/responses`;
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      if (input instanceof Request && new URL(input.url).hostname === 'chatgpt.com') {
        bearers.push(input.headers.get('authorization'));
        return realFetch(new Request(mockResponsesUrl, input), init);
      }
      return realFetch(input, init);
    });
    const { session, errors } = await startSession('openai/gpt-5.3-codex');
    mock.nextRequestError(401, { error: { code: 'token_expired', message: 'Token expired' } });

    await sendAndSettle(session);

    expect(errors).toEqual([]);
    expect(tenant.forcedRefreshes).toEqual(['openai-codex']);
    const requests = mock.getRequests();
    expect(requests.map(request => request.response.status)).toEqual([401, 200]);
    expect(bearers).toEqual(['Bearer revoked-access', 'Bearer fresh-access']);
    expect(requests.every(request => request.headers['chatgpt-account-id'] === 'chatgpt-account-1')).toBe(true);
  });
});
