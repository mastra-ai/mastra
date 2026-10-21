import { describe, expect, it } from 'vitest';

import type { RepositoryCommit } from '../../../../services/commits';
import type { TimeWindow } from '../time/timeViewport';
import { commitChips, datedCommits } from './commitChips';

const MINUTE_MS = 60_000;
const PAST_WINDOW: TimeWindow = { startMs: 0, endMs: 100 * MINUTE_MS, endsAtNow: false };
const TRACK_PX = 1000;

function commitAt(minute: number, author: string | null = 'ada'): RepositoryCommit {
  return {
    sha: `sha-${minute}`,
    message: `Commit at ${minute}`,
    author,
    avatarUrl: null,
    committedAt: new Date(minute * MINUTE_MS).toISOString(),
    url: `https://github.com/acme/app/commit/sha-${minute}`,
  };
}

function chipsFor(commits: RepositoryCommit[], timeWindow = PAST_WINDOW) {
  return commitChips(datedCommits(commits), timeWindow, TRACK_PX);
}

function clusteredShas(minutes: number[], timeWindow = PAST_WINDOW): string[][] {
  return chipsFor(
    minutes.map(minute => commitAt(minute)),
    timeWindow,
  ).map(chip => chip.commits.map(({ commit }) => commit.sha));
}

describe('commitChips', () => {
  it('folds commits too close to tell apart into one chip and keeps distant ones separate', () => {
    expect(clusteredShas([13, 10, 40])).toEqual([['sha-10', 'sha-13'], ['sha-40']]);
  });

  it('gives each commit its own chip once they sit a chip-width apart', () => {
    expect(clusteredShas([10, 16])).toEqual([['sha-10'], ['sha-16']]);
  });

  it('folds commits at the live edge, where the newest chip is pushed back inside the lane', () => {
    expect(clusteredShas([95, 100], { ...PAST_WINDOW, endsAtNow: true })).toEqual([['sha-95', 'sha-100']]);
  });

  it('lets a chip slide out past the left edge while its tail is still in view', () => {
    const [leaving] = chipsFor([commitAt(-5), commitAt(50)]);

    expect(leaving).toMatchObject({ leftPx: -50, commits: [{ commit: { sha: 'sha--5' } }] });
    expect(clusteredShas([-30, -5, 50, 120])).toEqual([['sha--5'], ['sha-50']]);
  });

  it('lets a chip run off the right edge of a past window instead of pinning it inside', () => {
    expect(chipsFor([commitAt(99)])).toMatchObject([{ leftPx: 990 }]);
  });

  it('keeps the same groups while panning, so an open cluster stays put', () => {
    const chainMinutes = [200, 205, 210, 215, 220, 225, 230, 235, 240];
    const groupsFrom = (startMinute: number) =>
      clusteredShas(chainMinutes, {
        startMs: startMinute * MINUTE_MS,
        endMs: (startMinute + 100) * MINUTE_MS,
        endsAtNow: false,
      });

    expect(groupsFrom(223)).toEqual(groupsFrom(222));
  });

  it('widens a folded chip for each extra face, up to three distinct authors', () => {
    const oneAuthor = [commitAt(10), commitAt(11), commitAt(12)];
    const manyAuthors = [
      commitAt(10),
      commitAt(11, 'margaret'),
      commitAt(12, null),
      commitAt(13, 'ada'),
      commitAt(14, 'grace'),
      commitAt(15, 'linus'),
    ];

    const [single] = chipsFor([...oneAuthor, commitAt(60)]);
    const [folded] = chipsFor([...manyAuthors, commitAt(60)]);

    expect(folded?.authors.map(author => author.name)).toEqual(['ada', 'margaret', 'grace']);
    expect(folded?.widthPx).toBeGreaterThan(single?.widthPx ?? Infinity);
  });

  it('keeps a folded chip to one face when the next chip leaves no room for more', () => {
    const [chip, next] = chipsFor([commitAt(10), commitAt(12, 'grace'), commitAt(16)]);

    expect(chip?.authors.map(author => author.name)).toEqual(['ada']);
    expect((chip?.leftPx ?? 0) + (chip?.widthPx ?? 0)).toBeLessThanOrEqual(next?.leftPx ?? 0);
  });
});
