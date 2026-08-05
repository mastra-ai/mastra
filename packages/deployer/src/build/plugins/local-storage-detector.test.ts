import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';
import type { Plugin } from 'rollup';
import { parseAst } from 'rollup/parseAst';
import { describe, expect, it } from 'vitest';
import { localStorageDetector } from './local-storage-detector';
import type { LocalStorageDetection, PreflightMetadata } from './local-storage-detector';

/**
 * Drives the plugin the way Rollup does: `transform` for each module (with a
 * `this.parse` context, like Rollup provides), then `generateBundle` with a
 * chunk whose `modules` map controls tree-shaking (`renderedLength`).
 */
function runPlugin(
  modules: Array<{ id: string; code: string; renderedLength?: number }>,
  rootDir?: string,
): {
  metadata: PreflightMetadata;
  legacy: LocalStorageDetection[];
  emitted: Array<{ fileName: string; source: string }>;
} {
  const plugin = localStorageDetector(rootDir) as Plugin & { transform: Function; generateBundle: Function };

  const transformCtx = { parse: (code: string) => parseAst(code) };
  for (const { id, code } of modules) {
    plugin.transform.call(transformCtx, code, id);
  }

  const emitted: Array<{ fileName: string; source: string }> = [];
  const generateCtx = {
    emitFile(file: { fileName: string; source: string }) {
      emitted.push(file);
    },
  };
  const chunkModules: Record<string, { renderedLength: number }> = {};
  for (const { id, renderedLength } of modules) {
    chunkModules[id] = { renderedLength: renderedLength ?? 100 };
  }
  plugin.generateBundle.call(generateCtx, {}, { 'index.mjs': { type: 'chunk', modules: chunkModules } });

  const metadataFile = emitted.find(f => f.fileName === 'preflight-metadata.json');
  const legacyFile = emitted.find(f => f.fileName === 'preflight-local-paths.json');
  if (!metadataFile || !legacyFile) throw new Error('expected both metadata assets to be emitted');

  return {
    metadata: JSON.parse(metadataFile.source),
    legacy: JSON.parse(legacyFile.source),
    emitted,
  };
}

