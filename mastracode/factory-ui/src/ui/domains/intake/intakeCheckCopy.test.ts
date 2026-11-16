import { describe, expect, it } from 'vitest';

import {
  boardSummary,
  changedSummary,
  eventLabel,
  failedConditionLabel,
  moveVerdictLabel,
  notRoutedSummary,
  ruleCounts,
  ruleFiledLabel,
} from './intakeCheckCopy';

const boardName = (key: string) => ({ ship: 'Ship', platform: 'Platform', work: 'Work' })[key] ?? key;
const keys = (count: number) => Array.from({ length: count }, (_, index) => `item-${index}`);

// The dry-run counts feed the boards' intake pages; the tester panel's own labels are covered by its MSW test.
describe('intake check copy', () => {
  it.each<[string, unknown, unknown]>([
    ['a rule that only takes', ruleCounts({ takes: keys(6), lost: [] }, boardName), ['takes 6']],
    [
      'a rule losing items to several boards, skipping empty ones',
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
      ['takes 0', 'lost 3 to Ship, 1 to Platform'],
    ],
    ['live counts', ruleFiledLabel({ filed: 4 }), 'filed 4 in the last 30 days'],
    [
      'a burst reaching past the history read',
      moveVerdictLabel(
        {
          decisionId: 'd-1',
          at: null,
          event: { type: 'work_item.updated' },
          outcome: 'unknown',
          to: null,
          phase: null,
          reason: 'Part of the burst is older than the decisions read.',
          rules: [],
        },
        boardName,
      ),
      "can't tell. Part of the burst is older than the decisions read.",
    ],
    [
      'a board losing items',
      boardSummary({ takes: keys(14), lostTo: [{ boardKey: 'ship', keys: keys(9) }] }, 200, boardName),
      "Would take 14 of the last 200 items. 9 more matched this board's rules but Ship took them first.",
    ],
    [
      'a board losing one item to two boards, counted once',
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
      "Would take 0 of the last 1 item. 3 more matched this board's rules but Ship and Platform took them first.",
    ],
    ['a preview', changedSummary(12, 200), '12 of the last 200 items would now land on a different board or phase.'],
    ['a preview changing nothing', changedSummary(0, 200), 'None of the last 200 items would land anywhere new.'],
    // Includes items a rule matched but whose phase refused them.
    [
      'items no board takes',
      notRoutedSummary(3, 200),
      '3 of the last 200 items would not be routed because no board takes them.',
    ],
    ['no item left out', notRoutedSummary(0, 200), null],
    [
      'an empty list',
      failedConditionLabel({ field: 'item.labels', operator: 'contains', value: 'ship', actual: [] }),
      'item.labels is empty, wanted contains ship',
    ],
    [
      'a missing fact',
      failedConditionLabel({ field: 'item.author', operator: 'exists', actual: null }),
      'item.author has no value, wanted exists',
    ],
    [
      'assignee changes',
      eventLabel({ type: 'work_item.updated', assignees: { added: ['grace'], removed: ['ada'] } }),
      'work_item.updated, assignees +grace −ada',
    ],
    [
      'an untrusted pull request',
      eventLabel({ type: 'pull_request.opened', pullRequestTrusted: false }),
      'pull_request.opened, from an untrusted author',
    ],
  ])('words %s', (_, actual, expected) => {
    expect(actual).toEqual(expected);
  });
});
