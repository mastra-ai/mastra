import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import type { InputOptions, OutputChunk, OutputOptions, Plugin } from 'rolldown';
import { afterEach, describe, expect, it } from 'vitest';
import { TREESHAKE_SMALLEST } from './options';
import { pruneUnreachableChunks, stripViteIgnore } from './plugins';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

/** Writes `files` into a temp dir, bundles `entry` with Rolldown and writes the output to `<dir>/out`. */
async function buildProject(
  files: Record<string, string>,
  entry: string,
  {
    plugins = [stripViteIgnore()],
    input = {},
    output: outputOptions = {},
  }: { plugins?: Plugin[]; input?: Omit<InputOptions, 'input'>; output?: OutputOptions } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'mastra-rolldown-plugins-'));
  tempDirs.push(root);
  for (const [file, content] of Object.entries(files)) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), content);
  }

  const bundle = await rolldown({
    input: join(root, entry),
    cwd: root,
    platform: 'node',
    logLevel: 'silent',
    plugins,
    ...input,
  });
  try {
    const outDir = join(root, 'out');
    const { output } = await bundle.write({
      dir: outDir,
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: '[name].mjs',
      ...outputOptions,
    });
    const chunks = output.filter((o): o is OutputChunk => o.type === 'chunk');
    return { outDir, chunks, entryCode: chunks.find(c => c.isEntry)!.code };
  } finally {
    await bundle.close();
  }
}

const lazyPackage = {
  'node_modules/lazy-pkg/package.json': JSON.stringify({ name: 'lazy-pkg', version: '1.0.0', type: 'module' }),
  'node_modules/lazy-pkg/index.js': `export const value = 'from lazy-pkg';\n`,
};

describe('stripViteIgnore', () => {
  // Same shape as `getChatModule()` in @mastra/core (channels/chat-lazy.ts).
  it('bundles a vite-ignored literal dynamic import of a package', async () => {
    const files = {
      ...lazyPackage,
      'src/index.js': `export const load = async () => (await import(\n  /* @vite-ignore */\n  /* webpackIgnore: true */\n  'lazy-pkg'\n)).value;\n`,
    };

    const withoutPlugin = await buildProject(files, 'src/index.js', { plugins: [] });
    expect(withoutPlugin.chunks).toHaveLength(1);
    expect(withoutPlugin.entryCode).toContain('"lazy-pkg"');

    const { outDir, chunks, entryCode } = await buildProject(files, 'src/index.js');
    expect(chunks).toHaveLength(2);
    expect(entryCode).not.toContain('"lazy-pkg"');
    expect(entryCode).not.toContain('@vite-ignore');
    expect(entryCode).toContain('webpackIgnore');

    // The output is self-contained: no node_modules next to it.
    await rm(join(outDir, '..', 'node_modules'), { recursive: true });
    const mod = await import(pathToFileURL(join(outDir, 'index.mjs')).href);
    expect(await mod.load()).toBe('from lazy-pkg');
  });

  it('bundles vite-ignored relative imports in TypeScript and handles non-ASCII text before them', async () => {
    const { chunks, entryCode } = await buildProject(
      {
        'src/index.ts': `const greeting: string = 'olá 👋';\nexport const load = (): Promise<{ x: number }> => import(/* @vite-ignore */ "./dep.ts");\nexport { greeting };\n`,
        'src/dep.ts': `export const x: number = 1;\n`,
      },
      'src/index.ts',
    );

    expect(chunks.map(c => c.fileName).sort()).toEqual(['dep.mjs', 'index.mjs']);
    expect(entryCode).toContain('olá 👋');
    expect(entryCode).toContain('import("./dep.mjs")');
  });

  it('leaves non-literal imports and string contents alone', async () => {
    const { chunks, entryCode } = await buildProject(
      {
        'src/index.js': [
          `export const byName = name => import(/* @vite-ignore */ name);`,
          `export const template = 'await import(/* @vite-ignore */ "./dep.js")';`,
          '',
        ].join('\n'),
        'src/dep.js': `export const x = 1;\n`,
      },
      'src/index.js',
    );

    expect(chunks).toHaveLength(1);
    expect(entryCode).toContain('import(\n\t/* @vite-ignore */\n\tname\n)');
    expect(entryCode).toContain(`"await import(/* @vite-ignore */ \\"./dep.js\\")"`);
  });
});

describe('pruneUnreachableChunks', () => {
  /**
   * Same shape as `@standard-community/standard-json`, which the deployer server imports only for side effects: the
   * package lazily loads vendor modules that import an error class back from it. With `moduleSideEffects: false` the
   * import is dropped, yet Rolldown 1.2.16 still emits the package and its vendor modules as chunks nothing loads.
   */
  const files = {
    'node_modules/schema-lib/package.json': JSON.stringify({
      name: 'schema-lib',
      type: 'module',
      exports: './index.js',
    }),
    'node_modules/schema-lib/index.js': [
      `export class MissingDependencyError extends Error {}`,
      `const load = async vendor => (vendor === 'a' ? await import('./a.js') : await import('./b.js')).default;`,
      `register(async vendor => (await load(vendor))());`,
      '',
    ].join('\n'),
    'node_modules/schema-lib/a.js': `import { MissingDependencyError } from './index.js';\nexport default () => { throw new MissingDependencyError('a'); };\n`,
    'node_modules/schema-lib/b.js': `import { MissingDependencyError } from './index.js';\nexport default () => { throw new MissingDependencyError('b'); };\n`,
    'src/index.js': [`import 'schema-lib';`, `export const loadFeature = () => import('./feature.js');`, ''].join('\n'),
    'src/feature.js': [
      `import { helper } from './shared.js';`,
      `export const feature = () => helper('feature');`,
      `export const loadNested = () => import('./nested.js');`,
      '',
    ].join('\n'),
    'src/shared.js': `export const helper = name => 'helped ' + name;\nexport const sharedValue = 'shared';\n`,
    'src/nested.js': `import { sharedValue } from './shared.js';\nexport const nested = () => 'nested ' + sharedValue;\n`,
  };
  const input = { treeshake: TREESHAKE_SMALLEST };

  it('drops chunks nothing can load and keeps every chunk an entry reaches', async () => {
    // Rolldown bug this works around: when this starts failing, the plugin may no longer be needed.
    const withoutPlugin = await buildProject(files, 'src/index.js', { plugins: [], input });
    expect(withoutPlugin.chunks.map(c => c.fileName).sort()).toEqual(
      expect.arrayContaining(['a.mjs', 'b.mjs', 'schema-lib.mjs']),
    );

    const { outDir, chunks } = await buildProject(files, 'src/index.js', {
      plugins: [pruneUnreachableChunks()],
      input,
      output: { sourcemap: true },
    });

    const written = (await readdir(outDir)).sort();
    expect(written).toEqual(chunks.flatMap(c => [c.fileName, `${c.fileName}.map`]).sort());
    expect(written.filter(file => /^(a|b|schema-lib)\.mjs/.test(file))).toEqual([]);

    const mod = await import(pathToFileURL(join(outDir, 'index.mjs')).href);
    const feature = await mod.loadFeature();
    expect(feature.feature()).toBe('helped feature');
    expect((await feature.loadNested()).nested()).toBe('nested shared');
  });
});
