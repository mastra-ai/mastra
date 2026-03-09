import { globby } from 'globby';
import { it, describe, expect } from 'vitest';
import * as customResolve from 'resolve.exports';
import { resolve } from 'node:path';
import { join, relative, dirname, extname } from 'node:path/posix';
import { stat, readFile } from 'node:fs/promises';
import { getPackages, type Package } from '@manypkg/get-packages';

const { packages: allPackages } = await getPackages(resolve(__dirname, '..', '..'));

const globalIgnore = [
  '@mastra/longmemeval',
  '@mastra/dane',
  '@mastra/mcp-docs-server',
  '@mastra/mcp-registry-registry',
  'mastra-docs',
];

describe.for(
  allPackages
    .filter(pkg => !globalIgnore.includes(pkg.packageJson.name))
    .map(pkg => [pkg.packageJson.name, pkg.packageJson] as const),
)('%s', async ([pkgName, pkgJson]) => {
  console.log(pkgName, pkgJson);
  let imports: string[] = Object.keys(pkgJson?.exports ?? {});

  it('should have type="module"', () => {
    expect(pkgJson.type).toBe('module');
  });

  it.skipIf(!pkgJson.name.startsWith('@internal/'))('should be marked as private', () => {
    expect(pkgJson.private).toBe(true);
  });

  describe.concurrent.for(imports.filter(x => !x.endsWith('.css')).map(x => [x]))('%s', async ([importPath]) => {
    it.skipIf(pkgJson.name === 'mastra' || pkgJson.name.startsWith('@internal/'))(
      'should use .js and .d.ts extensions when using import',
      async () => {
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
      },
    );

    it.skipIf(pkgName === '@mastra/playground-ui' || pkgName === 'mastra' || pkgName.startsWith('@internal/'))(
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
      pkgJson.name === '@mastra/opencode' ||
      pkgJson.name === 'mastracode' ||
      !pkgJson.name.startsWith('@mastra/'),
  )('should have @mastra/core as a peer dependency if used', async () => {
    const hasMastraCoreAsDependency = pkgJson?.dependencies?.['@mastra/core'];
    expect(hasMastraCoreAsDependency).toBe(undefined);
  });
});

// =============================================================================
// Native optional dependencies should not be bundled
// =============================================================================

describe('@mastra/core native optional deps', () => {
  const corePkg = allPackages.find(pkg => pkg.packageJson.name === '@mastra/core');
  if (!corePkg) throw new Error('@mastra/core not found in workspace packages');
  const coreDistDir = join(corePkg.dir, 'dist');

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Optional peer dependencies with native binaries must not be statically
  // imported in the bundle. They should only appear as string literals inside
  // dynamic import() or createRequire().resolve() calls. If esbuild/tsup
  // ever resolves them statically (e.g. someone removes the string-concat
  // trick), the bundle would embed the wrong platform binary.
  const nativeOptionalDeps = ['@ast-grep/napi'];

  it.for(nativeOptionalDeps.map(dep => [dep]))('%s should not be statically imported in the bundle', async ([dep]) => {
    const jsFiles = await globby(join(coreDistDir, '**/*.{js,cjs}'));
    expect(jsFiles.length).toBeGreaterThan(0);

    for (const file of jsFiles) {
      const content = await readFile(file, 'utf-8');
      if (!content.includes(dep)) continue;

      // Static ESM import: import ... from "@ast-grep/napi"
      const staticEsmImport = new RegExp(`^import\\s+.*from\\s+["']${escapeRegExp(dep)}["']`, 'm');
      expect(content, `${file} has a static ESM import of ${dep}`).not.toMatch(staticEsmImport);

      // Static CJS require: require("@ast-grep/napi")  (top-level, not inside req.resolve)
      // We allow: req.resolve("@ast-grep/napi") and const moduleName = "@ast-grep/napi"
      // We disallow: require("@ast-grep/napi") as a direct call
      const staticRequire = new RegExp(`(?<!\\.)require\\(["']${escapeRegExp(dep)}["']\\)`, 'm');
      expect(content, `${file} has a static require() of ${dep}`).not.toMatch(staticRequire);
    }
  });

  it('should not contain native binary files (.node) in dist', async () => {
    const nativeFiles = await globby(join(coreDistDir, '**/*.node'));
    expect(nativeFiles).toHaveLength(0);
  });
});
