import type { Plugin } from 'rollup';
import { describe, expect, it } from 'vitest';
import { getInputOptions } from './bundler';

const analyzedBundleInfo = {
  dependencies: new Map<string, string>(),
  externalDependencies: new Map(),
  workspaceMap: new Map(),
};

async function getPlugins(minify: boolean, sourcemap = false) {
  const inputOptions = await getInputOptions(
    'test-entry.js',
    analyzedBundleInfo as any,
    'node',
    { 'process.env.NODE_ENV': JSON.stringify('production') },
    { minify, sourcemap, projectRoot: process.cwd() },
  );

  return (inputOptions.plugins ?? []) as Plugin[];
}

/**
 * The minifier has to run at renderChunk so it sees whole emitted chunks. Asserting on
 * plugin names alone would not catch it being wired into the wrong stage, so these tests
 * drive the hook with real code and check the output actually shrank.
 */
function renderChunk(plugin: Plugin, code: string) {
  const hook = plugin.renderChunk;
  const handler = typeof hook === 'function' ? hook : hook?.handler;

  return handler?.call({} as any, code, { fileName: 'index.mjs' } as any, {} as any, {} as any);
}

describe('getInputOptions minify', () => {
  it('does not minify by default', async () => {
    const plugins = await getPlugins(false);

    const results = await Promise.all(
      plugins.filter(Boolean).map(plugin => renderChunk(plugin, 'export const hello = () => {\n  return 1 + 1;\n};\n')),
    );

    expect(results.every(result => result == null)).toBe(true);
  });

  it('minifies emitted chunks when enabled', async () => {
    const plugins = await getPlugins(true);
    const source = `export const hello = () => {
  // a comment that should not survive
  const someLongLocalName = 1 + 1;
  return someLongLocalName;
};
`;

    const outputs = await Promise.all(plugins.filter(Boolean).map(plugin => renderChunk(plugin, source)));
    const minified = outputs.find(output => output != null);

    expect(minified).toBeDefined();

    const code = typeof minified === 'string' ? minified : minified!.code;
    expect(code.length).toBeLessThan(source.length);
    expect(code).not.toContain('a comment that should not survive');
    expect(code).not.toContain('someLongLocalName');
    // The public export has to keep its name or importers break.
    expect(code).toContain('hello');
  });

  /**
   * Minified output only maps back to source if the minifier emits a map of its own for
   * Rollup to chain. The plugin defaults that on, which costs work on the far more common
   * non-sourcemap build, so the setting is wired to the build's — both directions asserted.
   */
  it('emits a sourcemap only when the build asked for one', async () => {
    const source =
      'export const hello = () => {\n  const someLongLocalName = 1 + 1;\n  return someLongLocalName;\n};\n';

    const renderWith = async (sourcemap: boolean) => {
      const plugins = await getPlugins(true, sourcemap);
      const outputs = await Promise.all(plugins.filter(Boolean).map(plugin => renderChunk(plugin, source)));

      return outputs.find(output => output != null);
    };

    const withMap = await renderWith(true);
    const withoutMap = await renderWith(false);

    expect(typeof withMap === 'string' ? null : withMap!.map).toBeTruthy();
    expect(typeof withoutMap === 'string' ? null : withoutMap!.map).toBeFalsy();
  });
});