describe('localStorageDetector', () => {
  it('collects file: paths from user modules', () => {
    const { metadata, legacy } = runPlugin([
      { id: '/project/src/mastra/index.ts', code: `const url = 'file:./mastra.db';` },
    ]);

    expect(metadata.localPaths).toHaveLength(1);
    expect(metadata.localPaths[0]!.value).toBe('file:./mastra.db');
    expect(metadata.localPaths[0]!.module).toBe('/project/src/mastra/index.ts');
    expect(metadata.localPaths[0]!.guardedBy).toBeUndefined();
    expect(legacy).toHaveLength(1);
  });

  it('ignores modules from node_modules', () => {
    const { metadata, legacy } = runPlugin([
      {
        id: '/project/node_modules/@mastra/agent-builder/dist/defaults.js',
        code: `const url = 'file:./mastra.db';`,
        renderedLength: 200,
      },
    ]);

    expect(metadata.localPaths).toHaveLength(0);
    expect(legacy).toHaveLength(0);
  });

  it('ignores deployer .mastra/.build pre-bundled dependency files', () => {
    // Reproduces the false positive triggered when the optimizer pre-bundles
    // `@mastra/core` into `.mastra/.build/@mastra__core__*.mjs` shims and
    // shared `chunk-*.mjs` files. These preserve JSDoc examples like
    // `url: 'file:./data.db'`.
    const { metadata } = runPlugin([
      {
        id: '/project/.mastra/.build/@mastra__core__mastra.mjs',
        code: `const example = "storage: new LibSQLStore({ url: 'file:./data.db' })";`,
        renderedLength: 5000,
      },
      {
        id: '/project/.mastra/.build/@mastra__core.mjs',
        code: `const example = "url: 'file:./data.db'";`,
        renderedLength: 5000,
      },
      {
        id: '/project/.mastra/.build/@ag-ui__mastra.mjs',
        code: `const example = "url: 'file:./data.db'";`,
        renderedLength: 5000,
      },
      {
        id: '/project/.mastra/.build/chunk-2TLN5H7J.mjs',
        code: `const example = "new LibSQLStore({ id: 'mastra-storage', url: 'file:./data.db' })";`,
        renderedLength: 5000,
      },
    ]);

    expect(metadata.localPaths).toHaveLength(0);
  });

  it('ignores symlinked dependencies outside the project root (pnpm link:)', () => {
    // pnpm `link:`/`file:` deps resolve through the symlink to a real path
    // that never contains `node_modules` — e.g. a linked @mastra/server dist
    // whose JSDoc examples mention `file:./mastra.db`. Anything outside the
    // project root is library code.
    const { metadata } = runPlugin(
      [
        {
          id: '/home/dev/worktrees/mastra/packages/server/dist/dist-JNS5ZLN3.js',
          code: `const example = "url: 'file:./mastra.db'"; const flag = process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS;`,
          renderedLength: 5000,
        },
        {
          id: '/project/src/mastra/index.ts',
          code: `const url = 'file:./user.db'; const key = process.env.USER_KEY;`,
          renderedLength: 500,
        },
      ],
      '/project',
    );

    expect(metadata.localPaths).toHaveLength(1);
    expect(metadata.localPaths[0]!.value).toBe('file:./user.db');
    expect(metadata.userEnvRefs).toEqual(['USER_KEY']);
  });

  it('excludes tree-shaken modules (renderedLength === 0)', () => {
    const { metadata } = runPlugin([
      {
        id: '/project/src/unused.ts',
        code: `const url = 'file:./mastra.db'; const key = process.env.UNUSED_KEY;`,
        renderedLength: 0,
      },
    ]);

    expect(metadata.localPaths).toHaveLength(0);
    expect(metadata.userEnvRefs).toHaveLength(0);
  });

  it('deduplicates identical value+hint pairs across modules', () => {
    const { metadata } = runPlugin([
      { id: '/project/src/a.ts', code: `const url = 'file:./mastra.db';`, renderedLength: 50 },
      { id: '/project/src/b.ts', code: `const url = 'file:./mastra.db';`, renderedLength: 50 },
    ]);

    expect(metadata.localPaths).toHaveLength(1);
  });

  it('detects localhost connection strings', () => {
    const { metadata } = runPlugin([
      { id: '/project/src/db.ts', code: `const pg = 'postgresql://user:pass@localhost:5432/db';`, renderedLength: 80 },
    ]);

    expect(metadata.localPaths).toHaveLength(1);
    expect(metadata.localPaths[0]!.hint).toBe('localhost in a connection string');
  });

  it('detects 127.0.0.1 connection strings', () => {
    const { metadata } = runPlugin([
      { id: '/project/src/cache.ts', code: `const r = 'redis://127.0.0.1:6379';`, renderedLength: 60 },
    ]);

    expect(metadata.localPaths).toHaveLength(1);
    expect(metadata.localPaths[0]!.hint).toBe('127.0.0.1 in a connection string');
  });

  it('reproduces original bug fix: agent-builder prompt templates are excluded', () => {
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

    const { metadata } = runPlugin([
      // These come from node_modules — plugin should ignore them
      {
        id: '/project/node_modules/@mastra/agent-builder/dist/defaults.js',
        code: agentBuilderDefaults,
        renderedLength: 500,
      },
      {
        id: '/project/node_modules/@mastra/agent-builder/dist/workflows/workflow-builder/prompts.js',
        code: agentBuilderPrompts,
        renderedLength: 300,
      },
      // User code has NO local paths
      { id: '/project/src/mastra/index.ts', code: `export const mastra = new Mastra({});` },
    ]);

    expect(metadata.localPaths).toHaveLength(0);
  });

  it('flags user code but not library code in the same bundle', () => {
    const { metadata } = runPlugin([
      // Library: has local path but in node_modules
      {
        id: '/project/node_modules/@mastra/agent-builder/dist/defaults.js',
        code: `const url = 'file:./mastra.db';`,
        renderedLength: 200,
      },
      // User: also has a local path — this SHOULD be flagged
      { id: '/project/src/mastra/index.ts', code: `const db = 'file:./my-app.db';` },
    ]);

    expect(metadata.localPaths).toHaveLength(1);
    expect(metadata.localPaths[0]!.value).toBe('file:./my-app.db');
    expect(metadata.localPaths[0]!.module).toBe('/project/src/mastra/index.ts');
  });

  it('does not flag hosted URLs (turso, remote postgres)', () => {
    const { metadata } = runPlugin([
      {
        id: '/project/src/db.ts',
        code: `const url = 'libsql://my-db-acme.turso.io'; const pg = 'postgresql://user:pass@db.render.com:5432/app';`,
      },
    ]);

    expect(metadata.localPaths).toHaveLength(0);
  });

  it('emits empty arrays when nothing is found', () => {
    const { metadata, legacy } = runPlugin([
      { id: '/project/src/clean.ts', code: `const x = 'hello world';`, renderedLength: 30 },
    ]);

    expect(metadata).toEqual({ version: 1, localPaths: [], userEnvRefs: [] });
    expect(legacy).toHaveLength(0);
  });

  describe('guardedBy detection', () => {
    it('records guardedBy for `process.env.X || literal`', () => {
      const { metadata } = runPlugin([
        {
          id: '/project/src/constants.ts',
          code: `const url = process.env.TURSO_DATABASE_URL || "file:./.mastra-demo.db";`,
        },
      ]);

      expect(metadata.localPaths).toHaveLength(1);
      expect(metadata.localPaths[0]!.value).toBe('file:./.mastra-demo.db');
      expect(metadata.localPaths[0]!.guardedBy).toBe('TURSO_DATABASE_URL');
    });

    it('records guardedBy for `process.env.X ?? literal`', () => {
      const { metadata } = runPlugin([
        {
          id: '/project/src/constants.ts',
          code: `const url = process.env.TURSO_DATABASE_URL ?? "file:./.mastra-demo.db";`,
        },
      ]);

      expect(metadata.localPaths[0]!.guardedBy).toBe('TURSO_DATABASE_URL');
    });

    it('records guardedBy for bracket-notation env reads', () => {
      const { metadata } = runPlugin([
        {
          id: '/project/src/constants.ts',
          code: `const url = process.env["TURSO_DATABASE_URL"] || "file:./.mastra-demo.db";`,
        },
      ]);

      expect(metadata.localPaths[0]!.guardedBy).toBe('TURSO_DATABASE_URL');
    });

    it('records guardedBy for chained fallbacks (`a || b || literal`)', () => {
      const { metadata } = runPlugin([
        {
          id: '/project/src/constants.ts',
          code: `const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./.mastra-demo.db";`,
        },
      ]);

      expect(metadata.localPaths[0]!.guardedBy).toBe('TURSO_DATABASE_URL');
    });

    it('does not record guardedBy for a bare literal', () => {
      const { metadata } = runPlugin([{ id: '/project/src/db.ts', code: `const url = "file:./a.db";` }]);

      expect(metadata.localPaths).toHaveLength(1);
      expect(metadata.localPaths[0]!.guardedBy).toBeUndefined();
    });

    it('does not record guardedBy when the same value also appears unguarded', () => {
      const { metadata } = runPlugin([
        {
          id: '/project/src/db.ts',
          code: `const a = process.env.TURSO_DATABASE_URL || "file:./a.db"; const b = "file:./a.db";`,
        },
      ]);

      expect(metadata.localPaths).toHaveLength(1);
      expect(metadata.localPaths[0]!.guardedBy).toBeUndefined();
    });

    it('falls back to unguarded detection when the module fails to parse', () => {
      const { metadata } = runPlugin([
        { id: '/project/src/broken.ts', code: `const url = 'file:./a.db'; this is not { valid js` },
      ]);

      expect(metadata.localPaths).toHaveLength(1);
      expect(metadata.localPaths[0]!.guardedBy).toBeUndefined();
    });
  });

  describe('userEnvRefs collection', () => {
    it('collects process.env reads from user modules (dot and bracket notation)', () => {
      const { metadata } = runPlugin([
        {
          id: '/project/src/mastra/index.ts',
          code: `const a = process.env.TURSO_DATABASE_URL; const b = process.env['OPENAI_API_KEY'];`,
        },
      ]);

      expect(metadata.userEnvRefs).toEqual(['OPENAI_API_KEY', 'TURSO_DATABASE_URL']);
    });

    it('excludes env reads from node_modules and .mastra/.build files', () => {
      const { metadata } = runPlugin([
        {
          id: '/project/node_modules/@mastra/server/dist/handlers/agents.js',
          code: `const flag = process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS;`,
          renderedLength: 400,
        },
        {
          id: '/project/.mastra/.build/@mastra__core.mjs',
          code: `const flag = process.env.LIB_INTERNAL_FLAG;`,
          renderedLength: 400,
        },
        {
          id: '/project/.mastra/.build/telemetry-config.mjs',
          code: `const t = process.env.OTHER_BUILD_FLAG;`,
          renderedLength: 400,
        },
        { id: '/project/src/mastra/index.ts', code: `const key = process.env.OPENAI_API_KEY;` },
      ]);

      expect(metadata.userEnvRefs).toEqual(['OPENAI_API_KEY']);
    });
  });

  it('produces correct metadata through a real Rollup build (end-to-end)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'local-storage-detector-e2e-'));
    try {
      // Shaped like esbuild-transpiled user output — the plugin runs
      // post-esbuild in the deployer's chain.
      writeFileSync(
        join(dir, 'entry.mjs'),
        `const url = process.env.TURSO_DATABASE_URL || "file:./.mastra-demo.db";\n` +
          `const key = process.env.OPENAI_API_KEY;\n` +
          `const bare = "file:./other.db";\n` +
          `export default { url, key, bare };\n`,
      );

      const bundle = await rollup({
        input: join(dir, 'entry.mjs'),
        plugins: [localStorageDetector()],
        logLevel: 'silent',
      });
      await bundle.write({ dir: join(dir, 'out'), format: 'esm' });
      await bundle.close();

      const metadata: PreflightMetadata = JSON.parse(
        readFileSync(join(dir, 'out', 'preflight-metadata.json'), 'utf-8'),
      );
      expect(metadata.version).toBe(1);
      expect(metadata.userEnvRefs).toEqual(['OPENAI_API_KEY', 'TURSO_DATABASE_URL']);
      expect(metadata.localPaths).toEqual([
        expect.objectContaining({ value: 'file:./.mastra-demo.db', guardedBy: 'TURSO_DATABASE_URL' }),
        expect.objectContaining({ value: 'file:./other.db' }),
      ]);
      expect(metadata.localPaths[1]!.guardedBy).toBeUndefined();

      const legacy: LocalStorageDetection[] = JSON.parse(
        readFileSync(join(dir, 'out', 'preflight-local-paths.json'), 'utf-8'),
      );
      expect(legacy.map(d => d.value)).toEqual(['file:./.mastra-demo.db', 'file:./other.db']);
      expect(Object.keys(legacy[0]!)).toEqual(['value', 'hint', 'module']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the legacy preflight-local-paths.json shape unchanged (no guardedBy)', () => {
    const { legacy } = runPlugin([
      {
        id: '/project/src/constants.ts',
        code: `const url = process.env.TURSO_DATABASE_URL || "file:./.mastra-demo.db";`,
      },
    ]);

    expect(legacy).toEqual([
      {
        value: 'file:./.mastra-demo.db',
        hint: 'LibSQL/SQLite file path relative to the build host',
        module: '/project/src/constants.ts',
      },
    ]);
  });
});
