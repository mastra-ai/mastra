import { describe, it, expect } from 'vitest';

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
});
