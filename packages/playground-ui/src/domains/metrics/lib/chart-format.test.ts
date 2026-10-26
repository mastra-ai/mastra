import { describe, expect, it } from 'vitest';
import { formatAxisUsd } from './chart-format';

describe('formatAxisUsd', () => {
  it('drops trailing zeros on round ticks', () => {
    expect([0, 2.5, 5].map(formatAxisUsd)).toEqual(['$0', '$2.5', '$5']);
  });

  it('keeps every digit of a fractional tick', () => {
    expect([0.25, 0.75, 12.5].map(formatAxisUsd)).toEqual(['$0.25', '$0.75', '$12.5']);
  });

  it('drops float noise from computed ticks', () => {
    expect(formatAxisUsd(0.1 + 0.2)).toBe('$0.3');
  });

  it('shortens thousands', () => {
    expect([1_000, 2_500, 1_500_000].map(formatAxisUsd)).toEqual(['$1K', '$2.5K', '$1.5M']);
  });
});
