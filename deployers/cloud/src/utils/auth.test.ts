import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAuthEntrypoint } from './auth.js';

describe('getAuthEntrypoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads service tokens at runtime instead of embedding them in the build', () => {
    vi.stubEnv('PLAYGROUND_JWT_TOKEN', 'playground-secret');
    vi.stubEnv('BUSINESS_JWT_TOKEN', "business'secret`${x}");

    const code = getAuthEntrypoint();

    expect(code).not.toContain('playground-secret');
    expect(code).not.toContain("business'secret");
    expect(code).toContain("'PLAYGROUND_JWT_TOKEN', 'BUSINESS_JWT_TOKEN'");
  });
});
