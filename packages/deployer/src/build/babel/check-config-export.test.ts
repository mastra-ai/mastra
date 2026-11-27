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

  it.each([
    ['matches export const mastra = new Mastra()', 'export const mastra = new Mastra()', true],
    ['matches const mastra = new Mastra(); export { mastra }', 'const mastra = new Mastra(); export { mastra }', true],
    [
      'matches const foo = new Mastra(); export { foo as mastra }',
      'const foo = new Mastra(); export { foo as mastra }',
      true,
    ],
    [
      'matches const foo = new Mastra(); const bar = 1; export { foo as mastra, bar }',
      'const foo = new Mastra(); const bar = 1; export { foo as mastra, bar }',
      true,
    ],
    ['does not match export const mastra = 123', 'export const mastra = 123', false],
    ['does not match export const mastra = getMastra()', 'export const mastra = getMastra()', false],
    ['does not match export { mastra } if mastra is not new Mastra()', 'const mastra = 123; export { mastra }', false],
    [
      'does not match export { foo as mastra } if foo is not new Mastra()',
      'const foo = 123; export { foo as mastra }',
      false,
    ],
    ['does not match unrelated exports', 'const foo = new Mastra(); export { foo }', false],
    ['does not match export default new Mastra()', 'export default new Mastra()', false],
    [
      'works with the babel-typescript preset',
      'type A = any; const foo: A = 123; export const mastra = new Mastra()',
      true,
    ],
    [
      'matches export const mastra = new Mastra({ ...config })',
      `
      const config = { server: { port: 3000 } };
      export const mastra = new Mastra({ ...config });
    `,
      true,
    ],
    [
      'matches export const mastra = new Mastra({ ...config, agents: {} })',
      `
      const config = { server: { port: 3000 } };
      export const mastra = new Mastra({ ...config, agents: {} });
    `,
      true,
    ],
    [
      'matches export const mastra = new Mastra({ agents: {}, ...config })',
      `
      const config = { server: { port: 3000 } };
      export const mastra = new Mastra({ agents: {}, ...config });
    `,
      true,
    ],
  ] as const)('%s', (_title, codeValue, expected) => {
    const code = codeValue;
    expect(runPlugin(code).hasValidConfig).toBe(expected);
  });

  // --- MastraFactory (factory) detection ---

  it.each([
    [
      'detects factory for import { MastraFactory } + new MastraFactory()',
      `import { MastraFactory } from './factory'; const f = new MastraFactory()`,
    ],
    [
      'detects factory for aliased import { MastraFactory as Factory } + new Factory()',
      `import { MastraFactory as Factory } from './factory'; const f = new Factory()`,
    ],
    [
      'detects factory for new MastraFactory() in export declaration',
      `import { MastraFactory } from './factory'; export const f = new MastraFactory()`,
    ],
    [
      'detects factory when the import declaration appears after construction',
      `const f = new MastraFactory(); import { MastraFactory } from './factory'`,
    ],
  ] as const)('%s', (_title, codeValue) => {
    const code = codeValue;
    expect(runPlugin(code).projectType).toBe('factory');
  });

  it('detects factory alongside valid Mastra config export', () => {
    const code = `import { MastraFactory } from './factory'; export const mastra = new Mastra(); const f = new MastraFactory()`;
    const result = runPlugin(code);
    expect(result.hasValidConfig).toBe(true);
    expect(result.projectType).toBe('factory');
  });

  it.each([
    [
      'does not detect factory for unused MastraFactory import',
      `import { MastraFactory } from './factory'; export const mastra = new Mastra()`,
    ],
    [
      'does not detect factory for local class named MastraFactory (not imported)',
      `class MastraFactory {}; const f = new MastraFactory()`,
    ],
    [
      'does not detect factory for non-imported identifier named MastraFactory',
      `const MastraFactory = class {}; const f = new MastraFactory()`,
    ],
    [
      'does not detect factory when a local parameter shadows the imported binding',
      `
      import { MastraFactory } from './factory';
      function create(MastraFactory: new () => unknown) {
        return new MastraFactory();
      }
    `,
    ],
    [
      'does not detect factory for non-constructor usage of imported MastraFactory',
      `import { MastraFactory } from './factory'; const f = MastraFactory()`,
    ],
  ] as const)('%s', (_title, codeValue) => {
    const code = codeValue;
    expect(runPlugin(code).projectType).toBeUndefined();
  });
});
