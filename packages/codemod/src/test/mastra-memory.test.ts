import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/not-implemented/mastra-memory';
import { testTransform, applyTransform } from './test-utils';

describe('mastra-memory', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mastra-memory');
  });

  it('does not add comment if no memory property', () => {
    const input = `
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  agents: { myAgent: agent },
});
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged - no comment added
    expect(output).toBe(input);
  });

  it('does not add comment to other classes with memory property', () => {
    const input = `
class CustomClass {
  constructor(config) {}
}

const obj = new CustomClass({ memory: new Memory() });
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
