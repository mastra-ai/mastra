import { describe, expect, it } from 'vitest';
import { generateSignalId } from './ids';

describe('generateSignalId', () => {
  it('returns a non-empty string', () => {
    const id = generateSignalId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns a unique id on each call', () => {
    const count = 1000;
    const ids = new Set<string>();
    for (let i = 0; i < count; i++) {
      ids.add(generateSignalId());
    }
    expect(ids.size).toBe(count);
  });
});
