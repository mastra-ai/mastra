import { describe, expect, it } from 'vitest';

import { customProviderHeaderProblem } from '../custom-provider-headers.js';
import type { CustomProviderAuthScheme } from '../settings.js';

type Headers = Array<{ name: unknown; value?: unknown }>;

describe('customProviderHeaderProblem', () => {
  it.each<[string, Headers, CustomProviderAuthScheme | undefined]>([
    ['a plain header', [{ name: 'X-Org-Id', value: 'org-1' }], undefined],
    ['a custom User-Agent', [{ name: 'User-Agent', value: 'acme/1.0' }], 'bearer'],
    ['a value with a tab and Latin-1 letters', [{ name: 'X-Team', value: 'café\tcrème' }], undefined],
    ['Authorization when the key goes in x-api-key', [{ name: 'Authorization', value: 'Basic abc' }], 'x-api-key'],
    ['x-api-key when the key goes in Authorization', [{ name: 'x-api-key', value: 'k' }], 'bearer'],
    ['a name without a value, kept from the saved header', [{ name: 'X-Secret' }], undefined],
    ['20 headers', Array.from({ length: 20 }, (_, i) => ({ name: `X-H${i}`, value: 'v' })), undefined],
  ])('accepts %s', (_, headers, scheme) => {
    expect(customProviderHeaderProblem(headers, scheme)).toBeUndefined();
  });

  // Names the HTTP client sets or that change how the connection behaves.
  it.each([
    'HOST',
    'content-length',
    'Content-Type',
    'Transfer-Encoding',
    'Connection',
    'Keep-Alive',
    'Upgrade',
    'Expect',
    'TE',
    'Trailer',
    'Proxy-Connection',
  ])('refuses the %s header', name => {
    expect(customProviderHeaderProblem([{ name, value: 'x' }], undefined)).toMatch(/set by the HTTP client/);
  });

  it.each<[string, Headers, CustomProviderAuthScheme | undefined, RegExp]>([
    ['a name with a space', [{ name: 'X Org', value: 'v' }], undefined, /not a valid header name/],
    ['a name with a colon', [{ name: 'X-Org:', value: 'v' }], undefined, /not a valid header name/],
    ['an empty name', [{ name: '', value: 'v' }], undefined, /not a valid header name/],
    ['a name that is a number', [{ name: 123, value: 'v' }], undefined, /name must be text/],
    ['a value that is a number', [{ name: 'X-A', value: 123 }], undefined, /value must be text/],
    ['an entry that is not an object', [null] as unknown as Headers, undefined, /needs a name and a value/],
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
    ['a value with NUL', [{ name: 'X-A', value: 'a\0b' }], undefined, /printable characters/],
    ['a value with ESC', [{ name: 'X-A', value: 'a\x1b[31m' }], undefined, /printable characters/],
    ['a value with DEL', [{ name: 'X-A', value: 'a\x7f' }], undefined, /printable characters/],
    ['a value above U+00FF', [{ name: 'X-A', value: 'Ā' }], undefined, /printable characters/],
    ['a value with an emoji', [{ name: 'X-A', value: 'ok 👍' }], undefined, /printable characters/],
    ['an empty value', [{ name: 'X-A', value: '' }], undefined, /no value/],
    ['a value of only spaces and tabs', [{ name: 'X-A', value: '  \t ' }], undefined, /no value/],
    ['a value over 4,096 characters', [{ name: 'X-A', value: 'a'.repeat(4097) }], undefined, /longer than 4096/],
    ['21 headers', Array.from({ length: 21 }, (_, i) => ({ name: `X-H${i}`, value: 'v' })), undefined, /at most 20/],
  ])('refuses %s', (_, headers, scheme, problem) => {
    expect(customProviderHeaderProblem(headers, scheme)).toMatch(problem);
  });

  // The problem text reaches terminals and logs, so it must not echo control characters or a huge name.
  it('quotes at most 100 characters of a bad name, without control characters', () => {
    const name = `X\u001b[2J${'a'.repeat(200)}`;

    expect(customProviderHeaderProblem([{ name, value: 'v' }], undefined)).toBe(
      `"X [2J${'a'.repeat(95)}..." is not a valid header name.`,
    );
  });
});
