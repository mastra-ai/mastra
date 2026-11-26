import { describe, expect, it } from 'vitest';

import { customProviderHeaderProblem } from '../custom-provider-headers.js';
import type { CustomProviderAuthScheme } from '../settings.js';

type Headers = Array<{ name: unknown; value?: unknown }>;
const one = (name: unknown, value?: unknown): Headers => [{ name, value }];

describe('customProviderHeaderProblem', () => {
  it.each<[string, Headers, CustomProviderAuthScheme | undefined, RegExp | undefined]>([
    ['a plain header', one('X-Org-Id', 'org-1'), undefined, undefined],
    ['a custom User-Agent', one('User-Agent', 'acme/1.0'), 'bearer', undefined],
    ['a tab and Latin-1 letters', one('X-Team', 'café\tcrème'), undefined, undefined],
    ['Authorization when the key goes in x-api-key', one('Authorization', 'Basic abc'), 'x-api-key', undefined],
    ['a name without a value, kept from the saved header', one('X-Secret'), undefined, undefined],
    ['a name with a space', one('X Org', 'v'), undefined, /not a valid header name/],
    ['a name that is not text', one(123, 'v'), undefined, /name must be text/],
    ['Host in any case', one('HOST', 'evil'), undefined, /set by the HTTP client/],
    ['Transfer-Encoding', one('Transfer-Encoding', 'chunked'), undefined, /set by the HTTP client/],
    ['Authorization with a missing scheme', one('authorization', 'x'), undefined, /carries the API key/],
    ['x-api-key with x-api-key', one('X-API-Key', 'x'), 'x-api-key', /carries the API key/],
    ['the same name twice', [...one('X-Org', 'a'), ...one('x-org', 'b')], undefined, /more than once/],
    ['a value with LF', one('X-A', 'a\nInjected: 1'), undefined, /line break/],
    // The HTTP client refuses these at call time, and U+009B starts an escape sequence on some terminals.
    ['a value with a control character', one('X-A', 'a\u009b2J'), undefined, /printable characters/],
    ['a value above U+00FF', one('X-A', 'ok 👍'), undefined, /printable characters/],
    ['a value of only spaces', one('X-A', '   '), undefined, /no value/],
    ['a value over 4,096 characters', one('X-A', 'a'.repeat(4097)), undefined, /longer than 4096/],
    ['21 headers', Array.from({ length: 21 }, (_, i) => one(`X-H${i}`, 'v')[0]!), undefined, /at most 20/],
  ])('judges %s', (_, headers, scheme, problem) => {
    const result = customProviderHeaderProblem(headers, scheme);

    if (problem) expect(result).toMatch(problem);
    else expect(result).toBeUndefined();
  });
});
