import { describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

// Service-free: constructing the domain class never touches the database, so
// this guards the capability opt-in even when no LibSQL file is available.
describe('MemoryLibSQL observation buffer claim capability', () => {
  it('declares supportsObservationBufferClaims true', () => {
    const memory = new MemoryLibSQL({ url: 'file::memory:' });
    expect(memory.supportsObservationBufferClaims).toBe(true);
  });
});
