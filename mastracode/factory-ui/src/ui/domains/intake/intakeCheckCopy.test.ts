import { describe, expect, it } from 'vitest';

import {
  boardSummary,
  changedSummary,
  failedConditionLabel,
  notRoutedSummary,
  ruleCounts,
  ruleFiledLabel,
} from './intakeCheckCopy';

const boardName = (key: string) => ({ ship: 'Ship', platform: 'Platform', work: 'Work' })[key] ?? key;
const keys = (count: number) => Array.from({ length: count }, (_, index) => `item-${index}`);

describe('intake check copy', () => {
  it('counts what a rule takes and what it loses, board by board', () => {
    expect(ruleCounts({ takes: keys(6), lost: [] }, boardName)).toEqual(['takes 6']);
    expect(ruleCounts({ takes: keys(6), lost: [{ boardKey: 'ship', keys: keys(3) }] }, boardName)).toEqual([
      'takes 6',
      'lost 3 to Ship',
    ]);
    expect(
      ruleCounts(
        {
          takes: [],
          lost: [
            { boardKey: 'ship', keys: keys(3) },
            { boardKey: 'platform', keys: keys(1) },
            { boardKey: 'work', keys: [] },
          ],
        },
        boardName,
      ),
    ).toEqual(['takes 0', 'lost 3 to Ship, 1 to Platform']);
    expect(ruleFiledLabel({ filed: 4 })).toBe('filed 4 in the last 30 days');
  });

  it('sums up a board, counting an item lost to several boards once', () => {
    expect(boardSummary({ takes: keys(14), lostTo: [{ boardKey: 'ship', keys: keys(9) }] }, 200, boardName)).toBe(
      "Would take 14 of the last 200 items. 9 more matched this board's rules but Ship took them first.",
    );
    expect(
      boardSummary(
        {
          takes: [],
          lostTo: [
            { boardKey: 'ship', keys: ['a', 'b'] },
            { boardKey: 'platform', keys: ['b', 'c'] },
          ],
        },
        1,
        boardName,
      ),
    ).toBe("Would take 0 of the last 1 item. 3 more matched this board's rules but Ship and Platform took them first.");
    expect(boardSummary({ takes: keys(2), lostTo: [] }, 200, boardName)).toBe('Would take 2 of the last 200 items.');
  });

  it('describes a preview and the items no board takes', () => {
    expect(changedSummary(12, 200)).toBe('12 of the last 200 items would now land on a different board.');
    expect(changedSummary(0, 200)).toBe('None of the last 200 items would land anywhere new.');
    expect(notRoutedSummary(3, 200)).toBe("3 of the last 200 items match no board's rules and would not be routed.");
    expect(notRoutedSummary(0, 200)).toBeNull();
  });

  it('names the value a failed condition saw', () => {
    expect(failedConditionLabel({ field: 'item.labels', operator: 'contains', value: 'ship', actual: [] })).toBe(
      'item.labels is empty, wanted contains ship',
    );
    expect(failedConditionLabel({ field: 'item.author', operator: 'exists', actual: null })).toBe(
      'item.author has no value, wanted exists',
    );
    expect(failedConditionLabel({ field: 'item.pullRequest', operator: 'greater_than', value: 3, actual: 2 })).toBe(
      'item.pullRequest is 2, wanted greater_than 3',
    );
  });
});
