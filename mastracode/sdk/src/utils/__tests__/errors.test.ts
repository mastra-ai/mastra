import { describe, expect, it } from 'vitest';

import { ProviderAuthRequiredError } from '../../auth/provider-auth-error.js';
import { parseError } from '../errors.js';

describe('parseError', () => {
  it('classifies a provider credential failure as auth without rewriting its message', () => {
    const parsed = parseError(new ProviderAuthRequiredError('Not logged in to Anthropic.'));

    expect(parsed.type).toBe('auth');
    expect(parsed.message).toBe('Not logged in to Anthropic.');
  });

  it('classifies a credential failure that reached the host as a flattened wire payload', () => {
    const parsed = parseError({ name: 'ProviderAuthRequiredError', message: 'Not logged in to Anthropic.' });

    expect(parsed.type).toBe('auth');
    expect(parsed.message).toBe('Not logged in to Anthropic.');
    expect(parsed.retryable).toBe(false);
  });

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

  it('treats a bare "Not Found" from a provider outage as provider unavailable', () => {
    const parsed = parseError(new Error('Not Found'));

    expect(parsed.type).toBe('provider_unavailable');
    expect(parsed.message).toBe('Model provider unavailable. The provider may be down or unreachable right now.');
    expect(parsed.detail).toBe('Not Found');
    expect(parsed.retryable).toBe(true);
  });

  it('treats 404/502/503/504/529 status codes as provider unavailable with HTTP detail', () => {
    for (const status of [404, 502, 503, 504, 529]) {
      const parsed = parseError(
        Object.assign(new Error('Not Found'), { statusCode: status, url: 'https://api.openai.com/v1/responses' }),
      );

      expect(parsed.type).toBe('provider_unavailable');
      expect(parsed.detail).toBe(`HTTP ${status}: Not Found`);
      expect(parsed.requestUrl).toBe('https://api.openai.com/v1/responses');
    }
  });

  it('treats overloaded and gateway failures as provider unavailable', () => {
    expect(parseError(new Error('Overloaded')).type).toBe('provider_unavailable');
    expect(parseError(new Error('502 Bad Gateway')).type).toBe('provider_unavailable');
    expect(parseError(new Error('Service Unavailable')).type).toBe('provider_unavailable');
  });

  it('still classifies model not found ahead of provider unavailable', () => {
    const parsed = parseError(Object.assign(new Error('The model `gpt-99` does not exist'), { statusCode: 404 }));

    expect(parsed.type).toBe('model_not_found');
  });

  it('adds HTTP status detail to unknown errors', () => {
    const parsed = parseError(Object.assign(new Error('Teapot'), { statusCode: 418 }));

    expect(parsed.type).toBe('unknown');
    expect(parsed.message).toBe('Teapot');
    expect(parsed.detail).toBe('HTTP 418');
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
