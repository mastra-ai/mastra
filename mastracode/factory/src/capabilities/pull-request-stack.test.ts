import { describe, expect, it } from 'vitest';
import { readPullRequestStack } from './pull-request-stack.js';

describe('native pull request stack metadata', () => {
  it('reads the provider identity and position independently of how many PRs are loaded', () => {
    expect(
      readPullRequestStack({ id: 100, number: 7, position: 3, size: 8, base: { ref: 'main', sha: 'abc' } }),
    ).toEqual({ id: 100, number: 7, position: 3, base: { ref: 'main' } });
  });

  it.each([
    undefined,
    null,
    {},
    { base: { ref: 'main' } },
    { id: 100, number: 7, position: 0, base: { ref: 'main' } },
    { id: 100, number: 7, position: 1.5, base: { ref: 'main' } },
    { id: '100', number: 7, position: 1, base: { ref: 'main' } },
    { id: 100, number: 7, position: 1, base: { ref: '' } },
  ])('leaves absent or incomplete preview metadata ungrouped: %j', value => {
    expect(readPullRequestStack(value)).toBeUndefined();
  });
});
