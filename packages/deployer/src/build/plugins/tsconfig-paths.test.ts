import fs from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { Plugin, PluginContext, ResolveIdExtraOptions } from 'rolldown';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tsConfigPaths, hasPaths } from './tsconfig-paths';

describe('tsconfig-paths plugin', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(_dirname, '__fixtures__');

  describe('hasPaths - JSONC parsing', () => {
    let tempDir: string;

    beforeEach(() => {
      // Create a temporary directory for test files
      tempDir = fs.mkdtempSync(join(os.tmpdir(), 'mastra-test-'));
    });

    afterEach(() => {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should detect paths in tsconfig.json without comments', () => {
      // Copy the no-comments fixture to temp dir
      const tsConfigContent = fs.readFileSync(join(fixturesDir, 'tsconfig-no-comments.json'), 'utf-8');
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, tsConfigContent);

      // hasPaths should return true for a valid tsconfig with paths
      expect(hasPaths(tsConfigPath)).toBe(true);
    });

    /**
     * This test demonstrates the bug from issue #10942:
     * When tsconfig.json contains JSONC comments, JSON.parse() fails silently
     * and hasPaths() returns false even though paths are configured.
     *
     * @see https://github.com/mastra-ai/mastra/issues/10942
     */
    it('should detect paths in tsconfig.json WITH JSONC comments (issue #10942)', () => {
      // Copy the with-comments fixture to temp dir
      const tsConfigContent = fs.readFileSync(join(fixturesDir, 'tsconfig-with-comments.json'), 'utf-8');
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, tsConfigContent);

      // hasPaths should return true even with JSONC comments
      // Currently this FAILS because JSON.parse can't handle JSONC comments
      expect(hasPaths(tsConfigPath)).toBe(true);
    });

    it('should return false when tsconfig.json has no paths configured', () => {
      // Copy the no-paths fixture to temp dir
      const tsConfigContent = fs.readFileSync(join(fixturesDir, 'tsconfig-no-paths.json'), 'utf-8');
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, tsConfigContent);

      // hasPaths should return false when no paths are configured
      expect(hasPaths(tsConfigPath)).toBe(false);
    });

    it('should return false for non-existent tsconfig.json', () => {
      const tsConfigPath = join(tempDir, 'non-existent.json');
      expect(hasPaths(tsConfigPath)).toBe(false);
    });

    it('should detect paths in tsconfig.json that extends another config', () => {
      // Create base config with paths
      const baseConfig = JSON.stringify({
        compilerOptions: {
          paths: {
            '@lib/*': ['src/lib/*'],
          },
        },
      });
      fs.writeFileSync(join(tempDir, 'tsconfig.base.json'), baseConfig);

      // Create extended config
      const extendedConfig = JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: {},
      });
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, extendedConfig);

      // hasPaths should return true because it extends a config (optimistic check)
      expect(hasPaths(tsConfigPath)).toBe(true);
    });
  });

  describe('plugin integration', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(join(os.tmpdir(), 'mastra-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('resolves aliases from the exact explicit config file', async () => {
      const tsConfigPath = join(tempDir, 'tsconfig.custom.json');
      fs.writeFileSync(
        tsConfigPath,
        `{
          // Explicit configs can be JSONC and do not need to be named tsconfig.json.
          "compilerOptions": {
            "baseUrl": ".",
            "paths": {
              "@src/*": ["src/*"]
            }
          }
        }`,
      );

      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(join(srcDir, 'utils.ts'), `export const hello = 'world';`);
      fs.writeFileSync(join(srcDir, 'index.ts'), `import { hello } from '@src/utils';\nconsole.log(hello);`);

      const bundle = await rolldown({
        logLevel: 'silent',
        input: join(srcDir, 'index.ts'),
        plugins: [tsConfigPaths({ tsConfigPath })],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].code).not.toContain(`'@src/utils'`);
      expect(result.output[0].code).toContain('world');
    });

    it('does not let paths configuration shadow ordinary package imports', async () => {
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(
        tsConfigPath,
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@src/*': ['src/*'],
            },
          },
        }),
      );

      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(join(tempDir, 'utils.ts'), `export const source = 'local';`);
      const packageFile = join(tempDir, 'utils-package.ts');
      fs.writeFileSync(packageFile, `export const source = 'package';`);
      const indexFile = join(srcDir, 'index.ts');
      fs.writeFileSync(indexFile, `import { source } from 'utils';\nconsole.log(source);`);

      const bundle = await rolldown({
        logLevel: 'silent',
        input: indexFile,
        plugins: [
          tsConfigPaths({ tsConfigPath }),
          {
            name: 'package-resolver',
            resolveId(id) {
              return id === 'utils' ? packageFile : null;
            },
          },
        ],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].code).toContain('package');
      expect(result.output[0].code).not.toContain('local');
    });

    it('resolves inherited aliases relative to the config that defines them', async () => {
      const appDir = join(tempDir, 'apps', 'app');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        join(tempDir, 'tsconfig.base.json'),
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@lib/*': ['./lib/*'],
            },
          },
        }),
      );
      const tsConfigPath = join(appDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, JSON.stringify({ extends: '../../tsconfig.base.json' }));

      fs.mkdirSync(join(tempDir, 'lib'), { recursive: true });
      fs.writeFileSync(join(tempDir, 'lib', 'utils.ts'), `export const value = 42;`);
      const indexFile = join(appDir, 'index.ts');
      fs.writeFileSync(indexFile, `import { value } from '@lib/utils';\nconsole.log(value);`);

      const bundle = await rolldown({
        logLevel: 'silent',
        input: indexFile,
        plugins: [tsConfigPaths({ tsConfigPath })],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].code).toContain('42');
      expect(result.output[0].code).not.toContain(`'@lib/utils'`);
    });

    it('should resolve aliases from extended tsconfig', async () => {
      // Create base config
      const baseConfig = JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@lib/*': ['lib/*'],
          },
        },
      });
      fs.writeFileSync(join(tempDir, 'tsconfig.base.json'), baseConfig);

      // Create extended config
      const extendedConfig = JSON.stringify({
        extends: './tsconfig.base.json',
      });
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, extendedConfig);

      // Create source files
      fs.mkdirSync(join(tempDir, 'lib'), { recursive: true });
      const libFile = join(tempDir, 'lib/utils.ts');
      fs.writeFileSync(libFile, `export const value = 42;`);

      const indexFile = join(tempDir, 'index.ts');
      fs.writeFileSync(indexFile, `import { value } from '@lib/utils';\nconsole.log(value);`);

      // Create plugin
      const plugin = tsConfigPaths({ tsConfigPath });

      // Build using rolldown
      const bundle = await rolldown({
        logLevel: 'silent',
        input: indexFile,
        plugins: [
          plugin,
          {
            name: 'mock-resolver',
            resolveId(id) {
              const normalized = id.replaceAll('\\', '/');
              if (normalized.endsWith('/lib/utils') || normalized.endsWith('/lib/utils.ts')) {
                return { id: libFile, external: false };
              }
              return null;
            },
            load(id) {
              if (id === libFile) return `export const value = 42;`;
              if (id === indexFile) return `import { value } from '@lib/utils';\nconsole.log(value);`;
              return null;
            },
          },
        ],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].code).not.toContain(`'@lib/utils'`);
      expect(result.output[0].code).toContain(42);
    });

    it('should resolve .js alias imports to TypeScript source files', async () => {
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(
        tsConfigPath,
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '~/*': ['src/*'],
            },
          },
        }),
      );

      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(join(srcDir, 'utils'), { recursive: true });
      const utilityFile = join(srcDir, 'utils', 'build-flags.ts');
      fs.writeFileSync(utilityFile, `export const loggerName = 'Mastra';`);

      const indexFile = join(srcDir, 'index.ts');
      fs.writeFileSync(indexFile, `import { loggerName } from '~/utils/build-flags.js';\nconsole.log(loggerName);`);

      const bundle = await rolldown({
        logLevel: 'silent',
        input: indexFile,
        plugins: [tsConfigPaths({ tsConfigPath })],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].code).not.toContain(`'~/utils/build-flags.js'`);
      expect(result.output[0].code).toContain('Mastra');
    });

    it('should resolve extensionless alias imports of files with dots in their names', async () => {
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(
        tsConfigPath,
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              'src/*': ['src/*'],
            },
          },
        }),
      );

      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(join(srcDir, 'repositories'), { recursive: true });
      fs.writeFileSync(
        join(srcDir, 'repositories', 'keyword-repository.interface.ts'),
        `export const kind = 'interface';`,
      );
      fs.writeFileSync(join(srcDir, 'repositories', 'keyword.fixtures.ts'), `export const fixture = 'fixture';`);

      const indexFile = join(srcDir, 'index.ts');
      fs.writeFileSync(
        indexFile,
        `import { kind } from 'src/repositories/keyword-repository.interface';\nimport { fixture } from 'src/repositories/keyword.fixtures';\nconsole.log(kind, fixture);`,
      );

      const bundle = await rolldown({
        logLevel: 'silent',
        input: indexFile,
        plugins: [tsConfigPaths({ tsConfigPath })],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].imports).toEqual([]);
      expect(result.output[0].code).toContain('interface');
      expect(result.output[0].code).toContain('fixture');
    });

    it('resolves relative importers from the configured cwd', async () => {
      const appDir = join(tempDir, 'apps', 'custom');
      const srcDir = join(appDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        join(appDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@/*': ['src/*'],
            },
          },
        }),
      );
      const valueFile = join(srcDir, 'value.js');
      fs.writeFileSync(valueFile, `export const value = 'resolved';`);
      fs.writeFileSync(join(srcDir, 'index.js'), `import { value } from '@/value';`);

      const { handler } = getResolveIdHook(tsConfigPaths({ cwd: tempDir }));
      const resolve = vi.fn(async (id: string) => ({ id, external: false as const }));
      const result = await handler.call(
        { resolve } as unknown as PluginContext,
        '@/value',
        'apps/custom/src/index.js',
        { kind: 'import-statement', isEntry: false } as ResolveIdExtraOptions,
      );

      expect(resolve).toHaveBeenCalledWith(
        valueFile,
        join(srcDir, 'index.js'),
        expect.objectContaining({ skipSelf: true }),
      );
      expect(result).toMatchObject({ id: valueFile });
    });

    // Rollup's version fell through to `this.resolve` for every unmapped id. In Rolldown that reaches the native
    // resolver, which would pull bare packages from node_modules and bypass each pass's externals logic.
    it('returns null for ids that match no paths pattern without resolving them', async () => {
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }));

      const { handler } = getResolveIdHook(tsConfigPaths({ tsConfigPath }));
      const resolve = vi.fn();
      const ctx = { resolve } as unknown as PluginContext;
      const options = { kind: 'import-statement', isEntry: false } as ResolveIdExtraOptions;
      const importer = join(tempDir, 'src', 'index.ts');

      expect(await handler.call(ctx, 'unmapped-package', importer, options)).toBeNull();
      expect(await handler.call(ctx, '@scope/pkg', importer, options)).toBeNull();
      expect(await handler.call(ctx, 'node:fs', importer, options)).toBeNull();
      expect(resolve).not.toHaveBeenCalled();
    });

    it('only runs the hook for ids that can be paths aliases', () => {
      const { filter } = getResolveIdHook(tsConfigPaths());

      for (const id of ['@/value', '@scope/pkg', '~/utils', '#internal', 'src/utils', 'lodash']) {
        expect(filter.test(id), id).toBe(true);
      }
      for (const id of ['./local', '../parent', '/abs/file.ts', '\0virtual:x', 'C:\\project\\file.ts', 'C:/file.ts']) {
        expect(filter.test(id), id).toBe(false);
      }
    });

    it('caches tsconfig lookups per directory', async () => {
      fs.writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
      );
      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(join(srcDir, 'a.ts'), `export const a = 1;`);

      const { handler } = getResolveIdHook(tsConfigPaths());
      const ctx = { resolve: async (id: string) => ({ id, external: false as const }) } as unknown as PluginContext;
      const options = { kind: 'import-statement', isEntry: false } as ResolveIdExtraOptions;
      const existsSync = vi.spyOn(fs, 'existsSync');

      try {
        await handler.call(ctx, '@/a', join(srcDir, 'index.ts'), options);
        const firstLookup = existsSync.mock.calls.filter(([file]) => String(file).includes('tsconfig')).length;
        expect(firstLookup).toBeGreaterThan(0);

        existsSync.mockClear();
        await handler.call(ctx, '@/a', join(srcDir, 'other.ts'), options);
        await handler.call(ctx, 'lodash', join(srcDir, 'other.ts'), options);
        expect(existsSync.mock.calls.filter(([file]) => String(file).includes('tsconfig'))).toEqual([]);
      } finally {
        existsSync.mockRestore();
      }
    });

    it('should not externalize @mastra/server imports from aliased modules', async () => {
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(
        tsConfigPath,
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@/*': ['src/*'],
            },
          },
        }),
      );

      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const indexFile = join(srcDir, 'index.ts');
      const routeFile = join(srcDir, 'route.ts');
      const internalFile = join(srcDir, 'internal.ts');
      const serverAdapterFile = join(tempDir, 'server-adapter.ts');

      fs.writeFileSync(
        indexFile,
        `import { route } from '@/route';\nimport { internal } from './internal.ts';\nconsole.log(route, internal);`,
      );
      fs.writeFileSync(
        routeFile,
        `import { createRoute } from '@mastra/server/server-adapter';\nexport const route = createRoute('route');`,
      );
      fs.writeFileSync(
        internalFile,
        `import { createRoute } from '@mastra/server/server-adapter';\nexport const internal = createRoute('internal');`,
      );
      fs.writeFileSync(serverAdapterFile, `export const createRoute = value => 'created:' + value;`);

      const bundle = await rolldown({
        logLevel: 'silent',
        input: indexFile,
        plugins: [
          {
            name: 'server-adapter-resolver',
            resolveId: {
              order: 'pre',
              handler(id) {
                if (id === '@mastra/server/server-adapter') {
                  return serverAdapterFile;
                }
              },
            },
          },
          tsConfigPaths({ tsConfigPath, localResolve: true }),
        ],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].code).toContain('created:');
      expect(result.output[0].imports).not.toContain(serverAdapterFile);
    });

    it('externalizes resolved bare imports of aliased modules with localResolve', async () => {
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(
        tsConfigPath,
        JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
      );

      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const indexFile = join(srcDir, 'index.ts');
      const aliasedDepFile = join(tempDir, 'aliased-dep.ts');
      const localDepFile = join(tempDir, 'local-dep.ts');
      const honoFile = join(tempDir, 'hono.ts');

      fs.writeFileSync(
        indexFile,
        `import { route } from '@/route';\nimport { internal } from './internal.ts';\nconsole.log(route, internal);`,
      );
      fs.writeFileSync(
        join(srcDir, 'route.ts'),
        `import { dep } from 'aliased-dep';\nimport { Hono } from 'hono';\nexport const route = dep + Hono;`,
      );
      fs.writeFileSync(join(srcDir, 'internal.ts'), `import { dep } from 'local-dep';\nexport const internal = dep;`);
      fs.writeFileSync(aliasedDepFile, `export const dep = 'aliased-dep-code';`);
      fs.writeFileSync(localDepFile, `export const dep = 'local-dep-code';`);
      fs.writeFileSync(honoFile, `export const Hono = 'hono-code';`);

      const packages: Record<string, string> = {
        'aliased-dep': aliasedDepFile,
        'local-dep': localDepFile,
        hono: honoFile,
      };
      const bundle = await rolldown({
        logLevel: 'silent',
        input: indexFile,
        plugins: [
          tsConfigPaths({ tsConfigPath, localResolve: true }),
          {
            name: 'package-resolver',
            resolveId(id) {
              return packages[id] ?? null;
            },
          },
        ],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].imports).toEqual([aliasedDepFile]);
      expect(result.output[0].code).not.toContain('aliased-dep-code');
      expect(result.output[0].code).toContain('local-dep-code');
      expect(result.output[0].code).toContain('hono-code');
    });
  });
});

function getResolveIdHook(plugin: Plugin) {
  const hook = plugin.resolveId;
  const filter = hook && typeof hook === 'object' && hook.filter && 'id' in hook.filter ? hook.filter.id : undefined;
  if (!hook || typeof hook !== 'object' || !(filter instanceof RegExp)) {
    throw new Error('expected an object resolveId hook with an id filter');
  }
  return { handler: hook.handler, filter };
}
