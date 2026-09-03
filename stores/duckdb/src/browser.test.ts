import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import * as browserEntry from './browser';
import * as nodeEntry from './index';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { exports: Record<string, Record<string, unknown>> };

describe('package entry points', () => {
  it('exposes the same public API from the browser stub as the node entry', () => {
    expect(Object.keys(browserEntry).sort()).toEqual(Object.keys(nodeEntry).sort());
  });

  it('throws a server-only error when the browser stub is used', () => {
    expect(() => new browserEntry.DuckDBVector()).toThrow(/only available in Node\.js server environments/);
    expect(() => new browserEntry.DuckDBStore()).toThrow(/only available in Node\.js server environments/);
  });

  it('maps the browser condition to the stub and keeps node on the real entry', () => {
    const root = pkg.exports['.']!;
    expect(root.browser).toMatchObject({ import: './dist/browser.js', require: './dist/browser.cjs' });
    expect(root.import).toMatchObject({ default: './dist/index.js' });
    expect(root.require).toMatchObject({ default: './dist/index.cjs' });
  });

  it('keeps @duckdb/node-api as a static import so `mastra build` discovers it as a runtime dependency', () => {
    for (const file of ['./storage/db/index.ts', './vector/index.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source).toMatch(/^import \{[^}]*\} from '@duckdb\/node-api';/m);
    }
  });
});
