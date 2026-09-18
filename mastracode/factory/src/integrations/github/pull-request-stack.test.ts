import { describe, expect, it } from 'vitest';
import { parseGithubReviewGroup, readGithubReviewGroup } from './pull-request-stack.js';

const nativeStack = { id: 100, number: 7, position: 3, size: 8, base: { ref: 'main', sha: 'abc' } };
const url = 'https://github.com/acme/repo/pull/17';

describe('GitHub native stack boundary', () => {
  it('normalizes ordered groups with an identity scoped to the provider host and repository', () => {
    expect(parseGithubReviewGroup(nativeStack, url)).toEqual({
      key: 'github:https://github.com/acme/repo:stack:100',
      label: 'Stack #7',
      position: 3,
      targetBranch: 'main',
    });
    const urls = [url, 'https://github.com/acme/other/pull/17', 'https://github.enterprise/acme/repo/pull/17'];
    expect(new Set(urls.map(url => parseGithubReviewGroup(nativeStack, url)?.key)).size).toBe(3);
  });

  it.each([undefined, null])('normalizes authoritative absence to null: %j', value => {
    expect(parseGithubReviewGroup(value, url)).toBeNull();
  });

  it.each([
    {},
    { ...nativeStack, position: 0 },
    { ...nativeStack, position: 1.5 },
    { ...nativeStack, id: '100' },
    { ...nativeStack, base: { ref: '' } },
  ])('rejects malformed metadata instead of reporting removal: %j', value => {
    expect(readGithubReviewGroup(value, url)).toBeUndefined();
    expect(() => parseGithubReviewGroup(value, url)).toThrow('Invalid GitHub stack metadata');
  });
});
