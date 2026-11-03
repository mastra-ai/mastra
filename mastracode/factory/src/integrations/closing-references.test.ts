import { describe, expect, it } from 'vitest';

import { closingIssueNumbers } from './closing-references.js';

const github = { provider: 'github' as const, repository: 'acme/app' };
const gitlab = { provider: 'gitlab' as const, repository: 'group/sub/project' };

describe('closingIssueNumbers', () => {
  it.each([
    ['Fixes #12', [12]],
    ['closes #12', [12]],
    ['This resolved #3.', [3]],
    ['fixes acme/app#13 and closes #12', [13, 12]],
    ['Fixes ACME/App#7', [7]],
    ['Fixes #12\nFixes #12', [12]],
  ])('reads %j as closing %j on GitHub', (text, expected) => {
    expect(closingIssueNumbers(text, github)).toEqual(expected);
  });

  it.each([
    ['fixes other/app#12', 'another repository'],
    ['See https://github.com/acme/app/issues/12', 'a link'],
    ['`fixes #12`', 'a code span'],
    ['```\nfixes #12\n```', 'a fenced block'],
    ['<!-- fixes #12 -->', 'an HTML comment'],
    ['refixes #12 or prefix#5 or fixes#6', 'keyword glued to other words'],
    ['Related to #12', 'a mention without a closing keyword'],
    ['Implements #9', "GitLab's keyword on GitHub"],
  ])('ignores %j (%s)', text => {
    expect(closingIssueNumbers(text, github)).toEqual([]);
  });

  it("reads GitLab's keywords and lists", () => {
    expect(closingIssueNumbers('Closes #1, #2 and #3', gitlab)).toEqual([1, 2, 3]);
    expect(closingIssueNumbers('Implements group/sub/project#9', gitlab)).toEqual([9]);
    expect(closingIssueNumbers('Implements other/project#9', gitlab)).toEqual([]);
  });

  it('has nothing to read in an empty description', () => {
    expect(closingIssueNumbers(null, github)).toEqual([]);
    expect(closingIssueNumbers('', gitlab)).toEqual([]);
  });
});
