import { describe, expect, it } from 'vitest';

import { isPlatformAuthSupportedHost } from './platform-auth-host.js';

describe('isPlatformAuthSupportedHost', () => {
  it.each([
    'acme.factory.mastra.cloud',
    'acme.factory.staging.mastra.cloud',
    'app.mastra.ai',
    'localhost',
    '127.0.0.1',
    '[::1]',
  ])('accepts %s', hostname => {
    expect(isPlatformAuthSupportedHost(hostname)).toBe(true);
  });

  it.each(['factory.acme.com', 'mastra.cloud.evil.com', 'evilmastra.cloud'])('rejects %s', hostname => {
    expect(isPlatformAuthSupportedHost(hostname)).toBe(false);
  });
});
