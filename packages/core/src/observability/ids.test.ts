import { describe, expect, it } from 'vitest';
import { generateSignalId } from './ids';

describe('generateSignalId', () => {
  it('returns a valid UUID v4 string', () => {
    const id = generateSignalId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
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
