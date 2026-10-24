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
const MODEL = 'claude-sonnet-4-5';

/**
 * A deployed per-tenant store, like Factory's `TenantCredentialStore`: one
 * OAuth credential per provider, no account registry, refreshes only on
 * expiry in `getApiKey`, plus a forced refresh for a rejected token.
 */
function tenantOAuthStore() {
  let credential: OAuthCredential = {
    type: 'oauth',
    access: 'revoked-access',
    refresh: 'refresh-1',
    // Unexpired: the provider rejects it anyway (revoked, rotated elsewhere, clock skew).
    expires: Date.now() + 3_600_000,
  };
  const forcedRefreshes: string[] = [];
  // Tokens the OAuth fetch read, one per model request.
  const served: string[] = [];
  const store: RotationCredentialStore = {
    allowEnvironmentFallback: false,
    reload: () => {},
    get: provider => (provider === 'anthropic' ? credential : undefined),
    getStoredApiKey: () => undefined,
    getApiKey: async provider => {
      if (provider !== 'anthropic') return undefined;
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
  // The Claude OAuth provider swaps in a static API key under test; take the
  // production OAuth fetch path so the bearer comes from the tenant store.
  vi.stubEnv('VITEST', '');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  stops = [];
  tenant = tenantOAuthStore();
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
  rmSync(directory, { recursive: true, force: true });
});

async function startSession() {
  const settingsPath = path.join(directory, 'settings.json');
  writeFileSync(
    settingsPath,
    JSON.stringify({
      onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
      models: { activeModelPackId: null, modeDefaults: { build: `anthropic/${MODEL}`, plan: `anthropic/${MODEL}` } },
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

describe('a Factory session whose personal Anthropic OAuth token is rejected before it expires', () => {
  it('force-refreshes the tenant credential and retries the turn with the new token', async () => {
    const { session, errors } = await startSession();
    mock.nextRequestError(401, { error: { type: 'authentication_error', message: 'OAuth token revoked' } });

    await session.sendMessage({ content: 'Say hi.', requestContext: new RequestContext([['user', { ...OWNER }]]) });
    await vi.waitFor(() => expect(session.run.isRunning()).toBe(false), { timeout: 30_000 });

    expect(errors).toEqual([]);
    expect(tenant.forcedRefreshes).toEqual(['anthropic']);
    expect(mock.getRequests().map(request => request.response.status)).toEqual([401, 200]);
    expect(tenant.served).toEqual(['revoked-access', 'fresh-access']);
  });
});
