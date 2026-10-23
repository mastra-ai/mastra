import { describe, expect, it } from 'vitest';
import { getShortId, getShortSha } from './id';

describe('getShortId', () => {
  it('keeps the first 8 characters', () => {
    expect(getShortId('3f2a9c1e-7b4d-4e8a-9c2f-1d6b8e0a4f7c')).toBe('3f2a9c1e');
  });

  it('returns undefined for a missing id', () => {
    expect(getShortId(undefined)).toBeUndefined();
    expect(getShortId('')).toBeUndefined();
  });
});

describe('getShortSha', () => {
  it('keeps the first 7 characters, like GitHub', () => {
    expect(getShortSha('79f36ef97e4b1c2d3e4f5a6b7c8d9e0f1a2b3c4d')).toBe('79f36ef');
  });

  it('returns undefined for a missing sha', () => {
    expect(getShortSha(undefined)).toBeUndefined();
  });
});
