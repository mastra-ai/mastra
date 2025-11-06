import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/evals-get-scorers';
import { testTransform, applyTransform } from './test-utils';

describe('evals-get-scorers', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'evals-get-scorers');
  });

  it('does not transform getScorers on non-Mastra objects', () => {
    const input = `
// Some other object, not from new Mastra()
const mastra = {
  getScorers: () => [],
};

// Should not be transformed
const scorers = mastra.getScorers();
`;

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
