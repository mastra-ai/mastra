import { describe, expect, it } from 'vitest';

import { serverHeaderProblemTarget } from './custom-provider-draft';
import type { HeaderDraft } from './custom-provider-draft';

/** A plain header row with a value, keyed by its name so the expected target reads plainly. */
function header(name: string): HeaderDraft {
  return { key: name, name, value: 'v', secret: false };
}

describe('serverHeaderProblemTarget', () => {
  it.each([
    {
      case: 'a one-letter name that only appears inside words',
      headers: [header('A'), header('Content-Type')],
      message: 'The Content-Type header is set by the HTTP client and cannot be sent as a custom header.',
      expected: 'Content-Type',
    },
    {
      case: 'a name that is the start of a longer one',
      headers: [header('X-Org'), header('X-Org-Id')],
      message: 'The X-Org-Id header value cannot contain a line break.',
      expected: 'X-Org-Id',
    },
    {
      case: 'a name that differs only in case',
      headers: [header('x-team')],
      message: 'The X-Team header is listed more than once.',
      expected: 'x-team',
    },
  ])('points a refused header at the row it names, with $case', ({ headers, message, expected }) => {
    expect(serverHeaderProblemTarget('header_refused', message, headers)).toEqual({ key: expected, input: 'name' });
  });

  it('points at no row when the message names none of them', () => {
    const message = 'The X-Org header is set by the HTTP client and cannot be sent as a custom header.';
    expect(serverHeaderProblemTarget('header_refused', message, [header('X-Org-Id')])).toBeUndefined();
  });
});
