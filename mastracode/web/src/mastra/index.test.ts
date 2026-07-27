import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Smoke test for the platform-deployable entry (`src/mastra/index.ts`).
 *
 * Importing the module boots the real controller via top-level await and
 * constructs the server-owned Mastra. We assert the deployer-facing surface:
 * the module exports a `mastra` instance and that instance carries the web
 * `apiRoutes` (auth + `/web/*`) the deployer's generated Hono server mounts.
 *
 * Web auth is left disabled (no WORKOS_* env), so there is no gate/dispatcher
 * middleware and no auth routes — matching the "auth disabled" branch of the
 * entry. The custom `/web/*` routes are still present.
 */
describe('platform entry (src/mastra/index.ts)', () => {
  it('exports a booted Mastra with the web apiRoutes folded onto server config', { timeout: 60_000 }, async () => {
    const mod = await import('./index.js');

    expect(mod.mastra).toBeDefined();
    // The deployer imports this named export and generates its Hono server from it.
    expect(typeof mod.mastra.getServer).toBe('function');

    const server = mod.mastra.getServer();
    expect(server).toBeDefined();

    // The custom web surface must ride along on `server.apiRoutes` so the
    // deployer-generated server exposes it. At minimum the fs `/web/*` routes
    // are always assembled (github is fail-soft, auth routes are gated).
    const apiRoutes = server?.apiRoutes ?? [];
    const paths = apiRoutes.map(r => r.path);
    expect(paths.some(p => p.startsWith('/web/'))).toBe(true);
  });

  // Integration env groups are all-or-nothing: setting ANY var of a group
  // means you intend to enable the integration, so a partial set must fail
  // the boot loudly (listing what's missing) instead of silently disabling.
  describe('integration env groups', () => {
    beforeEach(() => {
      for (const name of [
        'GITHUB_APP_ID',
        'GITHUB_APP_PRIVATE_KEY',
        'GITHUB_APP_CLIENT_ID',
        'GITHUB_APP_CLIENT_SECRET',
        'GITHUB_APP_SLUG',
        'GITHUB_APP_WEBHOOK_SECRET',
        'LINEAR_CLIENT_ID',
        'LINEAR_CLIENT_SECRET',
      ]) {
        vi.stubEnv(name, '');
      }
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it(
      'boots when the GitHub group is partially configured so diagnostics can report the missing setup',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        // The test env may carry a full GitHub config — blank everything but the
        // app id to force the partial state.
        vi.stubEnv('GITHUB_APP_ID', '12345');
        vi.stubEnv('GITHUB_APP_PRIVATE_KEY', '');
        vi.stubEnv('GITHUB_APP_CLIENT_ID', '');
        vi.stubEnv('GITHUB_APP_CLIENT_SECRET', '');
        vi.stubEnv('GITHUB_APP_SLUG', '');
        const mod = await import('./index.js');
        expect(mod.mastra).toBeDefined();
      },
    );

    it(
      'registers the direct GitHub App integration when the full group is configured',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        // No platform identity in this env, so the only source of a GitHub
        // connection is the direct GITHUB_APP_* group wired in the entry.
        vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
        vi.stubEnv('GITHUB_APP_ID', '12345');
        vi.stubEnv('GITHUB_APP_PRIVATE_KEY', 'test-private-key');
        vi.stubEnv('GITHUB_APP_CLIENT_ID', 'Iv1.client');
        vi.stubEnv('GITHUB_APP_CLIENT_SECRET', 'client-secret');
        vi.stubEnv('GITHUB_APP_SLUG', 'test-app');
        vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', 'webhook-secret');
        const mod = await import('./index.js');
        const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
        // The connect route is registered only by the GithubIntegration, so its
        // presence proves the direct fallback wired the integration onto the factory.
        expect(paths).toContain('/auth/github/connect');
      },
    );

    it(
      'boots when the Linear group is partially configured so diagnostics can report the missing setup',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('LINEAR_CLIENT_ID', 'lin_client');
        vi.stubEnv('LINEAR_CLIENT_SECRET', '');
        const mod = await import('./index.js');
        expect(mod.mastra).toBeDefined();
      },
    );

    it('registers the direct Linear integration when the full group is configured', { timeout: 60_000 }, async () => {
      vi.resetModules();
      vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
      vi.stubEnv('WORKOS_COOKIE_PASSWORD', 'stable-state-secret');
      vi.stubEnv('LINEAR_CLIENT_ID', 'lin_client');
      vi.stubEnv('LINEAR_CLIENT_SECRET', 'linear-secret');
      const mod = await import('./index.js');
      const paths = mod.mastra.getServer()?.apiRoutes?.map(route => route.path) ?? [];
      expect(paths).toContain('/auth/linear/connect');
    });

    it('skips Slack channel wiring when the Slack app env is unset', { timeout: 60_000 }, async () => {
      vi.resetModules();
      // chat's Slack adapter throws at construction without a signingSecret,
      // so an unconfigured env must skip channels instead of crashing boot.
      vi.stubEnv('SLACK_APP_SIGNING_SECRET', '');
      const mod = await import('./index.js');
      const controller = mod.mastra.getAgentController('code');
      expect(controller?.getChannels()).toBeNull();
    });

    it(
      'wires Slack channels onto the controller when the Slack app env is configured',
      { timeout: 60_000 },
      async () => {
        vi.resetModules();
        vi.stubEnv('SLACK_APP_SIGNING_SECRET', 'test-signing-secret');
        const mod = await import('./index.js');
        const controller = mod.mastra.getAgentController('code');
        expect(controller?.getChannels()).not.toBeNull();
      },
    );
  });
});
