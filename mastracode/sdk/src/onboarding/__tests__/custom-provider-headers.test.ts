import { describe, expect, it } from 'vitest';

import { customProviderHeaderProblem } from '../custom-provider-headers.js';
import type { CustomProviderAuthScheme } from '../settings.js';

describe('customProviderHeaderProblem', () => {
  it.each<[string, Array<{ name: string; value?: string }>, CustomProviderAuthScheme | undefined]>([
    ['a plain header', [{ name: 'X-Org-Id', value: 'org-1' }], undefined],
    ['a custom User-Agent', [{ name: 'User-Agent', value: 'acme/1.0' }], 'bearer'],
    ['Authorization when the key goes in x-api-key', [{ name: 'Authorization', value: 'Basic abc' }], 'x-api-key'],
    ['x-api-key when the key goes in Authorization', [{ name: 'x-api-key', value: 'k' }], 'bearer'],
    ['a name without a value, kept from the saved header', [{ name: 'X-Secret' }], undefined],
    ['20 headers', Array.from({ length: 20 }, (_, i) => ({ name: `X-H${i}`, value: 'v' })), undefined],
  ])('accepts %s', (_, headers, scheme) => {
    expect(customProviderHeaderProblem(headers, scheme)).toBeUndefined();
  });

  it.each<[string, Array<{ name: string; value?: string }>, CustomProviderAuthScheme | undefined, RegExp]>([
    ['a name with a space', [{ name: 'X Org', value: 'v' }], undefined, /not a valid header name/],
    ['a name with a colon', [{ name: 'X-Org:', value: 'v' }], undefined, /not a valid header name/],
    ['an empty name', [{ name: '', value: 'v' }], undefined, /not a valid header name/],
    ['Host in any case', [{ name: 'HOST', value: 'evil' }], undefined, /set by the HTTP client/],
    ['Content-Length', [{ name: 'content-length', value: '1' }], undefined, /set by the HTTP client/],
    ['Content-Type', [{ name: 'Content-Type', value: 'text/plain' }], undefined, /set by the HTTP client/],
    ['Transfer-Encoding', [{ name: 'Transfer-Encoding', value: 'chunked' }], undefined, /set by the HTTP client/],
    ['Connection', [{ name: 'Connection', value: 'close' }], undefined, /set by the HTTP client/],
    ['Authorization with a missing scheme', [{ name: 'authorization', value: 'x' }], undefined, /carries the API key/],
    ['Authorization with bearer', [{ name: 'Authorization', value: 'x' }], 'bearer', /carries the API key/],
    ['x-api-key with x-api-key', [{ name: 'X-API-Key', value: 'x' }], 'x-api-key', /carries the API key/],
    [
      'the same name twice in different case',
      [
        { name: 'X-Org', value: 'a' },
        { name: 'x-org', value: 'b' },
      ],
      undefined,
      /more than once/,
    ],
    ['a value with CR', [{ name: 'X-A', value: 'a\rb' }], undefined, /line break/],
    ['a value with LF', [{ name: 'X-A', value: 'a\nInjected: 1' }], undefined, /line break/],
    ['an empty value', [{ name: 'X-A', value: '' }], undefined, /no value/],
    ['a value over 4,096 characters', [{ name: 'X-A', value: 'a'.repeat(4097) }], undefined, /longer than 4096/],
    ['21 headers', Array.from({ length: 21 }, (_, i) => ({ name: `X-H${i}`, value: 'v' })), undefined, /at most 20/],
  ])('refuses %s', (_, headers, scheme, problem) => {
    expect(customProviderHeaderProblem(headers, scheme)).toMatch(problem);
  });
});
