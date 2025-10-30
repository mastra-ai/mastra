import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import { checkConfigExport } from './check-config-export';

describe('checkConfigExport Babel plugin', () => {
  function runPlugin(code: string) {
    const result = { hasValidConfig: false };
    transformSync(code, {
      filename: 'testfile.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [checkConfigExport(result)],
      configFile: false,
      babelrc: false,
    });
    return result.hasValidConfig;
  }

  it('matches export const mastra = new Mastra()', () => {
    const code = 'export const mastra = new Mastra()';
    expect(runPlugin(code)).toBe(true);
  });

  it('matches const mastra = new Mastra(); export { mastra }', () => {
    const code = 'const mastra = new Mastra(); export { mastra }';
    expect(runPlugin(code)).toBe(true);
  });

  it('matches const foo = new Mastra(); export { foo as mastra }', () => {
    const code = 'const foo = new Mastra(); export { foo as mastra }';
    expect(runPlugin(code)).toBe(true);
  });

  it('matches const foo = new Mastra(); const bar = 1; export { foo as mastra, bar }', () => {
    const code = 'const foo = new Mastra(); const bar = 1; export { foo as mastra, bar }';
    expect(runPlugin(code)).toBe(true);
  });

  it('does not match export const mastra = 123', () => {
    const code = 'export const mastra = 123';
    expect(runPlugin(code)).toBe(false);
  });

  it('does not match export const mastra = getMastra()', () => {
    const code = 'export const mastra = getMastra()';
    expect(runPlugin(code)).toBe(false);
  });

  it('does not match export { mastra } if mastra is not new Mastra()', () => {
    const code = 'const mastra = 123; export { mastra }';
    expect(runPlugin(code)).toBe(false);
  });

  it('does not match export { foo as mastra } if foo is not new Mastra()', () => {
    const code = 'const foo = 123; export { foo as mastra }';
    expect(runPlugin(code)).toBe(false);
  });

  it('does not match unrelated exports', () => {
    const code = 'const foo = new Mastra(); export { foo }';
    expect(runPlugin(code)).toBe(false);
  });

  it('does not match export default new Mastra()', () => {
    const code = 'export default new Mastra()';
    expect(runPlugin(code)).toBe(false);
  });

  it('works with the babel-typescript preset', () => {
    const code = 'type A = any; const foo: A = 123; export const mastra = new Mastra()';
    expect(runPlugin(code)).toBe(true);
  });
});
