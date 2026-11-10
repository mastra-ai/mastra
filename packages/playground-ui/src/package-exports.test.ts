import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package exports', () => {
  it('does not publish root or broad barrel entrypoints', () => {
    expect(packageJson).not.toHaveProperty('main');
    expect(packageJson).not.toHaveProperty('module');
    expect(packageJson).not.toHaveProperty('types');
    for (const barrel of ['.', './components', './hooks', './utils']) {
      expect(packageJson.exports).not.toHaveProperty([barrel]);
    }
  });

  it('publishes the lib entrypoint', () => {
    expect(packageJson.exports['./lib/*']).toEqual({
      import: {
        types: './dist/lib/*.d.ts',
        default: './dist/lib/*.es.js',
      },
      require: {
        types: './dist/lib/*.d.ts',
        default: './dist/lib/*.cjs.js',
      },
    });
  });

  it('publishes fonts.css with every font package it imports as a dependency', () => {
    expect(packageJson.exports['./fonts.css']).toBe('./fonts.css');
    expect(packageJson.files).toContain('fonts.css');

    const fontsCss = readFileSync(resolve(__dirname, '../fonts.css'), 'utf8');
    const imported = [...fontsCss.matchAll(/@import '(@fontsource[^/]*\/[^/']+)\//g)].map(([, name]) => name);
    expect(imported.length).toBeGreaterThan(0);
    for (const name of imported) {
      expect(packageJson.dependencies, name).toHaveProperty([name]);
    }
  });

  it('publishes the tabbed container layout entrypoint', () => {
    expect(packageJson.exports['./layout/tabbed-container']).toEqual({
      import: {
        types: './dist/layout/tabbed-container.d.ts',
        default: './dist/layout/tabbed-container.es.js',
      },
    });
  });
});
