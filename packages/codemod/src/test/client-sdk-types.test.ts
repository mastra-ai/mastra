import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/client-sdk-types';
import { testTransform, applyTransform } from './test-utils';

describe('client-sdk-types', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'client-sdk-types');
  });

  it('does not transform types from other packages', () => {
    const input = `
import type { GetWorkflowRunsParams } from '@some-other/package';

const params: GetWorkflowRunsParams = {};
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });

  it('does not transform unrelated identifiers with similar names', () => {
    const input = `
const GetWorkflowRunsParams = 'test';
const value = GetWorkflowRunsParams;
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
