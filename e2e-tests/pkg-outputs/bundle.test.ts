import { globby } from 'globby';
import { it, describe, expect } from 'vitest';
import * as customResolve from 'resolve.exports';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { join, relative, dirname, extname } from 'node:path/posix';
import { stat } from 'node:fs/promises';

let allPackages = await globby(
  [
    '**/package.json',
    '!./examples/**',
    '!./docs/**',
    '!**/node_modules/**',
    '!**/integration-tests/**',
    '!**/integration-tests-v5/**',
    '!./packages/_config/**',
    '!./e2e-tests/**',
    '!**/mcp-docs-server/**',
    '!**/mcp-registry-registry/**',
    '!**/stores/_test-utils/**',
    '!**/explorations/**',
  ],
  {
    cwd: resolve(__dirname, '..', '..'),
    absolute: true,
  },
);

// remove workspace root
allPackages.shift();

describe.for(allPackages.map(pkg => [relative(join(__dirname.replaceAll('\\', '/'), '..', '..'), dirname(pkg)), pkg]))(
  '%s',
  async ([pkgName, packagePath]) => {
    let pkgJson = JSON.parse(await readFile(packagePath, 'utf-8'));
    let imports: string[] = Object.keys(pkgJson?.exports ?? {});

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

        const pathsOnDisk = await globby(join(__dirname, '..', pkgName, fileOutput[0]));
        for (const pathOnDisk of pathsOnDisk) {
          await expect(stat(pathOnDisk), `${pathOnDisk} does not exist`).resolves.toBeDefined();
        }
      });

      it.skipIf(pkgName === 'packages/playground-ui' || pkgJson.name === 'mastra')(
        'should use .cjs and .d.ts extensions when using require',
        async () => {
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

          const pathsOnDisk = await globby(join(__dirname, '..', pkgName, fileOutput[0]));
          for (const pathOnDisk of pathsOnDisk) {
            await expect(stat(pathOnDisk), `${pathOnDisk} does not exist`).resolves.toBeDefined();
          }
        },
      );
    });

    it.skipIf(
      pkgJson.name === 'mastra' ||
        pkgJson.name === 'create-mastra' ||
        pkgJson.name === '@mastra/client-js' ||
        !pkgJson.name.startsWith('@mastra/'),
    )('should have @mastra/core as a peer dependency if used', async () => {
      console.log(pkgJson.name);
      const hasMastraCoreAsDependency = pkgJson?.dependencies?.['@mastra/core'];
      expect(hasMastraCoreAsDependency).toBe(undefined);
    });
  },
);
