import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/mastra-plural-apis';
import { testTransform, applyTransform } from './test-utils';

describe('mastra-plural-apis', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mastra-plural-apis');
  });

  it('does not transform methods on non-Mastra instances', () => {
    const input = `
const someObject = {
  getAgents: () => {},
  getWorkflows: () => {},
};

const agents = someObject.getAgents();
const workflows = someObject.getWorkflows();
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });

  it('only transforms tracked Mastra instances', () => {
    const input = `
import { Mastra } from '@mastra/core';

const mastra = new Mastra();
const agents = mastra.getAgents();

// Not tracked - no transformation
const otherMastra = getMastraFromSomewhere();
const workflows = otherMastra.getWorkflows();
    `.trim();

    const output = applyTransform(transformer, input);

    // Only the tracked instance should be transformed
    expect(output).toContain('mastra.listAgents()');
    expect(output).toContain('otherMastra.getWorkflows()');
  });
});
