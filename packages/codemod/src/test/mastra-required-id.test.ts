import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/not-implemented/mastra-required-id';
import { testTransform, applyTransform } from './test-utils';

describe('mastra-required-id', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'mastra-required-id');
  });

  it('does not add comment if id already exists', () => {
    const input = `
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';

const agent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
});

const tool = createTool({
  id: 'weather-tool',
  description: 'Get weather',
});
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged - no comments added
    expect(output).toBe(input);
  });

  it('does not add comment to unrelated classes', () => {
    const input = `
class MyCustomStore {
  constructor(config) {}
}

const store = new MyCustomStore({ url: 'test' });
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
