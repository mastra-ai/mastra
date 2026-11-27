import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/client-to-ai-sdk-format';
import { testTransform, applyTransform } from './test-utils';

describe('client-to-ai-sdk-format', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'client-to-ai-sdk-format');
  });

  it.each([
    [
      'does not transform imports from other packages',
      `
import { toAISdkFormat } from '@some-other/package';
const stream = toAISdkFormat(data);
    `,
    ],
    [
      'does not transform unrelated identifiers with the same name',
      `
const toAISdkFormat = 'test';
const value = toAISdkFormat;
    `,
    ],
  ] as const)('%s', (_title, value) => {
    const input = value.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
