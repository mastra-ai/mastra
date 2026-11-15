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
        { operator: 'AND', conditions: [{ field: 'author.trusted', operator: 'equals', value: true }] },
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
      '((author is trusted) or (labels contains effort:low or labels contains effort:medium)) and card has no open pull request',
    );
  });

  it('name stored values the way a person reads them', () => {
    const fields = conditionFields(intakeRouteFacts(['work_item.created', 'work_item.closed']));
    const label = (id: string, value: string | boolean) => {
      const suggestions = fields.find(field => field.id === id)?.suggestions;
      return Array.isArray(suggestions) ? suggestions.find(option => option.value === String(value))?.label : undefined;
    };

    expect(label('author.trusted', false)).toBe('Outside author');
    expect(label('source.kind', 'pull_request')).toBe('Pull request');
    expect(label('source.integration', 'incidentio')).toBe('incident.io');
    expect(label('event.reason', 'canceled')).toBe('Not planned');
  });

  it('offer event facts only to routes that handle an event besides new cards', () => {
    const ids = (on: string[]) => conditionFields(intakeRouteFacts(on)).map(field => field.id);

    expect(ids(['work_item.created'])).not.toContain('event.type');
    expect(ids(['work_item.reopened'])).toContain('event.type');
    expect(ids(['work_item.reopened'])).not.toContain('event.reason');
    expect(ids(['work_item.closed'])).toContain('event.reason');
  });
});
