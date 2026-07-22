import { transformSync } from '@babel/core';
import { describe, it, expect } from 'vitest';
import { checkConfigExport } from './check-config-export';

describe('checkConfigExport Babel plugin', () => {
  function runPlugin(code: string) {
    const result: { hasValidConfig: boolean; projectType?: string } = { hasValidConfig: false };
    transformSync(code, {
      filename: 'testfile.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [() => checkConfigExport(result)],
      configFile: false,
      babelrc: false,
    });
    return result;
  }

  it('matches export const mastra = new Mastra()', () => {
    const code = 'export const mastra = new Mastra()';
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  it('matches const mastra = new Mastra(); export { mastra }', () => {
    const code = 'const mastra = new Mastra(); export { mastra }';
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  it('matches const foo = new Mastra(); export { foo as mastra }', () => {
    const code = 'const foo = new Mastra(); export { foo as mastra }';
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  it('matches const foo = new Mastra(); const bar = 1; export { foo as mastra, bar }', () => {
    const code = 'const foo = new Mastra(); const bar = 1; export { foo as mastra, bar }';
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  it('does not match export const mastra = 123', () => {
    const code = 'export const mastra = 123';
    expect(runPlugin(code).hasValidConfig).toBe(false);
  });

  it('does not match export const mastra = getMastra()', () => {
    const code = 'export const mastra = getMastra()';
    expect(runPlugin(code).hasValidConfig).toBe(false);
  });

  it('does not match export { mastra } if mastra is not new Mastra()', () => {
    const code = 'const mastra = 123; export { mastra }';
    expect(runPlugin(code).hasValidConfig).toBe(false);
  });

  it('does not match export { foo as mastra } if foo is not new Mastra()', () => {
    const code = 'const foo = 123; export { foo as mastra }';
    expect(runPlugin(code).hasValidConfig).toBe(false);
  });

  it('does not match unrelated exports', () => {
    const code = 'const foo = new Mastra(); export { foo }';
    expect(runPlugin(code).hasValidConfig).toBe(false);
  });

  it('does not match export default new Mastra()', () => {
    const code = 'export default new Mastra()';
    expect(runPlugin(code).hasValidConfig).toBe(false);
  });

  it('works with the babel-typescript preset', () => {
    const code = 'type A = any; const foo: A = 123; export const mastra = new Mastra()';
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  it('matches export const mastra = new Mastra({ ...config })', () => {
    const code = `
      const config = { server: { port: 3000 } };
      export const mastra = new Mastra({ ...config });
    `;
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  it('matches export const mastra = new Mastra({ ...config, agents: {} })', () => {
    const code = `
      const config = { server: { port: 3000 } };
      export const mastra = new Mastra({ ...config, agents: {} });
    `;
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  it('matches export const mastra = new Mastra({ agents: {}, ...config })', () => {
    const code = `
      const config = { server: { port: 3000 } };
      export const mastra = new Mastra({ agents: {}, ...config });
    `;
    expect(runPlugin(code).hasValidConfig).toBe(true);
  });

  // --- MastraFactory (software-factory) detection ---

  it('detects software-factory for import { MastraFactory } + new MastraFactory()', () => {
    const code = `import { MastraFactory } from './factory'; const f = new MastraFactory()`;
    expect(runPlugin(code).projectType).toBe('software-factory');
  });

  it('detects software-factory for aliased import { MastraFactory as Factory } + new Factory()', () => {
    const code = `import { MastraFactory as Factory } from './factory'; const f = new Factory()`;
    expect(runPlugin(code).projectType).toBe('software-factory');
  });

  it('detects software-factory for new MastraFactory() in export declaration', () => {
    const code = `import { MastraFactory } from './factory'; export const f = new MastraFactory()`;
    expect(runPlugin(code).projectType).toBe('software-factory');
  });

  it('detects software-factory alongside valid Mastra config export', () => {
    const code = `import { MastraFactory } from './factory'; export const mastra = new Mastra(); const f = new MastraFactory()`;
    const result = runPlugin(code);
    expect(result.hasValidConfig).toBe(true);
    expect(result.projectType).toBe('software-factory');
  });

  it('does not detect software-factory for unused MastraFactory import', () => {
    const code = `import { MastraFactory } from './factory'; export const mastra = new Mastra()`;
    expect(runPlugin(code).projectType).toBeUndefined();
  });

  it('does not detect software-factory for local class named MastraFactory (not imported)', () => {
    const code = `class MastraFactory {}; const f = new MastraFactory()`;
    expect(runPlugin(code).projectType).toBeUndefined();
  });

  it('does not detect software-factory for non-imported identifier named MastraFactory', () => {
    const code = `const MastraFactory = class {}; const f = new MastraFactory()`;
    expect(runPlugin(code).projectType).toBeUndefined();
  });

  it('does not detect software-factory for non-constructor usage of imported MastraFactory', () => {
    const code = `import { MastraFactory } from './factory'; const f = MastraFactory()`;
    expect(runPlugin(code).projectType).toBeUndefined();
  });
});
