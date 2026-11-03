import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBundler, getInputOptions } from './bundler';
import { createWatcher } from './watcher';

const analyzedBundleInfo = {
  dependencies: new Map<string, string>(),
  externalDependencies: new Map(),
  workspaceMap: new Map(),
};

let projectRoot: string;
let outputDir: string;
let entryFile: string;
let toolsIndexFile: string;

/**
 * Mirrors a project whose `src/mastra/tools/index.ts` is imported both by the Mastra entry and by the tool entries
 * that `mastra dev`/`mastra build` add from the tools directory. The top-level await (like an app awaiting its
 * storage setup) is what makes Rolldown move the shared module into its own chunk instead of the tool entry.
 */
beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mastra-tools-manifest-'));
  outputDir = join(projectRoot, 'output');
  const toolsDir = join(projectRoot, 'src', 'mastra', 'tools');
  await mkdir(toolsDir, { recursive: true });

  toolsIndexFile = join(toolsDir, 'index.js');
  await writeFile(toolsIndexFile, `export const weatherInfo = { id: 'weatherInfo' };\n`);
  await writeFile(
    join(projectRoot, 'src', 'mastra', 'index.js'),
    `import { weatherInfo } from './tools/index.js';
await Promise.resolve();
export const mastra = { weatherInfo };
`,
  );

  // Shaped like the CLI's dev/build entry templates.
  entryFile = join(projectRoot, 'entry.js');
  await writeFile(
    entryFile,
    `import { mastra } from './src/mastra/index.js';
import { tools } from '#tools';
export const result = { manifest: tools.length, weatherInfo: mastra.weatherInfo.id };
`,
  );
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

const input = () => ({ index: entryFile, 'tools/abc': toolsIndexFile });

/** Same manifest the dev watcher and `Bundler._bundle` write next to the bundle once it is built. */
async function writeToolsManifest() {
  await writeFile(
    join(outputDir, 'tools.mjs'),
    `import * as tool0 from './tools/abc.mjs';\nexport const tools = [tool0];\n`,
  );
}

async function assertEntryLoads() {
  const mod = await import(`${pathToFileURL(join(outputDir, 'index.mjs')).href}?t=${Date.now()}`);
  expect(mod.result).toEqual({ manifest: 1, weatherInfo: 'weatherInfo' });
}

async function inputOptions(isDev: boolean) {
  return getInputOptions(entryFile, analyzedBundleInfo, 'node', undefined, { isDev, projectRoot });
}

// Rolldown names a shared chunk after the directory of an `index` module, so `tools/index` became `tools.mjs`:
// the same file as the `#tools` manifest. `mastra dev` then failed with "does not provide an export named 'tools'"
// and `mastra build` silently overwrote the chunk.
describe('tools manifest', () => {
  it('mastra build output keeps the shared tools chunk apart from tools.mjs', async () => {
    const bundler = await createBundler({ ...(await inputOptions(false)), input: input() }, { dir: outputDir });
    try {
      await bundler.write();
    } finally {
      await bundler.close();
    }
    await writeToolsManifest();

    await assertEntryLoads();
  });

  it('mastra dev output keeps the shared tools chunk apart from tools.mjs', async () => {
    const watcher = await createWatcher({ ...(await inputOptions(true)), input: input() }, { dir: outputDir });
    try {
      await new Promise<void>((resolve, reject) => {
        watcher.on('event', event => {
          if (event.code === 'BUNDLE_END') resolve();
          if (event.code === 'ERROR') reject(event.error);
        });
      });
    } finally {
      await watcher.close();
    }
    await writeToolsManifest();

    await assertEntryLoads();
  });
});
