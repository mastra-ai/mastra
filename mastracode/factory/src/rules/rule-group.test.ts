import { describe, expect, it } from 'vitest';

import { cardRuleGroupSchema, evaluateRuleGroup, explainRuleGroup } from './rule-group.js';
import type { RuleCondition, RuleGroup } from './rule-group.js';

const all = (...conditions: Array<RuleCondition | RuleGroup>): RuleGroup => ({ operator: 'AND', conditions });
const any = (...conditions: Array<RuleCondition | RuleGroup>): RuleGroup => ({ operator: 'OR', conditions });

/** Every case below runs through both entry points: explaining a rule must decide exactly as evaluating it. */
function evaluate(group: RuleGroup | null | undefined, facts: Parameters<typeof evaluateRuleGroup>[1]): boolean {
  const result = evaluateRuleGroup(group, facts);
  const explained = explainRuleGroup(group, facts);
  expect(explained.matched).toBe(result);
  expect(explained.failed.length === 0).toBe(result);
  return result;
}

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
    expect(evaluate(all({ field: 'item.labels', operator: 'contains', value: 'release' }), pullRequest)).toBe(true);
    expect(evaluate(all({ field: 'item.labels', operator: 'contains', value: 'docs' }), pullRequest)).toBe(false);
    expect(evaluate(all({ field: 'item.labels', operator: 'not_contains', value: 'docs' }), pullRequest)).toBe(true);
  });

  it('matches repository slugs case-insensitively', () => {
    expect(
      evaluate(all({ field: 'source.repository', operator: 'equals', value: 'mastra-ai/mastra' }), pullRequest),
    ).toBe(true);
    expect(
      evaluate(all({ field: 'source.repository', operator: 'not_equals', value: 'mastra-ai/mastra' }), pullRequest),
    ).toBe(false);
  });

  it('treats a false boolean fact as present, so untrusted authors are not mistaken for missing ones', () => {
    expect(evaluate(all({ field: 'item.authorTrusted', operator: 'equals', value: false }), pullRequest)).toBe(true);
    expect(evaluate(all({ field: 'item.authorTrusted', operator: 'exists' }), pullRequest)).toBe(true);
    expect(evaluate(all({ field: 'item.author', operator: 'exists' }), pullRequest)).toBe(false);
    expect(evaluate(all({ field: 'item.author', operator: 'not_exists' }), pullRequest)).toBe(true);
  });

  it('fails positive operators and passes negative ones when the fact is missing', () => {
    const facts = {};
    expect(evaluate(all({ field: 'item.author', operator: 'equals', value: 'x' }), facts)).toBe(false);
    expect(evaluate(all({ field: 'item.author', operator: 'contains', value: 'x' }), facts)).toBe(false);
    expect(evaluate(all({ field: 'item.author', operator: 'in', value: ['x'] }), facts)).toBe(false);
    expect(evaluate(all({ field: 'item.author', operator: 'not_equals', value: 'x' }), facts)).toBe(true);
    expect(evaluate(all({ field: 'item.author', operator: 'not_in', value: ['x'] }), facts)).toBe(true);
  });

  it('checks list membership and numeric order', () => {
    const facts = { 'issue.stateReason': 'not_planned', count: 3 };
    expect(
      evaluate(all({ field: 'issue.stateReason', operator: 'in', value: ['not_planned', 'duplicate'] }), facts),
    ).toBe(true);
    expect(evaluate(all({ field: 'issue.stateReason', operator: 'not_in', value: ['completed'] }), facts)).toBe(true);
    expect(evaluate(all({ field: 'count', operator: 'greater_than', value: 2 }), facts)).toBe(true);
    expect(evaluate(all({ field: 'count', operator: 'greater_than', value: 3 }), facts)).toBe(false);
    expect(evaluate(all({ field: 'count', operator: 'greater_than_or_equal', value: 3 }), facts)).toBe(true);
    expect(evaluate(all({ field: 'count', operator: 'less_than', value: 3 }), facts)).toBe(false);
    expect(evaluate(all({ field: 'count', operator: 'less_than_or_equal', value: 3 }), facts)).toBe(true);
    expect(evaluate(all({ field: 'issue.stateReason', operator: 'greater_than', value: 1 }), facts)).toBe(false);
  });

  it('tests a list fact by its members, and an empty list as no value', () => {
    const assigned = { 'item.assignees': ['Ada', 'grace'] };
    const unassigned = { 'item.assignees': [] };
    const test = (operator: RuleCondition['operator'], value: unknown, facts: Record<string, unknown>) =>
      evaluate(all({ field: 'item.assignees', operator, value } as RuleCondition), facts);

    expect(test('equals', 'ada', assigned)).toBe(true);
    expect(test('equals', 'linus', assigned)).toBe(false);
    expect(test('not_equals', 'ada', assigned)).toBe(false);
    expect(test('not_equals', 'linus', assigned)).toBe(true);
    expect(test('in', ['linus', 'Grace'], assigned)).toBe(true);
    expect(test('not_in', ['linus', 'Grace'], assigned)).toBe(false);
    expect(test('not_in', ['linus'], assigned)).toBe(true);
    expect(test('exists', undefined, assigned)).toBe(true);
    expect(test('not_exists', undefined, assigned)).toBe(false);

    expect(test('exists', undefined, unassigned)).toBe(false);
    expect(test('not_exists', undefined, unassigned)).toBe(true);
    expect(test('equals', 'ada', unassigned)).toBe(false);
    expect(test('not_equals', 'ada', unassigned)).toBe(true);
    expect(test('contains', 'ada', unassigned)).toBe(false);
    expect(test('not_contains', 'ada', unassigned)).toBe(true);
  });

  it('combines AND and OR groups', () => {
    const releaseOrDocs = any(
      { field: 'item.labels', operator: 'contains', value: 'release' },
      { field: 'item.labels', operator: 'contains', value: 'docs' },
    );
    expect(
      evaluate(all({ field: 'source.kind', operator: 'equals', value: 'pull_request' }, releaseOrDocs), pullRequest),
    ).toBe(true);
    expect(
      evaluate(all({ field: 'source.kind', operator: 'equals', value: 'issue' }, releaseOrDocs), pullRequest),
    ).toBe(false);
  });

  it('matches everything when there is no condition, as for a phase without a condition', () => {
    expect(evaluate(null, {})).toBe(true);
    expect(evaluate(undefined, pullRequest)).toBe(true);
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

  it("lets a condition test whether the card's author is trusted", () => {
    expect(
      cardRuleGroupSchema.safeParse(all({ field: 'author.trusted', operator: 'equals', value: true })).success,
    ).toBe(true);
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

describe('explainRuleGroup', () => {
  const issue = {
    'source.kind': 'issue',
    'source.repository': 'mastra-ai/mastra',
    'item.labels': ['bug'],
    'author.trusted': true,
  };

  it('names each condition an AND group fails on, with the fact it read', () => {
    const group = all(
      { field: 'source.repository', operator: 'equals', value: 'mastra-ai/ship' },
      { field: 'item.labels', operator: 'contains', value: 'bug' },
      { field: 'item.labels', operator: 'contains', value: 'ship' },
    );
    expect(explainRuleGroup(group, issue)).toEqual({
      matched: false,
      failed: [
        { field: 'source.repository', operator: 'equals', value: 'mastra-ai/ship', actual: 'mastra-ai/mastra' },
        { field: 'item.labels', operator: 'contains', value: 'ship', actual: ['bug'] },
      ],
    });
  });

  it('names every branch of an OR group that failed, and a missing fact as null', () => {
    const group = all(
      { field: 'author.trusted', operator: 'equals', value: true },
      any(
        { field: 'source.kind', operator: 'equals', value: 'pull_request' },
        { field: 'item.assignees', operator: 'exists' },
      ),
    );
    expect(explainRuleGroup(group, issue)).toEqual({
      matched: false,
      failed: [
        { field: 'source.kind', operator: 'equals', value: 'pull_request', actual: 'issue' },
        { field: 'item.assignees', operator: 'exists', actual: null },
      ],
    });
  });

  it('reports no failure for a matching group or no group at all', () => {
    expect(explainRuleGroup(null, issue)).toEqual({ matched: true, failed: [] });
    expect(
      explainRuleGroup(
        any(
          { field: 'source.kind', operator: 'equals', value: 'pull_request' },
          { field: 'item.labels', operator: 'contains', value: 'BUG' },
        ),
        issue,
      ),
    ).toEqual({ matched: true, failed: [] });
  });

  it('agrees with evaluateRuleGroup on every operator, present and missing facts', () => {
    const operators = [
      ['equals', 'bug'],
      ['not_equals', 'bug'],
      ['contains', 'bu'],
      ['not_contains', 'bug'],
      ['in', ['bug', 'docs']],
      ['not_in', ['docs']],
      ['exists', undefined],
      ['not_exists', undefined],
      ['greater_than', 1],
      ['less_than', 1],
      ['greater_than_or_equal', 2],
      ['less_than_or_equal', 2],
    ] as const;
    const factSets = [issue, { 'item.labels': [] }, { 'item.labels': 'bug' }, { 'item.labels': 2 }, {}];
    for (const [operator, value] of operators) {
      const leaf = { field: 'item.labels', operator, ...(value === undefined ? {} : { value }) } as RuleCondition;
      for (const facts of factSets) {
        for (const group of [all(leaf), any(leaf, { field: 'x', operator: 'exists' }), all(all(leaf), any(leaf))]) {
          expect(explainRuleGroup(group, facts).matched).toBe(evaluateRuleGroup(group, facts));
        }
      }
    }
  });
});
