import { describe, it, expect } from 'vitest';
import { getInputOptions } from './bundler';

const analyzedBundleInfo = {
  dependencies: new Map<string, string>(),
  externalDependencies: new Set<string>(),
  workspaceMap: new Map(),
};

function getEsbuildPlugin(result: any) {
  return result.plugins.find((p: any) => p?.name === 'esbuild');
}

describe('getInputOptions', () => {
  it('uses production NODE_ENV by default', async () => {
    const result = await getInputOptions(
      'test-entry.js',
      analyzedBundleInfo,
      'node',
      undefined,
      { projectRoot: '/test/project' }
    );

    const esbuildPlugin = getEsbuildPlugin(result);

    expect(esbuildPlugin).toBeDefined();
    expect(esbuildPlugin.options.define['process.env.NODE_ENV'])
      .toBe(JSON.stringify('production'));
  });

  it('uses custom NODE_ENV when provided', async () => {
    const result = await getInputOptions(
      'test-entry.js',
      analyzedBundleInfo,
      'node',
      { 'process.env.NODE_ENV': JSON.stringify('development') },
      { projectRoot: '/test/project' }
    );

    const esbuildPlugin = getEsbuildPlugin(result);

    expect(esbuildPlugin.options.define['process.env.NODE_ENV'])
      .toBe(JSON.stringify('development'));
  });
});
