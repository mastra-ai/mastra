import { describe, it, expect } from 'vitest';
import { resolveBrowserEnabled } from './browser';

describe('resolveBrowserEnabled', () => {
  it('returns true when true', () => {
    expect(resolveBrowserEnabled(true)).toBe(true);
  });

  it('returns false when false', () => {
    expect(resolveBrowserEnabled(false)).toBe(false);
  });

  it('returns undefined when undefined', () => {
    expect(resolveBrowserEnabled(undefined)).toBeUndefined();
  });
});
