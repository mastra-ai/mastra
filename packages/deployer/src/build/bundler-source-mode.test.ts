import type { Plugin } from 'rollup';
import { describe, it, expect, afterEach } from 'vitest';
import { getInputOptions } from './bundler';

describe('bundler source mode', () => {
  const originalSourceMode = process.env.MASTRA_SOURCE_MODE;

  afterEach(() => {
    if (originalSourceMode === undefined) {
      delete process.env.MASTRA_SOURCE_MODE;
    } else {
      process.env.MASTRA_SOURCE_MODE = originalSourceMode;
    }
  });

  it('keeps dev workspace imports on package export specifiers', async () => {
    process.env.MASTRA_SOURCE_MODE = '1';

    const inputOptions = await getInputOptions(
      'test-entry.js',
      {
        dependencies: new Map([['@mastra/core/evals/scoreTraces', 'packages/core/src/evals/scoreTraces/index.ts']]),
        externalDependencies: new Map(),
        workspaceMap: new Map(),
      },
      'node',
      undefined,
      {
        isDev: true,
        projectRoot: '/workspace',
        workspaceRoot: '/workspace',
      },
    );

    const plugin = (inputOptions.plugins as Plugin[]).find(plugin => plugin.name === 'alias-optimized-deps');
    const resolveId = plugin?.resolveId;
    const result =
      typeof resolveId === 'function'
        ? await resolveId.call({} as never, '@mastra/core/evals/scoreTraces', undefined, {} as never)
        : await resolveId?.handler.call({} as never, '@mastra/core/evals/scoreTraces', undefined, {} as never);

    expect(result).toEqual({
      id: '@mastra/core/evals/scoreTraces',
      external: true,
    });
  });
});
