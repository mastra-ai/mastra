import { describe, expect, it } from 'vitest';

import { normalizeToolOutput, unwrapLegacyToolOutput } from './unwrap-legacy-tool-output';

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

describe('normalizeToolOutput', () => {
  it.each([0, false, '', null])('unwraps a legacy sole-key envelope containing %#', value => {
    expect(normalizeToolOutput({ value })).toEqual({ isError: false, output: value });
  });

  it.each(['text', 'json', 'content'])('unwraps a documented %s output wrapper', type => {
    expect(normalizeToolOutput({ type, value: { ok: true } })).toEqual({
      isError: false,
      output: { ok: true },
    });
  });

  it('preserves a content wrapper when requested', () => {
    const output = { type: 'content', value: [{ type: 'text', text: 'ok' }] };
    expect(normalizeToolOutput(output, { unwrapContent: false })).toEqual({ isError: false, output });
  });

  it.each(['error-text', 'error-json'])('marks a documented %s output wrapper as an error', type => {
    expect(normalizeToolOutput({ type, value: 'failed' })).toEqual({ isError: true, output: 'failed' });
  });

  it.each([
    { type: 'celsius', value: 20 },
    { type: 'json', value: { ok: true }, receipt: 'r-1' },
  ])('preserves non-wrapper output %#', output => {
    expect(normalizeToolOutput(output)).toEqual({ isError: false, output });
  });
});
