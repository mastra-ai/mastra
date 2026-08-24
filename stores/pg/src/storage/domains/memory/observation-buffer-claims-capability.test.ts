import { describe, expect, it } from 'vitest';

import { MemoryPG } from './index';

// Service-free: pg pools connect lazily, so constructing the domain class
// never touches a database. Guards the capability opt-in without services.
describe('MemoryPG observation buffer claim capability', () => {
  it('declares supportsObservationBufferClaims true', () => {
    const memory = new MemoryPG({
      connectionString: 'postgresql://capability:capability@127.0.0.1:5432/capability',
    });
    expect(memory.supportsObservationBufferClaims).toBe(true);
  });
});
