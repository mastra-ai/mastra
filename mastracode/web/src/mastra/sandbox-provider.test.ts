import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isFactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import type * as factoryModule from '@mastra/factory';

const factoryConfigs = vi.hoisted(() => [] as Array<ConstructorParameters<typeof factoryModule.MastraFactory>[0]>);
vi.mock('@mastra/factory', async importOriginal => {
  const actual = await importOriginal<typeof factoryModule>();
  class TrackedMastraFactory extends actual.MastraFactory {
    constructor(config: ConstructorParameters<typeof actual.MastraFactory>[0]) {
      super(config);
      factoryConfigs.push(config);
    }
  }
  return { ...actual, MastraFactory: TrackedMastraFactory };
});

/**
 * Sandbox selection lives inline in the entry, which hands the factory one
 * host `FactorySandbox` chosen at boot, because `src/mastra/index.ts` is
 * copied verbatim into the create-factory template (scripts/sync-template.mjs)
 * — the entry must stay a single self-contained file. These tests boot the
 * real entry and create session sandboxes from that host object directly.
 *
 * Provider precedence: forced local > Platform (the factory picks the sandbox)
 * > E2B > Local.
 */
describe('entry host sandbox (src/mastra/index.ts)', () => {
  beforeEach(() => {
    for (const name of [
      'MASTRACODE_AUTH_DISABLED',
      'WORKOS_API_KEY',
      'WORKOS_CLIENT_ID',
      'WORKOS_COOKIE_PASSWORD',
      'MASTRA_SHARED_API_URL',
      'MASTRA_PLATFORM_SECRET_KEY',
      'MASTRA_PLATFORM_ACCESS_TOKEN',
      'MASTRA_CLOUD_ACCESS_TOKEN',
      'MASTRA_ENVIRONMENT_ID',
      'DATABASE_URL',
      'APP_DATABASE_URL',
      'REDIS_URL',
      'GITHUB_APP_ID',
      'GITHUB_APP_PRIVATE_KEY',
      'GITHUB_APP_CLIENT_ID',
      'GITHUB_APP_CLIENT_SECRET',
      'GITHUB_APP_SLUG',
      'GITHUB_APP_WEBHOOK_SECRET',
      'LINEAR_CLIENT_ID',
      'LINEAR_CLIENT_SECRET',
      'SLACK_APP_SIGNING_SECRET',
      'MASTRACODE_DISPATCH_MAX_IN_FLIGHT',
      'E2B_API_KEY',
      'SANDBOX_PROVIDER',
      'FACTORY_SANDBOX_PROVIDER',
    ]) {
      vi.stubEnv(name, '');
    }
    vi.stubEnv('MASTRA_PROJECT_ID', 'test-project');
    factoryConfigs.length = 0;
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /**
   * Boots the entry and returns a session-sandbox constructor backed by the
   * host `FactorySandbox` it configured, called the way factory calls it:
   * with the session context and the provider's default (empty) settings.
   */
  async function importSandboxCallback() {
    await import('./index.js');
    expect(factoryConfigs).toHaveLength(1);
    const host = factoryConfigs[0]?.sandbox;
    if (!isFactorySandbox(host)) throw new Error('entry factory config has no FactorySandbox');
    return (ctx: Partial<FactorySandboxContext> & { sessionId: string }) =>
      host.create({ getRepositoryAccess: undefined, ...ctx }, {});
  }

  /** Boots the entry and returns the `sandbox` it handed the factory. */
  async function importHostSandbox() {
    await import('./index.js');
    expect(factoryConfigs).toHaveLength(1);
    return factoryConfigs[0]?.sandbox;
  }

  it.each([
    ['jwt_platform', ''],
    ['', 'sk_secret'],
  ])(
    'leaves the sandbox to the factory with access token %j and secret key %j, even with E2B configured',
    { timeout: 60_000 },
    async (token, key) => {
      vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', token);
      vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', key);
      vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'environment-1');
      vi.stubEnv('E2B_API_KEY', 'direct-e2b-must-not-win');

      // The factory installs its own: local under `mastra dev`, Platform in
      // built deployments (covered by @mastra/factory's prepare tests).
      expect(await importHostSandbox()).toBeUndefined();
    },
  );

  it('requires an environment ID even with a secret key', { timeout: 60_000 }, async () => {
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_secret');
    const callback = await importSandboxCallback();

    expect(callback({ sessionId: 'session-no-env' })).toMatchObject({ provider: 'local' });
  });

  it('honors the local override even with all cloud credentials configured', { timeout: 60_000 }, async () => {
    vi.stubEnv('FACTORY_SANDBOX_PROVIDER', 'local');
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'jwt_platform');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_secret');
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'environment-1');
    vi.stubEnv('E2B_API_KEY', 'direct-e2b');
    const callback = await importSandboxCallback();

    expect(callback({ sessionId: 'session-local' })).toMatchObject({ provider: 'local' });
  });

  it('honors the local override when only direct E2B is configured', { timeout: 60_000 }, async () => {
    vi.stubEnv('FACTORY_SANDBOX_PROVIDER', 'local');
    vi.stubEnv('SANDBOX_PROVIDER', 'railway');
    vi.stubEnv('E2B_API_KEY', 'direct-e2b');
    const callback = await importSandboxCallback();

    expect(callback({ sessionId: 'session-local-e2b' })).toMatchObject({ provider: 'local' });
  });

  it('selects direct E2BSandbox when only E2B_API_KEY is configured', { timeout: 60_000 }, async () => {
    vi.stubEnv('E2B_API_KEY', 'direct-e2b');
    const callback = await importSandboxCallback();

    const sandbox = callback({ sessionId: 'session-2', repoFullName: 'acme/widgets' });

    expect(sandbox).toMatchObject({ provider: 'e2b' });
    expect(sandbox).toMatchObject({ id: 'session-2' });
  });

  it(
    'falls back to a per-session LocalSandbox when no remote provider is configured',
    { timeout: 60_000 },
    async () => {
      const callback = await importSandboxCallback();

      const sandbox = callback({ sessionId: 'session-3' });

      expect(sandbox).toMatchObject({ provider: 'local' });
    },
  );
});
