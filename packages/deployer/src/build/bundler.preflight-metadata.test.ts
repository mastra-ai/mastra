import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBundler, getInputOptions } from './bundler';
import { createWatcher } from './watcher';

const PREFLIGHT_FILES = ['preflight-metadata.json', 'workers.json', 'preflight-local-paths.json'];

let projectRoot: string;
let outputDir: string;
let entryFile: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mastra-preflight-metadata-'));
  outputDir = join(projectRoot, 'output');
  await mkdir(join(projectRoot, 'src', 'mastra'), { recursive: true });
  entryFile = join(projectRoot, 'src', 'mastra', 'index.js');
  await writeFile(entryFile, `export const storageUrl = 'file:./mastra.db';\n`);
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

function inputOptions(isDev: boolean) {
  return getInputOptions(
    entryFile,
    { dependencies: new Map(), externalDependencies: new Map(), workspaceMap: new Map() },
    'node',
    undefined,
    { isDev, projectRoot },
  );
}

// Only the deploy and lint preflight checks read these files, and they run on `mastra build` output. `mastra dev`
// skips the scan that writes them, which otherwise re-parses every user module on each rebuild.
describe('preflight metadata', () => {
  it('mastra build writes the preflight files', async () => {
    const bundler = await createBundler(
      { ...(await inputOptions(false)), input: { index: entryFile } },
      { dir: outputDir },
    );
    try {
      await bundler.write();
    } finally {
      await bundler.close();
    }

    for (const file of PREFLIGHT_FILES) {
      expect(existsSync(join(outputDir, file)), file).toBe(true);
    }
  });

  it('mastra dev does not write them', async () => {
    const watcher = await createWatcher(
      { ...(await inputOptions(true)), input: { index: entryFile } },
      { dir: outputDir },
    );
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

    expect(existsSync(join(outputDir, 'index.mjs'))).toBe(true);
    for (const file of PREFLIGHT_FILES) {
      expect(existsSync(join(outputDir, file)), file).toBe(false);
    }
  });
});
