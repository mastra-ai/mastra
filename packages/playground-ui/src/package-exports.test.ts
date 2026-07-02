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
});
