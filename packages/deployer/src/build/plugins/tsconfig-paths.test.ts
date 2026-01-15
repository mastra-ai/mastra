import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { tsConfigPaths, hasPaths } from './tsconfig-paths';
import { rollup } from 'rollup';

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

    it('should resolve path aliases when tsconfig has JSONC comments', async () => {
      // Copy the with-comments fixture to temp dir
      const tsConfigContent = fs.readFileSync(join(fixturesDir, 'tsconfig-with-comments.json'), 'utf-8');
      const tsConfigPath = join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsConfigPath, tsConfigContent);

      // Create source files
      const srcDir = join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(join(srcDir, 'utils.ts'), `export const hello = 'world';`);
      fs.writeFileSync(join(srcDir, 'index.ts'), `import { hello } from '@src/utils';\nconsole.log(hello);`);

      // Create the plugin with explicit tsconfig path
      const plugin = tsConfigPaths({ tsConfigPath });

      // Build using rollup to test plugin behavior
      const bundle = await rollup({
        logLevel: 'silent',
        input: join(srcDir, 'index.ts'),
        plugins: [
          plugin,
          {
            name: 'mock-resolver',
            resolveId(id) {
              if (id.includes('/src/utils')) {
                return { id: join(srcDir, 'utils.ts'), external: false };
              }
              return null;
            },
            load(id) {
              if (id.endsWith('utils.ts')) {
                return `export const hello = 'world';`;
              }
              if (id.endsWith('index.ts')) {
                return `import { hello } from '@src/utils';\nconsole.log(hello);`;
              }
              return null;
            },
          },
        ],
      });

      const result = await bundle.generate({ format: 'esm' });
      expect(result.output[0].code).toContain('hello');
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

      // Build using rollup
      const bundle = await rollup({
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
  });
});
