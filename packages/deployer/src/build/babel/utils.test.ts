import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import type { types, PluginObj } from '@babel/core';
import babel from '@babel/core';
import { findPropertyByKeyName, hasSpreadElement } from './utils';

const t = babel.types;

describe('findPropertyByKeyName', () => {
  // Helper to extract the ObjectExpression from code like `const x = { ... }`
  function getObjectExpression(code: string): types.ObjectExpression | null {
    let result: types.ObjectExpression | null = null;

    const plugin: PluginObj = {
      visitor: {
        ObjectExpression(path) {
          result = path.node;
          path.stop();
        },
      },
    };

    transformSync(code, {
      filename: 'test.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [plugin],
      configFile: false,
      babelrc: false,
    });

    return result;
  }

  it('finds a property with identifier key', () => {
    const objExpr = getObjectExpression('const x = { server: 123, agents: {} }');
    expect(objExpr).not.toBeNull();
    const prop = findPropertyByKeyName(objExpr!.properties, 'server');
    expect(prop).toBeDefined();
    expect(t.isObjectProperty(prop)).toBe(true);
    expect(t.isIdentifier(prop!.key)).toBe(true);
    expect((prop!.key as types.Identifier).name).toBe('server');
  });

  it('finds a property with string literal key', () => {
    const objExpr = getObjectExpression('const x = { "server": 123 }');
    expect(objExpr).not.toBeNull();
    const prop = findPropertyByKeyName(objExpr!.properties, 'server');
    expect(prop).toBeDefined();
    expect(t.isObjectProperty(prop)).toBe(true);
  });

  it('returns undefined when property is not found', () => {
    const objExpr = getObjectExpression('const x = { agents: {} }');
    expect(objExpr).not.toBeNull();
    const prop = findPropertyByKeyName(objExpr!.properties, 'server');
    expect(prop).toBeUndefined();
  });

  it('returns undefined for empty object', () => {
    const objExpr = getObjectExpression('const x = {}');
    expect(objExpr).not.toBeNull();
    const prop = findPropertyByKeyName(objExpr!.properties, 'server');
    expect(prop).toBeUndefined();
  });

  it('handles spread elements without throwing', () => {
    // We need to get the second object expression (the one with spread)
    let spreadObj: types.ObjectExpression | null = null;
    const plugin: PluginObj = {
      visitor: {
        ObjectExpression(path) {
          if (path.node.properties.some(p => t.isSpreadElement(p))) {
            spreadObj = path.node;
            path.stop();
          }
        },
      },
    };

    transformSync('const config = { a: 1 }; const x = { ...config, server: 123 }', {
      filename: 'test.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [plugin],
      configFile: false,
      babelrc: false,
    });

    expect(spreadObj).not.toBeNull();
    // Should not throw and should find the explicit property
    const prop = findPropertyByKeyName(spreadObj!.properties, 'server');
    expect(prop).toBeDefined();
    expect(t.isIdentifier(prop!.key)).toBe(true);
    expect((prop!.key as types.Identifier).name).toBe('server');
  });

  it('handles object with only spread elements', () => {
    let spreadObj: types.ObjectExpression | null = null;
    const plugin: PluginObj = {
      visitor: {
        ObjectExpression(path) {
          if (path.node.properties.some(p => t.isSpreadElement(p))) {
            spreadObj = path.node;
            path.stop();
          }
        },
      },
    };

    transformSync('const config = { server: 123 }; const x = { ...config }', {
      filename: 'test.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [plugin],
      configFile: false,
      babelrc: false,
    });

    expect(spreadObj).not.toBeNull();
    // Should not throw but will not find the property (it's inside the spread)
    const prop = findPropertyByKeyName(spreadObj!.properties, 'server');
    expect(prop).toBeUndefined();
  });

  it('handles spread before explicit property', () => {
    let spreadObj: types.ObjectExpression | null = null;
    const plugin: PluginObj = {
      visitor: {
        ObjectExpression(path) {
          if (path.node.properties.some(p => t.isSpreadElement(p))) {
            spreadObj = path.node;
            path.stop();
          }
        },
      },
    };

    transformSync('const base = { a: 1 }; const x = { ...base, deployer: myDeployer }', {
      filename: 'test.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [plugin],
      configFile: false,
      babelrc: false,
    });

    expect(spreadObj).not.toBeNull();
    const prop = findPropertyByKeyName(spreadObj!.properties, 'deployer');
    expect(prop).toBeDefined();
  });

  it('handles multiple spread elements', () => {
    let spreadObj: types.ObjectExpression | null = null;
    const plugin: PluginObj = {
      visitor: {
        ObjectExpression(path) {
          const spreadCount = path.node.properties.filter(p => t.isSpreadElement(p)).length;
          if (spreadCount >= 2) {
            spreadObj = path.node;
            path.stop();
          }
        },
      },
    };

    transformSync('const a = { x: 1 }; const b = { y: 2 }; const x = { ...a, ...b, server: 3 }', {
      filename: 'test.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [plugin],
      configFile: false,
      babelrc: false,
    });

    expect(spreadObj).not.toBeNull();
    const prop = findPropertyByKeyName(spreadObj!.properties, 'server');
    expect(prop).toBeDefined();
  });
});

describe('hasSpreadElement', () => {
  function getObjectExpression(code: string): types.ObjectExpression | null {
    let result: types.ObjectExpression | null = null;

    const plugin: PluginObj = {
      visitor: {
        ObjectExpression(path) {
          result = path.node;
          path.stop();
        },
      },
    };

    transformSync(code, {
      filename: 'test.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [plugin],
      configFile: false,
      babelrc: false,
    });

    return result;
  }

  it('returns false for object without spread', () => {
    const objExpr = getObjectExpression('const x = { a: 1, b: 2 }');
    expect(objExpr).not.toBeNull();
    expect(hasSpreadElement(objExpr!)).toBe(false);
  });

  it('returns true for object with spread', () => {
    let spreadObj: types.ObjectExpression | null = null;
    const plugin: PluginObj = {
      visitor: {
        ObjectExpression(path) {
          if (path.node.properties.some(p => t.isSpreadElement(p))) {
            spreadObj = path.node;
            path.stop();
          }
        },
      },
    };

    transformSync('const base = {}; const x = { ...base }', {
      filename: 'test.ts',
      presets: ['@babel/preset-typescript'],
      plugins: [plugin],
      configFile: false,
      babelrc: false,
    });

    expect(spreadObj).not.toBeNull();
    expect(hasSpreadElement(spreadObj!)).toBe(true);
  });

  it('returns false for empty object', () => {
    const objExpr = getObjectExpression('const x = {}');
    expect(objExpr).not.toBeNull();
    expect(hasSpreadElement(objExpr!)).toBe(false);
  });
});
