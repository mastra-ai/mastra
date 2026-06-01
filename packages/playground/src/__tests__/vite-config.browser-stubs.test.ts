// Regression guard for the Studio DEV server startup.
//
// @mastra/core dist top-level-imports server-only npm packages (posthog-node, dotenv, ws) AND Node
// builtins (crypto, fs, stream, ...) from browser-reachable subpaths. Served as native ESM in dev,
// these crash at module eval before React renders: the npm packages aren't browser-resolvable, and a
// Node builtin is externalized to a throwing proxy, so `import { createHash } from 'crypto'` throws on
// access. The fix is a dev-active enforce:'pre' plugin that resolves each to a no-op stub exporting
// the names the graph imports (native ESM ignores the build plugin's Rollup syntheticNamedExports).
// Builtin stubs derive their named exports from the REAL module, so any named import — including
// subpath ones like node:stream/web (ReadableStream) and node:fs/promises (mkdtemp) — resolves.
//
// It calls Vite's resolveConfig() in serve/development mode — the exact dev path — which neither
// optimizes nor writes to node_modules/.vite, so it is fast, CI-safe, and cannot disturb a running
// dev server.
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveConfig } from 'vite';
import type { Plugin } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
// Import the single source of truth so the npm-package map can't silently drift from the config.
import { browserStubPackages } from '../../vite.config';

const playgroundRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const stubbedPackageNames = Object.keys(browserStubPackages);

// Node builtin specifiers @mastra/core's dist imports from browser-reachable subpaths, each paired
// with a representative named export that MUST resolve. Subpaths matter: node:stream/web and
// node:fs/promises carry different exports than their base module, and a missing name is a hard
// module-eval SyntaxError in dev (native ESM) — the exact crash this stub exists to prevent.
const builtinSpecifiers = ['crypto', 'fs', 'fs/promises', 'os', 'path', 'stream', 'stream/web', 'string_decoder'];
const builtinMustExport: Array<[string, string]> = [
  ['crypto', 'createHash'],
  ['fs', 'readFileSync'],
  ['fs/promises', 'mkdtemp'],
  ['path', 'join'],
  ['stream', 'Readable'],
  ['stream/web', 'ReadableStream'],
  ['string_decoder', 'StringDecoder'],
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
  (config.plugins as Plugin[]).find(p => p?.name === 'stub-browser-packages')!;

// Drive the plugin's resolveId then load in isolation (the hooks are pure functions of their id arg).
const loadStub = async (owner: Plugin, source: string) => {
  const resolved = await asFn(owner.resolveId)?.call({}, source, undefined, { isEntry: false });
  const stubId = typeof resolved === 'string' ? resolved : (resolved as { id?: string })?.id;
  if (!stubId) return undefined;
  const loaded = await asFn(owner.load)?.call({}, stubId);
  return typeof loaded === 'string' ? loaded : ((loaded as { code?: string })?.code ?? '');
};

const exportedNames = (code: string) => [...code.matchAll(/export const ([A-Za-z_$][\w$]*) =/g)].map(m => m[1]);

const tmpFiles: string[] = [];
// Evaluate the emitted stub as a real ES module and return its live namespace.
const evalStub = async (code: string) => {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-stub-'));
  const file = join(dir, 'stub.mjs');
  await writeFile(file, code);
  tmpFiles.push(file);
  return import(/* @vite-ignore */ pathToFileURL(file).href);
};

afterAll(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(tmpFiles.map(f => rm(dirname(f), { recursive: true, force: true })));
});

describe('vite.config browser stubs (Studio dev startup regression guard)', () => {
  it('excludes the server-only / empty npm packages from dep pre-bundling', async () => {
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
    const code = await loadStub(devStubPlugin(config), pkg);
    expect(code, `stub-browser-packages did not resolve "${pkg}"`).toBeTruthy();
    // Dev serves native ESM, so the stub must declare a real default plus each imported name.
    expect(code, `stub for "${pkg}" must export a default`).toContain('export default');
    for (const name of browserStubPackages[pkg]) {
      expect(exportedNames(code!), `stub for "${pkg}" must export "${name}"`).toContain(name);
    }
  });

  it.each(builtinMustExport)('stubs Node builtin "%s" with the value-named export "%s"', async (specifier, name) => {
    const config = await resolveDevConfig();
    const code = await loadStub(devStubPlugin(config), `node:${specifier}`);
    expect(code, `stub-browser-packages did not resolve builtin "${specifier}"`).toBeTruthy();
    expect(code, `stub for "${specifier}" must export a default`).toContain('export default');
    expect(
      exportedNames(code!),
      `stub for "${specifier}" must export "${name}" (native ESM needs the real name)`,
    ).toContain(name);
  });

  // The whole point of deriving exports from the real module: the stub covers EVERY named export the
  // builtin has, so a new @mastra/core import can never reintroduce the "does not provide an export" crash.
  it.each(builtinSpecifiers)('stub for builtin "%s" covers every named export of the real module', async specifier => {
    const config = await resolveDevConfig();
    const code = await loadStub(devStubPlugin(config), `node:${specifier}`);
    const real = (await import(/* @vite-ignore */ `node:${specifier}`)) as Record<string, unknown>;
    const realNames = Object.keys(real).filter(n => n !== 'default' && /^[A-Za-z_$][\w$]*$/.test(n));
    expect(realNames.length, `expected node:${specifier} to expose named exports`).toBeGreaterThan(0);
    expect(exportedNames(code!)).toEqual(expect.arrayContaining(realNames));
  });

  it('emits chainable no-op proxies (default and named exports behave, not just look, right)', async () => {
    const config = await resolveDevConfig();
    const cryptoStub = await evalStub((await loadStub(devStubPlugin(config), 'node:crypto'))!);
    // default is callable and constructable without throwing...
    expect(typeof cryptoStub.default).toBe('function');
    expect(() => new cryptoStub.default()).not.toThrow();
    // ...and a named export chains as a no-op so dead code like createHash(x).update(y).digest(z) can't throw.
    expect(cryptoStub.createHash('a').update('b').digest('c')).toBe(cryptoStub.default);

    const posthogStub = await evalStub((await loadStub(devStubPlugin(config), 'posthog-node'))!);
    expect(typeof posthogStub.PostHog).toBe('function');
    expect(() => new posthogStub.PostHog({ apiKey: 'x' }).capture({})).not.toThrow();
  });
});
