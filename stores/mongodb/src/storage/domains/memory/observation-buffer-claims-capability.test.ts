import { describe, expect, it } from 'vitest';

import { MemoryStorageMongoDB } from './index';

// Service-free: MongoClient connects lazily, so constructing the domain class
// never touches a database. Guards the capability opt-in without services.
describe('MemoryStorageMongoDB observation buffer claim capability', () => {
  it('declares supportsObservationBufferClaims true', () => {
    const memory = new MemoryStorageMongoDB({ uri: 'mongodb://127.0.0.1:27017', dbName: 'capability' });
    expect(memory.supportsObservationBufferClaims).toBe(true);
  });
});
