import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { packagesManifestCandidates, readRunningPackages } from './running-packages.js';

describe('readRunningPackages', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'factory-running-packages-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads the manifest `mastra build` writes next to the server entry', async () => {
    const outputDir = join(dir, '.mastra', 'output');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, 'mastra-packages.json'),
      JSON.stringify([
        { name: '@mastra/factory', version: '0.28.0' },
        { name: '@mastra/core', version: '1.83.0' },
      ]),
    );

    const candidates = packagesManifestCandidates({}, join(outputDir, 'index.mjs'), join(dir, 'elsewhere'));

    expect(await readRunningPackages(candidates)).toEqual([
      { name: '@mastra/core', version: '1.83.0' },
      { name: '@mastra/factory', version: '0.28.0' },
    ]);
  });

  it('prefers the file `mastra dev` points at', async () => {
    const devFile = join(dir, 'dev-packages.json');
    writeFileSync(devFile, JSON.stringify([{ name: 'mastra', version: '1.39.0' }]));

    const candidates = packagesManifestCandidates({ MASTRA_PACKAGES_FILE: devFile }, undefined, dir);

    expect(candidates[0]).toBe(devFile);
    expect(await readRunningPackages(candidates)).toEqual([{ name: 'mastra', version: '1.39.0' }]);
  });

  it('falls back to the manifest next to the bundled module, then the build output under cwd', () => {
    const bundled = join(dirname(fileURLToPath(import.meta.url)), 'mastra-packages.json');

    expect(packagesManifestCandidates({}, '', dir)).toEqual([
      bundled,
      join(dir, '.mastra', 'output', 'mastra-packages.json'),
    ]);
  });

  it('uses the first manifest that exists, even when later ones do too', async () => {
    const first = join(dir, 'first.json');
    const second = join(dir, 'second.json');
    writeFileSync(first, JSON.stringify([{ name: '@mastra/core', version: '1.0.0' }]));
    writeFileSync(second, JSON.stringify([{ name: '@mastra/core', version: '2.0.0' }]));

    expect(await readRunningPackages([join(dir, 'missing.json'), first, second])).toEqual([
      { name: '@mastra/core', version: '1.0.0' },
    ]);
  });

  it('returns no packages when the manifest is missing or malformed', async () => {
    expect(await readRunningPackages([join(dir, 'missing.json')])).toEqual([]);

    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{"not":"a list"}');
    expect(await readRunningPackages([bad])).toEqual([]);
  });

  it('skips entries without a string name and version', async () => {
    const file = join(dir, 'mixed.json');
    writeFileSync(
      file,
      JSON.stringify([
        null,
        { name: 1, version: '1.0.0' },
        { name: '@mastra/pg', version: null },
        { name: '@mastra/core', version: '1.83.0' },
      ]),
    );

    expect(await readRunningPackages([file])).toEqual([{ name: '@mastra/core', version: '1.83.0' }]);
  });
});
