import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/client-sdk-types';
import { testTransform, applyTransform } from './test-utils';

describe('client-sdk-types', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'client-sdk-types');
  });

  it.each([
    [
      'does not transform types from other packages',
      `
import type { GetWorkflowRunsParams } from '@some-other/package';

const params: GetWorkflowRunsParams = {};
    `,
    ],
    [
      'does not transform unrelated identifiers with similar names',
      `
const GetWorkflowRunsParams = 'test';
const value = GetWorkflowRunsParams;
    `,
    ],
  ] as const)('%s', (_title, value) => {
    const input = value.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
