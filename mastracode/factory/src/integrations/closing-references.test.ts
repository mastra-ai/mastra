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

  it.each([
    ['#1, #2 and #3', [1, 2, 3]],
    ['#1,#2, and #3', [1, 2, 3]],
    ['#1 , and #2', [1, 2]],
    ['#1  and  #2', [1, 2]],
    ['#1,and #2', [1]],
    ['#1 or #2', [1]],
    ['group/sub/project#4, #5', [4, 5]],
  ])('reads the GitLab list "Closes %s"', (list, expected) => {
    expect(closingIssueNumbers(`Closes ${list}`, gitlab)).toEqual(expected);
  });

  it.each([
    ['```\nCloses #2\n```\nCloses #1', 'a closed fence'],
    ['~~~~\nCloses #2\n~~~\n~~~~~\nCloses #1', 'a fence closed by a longer run, not a shorter one'],
    ['```\nCloses #2\n~~~\nCloses #3\n```\nCloses #1', 'a fence the other character never closes'],
    ['Closes #1\n```\nCloses #2', 'an unclosed fence, to the end'],
    ['````\nCloses #2\n`````Closes #1', 'the rest of a longer closing run'],
  ])('reads only what is outside %j (%s)', text => {
    expect(closingIssueNumbers(text, github)).toEqual([1]);
  });

  it("drops an unclosed HTML comment's tail, like an unclosed code fence", () => {
    expect(closingIssueNumbers('Closes #1\n<!-- Closes #2', github)).toEqual([1]);
  });

  // A description is attacker-shaped text from anyone with Developer access, read on every delivery
  // and replay, so it must take linear time. Each body here took seconds to minutes before.
  it.each([
    ['40k spaces after a GitLab list', `Closes #1${' '.repeat(40_000)}`, gitlab],
    ['1 MB of unclosed HTML comments', `Closes #1 ${'<!--'.repeat(262_144)}`, github],
    ['1 MB of unclosed HTML comments on GitLab', `Closes #1 ${'<!--'.repeat(262_144)}`, gitlab],
    [
      'a 262k-backtick fence opener followed by shorter runs',
      `Closes #1 ${'`'.repeat(262_000)}${` ${'`'.repeat(261_999)}`.repeat(3)}`,
      gitlab,
    ],
    ['1 MB of short code fences', `Closes #1 ${'```a```'.repeat(150_000)}`, gitlab],
  ])('reads %s in linear time', (_, body, options) => {
    const started = performance.now();
    expect(closingIssueNumbers(body, options)).toEqual([1]);
    expect(performance.now() - started).toBeLessThan(250);
  });

  it('has nothing to read in an empty description', () => {
    expect(closingIssueNumbers(null, github)).toEqual([]);
    expect(closingIssueNumbers('', gitlab)).toEqual([]);
  });
});
