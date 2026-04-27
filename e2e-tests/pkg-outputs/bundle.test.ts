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

  describe.concurrent.for(imports.filter(x => !x.endsWith('.css') && pkgJson.exports[x] !== null).map(x => [x]))('%s', async ([importPath]) => {
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

describe('@mastra/core phantom export validation', () => {
  const corePkg = allPackages.find(pkg => pkg.packageJson.name === '@mastra/core');
  if (!corePkg) throw new Error('@mastra/core not found in workspace packages');
  const coreDistDir = join(corePkg.dir, 'dist');
  const exports = corePkg.packageJson.exports as Record<string, unknown>;

  it('should block all phantom subpaths with null exports', async () => {
    // Phantom subpaths used for type-only imports by workspace packages are
    // intentionally left unblocked so tsc can resolve them during build.
    const typeOnlyAllowlist = new Set([
      './action',
      './llm/model',
      './storage/domains',
      './storage/domains/agents',
      './storage/domains/mcp-clients',
      './storage/domains/mcp-servers',
      './storage/domains/prompt-blocks',
      './storage/domains/scorer-definitions',
      './storage/domains/skills',
      './storage/domains/workspaces',
      './workspace/constants',
    ]);

    // Find all index.d.ts files without a matching index.js (phantom subpaths)
    const dtsFiles = await globby(join(coreDistDir, '**/index.d.ts'));
    const phantoms: string[] = [];

    for (const dts of dtsFiles) {
      const dir = dirname(dts);
      const js = join(dir, 'index.js');
      try {
        await stat(js);
      } catch {
        const rel = relative(coreDistDir, dir);
        // Skip internal type shims
        if (rel.startsWith('_types')) continue;
        phantoms.push(`./${rel}`);
      }
    }

    const missing = phantoms.filter(p => exports[p] !== null && !typeOnlyAllowlist.has(p));
    if (missing.length > 0) {
      throw new Error(
        `Found ${missing.length} phantom subpath(s) without null exports in @mastra/core package.json:\n` +
          missing.map(p => `  ${p}`).join('\n') +
          '\n\nAdd these as null entries in package.json exports (before the ./* wildcard) to prevent ' +
          'runtime MODULE_NOT_FOUND errors. See https://github.com/mastra-ai/mastra/issues/15758',
      );
    }
  });

  it('should not have stale null exports for subpaths that now have runtime JS', async () => {
    const nullExports = Object.entries(exports)
      .filter(([, v]) => v === null)
      .map(([k]) => k);

    const stale: string[] = [];
    for (const subpath of nullExports) {
      const jsPath = join(coreDistDir, subpath.replace('./', ''), 'index.js');
      try {
        await stat(jsPath);
        stale.push(subpath);
      } catch {
        // Expected — no JS file means null export is correct
      }
    }

    if (stale.length > 0) {
      throw new Error(
        `Found ${stale.length} stale null export(s) in @mastra/core package.json that now have runtime JS:\n` +
          stale.map(p => `  ${p}`).join('\n') +
          '\n\nRemove these null entries since the subpaths now have valid runtime modules.',
      );
    }
  });
});
