// Regression guard for the Studio DEV server startup.
//
// @mastra/core dist top-level-imports server-only packages (posthog-node, dotenv, ws) from
// browser-reachable subpaths. esbuild's optimizeDeps pre-bundles them into the dev browser graph,
// and posthog-node's module body reads process.argv[1] at eval time — but vite.config defines
// `process` as { env: {} }, so it throws "Cannot read properties of undefined (reading '1')" and
// Studio dies before React renders. The fix excludes them from optimizeDeps AND maps each bare
// specifier to an empty stub via a DEV-active enforce:'pre' plugin (the build-only stub does not
// run in serve mode). This test locks both halves in place.
//
// It calls Vite's resolveConfig() in serve/development mode — the exact dev path — which neither
// optimizes nor writes to node_modules/.vite, so it is fast, CI-safe, and cannot disturb a running
// dev server.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';

const playgroundRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// npm packages that must be both optimizeDeps-excluded and stubbed-to-empty in dev. Add to this
// list whenever a new server-only dep is found leaking into the browser bundle.
const stubbedPackages = ['@standard-schema/spec', 'posthog-node', 'dotenv', 'ws'];

const resolveDevConfig = () =>
  resolveConfig(
    { root: playgroundRoot, configFile: resolve(playgroundRoot, 'vite.config.ts'), logLevel: 'silent' },
    'serve',
    'development',
    'development',
  );

// resolveId/load may be a bare function or a Rollup `{ handler }` object.
const asFn = (hook: unknown) =>
  typeof hook === 'function' ? hook : (hook as { handler?: (...a: unknown[]) => unknown })?.handler;

describe('vite.config browser stubs (Studio dev startup regression guard)', () => {
  it('excludes the server-only / empty packages from dep pre-bundling', async () => {
    const config = await resolveDevConfig();
    const exclude = config.optimizeDeps?.exclude ?? [];
    for (const pkg of stubbedPackages) {
      expect(exclude, `optimizeDeps.exclude must contain "${pkg}"`).toContain(pkg);
    }
  });

  it.each(stubbedPackages)('stubs "%s" to an empty module via a dev-active plugin', async pkg => {
    const config = await resolveDevConfig();
    // Our dev stub. Vite drops apply:'build' plugins from a serve config, so the build-only
    // stub-node-builtins plugin is absent here — only a genuinely dev-active stub can satisfy this.
    const owner = (config.plugins as Plugin[]).find(p => p?.name === 'stub-browser-packages');
    expect(owner, 'stub-browser-packages plugin must be present in the dev (serve) config').toBeTruthy();

    const resolved = await asFn(owner!.resolveId)?.call({}, pkg, undefined, { isEntry: false });
    const stubId = typeof resolved === 'string' ? resolved : (resolved as { id?: string })?.id;
    expect(stubId, `stub-browser-packages did not resolve "${pkg}"`).toBeTruthy();

    const loaded = await asFn(owner!.load)?.call({}, stubId);
    const code = typeof loaded === 'string' ? loaded : (loaded as { code?: string })?.code;
    const synthetic =
      typeof loaded === 'string' ? undefined : (loaded as { syntheticNamedExports?: boolean })?.syntheticNamedExports;

    expect(code, `stub for "${pkg}" must export a default`).toContain('export default');
    // syntheticNamedExports lets named imports (e.g. `{ PostHog }`) resolve against the empty default.
    expect(synthetic, `stub for "${pkg}" must set syntheticNamedExports`).toBe(true);
  });
});
