import { describe, expect, it } from 'vitest';

import { parseError } from '../errors.js';

describe('parseError', () => {
  it('preserves useful detail for network-style errors', () => {
    const error = new Error('fetch failed: socket hang up');

    const parsed = parseError(error);

    expect(parsed.type).toBe('network');
    expect(parsed.message).toBe('Network error while contacting the provider or gateway.');
    expect(parsed.detail).toBe('fetch failed: socket hang up');
  });

  it('prefers the cause message when available', () => {
    const error = new Error('fetch failed') as Error & { cause?: unknown };
    error.cause = new Error('self-signed certificate in certificate chain');

    const parsed = parseError(error);

    expect(parsed.type).toBe('network');
    expect(parsed.detail).toBe('self-signed certificate in certificate chain');
  });

  it('includes the request URL when available', () => {
    const error = Object.assign(new Error('authentication failed'), {
      requestUrl: 'https://server.mastra.ai/v1/messages',
    });

    const parsed = parseError(error);

    expect(parsed.type).toBe('auth');
    expect(parsed.requestUrl).toBe('https://server.mastra.ai/v1/messages');
  });

  it('includes the request URL for access denied errors', () => {
    const error = Object.assign(new Error('forbidden'), {
      status: 403,
      requestUrl: 'https://gateway-api.mastra.ai/v1/responses',
    });

    const parsed = parseError(error);

    expect(parsed.type).toBe('auth');
    expect(parsed.message).toBe('Access denied. You may not have permission to use this model.');
    expect(parsed.requestUrl).toBe('https://gateway-api.mastra.ai/v1/responses');
  });
});
