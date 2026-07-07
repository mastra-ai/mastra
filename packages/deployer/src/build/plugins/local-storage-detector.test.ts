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

  it('ignores all deployer .mastra/.build shim files', () => {
    // Reproduces the false positive triggered when a user sets a `bundler:` field
    // in `new Mastra({...})`, which causes the optimizer to pre-bundle
    // dependencies into `.mastra/.build/*.mjs` shims. These shims preserve
    // JSDoc examples like `url: 'file:./data.db'`. Non-@mastra shims (e.g.
    // `@ag-ui__mastra.mjs`) can carry the same JSDoc, so the whole directory
    // must be excluded.
    const plugin = getPlugin();
    plugin.transform(
      `const example = "storage: new LibSQLStore({ url: 'file:./data.db' })";`,
      '/project/.mastra/.build/@mastra__core__mastra.mjs',
    );
    plugin.transform(`const example = "url: 'file:./data.db'";`, '/project/.mastra/.build/@mastra__core.mjs');
    plugin.transform(`const example = "url: 'file:./data.db'";`, '/project/.mastra/.build/@ag-ui__mastra.mjs');

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
            '/project/.mastra/.build/@mastra__core__mastra.mjs': { renderedLength: 5000 },
            '/project/.mastra/.build/@mastra__core.mjs': { renderedLength: 5000 },
            '/project/.mastra/.build/@ag-ui__mastra.mjs': { renderedLength: 5000 },
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

  it('detects 127.0.0.1 connection strings', () => {
    const plugin = getPlugin();
    plugin.transform(`const r = 'redis://127.0.0.1:6379';`, '/project/src/cache.ts');

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
            '/project/src/cache.ts': { renderedLength: 60 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(1);
    expect(detections[0].hint).toBe('127.0.0.1 in a connection string');
  });

  it('reproduces original bug fix: agent-builder prompt templates are excluded', () => {
    const plugin = getPlugin();

    // Exact content from packages/agent-builder/src/defaults.ts and prompts.ts
    const agentBuilderDefaults = `
      const defaults = {
        url: 'file:../mastra.db', // ask user what database to use
        comment: '// stores observability into memory storage, if it needs to persist, change to file:../mastra.db'
      };
    `;
    const agentBuilderPrompts = `
      const example = "storage: new LibSQLStore({ id: 'mastra-storage', url: 'file:./mastra.db' })";
    `;

    // These come from node_modules — plugin should ignore them
    plugin.transform(agentBuilderDefaults, '/project/node_modules/@mastra/agent-builder/dist/defaults.js');
    plugin.transform(
      agentBuilderPrompts,
      '/project/node_modules/@mastra/agent-builder/dist/workflows/workflow-builder/prompts.js',
    );

    // User code has NO local paths
    plugin.transform(`export const mastra = new Mastra({});`, '/project/src/mastra/index.ts');

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
            '/project/node_modules/@mastra/agent-builder/dist/defaults.js': { renderedLength: 500 },
            '/project/node_modules/@mastra/agent-builder/dist/workflows/workflow-builder/prompts.js': {
              renderedLength: 300,
            },
            '/project/src/mastra/index.ts': { renderedLength: 100 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(0);
  });

  it('flags user code but not library code in the same bundle', () => {
    const plugin = getPlugin();

    // Library: has local path but in node_modules
    plugin.transform(`const url = 'file:./mastra.db';`, '/project/node_modules/@mastra/agent-builder/dist/defaults.js');
    // User: also has a local path — this SHOULD be flagged
    plugin.transform(`const db = 'file:./my-app.db';`, '/project/src/mastra/index.ts');

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
            '/project/src/mastra/index.ts': { renderedLength: 100 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(1);
    expect(detections[0].value).toBe('file:./my-app.db');
    expect(detections[0].module).toBe('/project/src/mastra/index.ts');
  });

  it('does not flag hosted URLs (turso, remote postgres)', () => {
    const plugin = getPlugin();
    plugin.transform(
      `const url = 'libsql://my-db-acme.turso.io'; const pg = 'postgresql://user:pass@db.render.com:5432/app';`,
      '/project/src/db.ts',
    );

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
            '/project/src/db.ts': { renderedLength: 100 },
          },
        },
      },
    );

    const detections = JSON.parse(emitted[0]!.source);
    expect(detections).toHaveLength(0);
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
