import { globby } from 'globby';
import { it, describe, expect } from 'vitest';
import * as customResolve from 'resolve.exports';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { join, relative, dirname, extname } from 'node:path/posix';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..', '..');

const allPackages = await globby(
  [
    '**/package.json',
    '!./examples/**',
    '!./docs/**',
    '!./docs-new/**',
    '!**/node_modules/**',
    '!**/integration-tests/**',
    '!**/integration-tests-v5/**',
    '!**/server-adapters/_test-utils/**',
    '!./packages/_config/**',
    '!./e2e-tests/**',
    '!**/mcp-docs-server/**',
    '!**/mcp-registry-registry/**',
    '!**/stores/_test-utils/**',
    '!**/explorations/**',
    '!**/observability/_examples/**',
  ],
  {
    cwd: rootDir,
    absolute: true,
  },
);

// Remove workspace root package.json
allPackages.shift();

describe.for(allPackages.map(pkg => [relative(rootDir.replaceAll('\\', '/'), dirname(pkg)), pkg]))(
  '%s',
  async ([pkgName, packagePath]) => {
    const pkgJson = JSON.parse(await readFile(packagePath, 'utf-8'));
    const imports: string[] = Object.keys(pkgJson?.exports ?? {});

    it('should have type="module"', () => {
      expect(pkgJson.type).toBe('module');
    });

    describe.concurrent.for(imports.filter(x => !x.endsWith('.css')).map(x => [x]))('%s', async ([importPath]) => {
      it.skipIf(pkgJson.name === 'mastra')('should use .js and .d.ts extensions when using import', async () => {
        if (importPath === './package.json') {
          return;
        }

        const exportConfig = pkgJson.exports[importPath] as any;
        expect(exportConfig.import).toBeDefined();
        expect(exportConfig.import).not.toBe(expect.any(String));
        expect(extname(exportConfig.import.default)).toMatch(/\.js$/);
        expect(exportConfig.import.types).toMatch(/\.d\.ts$/);

        const fileOutput = customResolve.exports(pkgJson, importPath);
        expect(fileOutput).toBeDefined();

        const pathsOnDisk = await globby(join(rootDir, pkgName, fileOutput![0]));
        for (const pathOnDisk of pathsOnDisk) {
          await expect(stat(pathOnDisk), `${pathOnDisk} does not exist`).resolves.toBeDefined();
        }
      });

      it.skipIf(
        pkgName === 'packages/playground-ui' || pkgJson.name === 'mastra' || pkgJson.name.startsWith('@internal/'),
      )('should use .cjs and .d.ts extensions when using require', async () => {
        if (importPath === './package.json') {
          return;
        }

        const exportConfig = pkgJson.exports[importPath] as any;
        expect(exportConfig.require).toBeDefined();
        expect(exportConfig.require).not.toBe(expect.any(String));
        expect(extname(exportConfig.require.default)).toMatch(/\.cjs$/);
        expect(exportConfig.require.types).toMatch(/\.d\.ts$/);

        const fileOutput = customResolve.exports(pkgJson, importPath, {
          require: true,
        });
        expect(fileOutput).toBeDefined();

        const pathsOnDisk = await globby(join(rootDir, pkgName, fileOutput![0]));
        for (const pathOnDisk of pathsOnDisk) {
          await expect(stat(pathOnDisk), `${pathOnDisk} does not exist`).resolves.toBeDefined();
        }
      });
    });

    it.skipIf(
      pkgJson.name === 'mastra' ||
        pkgJson.name === 'create-mastra' ||
        pkgJson.name === '@mastra/client-js' ||
        !pkgJson.name.startsWith('@mastra/'),
    )('should have @mastra/core as a peer dependency if used', async () => {
      const hasMastraCoreAsDependency = pkgJson?.dependencies?.['@mastra/core'];
      expect(hasMastraCoreAsDependency).toBe(undefined);
    });
  },
);
