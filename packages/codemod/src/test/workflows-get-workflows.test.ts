import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/workflows-get-workflows';
import { testTransform, applyTransform } from './test-utils';

describe('workflows-get-workflows', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'workflows-get-workflows');
  });

  it('does not transform getWorkflows on non-Mastra objects', () => {
    const input = `
// Some other object, not from new Mastra()
const mastra = {
  getWorkflows: () => [],
};

// Should not be transformed
const workflows = mastra.getWorkflows();
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
