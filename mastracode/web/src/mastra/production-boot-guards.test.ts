import type * as factoryModule from '@mastra/factory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const factoryConfigs = vi.hoisted(() => [] as Array<ConstructorParameters<typeof factoryModule.MastraFactory>[0]>);
vi.mock('@mastra/factory', async importOriginal => {
  const actual = await importOriginal<typeof factoryModule>();
  // Records the config the entry builds. Boot itself is skipped: production
  // mode needs DATABASE_URL, and these tests check what the entry decides to
  // configure before the database is ever touched.
  class RecordedMastraFactory extends actual.MastraFactory {
    constructor(config: ConstructorParameters<typeof actual.MastraFactory>[0]) {
      super(config);
      factoryConfigs.push(config);
    }
    override async prepare() {
      return {} as Awaited<ReturnType<factoryModule.MastraFactory['prepare']>>;
    }
    override async finalize() {}
  }
  return { ...actual, MastraFactory: RecordedMastraFactory };
});

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

/**
 * Outside development and tests the entry refuses to boot when a security
 * requirement is missing, the same way it already does for DATABASE_URL:
 * credential encryption and an isolated sandbox provider each need either
 * their configuration or an explicit opt-out.
 */
describe('production boot guards (src/mastra/index.ts)', () => {
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
      'APP_DATABASE_URL',
      'REDIS_URL',
      'GITHUB_APP_ID',
      'GITHUB_APP_PRIVATE_KEY',
      'GITHUB_APP_CLIENT_ID',
      'GITHUB_APP_CLIENT_SECRET',
      'GITHUB_APP_SLUG',
      'GITHUB_APP_WEBHOOK_SECRET',
      'GITLAB_ACCESS_TOKEN',
      'LINEAR_CLIENT_ID',
      'LINEAR_CLIENT_SECRET',
      'INCIDENT_IO_API_KEY',
      'SLACK_APP_SIGNING_SECRET',
      'E2B_API_KEY',
      'SANDBOX_PROVIDER',
      'FACTORY_SANDBOX_PROVIDER',
      'FACTORY_CREDENTIAL_ENCRYPTION',
      'FACTORY_CREDENTIAL_ENCRYPTION_KEY',
      'FACTORY_CREDENTIAL_ENCRYPTION_KEY_ID',
      'FACTORY_CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS',
    ]) {
      vi.stubEnv(name, '');
    }
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgres://factory:factory@127.0.0.1:1/factory');
    vi.stubEnv('MASTRA_PROJECT_ID', 'test-project');
    factoryConfigs.length = 0;
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function bootedConfig() {
    await import('./index.js');
    expect(factoryConfigs).toHaveLength(1);
    return factoryConfigs[0]!;
  }

  it('refuses to boot without a credential encryption key', { timeout: 60_000 }, async () => {
    vi.stubEnv('E2B_API_KEY', 'e2b-key');

    await expect(import('./index.js')).rejects.toThrow(/FACTORY_CREDENTIAL_ENCRYPTION_KEY is required/);
    expect(factoryConfigs).toHaveLength(0);
  });

  it('refuses to boot when sandboxes would fall back to the host', { timeout: 60_000 }, async () => {
    vi.stubEnv('FACTORY_CREDENTIAL_ENCRYPTION_KEY', ENCRYPTION_KEY);

    await expect(import('./index.js')).rejects.toThrow(/FACTORY_SANDBOX_PROVIDER=local/);
    expect(factoryConfigs).toHaveLength(0);
  });

  it('boots with encryption and an isolated provider configured', { timeout: 60_000 }, async () => {
    vi.stubEnv('FACTORY_CREDENTIAL_ENCRYPTION_KEY', ENCRYPTION_KEY);
    vi.stubEnv('E2B_API_KEY', 'e2b-key');

    const config = await bootedConfig();

    expect(config.secretEncryption).toBeDefined();
    expect(config.sandbox).toMatchObject({ provider: 'e2b' });
  });

  it('boots with plaintext credentials and host sandboxes when both are opted into', { timeout: 60_000 }, async () => {
    vi.stubEnv('FACTORY_CREDENTIAL_ENCRYPTION', 'plaintext');
    vi.stubEnv('FACTORY_SANDBOX_PROVIDER', 'local');

    const config = await bootedConfig();

    expect(config.secretEncryption).toBeUndefined();
    expect(config.sandbox).toMatchObject({ provider: 'local' });
  });

  it('keeps the development fallbacks', { timeout: 60_000 }, async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', '');

    const config = await bootedConfig();

    expect(config.secretEncryption).toBeUndefined();
    expect(config.sandbox).toMatchObject({ provider: 'local' });
  });
});
