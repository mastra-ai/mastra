import { describe, expect, it } from 'vitest';

import type { OraclePoolManager } from '../../../shared/connection';
import { MemoryOracle } from './index';

// Service-free: mirrors the stubbed pool manager the package's own
// index.test.ts uses when RUN_ORACLE_STORAGE_INTEGRATION is unset, so this
// guards the capability opt-in without an Oracle service.
describe('MemoryOracle observation buffer claim capability', () => {
  it('declares supportsObservationBufferClaims true', () => {
    const memory = new MemoryOracle({ poolManager: {} as unknown as OraclePoolManager });
    expect(memory.supportsObservationBufferClaims).toBe(true);
  });
});
