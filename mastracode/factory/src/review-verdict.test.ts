import { describe, expect, it } from 'vitest';
import { normalizedVerdictLine, requestsChangesVerdict } from './review-verdict.js';

describe('requestsChangesVerdict', () => {
  // The Platform GitHub proxy prefixes every body it writes for a session with
  // an attribution line, so the verdict a review posts is on the second line.
  it('reads the verdict below the proxy attribution line', () => {
    const body = '> Opened by @DSchau\n\nVerdict: request changes\nReviewed head: abc';
    expect(normalizedVerdictLine(body)).toBe('verdict: request changes');
    expect(requestsChangesVerdict(body)).toBe(true);
  });

  it('does not look past a first line that is not the attribution', () => {
    expect(requestsChangesVerdict('Looks fine to me.\nVerdict: request changes')).toBe(false);
    expect(requestsChangesVerdict('> Opened by @DSchau\n\nThanks, will fix.')).toBe(false);
  });
});
