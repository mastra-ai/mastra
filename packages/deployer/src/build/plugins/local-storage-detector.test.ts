import type { Plugin } from 'rollup';
import { describe, expect, it } from 'vitest';
import { localStorageDetector } from './local-storage-detector';

describe('localStorageDetector', () => {
  function getPlugin(): Plugin & { transform: Function; generateBundle: Function } {
    return localStorageDetector() as Plugin & { transform: Function; generateBundle: Function };
  }

  it('collects file: paths from user modules', () => {
    const plugin = getPlugin();
    plugin.transform(`const url = 'file:./mastra.db';`, '/project/src/mastra/index.ts');

    const emitted: Array<{ fileName: string; source: string }> = [];
    const ctx = {
      emitFile(file: { fileName: string; source: string }) {
        emitted.push(file);
      },
    };
    plugin.generateBundle.call(
      ctx,
      {},
      {
        'index.mjs': {
          type: 'chunk',
          modules: {
            '/project/src/mastra/index.ts': { renderedLength: 100 },
          },
        },
      },
    );

    expect(emitted).toHaveLength(1);
    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(1);
    expect(detections[0].value).toBe('file:./mastra.db');
    expect(detections[0].module).toBe('/project/src/mastra/index.ts');
  });

  it('ignores modules from node_modules', () => {
    const plugin = getPlugin();
    plugin.transform(`const url = 'file:./mastra.db';`, '/project/node_modules/@mastra/agent-builder/dist/defaults.js');

    const emitted: Array<{ fileName: string; source: string }> = [];
    const ctx = {
      emitFile(file: { fileName: string; source: string }) {
        emitted.push(file);
      },
    };
    plugin.generateBundle.call(
      ctx,
      {},
      {
        'index.mjs': {
          type: 'chunk',
          modules: {
            '/project/node_modules/@mastra/agent-builder/dist/defaults.js': { renderedLength: 200 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(0);
  });

  it('excludes tree-shaken modules (renderedLength === 0)', () => {
    const plugin = getPlugin();
    plugin.transform(`const url = 'file:./mastra.db';`, '/project/src/unused.ts');

    const emitted: Array<{ fileName: string; source: string }> = [];
    const ctx = {
      emitFile(file: { fileName: string; source: string }) {
        emitted.push(file);
      },
    };
    plugin.generateBundle.call(
      ctx,
      {},
      {
        'index.mjs': {
          type: 'chunk',
          modules: {
            '/project/src/unused.ts': { renderedLength: 0 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(0);
  });

  it('deduplicates identical value+hint pairs across modules', () => {
    const plugin = getPlugin();
    plugin.transform(`const url = 'file:./mastra.db';`, '/project/src/a.ts');
    plugin.transform(`const url = 'file:./mastra.db';`, '/project/src/b.ts');

    const emitted: Array<{ fileName: string; source: string }> = [];
    const ctx = {
      emitFile(file: { fileName: string; source: string }) {
        emitted.push(file);
      },
    };
    plugin.generateBundle.call(
      ctx,
      {},
      {
        'index.mjs': {
          type: 'chunk',
          modules: {
            '/project/src/a.ts': { renderedLength: 50 },
            '/project/src/b.ts': { renderedLength: 50 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(1);
  });

  it('detects localhost connection strings', () => {
    const plugin = getPlugin();
    plugin.transform(`const pg = 'postgresql://user:pass@localhost:5432/db';`, '/project/src/db.ts');

    const emitted: Array<{ fileName: string; source: string }> = [];
    const ctx = {
      emitFile(file: { fileName: string; source: string }) {
        emitted.push(file);
      },
    };
    plugin.generateBundle.call(
      ctx,
      {},
      {
        'index.mjs': {
          type: 'chunk',
          modules: {
            '/project/src/db.ts': { renderedLength: 80 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(1);
    expect(detections[0].hint).toBe('localhost in a connection string');
  });

  it('emits empty array when no detections found', () => {
    const plugin = getPlugin();
    plugin.transform(`const x = 'hello world';`, '/project/src/clean.ts');

    const emitted: Array<{ fileName: string; source: string }> = [];
    const ctx = {
      emitFile(file: { fileName: string; source: string }) {
        emitted.push(file);
      },
    };
    plugin.generateBundle.call(
      ctx,
      {},
      {
        'index.mjs': {
          type: 'chunk',
          modules: {
            '/project/src/clean.ts': { renderedLength: 30 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(0);
  });
});
