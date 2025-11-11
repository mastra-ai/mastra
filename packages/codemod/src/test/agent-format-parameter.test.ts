import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/not-implemented/agent-format-parameter';
import { testTransform, applyTransform } from './test-utils';

describe('agent-format-parameter', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-format-parameter');
  });

  it('does not transform non-Agent instances', () => {
    const input = `
const someObject = { format: 'test' };
const result = someObject.generate('Hello', {
  format: 'aisdk'
});
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
