import { describe, expect, it } from 'vitest';
import transformer from '../codemods/v1/evals-run-experiment';
import { applyTransform, testTransform } from './test-utils';

describe('evals-run-experiment', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'evals-run-experiment');
  });

  it('migrates the released v0 scores import and function name', () => {
    const input = `import { createScorer, runExperiment } from '@mastra/core/scores';
const result = runExperiment({});
`;
    const expected = `import { createScorer, runEvals } from '@mastra/core/evals';
const result = runEvals({});
`;

    expect(applyTransform(transformer, input)).toBe(expected);
  });
});
