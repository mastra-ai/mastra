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

  it('publishes the new tabbed container entrypoint', () => {
    expect(packageJson.exports['./new/layout/tabbed-container']).toEqual({
      import: {
        types: './dist/new/layout/tabbed-container.d.ts',
        default: './dist/new/layout/tabbed-container.es.js',
      },
    });
  });
});
