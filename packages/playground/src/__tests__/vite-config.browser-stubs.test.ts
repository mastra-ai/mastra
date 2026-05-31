// Regression guard for the Studio DEV server startup.
//
// @mastra/core dist top-level-imports server-only npm packages (posthog-node, dotenv, ws) AND Node
// builtins (crypto, fs, os, ...) from browser-reachable subpaths. Served as native ESM in dev, these
// crash at module eval before React renders: the npm packages aren't browser-resolvable, and Node
// builtins are externalized to a throwing proxy, so `import { createHash } from 'crypto'` throws on
// access. The fix is a dev-active enforce:'pre' plugin that resolves each to a no-op stub exporting
// the exact names the graph imports (native ESM ignores Rollup's syntheticNamedExports), plus
// optimizeDeps.exclude for the npm packages so esbuild never pre-bundles the real module. This test
// locks both halves in place.
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

// npm packages that must be both optimizeDeps-excluded and stubbed in dev, mapped to the named
// exports the browser graph imports from them. Add an entry whenever a new one surfaces.
const stubbedPackages: Record<string, string[]> = {
  '@standard-schema/spec': [],
  'posthog-node': ['PostHog'],
  dotenv: ['config', 'parse'],
  ws: ['WebSocket'],
};
const stubbedPackageNames = Object.keys(stubbedPackages);

// A representative Node builtin + named export that @mastra/core dist imports at module eval
// (chunk-APVSRINN.js: `import { createHash } from 'crypto'`). If the dev stub stops covering
// builtins, this import throws and Studio fails to start.
const builtinChecks: Array<[string, string]> = [
  ['crypto', 'createHash'],
  ['fs', 'readFileSync'],
  ['path', 'join'],
];

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

const devStubPlugin = (config: Awaited<ReturnType<typeof resolveDevConfig>>) =>
  (config.plugins as Plugin[]).find(p => p?.name === 'stub-browser-packages');

const loadStub = async (owner: Plugin, source: string) => {
  const resolved = await asFn(owner.resolveId)?.call({}, source, undefined, { isEntry: false });
  const stubId = typeof resolved === 'string' ? resolved : (resolved as { id?: string })?.id;
  if (!stubId) return undefined;
  const loaded = await asFn(owner.load)?.call({}, stubId);
  return typeof loaded === 'string' ? loaded : (loaded as { code?: string })?.code ?? '';
};

describe('vite.config browser stubs (Studio dev startup regression guard)', () => {
  it('excludes the server-only / empty packages from dep pre-bundling', async () => {
    const config = await resolveDevConfig();
    const exclude = config.optimizeDeps?.exclude ?? [];
    for (const pkg of stubbedPackageNames) {
      expect(exclude, `optimizeDeps.exclude must contain "${pkg}"`).toContain(pkg);
    }
  });

  it('exposes a dev-active stub plugin (build-only stubs do not run in serve)', async () => {
    const config = await resolveDevConfig();
    expect(devStubPlugin(config), 'stub-browser-packages must be present in the serve config').toBeTruthy();
  });

  it.each(stubbedPackageNames)('stubs npm package "%s" with the named exports the graph imports', async pkg => {
    const config = await resolveDevConfig();
    const code = await loadStub(devStubPlugin(config)!, pkg);
    expect(code, `stub-browser-packages did not resolve "${pkg}"`).toBeTruthy();
    // Dev serves native ESM, so the stub must declare a real default plus each imported name —
    // syntheticNamedExports (a Rollup-only feature) does NOT work here.
    expect(code, `stub for "${pkg}" must export a default`).toContain('export default');
    for (const name of stubbedPackages[pkg]) {
      expect(code, `stub for "${pkg}" must export "${name}"`).toContain(`export const ${name} `);
    }
  });

  it.each(builtinChecks)('stubs Node builtin "%s" with named export "%s"', async (builtin, name) => {
    const config = await resolveDevConfig();
    const code = await loadStub(devStubPlugin(config)!, builtin);
    expect(code, `stub-browser-packages did not resolve builtin "${builtin}"`).toBeTruthy();
    expect(code, `stub for "${builtin}" must export a default`).toContain('export default');
    expect(code, `stub for "${builtin}" must export "${name}" (native ESM needs the real name)`).toContain(
      `export const ${name} `,
    );
  });
});
