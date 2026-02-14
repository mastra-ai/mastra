import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/workspace-tools-enabled';
import { applyTransform, testEdgeCases, testTransform } from './test-utils';

describe('workspace-tools-enabled', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'workspace-tools-enabled');
  });

  it('does not transform when no Workspace constructor', () => {
    const input = `const x = new SomeOtherClass({ foo: 'bar' });`;
    const output = applyTransform(transformer, input);
    expect(output).toBe(input);
  });

  it('does not transform Workspace with no arguments', () => {
    const input = `const w = new Workspace();`;
    const output = applyTransform(transformer, input);
    expect(output).toBe(input);
  });

  it('does not transform Workspace with non-object argument', () => {
    const input = `const w = new Workspace(config);`;
    const output = applyTransform(transformer, input);
    expect(output).toBe(input);
  });

  it('does not transform when tools.enabled is already false', () => {
    const input = `const w = new Workspace({ tools: { enabled: false } });`;
    const output = applyTransform(transformer, input);
    expect(output).toBe(input);
  });

  it('does not transform when tools.enabled is already true', () => {
    const input = `const w = new Workspace({ tools: { enabled: true } });`;
    const output = applyTransform(transformer, input);
    expect(output).toBe(input);
  });

  testEdgeCases(transformer);
});
