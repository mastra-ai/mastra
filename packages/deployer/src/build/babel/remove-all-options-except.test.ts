import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import { removeAllOptionsFromMastraExcept } from './remove-all-options-except';

describe('removeAllOptionsFromMastraExcept Babel plugin', () => {
  function runPlugin(code: string, option: 'bundler' | 'server' | 'deployer' = 'bundler') {
    const result = { hasCustomConfig: false };
    const output = transformSync(code, {
      filename: 'testfile.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [removeAllOptionsFromMastraExcept(result, option)],
      configFile: false,
      babelrc: false,
    });
    return { code: output?.code ?? '', hasCustomConfig: result.hasCustomConfig };
  }

  it('extracts bundler option from direct config', () => {
    const code = `
      export const mastra = new Mastra({
        bundler: {
          externals: ['sharp'],
        },
        agents: {},
      });
    `;
    const { code: result, hasCustomConfig } = runPlugin(code, 'bundler');
    expect(result).toContain('export const bundler');
    expect(hasCustomConfig).toBe(true);
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
    // This test currently fails because the plugin accesses prop.key.name
    // on SpreadElement nodes which don't have a key property
    expect(() => runPlugin(code, 'bundler')).not.toThrow();
  });

  it('handles spread operator with bundler option after spread', () => {
    const code = `
      const config = {
        agents: {},
      };
      export const mastra = new Mastra({
        ...config,
        bundler: {
          externals: ['sharp'],
        },
      });
    `;
    const { code: result, hasCustomConfig } = runPlugin(code, 'bundler');
    expect(result).toContain('export const bundler');
    expect(hasCustomConfig).toBe(true);
  });

  it('handles spread operator with bundler option before spread', () => {
    const code = `
      const config = {
        agents: {},
      };
      export const mastra = new Mastra({
        bundler: {
          externals: ['sharp'],
        },
        ...config,
      });
    `;
    const { code: result, hasCustomConfig } = runPlugin(code, 'bundler');
    expect(result).toContain('export const bundler');
    expect(hasCustomConfig).toBe(true);
  });

  it('handles multiple spread operators with config option between them', () => {
    const code = `
      const config1 = { agents: {} };
      const config2 = { tools: {} };
      export const mastra = new Mastra({
        ...config1,
        bundler: {
          externals: ['sharp'],
        },
        ...config2,
      });
    `;
    const { code: result, hasCustomConfig } = runPlugin(code, 'bundler');
    expect(result).toContain('export const bundler');
    expect(hasCustomConfig).toBe(true);
  });

  it('returns empty config when spread-only config has no target option', () => {
    const code = `
      const config = {
        agents: {},
      };
      export const mastra = new Mastra({
        ...config,
      });
    `;
    const { hasCustomConfig } = runPlugin(code, 'bundler');
    // Since we can't statically know if config contains bundler,
    // we should not mark it as having custom config
    expect(hasCustomConfig).toBe(false);
  });
});
