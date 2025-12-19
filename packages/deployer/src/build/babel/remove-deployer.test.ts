import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import { removeDeployer } from './remove-deployer';

describe('removeDeployer Babel plugin', () => {
  function runPlugin(code: string) {
    const result = transformSync(code, {
      filename: 'testfile.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [removeDeployer()],
      configFile: false,
      babelrc: false,
    });
    return result?.code ?? '';
  }

  it('removes deployer from direct config object', () => {
    const code = `
      const deployer = { name: 'test' };
      export const mastra = new Mastra({
        deployer,
        agents: {},
      });
    `;
    const result = runPlugin(code);
    expect(result).not.toContain('deployer:');
    expect(result).toContain('agents:');
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
    // Should not throw when encountering spread element
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
    expect(result).not.toContain('deployer:');
    // The spread should be preserved
    expect(result).toContain('...config');
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
    expect(result).not.toContain('deployer:');
    expect(result).toContain('...config');
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
    expect(result).not.toContain('deployer:');
    expect(result).toContain('...config1');
    expect(result).toContain('...config2');
  });
});
