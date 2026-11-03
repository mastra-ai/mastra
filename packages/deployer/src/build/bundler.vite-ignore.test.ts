import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeBundle } from './analyze';
import { createBundler, getInputOptions } from './bundler';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

/**
 * An app whose dependency lazily loads an ESM-only package through `import(/* @vite-ignore *\/ 'lazy-pkg')`, like
 * `getChatModule()` in @mastra/core, and whose own code does the same.
 */
async function createApp() {
  const appDir = await realpath(await mkdtemp(join(tmpdir(), 'mastra-vite-ignore-app-')));
  tempDirs.push(appDir);

  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'app',
      version: '1.0.0',
      type: 'module',
      dependencies: { 'dep-with-lazy': '1.0.0', 'lazy-pkg': '2.3.4' },
    }),
    'src/index.ts': [
      `import { loadFromDep } from 'dep-with-lazy';`,
      `export { loadFromDep };`,
      `export const loadDirect = async (): Promise<string> =>`,
      `  (await import(/* @vite-ignore */ 'lazy-pkg')).value;`,
      '',
    ].join('\n'),
    'node_modules/dep-with-lazy/package.json': JSON.stringify({
      name: 'dep-with-lazy',
      version: '1.0.0',
      type: 'module',
      exports: './index.js',
      dependencies: { 'lazy-pkg': '2.3.4' },
    }),
    'node_modules/dep-with-lazy/index.js': [
      `export async function loadFromDep() {`,
      `  const mod = await import(`,
      `    /* @vite-ignore */`,
      `    /* webpackIgnore: true */`,
      `    'lazy-pkg'`,
      `  );`,
      `  return mod.value;`,
      `}`,
      '',
    ].join('\n'),
    'node_modules/lazy-pkg/package.json': JSON.stringify({
      name: 'lazy-pkg',
      version: '2.3.4',
      type: 'module',
      exports: './index.js',
    }),
    'node_modules/lazy-pkg/index.js': `export const value = 'from lazy-pkg';\n`,
  };

  for (const [file, content] of Object.entries(files)) {
    await mkdir(join(appDir, file, '..'), { recursive: true });
    await writeFile(join(appDir, file), content);
  }
  await mkdir(join(appDir, '.mastra', '.build'), { recursive: true });

  return { appDir, entryFile: join(appDir, 'src', 'index.ts') };
}

async function build({ externals }: { externals: boolean }) {
  const { appDir, entryFile } = await createApp();
  const outputDir = join(appDir, '.mastra', 'output');

  const analyzed = await analyzeBundle(
    [entryFile],
    entryFile,
    {
      outputDir: join(appDir, '.mastra', '.build'),
      projectRoot: appDir,
      platform: 'node',
      bundlerOptions: { externals, enableSourcemap: false },
    },
    noopLogger,
  );

  const inputOptions = await getInputOptions(entryFile, analyzed, 'node', undefined, {
    projectRoot: appDir,
    externalsPreset: externals,
  });
  const bundler = await createBundler({ ...inputOptions, input: { index: entryFile } }, { dir: outputDir });
  try {
    await bundler.write();
  } finally {
    await bundler.close();
  }

  return { appDir, analyzed, outputFile: join(outputDir, 'index.mjs') };
}

describe('dynamic imports marked with @vite-ignore', () => {
  it('are bundled with externals: false, so the output runs without node_modules', async () => {
    const { appDir, analyzed, outputFile } = await build({ externals: false });

    expect([...analyzed.externalDependencies.keys()]).not.toContain('lazy-pkg');

    // Nothing gets installed next to the output for bundled dependencies.
    await rm(join(appDir, 'node_modules'), { recursive: true });
    const mod = await import(pathToFileURL(outputFile).href);
    expect(await mod.loadFromDep()).toBe('from lazy-pkg');
    expect(await mod.loadDirect()).toBe('from lazy-pkg');
  });

  it('stay external with externals: true and are recorded for the output package.json', async () => {
    const { analyzed, outputFile } = await build({ externals: true });

    expect(analyzed.externalDependencies.get('lazy-pkg')).toMatchObject({ version: '2.3.4' });
    expect(analyzed.externalDependencies.get('dep-with-lazy')).toMatchObject({ version: '1.0.0' });

    const mod = await import(pathToFileURL(outputFile).href);
    expect(await mod.loadFromDep()).toBe('from lazy-pkg');
    expect(await mod.loadDirect()).toBe('from lazy-pkg');
  });
});
