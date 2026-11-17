import { describe, expect, it } from 'vitest';

import { MAX_PERSISTED_RESPONSE_BODY_LENGTH, describeProviderError, readRequestOrigin } from './provider-error-details';

function providerError(responseBody: string, requestId = 'req_123') {
  return Object.assign(new Error('Bad Request'), {
    statusCode: 400,
    responseBody,
    responseHeaders: { 'request-id': requestId },
  });
}

describe('describeProviderError', () => {
  it('reads the explanation from a JSON body longer than the persisted cap', () => {
    const body = JSON.stringify({
      metadata: 'x'.repeat(MAX_PERSISTED_RESPONSE_BODY_LENGTH),
      error: { type: 'invalid_request_error', message: 'prompt is too long' },
    });

    expect(describeProviderError('Bad Request', providerError(body), 1000)).toBe(
      'Bad Request (HTTP 400): prompt is too long (request id req_123)',
    );
  });

  it('keeps the request id when a long explanation is shortened', () => {
    const body = JSON.stringify({ error: { message: 'y'.repeat(5000) } });

    const text = describeProviderError('Bad Request', providerError(body), 1000)!;

    expect(text).toHaveLength(1000);
    expect(text.startsWith('Bad Request (HTTP 400): yyy')).toBe(true);
    expect(text.endsWith('… (request id req_123)')).toBe(true);
  });

  it('reads a FastAPI-style top-level detail (ChatGPT Codex backend)', () => {
    const body = JSON.stringify({ detail: 'Unsupported model: gpt-5.5' });

    expect(describeProviderError('Bad Request', providerError(body), 1000)).toBe(
      'Bad Request (HTTP 400): Unsupported model: gpt-5.5 (request id req_123)',
    );
  });

  it('returns undefined for errors without HTTP details', () => {
    expect(describeProviderError('boom', new Error('boom'), 1000)).toBeUndefined();
  });
});

describe('readRequestOrigin', () => {
  it.each([
    ['https://gateway-api.mastra.ai/v1/chat/completions', 'https://gateway-api.mastra.ai'],
    ['http://127.0.0.1:4180/v1/chat/completions?x=1', 'http://127.0.0.1:4180'],
    ['https://user:pass@api.example.com:443/path', 'https://api.example.com'],
    ['  https://api.example.com/v1  ', 'https://api.example.com'],
  ])('keeps only the origin of %s', (url, origin) => {
    expect(readRequestOrigin(url)).toBe(origin);
  });

  it.each([undefined, null, 42, '', '   ', 'not a url', '/relative', 'file:///etc/passwd', 'data:text/plain,hi'])(
    'gives undefined for %s',
    url => {
      expect(readRequestOrigin(url)).toBeUndefined();
    },
  );
});
