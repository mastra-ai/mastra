import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { Hono } from 'hono';
import { expect, it, vi } from 'vitest';
import type { VersionControl } from './capabilities/version-control.js';
import { MastraFactory } from './factory.js';
import { OAuthRoutes } from './routes/oauth.js';
import { fakeRouteAuth, mountApiRoutes } from './routes/test-utils.js';
import {
  createFactorySecretEncryption,
  FactorySecretDecryptionError,
  secretKeyMismatchHint,
} from './secret-encryption.js';
import { ModelCredentialsStorage } from './storage/domains/credentials/base.js';
import { IntegrationStorage } from './storage/domains/integrations/base.js';

const prepareMock = vi.fn(async (_config: Record<string, unknown>) => ({
  base: { controller: { onSessionCreated: vi.fn() } },
  mastraArgs: {},
  finalize: vi.fn(async () => {}),
}));
vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: (config: Record<string, unknown>) => prepareMock(config),
}));

// Secrets written under one key, then Factory rebooted under another key with the same id
// (e.g. a regenerated FACTORY_CREDENTIAL_ENCRYPTION_KEY against a shared database). The secret
// domains stay down, and every surface must say why and how to fix it instead of a bare 503.
it('explains an encryption key mismatch on every surface it breaks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'factory-key-mismatch-'));
  const url = `file:${join(dir, 'factory.db')}`;
  const keyA = createFactorySecretEncryption({ primary: { id: 'v1', key: Buffer.alloc(32, 1) } });
  const keyB = createFactorySecretEncryption({ primary: { id: 'v1', key: Buffer.alloc(32, 2) } });

  // Boot 1 under key A: a GitHub connection and a personal model credential get stored.
  const first = new LibSQLFactoryStorage({ id: 'key-mismatch', url });
  const integrations = first.registerDomain(new IntegrationStorage(keyA));
  const credentials = first.registerDomain(new ModelCredentialsStorage(keyA));
  await first.init();
  await integrations.forIntegration('github').connections.upsert('org1', { data: { installationId: 1 } });
  await credentials.setCredential({ orgId: 'org1', userId: 'user-a' }, 'openai', { type: 'api_key', key: 'sk-x' });
  await first.close();

  // Boot 2 under key B (same key id, different key) against the same DB.
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const storage = new LibSQLFactoryStorage({ id: 'key-mismatch', url });
  const versionControl = {
    initialize: vi.fn(),
    registerInstallation: vi.fn(),
    registerRepositories: vi.fn(),
    getRepositoryAccess: vi.fn(),
  } as unknown as VersionControl;
  const factory = new MastraFactory({
    secretEncryption: keyB,
    storage,
    integrations: [
      {
        id: 'github',
        versionControl,
        diagnostics: () => ({}),
        routes: () => [
          {
            path: '/web/github/projects/:id/issues',
            method: 'GET' as const,
            handler: () => Response.json({ issues: [] }),
          },
        ],
      },
    ],
  });
  await factory.prepare();
  const config = prepareMock.mock.calls[0]![0];
  expect(storage.domainInitError('integrations')).toBeInstanceOf(FactorySecretDecryptionError);
  expect(storage.domainInitError('model-credentials')).toBeInstanceOf(FactorySecretDecryptionError);
  expect(errors).toHaveBeenCalledWith(
    expect.stringContaining('storage domain "integrations" failed to initialize'),
    storage.domainInitError('integrations'),
  );
  expect(errors).toHaveBeenCalledWith(
    expect.stringContaining('storage domain "model-credentials" failed to initialize'),
    storage.domainInitError('model-credentials'),
  );

  const routes = (config.buildApiRoutes as (deps: object) => never[])({
    controller: { onSessionCreated: () => () => {}, onSessionDeleted: () => () => {} },
    authStorage: {},
  });
  const app = new Hono();
  mountApiRoutes(app as never, routes);
  const issues = await app.request('/web/github/projects/repo-1/issues');
  const issuesBody = await issues.json();
  expect(issues.status).toBe(503);
  expect(issuesBody).toEqual({
    error: 'integration_unavailable',
    message: `github integration is unavailable. ${secretKeyMismatchHint(new FactorySecretDecryptionError(''))}`,
  });
  expect(issuesBody.message).toContain('FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS');
  expect(errors).toHaveBeenCalledWith(
    expect.stringContaining('github integration is unavailable'),
    expect.any(FactorySecretDecryptionError),
  );
  // Every retry throws a fresh error; the same failure is logged once, not per request.
  expect((await app.request('/web/github/projects/repo-1/issues')).status).toBe(503);
  expect(errors.mock.calls.filter(([line]) => String(line).includes('github integration is unavailable'))).toHaveLength(
    1,
  );

  const credentialsApp = new Hono();
  credentialsApp.use('*', async (c, next) => {
    c.set('factoryAuthUser' as never, { workosId: 'user-a', organizationId: 'org1' } as never);
    await next();
  });
  mountApiRoutes(
    credentialsApp as never,
    new OAuthRoutes({
      auth: fakeRouteAuth(),
      authStorage: {} as never,
      modelCredentials: storage.getDomain<ModelCredentialsStorage>('model-credentials'),
    }).routes(),
  );
  const start = await credentialsApp.request('/web/config/providers/anthropic/oauth/start', { method: 'POST' });
  const startBody = await start.json();
  expect(start.status).toBe(503);
  expect(startBody).toEqual({
    error: 'credentials_unavailable',
    message: `Provider credentials are unavailable. ${secretKeyMismatchHint(new FactorySecretDecryptionError())}`,
  });

  // The stored secrets were left untouched: restoring key A brings everything back.
  await storage.close();
  const restored = new LibSQLFactoryStorage({ id: 'key-mismatch', url });
  const restoredCredentials = restored.registerDomain(new ModelCredentialsStorage(keyA));
  restored.registerDomain(new IntegrationStorage(keyA));
  await restored.init();
  expect(restored.domainInitError('integrations')).toBeUndefined();
  expect(await restoredCredentials.getCredential({ orgId: 'org1', userId: 'user-a' }, 'openai')).toEqual({
    type: 'api_key',
    key: 'sk-x',
  });
  await restored.close();

  rmSync(dir, { recursive: true, force: true });
});
