import { DEFAULT_INTAKE_ROUTES } from '@mastra/factory/boards/work-routes';
import { cardRuleGroupSchema } from '@mastra/factory/rules/rule-group';
import type { RuleGroup } from '@mastra/factory/rules/rule-group';
import { describe, expect, it } from 'vitest';

import { conditionFields, describeRule, intakeRouteFacts } from '../conditionFields';
import { canNest, emptyRow, fromRule, toRule } from '../conditionTree';

// A Self-review start rule in use today: groups three levels deep, the most the server accepts.
const selfReviewRule: RuleGroup = {
  operator: 'AND',
  conditions: [
    {
      operator: 'OR',
      conditions: [
        { operator: 'AND', conditions: [{ field: 'item.trusted', operator: 'equals', value: true }] },
        {
          operator: 'OR',
          conditions: [
            { field: 'item.labels', operator: 'contains', value: 'effort:low' },
            { field: 'item.labels', operator: 'contains', value: 'effort:medium' },
          ],
        },
      ],
    },
    { field: 'item.pullRequest', operator: 'not_exists' },
  ],
};

describe('condition rows', () => {
  it('edit every default route condition, and a three-level start rule, without changing them', () => {
    for (const { route } of DEFAULT_INTAKE_ROUTES) {
      const when = route.when ?? null;
      expect(toRule(fromRule(when))).toEqual({ rule: when, incomplete: false });
    }
    expect(cardRuleGroupSchema.safeParse(selfReviewRule).success).toBe(true);
    expect(toRule(fromRule(selfReviewRule))).toEqual({ rule: selfReviewRule, incomplete: false });
  });

  it('offer groups only as deep as the server accepts', () => {
    expect(canNest(0)).toBe(true);
    expect(canNest(1)).toBe(true);
    expect(canNest(2)).toBe(false);
  });

  it('leave out unfinished rows and empty groups, and read no rows as no rule', () => {
    expect(toRule(fromRule(null))).toEqual({ rule: null, incomplete: false });
    const root = fromRule({
      operator: 'AND',
      conditions: [{ field: 'source.kind', operator: 'equals', value: 'issue' }],
    });
    root.items.push(emptyRow(), { key: 'g', logic: 'OR', items: [] });
    expect(toRule(root)).toEqual({
      rule: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'issue' }] },
      incomplete: true,
    });
  });

  it('read a rule back in words', () => {
    expect(describeRule(selfReviewRule)).toBe(
      '((author is trusted) or (labels contains effort:low or labels contains effort:medium)) and card has no pull request',
    );
  });

  it('name stored values the way a person reads them', () => {
    const fields = conditionFields(intakeRouteFacts(['work_item.opened', 'work_item.closed']));
    const label = (id: string, value: string | boolean) => {
      const suggestions = fields.find(field => field.id === id)?.suggestions;
      return Array.isArray(suggestions) ? suggestions.find(option => option.value === String(value))?.label : undefined;
    };

    expect(label('item.trusted', false)).toBe('Outside author');
    expect(label('source.provider', 'incidentio')).toBe('incident.io');
    expect(label('event.reason', 'canceled')).toBe('Not planned');
  });

  it('offer each fact once, by the name a person picks it by, A to Z', () => {
    const labels = conditionFields(intakeRouteFacts(['work_item.closed', 'work_item.updated'])).map(
      field => field.label,
    );
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(labels).toEqual(expect.arrayContaining(['Source', 'Has pull request']));
    for (const gone of ['State', 'Integration', 'Provider', 'Kind', 'Closed issue has a pull request']) {
      expect(labels).not.toContain(gone);
    }
  });

  it('still read rules on facts the picker no longer offers', () => {
    expect(
      describeRule({
        operator: 'AND',
        conditions: [
          { field: 'source.integration', operator: 'equals', value: 'github' },
          { field: 'source.kind', operator: 'equals', value: 'issue' },
          { field: 'closedIssue.hasPullRequest', operator: 'equals', value: true },
        ],
      }),
    ).toBe('Integration is GitHub and kind is issue and closed issue has a pull request');
  });

  const CHANGES = ['event.labels.added', 'event.labels.removed', 'event.assignees.added', 'event.assignees.removed'];
  it.each([
    // New issues have no event to filter on, legacy rules included; a pull request opening may also move a card.
    [['work_item.opened'], [], ['event.type', ...CHANGES]],
    [['work_item.created'], [], ['event.type', ...CHANGES]],
    [['pull_request.opened'], ['event.type'], CHANGES],
    [['work_item.reopened'], ['event.type'], ['event.reason', ...CHANGES]],
    [['work_item.closed'], ['event.type', 'event.reason'], CHANGES],
    [['work_item.updated'], ['event.type', ...CHANGES], ['event.reason']],
    [['pull_request.updated'], CHANGES, ['event.reason']],
  ])('offer a rule on %j the event facts it can see', (on, offered, hidden) => {
    const ids = conditionFields(intakeRouteFacts(on)).map(field => field.id);
    expect(ids).toEqual(expect.arrayContaining(offered));
    for (const id of hidden) expect(ids).not.toContain(id);
  });
});
