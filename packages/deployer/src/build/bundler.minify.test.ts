import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rolldown } from 'rolldown';
import type { Plugin } from 'rolldown';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getInputOptions } from './bundler';

const analyzedBundleInfo = {
  dependencies: new Map<string, string>(),
  externalDependencies: new Map(),
  workspaceMap: new Map(),
};

// Rolldown folds constants and inlines single-use locals even without minification, so the name to mangle is a
// parameter.
const source = `export function hello(someLongParameterName) {
  return ('hello ' + someLongParameterName).toUpperCase();
}
`;

let projectRoot: string;
let entryFile: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mastra-bundler-minify-'));
  entryFile = join(projectRoot, 'entry.js');
  await writeFile(entryFile, source);
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

function getOptions(minify: boolean, sourcemap = false) {
  return getInputOptions(
    entryFile,
    analyzedBundleInfo,
    'node',
    { 'process.env.NODE_ENV': JSON.stringify('production') },
    { minify, sourcemap, projectRoot },
  );
}

/**
 * Minification has to apply to whole emitted chunks. Asserting on plugin names alone would not catch it being wired
 * into the wrong stage, so these tests run real builds and check the output.
 */
async function build(minify: boolean, sourcemap = false) {
  const bundle = await rolldown({ ...(await getOptions(minify, sourcemap)), input: entryFile });
  try {
    const { output } = await bundle.generate({ format: 'esm' });
    return output[0];
  } finally {
    await bundle.close();
  }
}

describe('getInputOptions minify', () => {
  it('does not minify by default', async () => {
    const plugins = ((await getOptions(false)).plugins ?? []) as Plugin[];
    expect(plugins.map(plugin => plugin.name)).not.toContain('mastra-minify');

    const chunk = await build(false);
    expect(chunk.code).toContain('someLongParameterName');
    expect(chunk.code.trim()).toContain('\n');
  });

  it('minifies emitted chunks when enabled', async () => {
    const chunk = await build(true);

    expect(chunk.code.length).toBeLessThan(source.length);
    expect(chunk.code).not.toContain('someLongParameterName');
    expect(chunk.code.trim()).not.toContain('\n');
    // The public export has to keep its name or importers break.
    expect(chunk.exports).toContain('hello');
    expect(chunk.code).toContain('hello');
  });

  /**
   * Generating a sourcemap costs work on the far more common non-sourcemap build, so it is wired to the build's
   * setting. Both directions asserted.
   */
  it('emits a sourcemap only when the build asked for one', async () => {
    const withMap = await build(true, true);
    const withoutMap = await build(true, false);

    expect(withMap.map).toBeTruthy();
    expect(withMap.map!.sources.some(file => file.endsWith('entry.js'))).toBe(true);
    expect(withoutMap.map).toBeFalsy();
  });
});
