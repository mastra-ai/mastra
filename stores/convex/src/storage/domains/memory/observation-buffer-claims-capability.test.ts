import { describe, expect, it } from 'vitest';

import { MemoryConvex } from './index';

// Service-free: the admin client only issues requests when called, so
// constructing the domain class never touches a deployment. Guards the
// capability opt-in without CONVEX_TEST_URL/ADMIN_KEY credentials.
describe('MemoryConvex observation buffer claim capability', () => {
  it('declares supportsObservationBufferClaims true', () => {
    const memory = new MemoryConvex({
      deploymentUrl: 'http://127.0.0.1:9999',
      adminAuthToken: 'capability',
    });
    expect(memory.supportsObservationBufferClaims).toBe(true);
  });
});
