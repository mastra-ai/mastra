import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import { removeAllExceptDeployer } from './get-deployer';

describe('removeAllExceptDeployer Babel plugin', () => {
  function runPlugin(code: string) {
    const result = transformSync(code, {
      filename: 'testfile.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [removeAllExceptDeployer()],
      configFile: false,
      babelrc: false,
    });
    return result?.code ?? '';
  }

  it('extracts deployer from direct config object', () => {
    const code = `
      const deployer = { name: 'test' };
      export const mastra = new Mastra({
        deployer,
        agents: {},
      });
    `;
    const result = runPlugin(code);
    expect(result).toContain('export const deployer');
  });

  it('handles spread operator in Mastra config without throwing', () => {
    const code = `
      const config = {
        server: {
          port: 3000,
        },
      };
      export const mastra = new Mastra({
        ...config,
      });
    `;
    // This test currently fails because the plugin throws an error
    // when accessing prop.key.name on a SpreadElement
    expect(() => runPlugin(code)).not.toThrow();
  });

  it('handles spread operator with deployer after spread', () => {
    const code = `
      const config = {
        agents: {},
      };
      const deployer = { name: 'test' };
      export const mastra = new Mastra({
        ...config,
        deployer,
      });
    `;
    const result = runPlugin(code);
    expect(result).toContain('export const deployer');
  });

  it('handles spread operator with deployer before spread', () => {
    const code = `
      const config = {
        agents: {},
      };
      const deployer = { name: 'test' };
      export const mastra = new Mastra({
        deployer,
        ...config,
      });
    `;
    const result = runPlugin(code);
    expect(result).toContain('export const deployer');
  });

  it('handles multiple spread operators', () => {
    const code = `
      const config1 = { agents: {} };
      const config2 = { tools: {} };
      const deployer = { name: 'test' };
      export const mastra = new Mastra({
        ...config1,
        deployer,
        ...config2,
      });
    `;
    const result = runPlugin(code);
    expect(result).toContain('export const deployer');
  });
});
