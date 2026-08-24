import { createPool } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { MemoryMySQL } from './index';

// Service-free: mysql2 pools connect lazily, so constructing the domain class
// never touches a database. Guards the capability opt-in without services.
describe('MemoryMySQL observation buffer claim capability', () => {
  it('declares supportsObservationBufferClaims true', async () => {
    const pool = createPool({ uri: 'mysql://capability:capability@127.0.0.1:3306/capability' });
    try {
      const operations = new StoreOperationsMySQL({ pool });
      const memory = new MemoryMySQL({ pool, operations });
      expect(memory.supportsObservationBufferClaims).toBe(true);
    } finally {
      await pool.end();
    }
  });
});
