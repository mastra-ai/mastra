import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
 * Sandbox selection lives inline in the entry's `sandbox` callback because
 * `src/mastra/index.ts` is copied verbatim into the create-factory template
 * (scripts/sync-template.mjs) — the entry must stay a single self-contained
 * file. These tests boot the real entry and exercise that callback directly.
 *
 * Provider precedence: Platform > E2B > Local. Template *definitions* are
 * covered by `@mastra/platform-workspace` repo-template tests; here we pin
 * which provider is selected and what session context is forwarded.
 */
describe('entry sandbox callback (src/mastra/index.ts)', () => {
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

  async function importSandboxCallback() {
    await import('./index.js');
    expect(factoryConfigs).toHaveLength(1);
    const sandbox = factoryConfigs[0]?.sandbox;
    if (typeof sandbox !== 'function') throw new Error('entry factory config has no sandbox callback');
    return sandbox;
  }

  it('prefers PlatformSandbox over direct E2B and forwards session context', { timeout: 60_000 }, async () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', 'sk_platform');
    vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'environment-1');
    vi.stubEnv('E2B_API_KEY', 'direct-e2b-must-not-win');
    const callback = await importSandboxCallback();

    const sandbox = callback({
      sessionId: 'session-1',
      repoFullName: 'acme/widgets',
      setupCommand: 'pnpm install',
      getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/widgets.git' }),
    });

    // `vi.resetModules()` reloads the entry's module graph, so provider classes
    // have a fresh identity — assert on the stable `provider` discriminator.
    expect(sandbox).toMatchObject({ provider: 'platform' });
    expect(sandbox).toMatchObject({ id: 'session-1' });
    // Session setup is not the callback's job: factory attaches it to the
    // returned sandbox with setOnStart, so no onStart forwarding happens here.
    expect((sandbox as unknown as { _onStart?: unknown })._onStart).toBeUndefined();
    // A repo-backed session carries a lazy template resolver; no work happens
    // until start().
    expect((sandbox as unknown as { _template?: unknown })._template).toBeDefined();
  });

  it(
    'does not select PlatformSandbox on MASTRA_PLATFORM_SECRET_KEY alone (integrations credential, not the sandbox one)',
    { timeout: 60_000 },
    async () => {
      vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'sk_secret');
      vi.stubEnv('MASTRA_ENVIRONMENT_ID', 'environment-1');
      vi.stubEnv('E2B_API_KEY', 'direct-e2b');
      const callback = await importSandboxCallback();

      const sandbox = callback({ sessionId: 'session-sk', repoFullName: 'acme/widgets' });

      expect(sandbox).toMatchObject({ provider: 'e2b' });
    },
  );

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
