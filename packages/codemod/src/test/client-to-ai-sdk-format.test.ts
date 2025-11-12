import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/client-to-ai-sdk-format';
import { testTransform, applyTransform } from './test-utils';

describe('client-to-ai-sdk-format', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'client-to-ai-sdk-format');
  });

  it('does not transform imports from other packages', () => {
    const input = `
import { toAISdkFormat } from '@some-other/package';
const stream = toAISdkFormat(data);
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });

  it('does not transform unrelated identifiers with the same name', () => {
    const input = `
const toAISdkFormat = 'test';
const value = toAISdkFormat;
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
