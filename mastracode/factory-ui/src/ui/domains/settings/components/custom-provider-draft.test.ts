import { describe, expect, it } from 'vitest';

import { serverHeaderProblemTarget } from './custom-provider-draft';

/** A plain header row keyed by its name, so the expected target reads plainly. */
function header(name: string) {
  return { key: name, name, value: 'v', secret: false };
}

describe('serverHeaderProblemTarget', () => {
  it.each([
    {
      headers: [header('A'), header('Content-Type')],
      message: 'The Content-Type header is set by the HTTP client and cannot be sent as a custom header.',
      expected: 'Content-Type',
    },
    {
      headers: [header('X-Org'), header('X-Org-Id')],
      message: 'The X-Org-Id header value cannot contain a line break.',
      expected: 'X-Org-Id',
    },
  ])('points a refused header at the row named $expected', ({ headers, message, expected }) => {
    expect(serverHeaderProblemTarget('header_refused', message, headers)).toEqual({ key: expected, input: 'name' });
  });
});
