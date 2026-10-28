import { describe, expect, it } from 'vitest';

import { cardRuleGroupSchema, evaluateRuleGroup } from './rule-group.js';
import type { RuleCondition, RuleGroup } from './rule-group.js';

const all = (...conditions: Array<RuleCondition | RuleGroup>): RuleGroup => ({ operator: 'AND', conditions });
const any = (...conditions: Array<RuleCondition | RuleGroup>): RuleGroup => ({ operator: 'OR', conditions });

describe('evaluateRuleGroup', () => {
  const pullRequest = {
    'source.kind': 'pull_request',
    'source.repository': 'Mastra-AI/mastra',
    'item.labels': ['Release', 'bug'],
    'item.title': 'Fix the flaky queue test',
    'item.authorTrusted': false,
    'item.draft': false,
  };

  it('routes an item with a matching label regardless of label case, like GitHub', () => {
    expect(evaluateRuleGroup(all({ field: 'item.labels', operator: 'contains', value: 'release' }), pullRequest)).toBe(
      true,
    );
    expect(evaluateRuleGroup(all({ field: 'item.labels', operator: 'contains', value: 'docs' }), pullRequest)).toBe(
      false,
    );
    expect(evaluateRuleGroup(all({ field: 'item.labels', operator: 'not_contains', value: 'docs' }), pullRequest)).toBe(
      true,
    );
  });

  it('matches repository slugs case-insensitively', () => {
    expect(
      evaluateRuleGroup(
        all({ field: 'source.repository', operator: 'equals', value: 'mastra-ai/mastra' }),
        pullRequest,
      ),
    ).toBe(true);
    expect(
      evaluateRuleGroup(
        all({ field: 'source.repository', operator: 'not_equals', value: 'mastra-ai/mastra' }),
        pullRequest,
      ),
    ).toBe(false);
  });

  it('treats a false boolean fact as present, so untrusted authors are not mistaken for missing ones', () => {
    expect(evaluateRuleGroup(all({ field: 'item.authorTrusted', operator: 'equals', value: false }), pullRequest)).toBe(
      true,
    );
    expect(evaluateRuleGroup(all({ field: 'item.authorTrusted', operator: 'exists' }), pullRequest)).toBe(true);
    expect(evaluateRuleGroup(all({ field: 'item.author', operator: 'exists' }), pullRequest)).toBe(false);
    expect(evaluateRuleGroup(all({ field: 'item.author', operator: 'not_exists' }), pullRequest)).toBe(true);
  });

  it('fails positive operators and passes negative ones when the fact is missing', () => {
    const facts = {};
    expect(evaluateRuleGroup(all({ field: 'item.author', operator: 'equals', value: 'x' }), facts)).toBe(false);
    expect(evaluateRuleGroup(all({ field: 'item.author', operator: 'contains', value: 'x' }), facts)).toBe(false);
    expect(evaluateRuleGroup(all({ field: 'item.author', operator: 'in', value: ['x'] }), facts)).toBe(false);
    expect(evaluateRuleGroup(all({ field: 'item.author', operator: 'not_equals', value: 'x' }), facts)).toBe(true);
    expect(evaluateRuleGroup(all({ field: 'item.author', operator: 'not_in', value: ['x'] }), facts)).toBe(true);
  });

  it('checks list membership and numeric order', () => {
    const facts = { 'issue.stateReason': 'not_planned', count: 3 };
    expect(
      evaluateRuleGroup(
        all({ field: 'issue.stateReason', operator: 'in', value: ['not_planned', 'duplicate'] }),
        facts,
      ),
    ).toBe(true);
    expect(
      evaluateRuleGroup(all({ field: 'issue.stateReason', operator: 'not_in', value: ['completed'] }), facts),
    ).toBe(true);
    expect(evaluateRuleGroup(all({ field: 'count', operator: 'greater_than', value: 2 }), facts)).toBe(true);
    expect(evaluateRuleGroup(all({ field: 'count', operator: 'greater_than', value: 3 }), facts)).toBe(false);
    expect(evaluateRuleGroup(all({ field: 'count', operator: 'greater_than_or_equal', value: 3 }), facts)).toBe(true);
    expect(evaluateRuleGroup(all({ field: 'count', operator: 'less_than', value: 3 }), facts)).toBe(false);
    expect(evaluateRuleGroup(all({ field: 'count', operator: 'less_than_or_equal', value: 3 }), facts)).toBe(true);
    expect(evaluateRuleGroup(all({ field: 'issue.stateReason', operator: 'greater_than', value: 1 }), facts)).toBe(
      false,
    );
  });

  it('combines AND and OR groups', () => {
    const releaseOrDocs = any(
      { field: 'item.labels', operator: 'contains', value: 'release' },
      { field: 'item.labels', operator: 'contains', value: 'docs' },
    );
    expect(
      evaluateRuleGroup(
        all({ field: 'source.kind', operator: 'equals', value: 'pull_request' }, releaseOrDocs),
        pullRequest,
      ),
    ).toBe(true);
    expect(
      evaluateRuleGroup(all({ field: 'source.kind', operator: 'equals', value: 'issue' }, releaseOrDocs), pullRequest),
    ).toBe(false);
  });

  it('matches everything when there is no condition, as for a phase without a condition', () => {
    expect(evaluateRuleGroup(null, {})).toBe(true);
    expect(evaluateRuleGroup(undefined, pullRequest)).toBe(true);
  });
});

describe('rule group schemas', () => {
  const leaf = { field: 'item.labels', operator: 'contains', value: 'release' } as const;

  it('accepts three levels of nesting and rejects a fourth', () => {
    const depth3 = all(any(all(leaf)));
    expect(cardRuleGroupSchema.safeParse(depth3).success).toBe(true);
    expect(cardRuleGroupSchema.safeParse(all(any(all(any(leaf))))).success).toBe(false);
  });

  it('only allows facts Factory knows about a card', () => {
    expect(cardRuleGroupSchema.safeParse(all(leaf)).success).toBe(true);
    expect(cardRuleGroupSchema.safeParse(all({ field: 'item.body', operator: 'exists' })).success).toBe(false);
  });

  it('checks each operator gets the value it needs', () => {
    expect(cardRuleGroupSchema.safeParse(all({ field: 'item.author', operator: 'exists', value: 'x' })).success).toBe(
      false,
    );
    expect(cardRuleGroupSchema.safeParse(all({ field: 'item.author', operator: 'equals' })).success).toBe(false);
    expect(cardRuleGroupSchema.safeParse(all({ field: 'item.author', operator: 'in', value: 'x' })).success).toBe(
      false,
    );
    expect(cardRuleGroupSchema.safeParse(all({ field: 'item.author', operator: 'equals', value: ['x'] })).success).toBe(
      false,
    );
    expect(
      cardRuleGroupSchema.safeParse(all({ field: 'item.title', operator: 'greater_than', value: 'a' })).success,
    ).toBe(false);
    expect(cardRuleGroupSchema.safeParse({ operator: 'AND', conditions: [] }).success).toBe(false);
  });
});
