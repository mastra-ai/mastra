import { describe, expect, it } from 'vitest';

import { unwrapLegacyToolOutput } from './unwrap-legacy-tool-output';

describe('unwrapLegacyToolOutput', () => {
  it('unwraps a legacy sole-key value object', () => {
    expect(unwrapLegacyToolOutput({ value: 42 })).toBe(42);
  });

  it.each([
    { value: 42, receipt: 'r-1' },
    { amount: 42, receipt: 'r-1' },
    { type: 'json', value: { ok: true } },
    { type: 'content', value: [{ type: 'text', text: 'ok' }] },
  ])('preserves raw tool output %#', output => {
    expect(unwrapLegacyToolOutput(output)).toBe(output);
  });
});
