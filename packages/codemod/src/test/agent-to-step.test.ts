import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/agent-to-step';
import { testTransform, applyTransform } from './test-utils';

describe('agent-to-step', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-to-step');
  });

  it('does not transform non-Agent instances', () => {
    const input = `
const someObject = { name: 'test' };
const step = someObject.toStep();
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
