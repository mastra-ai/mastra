import { existsSync, readFileSync } from 'node:fs';
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

  it('publishes fonts.css together with every font file it points at', () => {
    expect(packageJson.exports['./fonts.css']).toBe('./fonts.css');
    expect(packageJson.files).toEqual(expect.arrayContaining(['fonts.css', 'fonts']));

    const fontsCss = readFileSync(resolve(__dirname, '../fonts.css'), 'utf8');
    const files = [...fontsCss.matchAll(/url\('\.\/(fonts\/[^']+\.woff2)'\)/g)].map(([, file]) => file);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(existsSync(resolve(__dirname, '..', file)), file).toBe(true);
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
