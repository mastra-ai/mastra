import { describe, expect, it } from 'vitest';

import { truncateStringForTokenEstimate } from '../token-estimator.js';

// Matches a high surrogate not followed by a low one, or a low surrogate not preceded by a high one.
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function expectWellFormed(text: string) {
  expect(text).not.toMatch(LONE_SURROGATE_RE);
  // Node escapes a lone surrogate as `\udXXX`, which strict JSON parsers reject.
  expect(JSON.stringify(text)).not.toMatch(/\\ud[89a-f][0-9a-f]{2}/i);
}

describe('truncateStringForTokenEstimate', () => {
  // A web_search result held math italic letters (surrogate pairs). The truncated result started
  // with the low half of U+1D452, and the provider rejected the request:
  // "The request body is not valid JSON: lone leading surrogate in hex escape".
  it('does not split a surrogate pair at the cut (math italic text)', () => {
    const text = 'plain prefix text\n𝑡ℎ𝑟𝑒𝑠ℎ𝑜𝑙𝑑𝑗';

    // Before the fix this returned "\udc52𝑠ℎ𝑜𝑙𝑑𝑗" after the marker.
    const truncated = truncateStringForTokenEstimate(text, 2);

    expect(truncated).toMatch(/^\[Truncated ~\d+ tokens\]\n�𝑠ℎ𝑜𝑙𝑑𝑗$/u);
    expectWellFormed(truncated);
  });

  it('does not leave half an emoji at either end of the cut', () => {
    const text = `release notes ${'🙂'.repeat(5)} and more words after the emoji run`;

    for (let tokens = 1; tokens < 20; tokens++) {
      expectWellFormed(truncateStringForTokenEstimate(text, tokens));
      expectWellFormed(truncateStringForTokenEstimate(text, tokens, false));
    }
  });

  it('keeps whole surrogate pairs that the cut does not touch', () => {
    const text = `${'word '.repeat(50)}🙂 end`;

    const truncated = truncateStringForTokenEstimate(text, 3);

    expect(truncated).toContain('🙂 end');
  });
});
