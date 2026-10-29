import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const esmEntry = path.join(distDir, 'storage/dashboards.js');
const cjsEntry = path.join(distDir, 'storage/dashboards.cjs');
const require = createRequire(import.meta.url);
// `@mastra/core` accepts zod ^3.25 or ^4 as a peer and imports `zod/v4`, so the entry must load with
// either package behind that specifier.
const zodEntries = { 'zod 4': require.resolve('zod/v4'), 'zod 3.25': require.resolve('zod-v3/v4') };

function collectBareImports(entry: string): string[] {
  const visited = new Set<string>();
  const found: string[] = [];
  const walk = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(/from "([^"]+)"|^import "([^"]+)"/gm)) {
      const specifier = match[1] ?? match[2]!;
      if (specifier.startsWith('.')) walk(path.resolve(path.dirname(file), specifier));
      else found.push(`${path.basename(file)} -> ${specifier}`);
    }
  };
  walk(entry);
  return found;
}

/**
 * Loads a CommonJS graph into a fresh context that has only the globals a browser shares with
 * plain JavaScript: no `process`, `Buffer`, global `require` or Node built-ins. Each module gets
 * a `require` that resolves files inside `dist` and the given zod `v4` entry, like a browser bundler would.
 */
function loadInBrowserLikeContext(entry: string, zodEntry = zodEntries['zod 4']): Record<string, unknown> {
  const context = vm.createContext({ TextEncoder, TextDecoder, URL, console });
  const cache = new Map<string, { exports: unknown }>();
  const resolveFile = (from: string, specifier: string) => {
    if (specifier === 'zod/v4') return zodEntry;
    if (!specifier.startsWith('.')) throw new Error(`Browser bundle cannot load '${specifier}' (from ${from})`);
    const base = path.resolve(path.dirname(from), specifier);
    const file = ['', '.cjs', '.js', '/index.cjs', '/index.js'].map(suffix => base + suffix).find(existsSync);
    if (!file) throw new Error(`Cannot resolve '${specifier}' from ${from}`);
    return file;
  };
  const load = (file: string): unknown => {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const module = { exports: {} };
    cache.set(file, module);
    const wrapper = vm.runInContext(
      `(function (exports, require, module) {${readFileSync(file, 'utf8')}\n})`,
      context,
      {
        filename: file,
      },
    ) as (exports: unknown, require: (specifier: string) => unknown, module: { exports: unknown }) => void;
    wrapper(module.exports, specifier => load(resolveFile(file, specifier)), module);
    return module.exports;
  };
  return load(entry) as Record<string, unknown>;
}

const where = { op: 'eq', left: { path: 'rootEntityName' }, right: { literal: 'support-agent' } };
const having = { op: 'eq', left: { path: 'rootEntityName' }, right: { literal: 'triage-agent' } };

const definition = {
  schemaVersion: 1,
  defaults: {
    datePreset: '24h',
    filters: [
      { fieldId: 'environment', value: 'production' },
      {
        id: 'g1',
        logic: 'or',
        nodes: [
          { id: 't1', fieldId: 'rootEntityName', value: ['support-agent'] },
          { id: 'g2', logic: 'and', nodes: [{ id: 't2', fieldId: 'status', value: 'error', operatorId: 'is' }] },
        ],
      },
    ],
  },
  rows: [
    {
      widgets: [
        {
          id: 'everything',
          span: 12,
          kind: 'kpis',
          views: [
            {
              queries: [
                { source: 'traceAggregate', measures: ['count'], groupBy: ['rootEntityName'], where, having },
                { source: 'spanAggregate', measures: ['count'], groupBy: ['rootEntityName'], where, having },
                {
                  source: 'metrics',
                  request: 'breakdown',
                  name: ['mastra_model_total_input_tokens'],
                  groupBy: ['entityName'],
                  aggregation: 'sum',
                  filters: { entityName: 'support-agent' },
                },
                {
                  source: 'scores',
                  request: 'aggregate',
                  scorerId: 'relevance',
                  aggregation: 'avg',
                  filters: { entityName: 'support-agent' },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

type SafeParse = { safeParse: (input: unknown) => { success: boolean; error?: { issues: unknown[] } } };

// Browser apps (the Platform dashboards page) import this entry directly, so its build output must
// load and parse with nothing from Node.
describe.skipIf(!existsSync(esmEntry))('storage/dashboards build output', () => {
  it('imports nothing but its own chunks and zod', () => {
    expect(collectBareImports(esmEntry).filter(line => !line.endsWith('-> zod/v4'))).toEqual([]);
  });

  it.each(Object.entries(zodEntries))(
    'loads and parses every query source without Node globals or built-ins (%s)',
    (_, zodEntry) => {
      const entry = loadInBrowserLikeContext(cjsEntry, zodEntry);
      const full = (entry.dashboardDefinitionSchema as SafeParse).safeParse(definition);
      expect(full.error?.issues).toBeUndefined();
      expect(full.success).toBe(true);
      expect((entry.dashboardDefinitionEnvelopeSchema as SafeParse).safeParse(definition).success).toBe(true);
      expect(typeof entry.migrateDashboardDefinition).toBe('function');
    },
  );

  it('really has no Node globals in that context', () => {
    expect(() => loadInBrowserLikeContext(path.join(distDir, 'storage/index.cjs'))).toThrow();
  });
});
