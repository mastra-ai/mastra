import { describe, expect, it } from 'vitest';

import { cardRuleGroupSchema, evaluateRuleGroup } from '../rules/rule-group.js';
import { cardRuleFacts } from './card-facts.js';

const card = (stages: string[], metadata: Record<string, unknown> = {}) => ({
  title: 'Fix the bug',
  stages,
  metadata,
  externalSource: { integrationId: 'github', type: 'issue' as const, externalId: '1' },
});

describe('cardRuleFacts', () => {
  it('reports the phase the card is in and its review state', () => {
    expect(
      cardRuleFacts(
        card(['review'], {
          openPullRequestNumber: 42,
          reviewVerdict: 'request changes',
          selfReviewVerdict: 'approve',
          selfReviewNeedsHuman: true,
        }),
      ),
    ).toMatchObject({
      'item.phase': 'review',
      'item.openPullRequest': 42,
      'item.reviewVerdict': 'request changes',
      'item.selfReviewVerdict': 'approve',
      'item.selfReviewNeedsHuman': true,
    });
  });

  it('leaves review facts absent when the card has none', () => {
    const facts = cardRuleFacts(
      card(['execute'], { openPullRequestNumber: null, selfReviewNeedsHuman: false, reviewVerdict: 3 }),
    );

    expect(facts['item.phase']).toBe('execute');
    for (const field of [
      'item.openPullRequest',
      'item.reviewVerdict',
      'item.selfReviewVerdict',
      'item.selfReviewNeedsHuman',
    ]) {
      expect(facts).not.toHaveProperty(field);
    }
  });

  it('lets a phase condition test the new facts, absent ones included', () => {
    const noOpenPullRequest = cardRuleGroupSchema.parse({
      operator: 'AND',
      conditions: [
        { field: 'item.openPullRequest', operator: 'not_exists' },
        { field: 'item.reviewVerdict', operator: 'not_equals', value: 'request changes' },
        { field: 'item.phase', operator: 'equals', value: 'review' },
      ],
    });

    expect(evaluateRuleGroup(noOpenPullRequest, cardRuleFacts(card(['review'])))).toBe(true);
    expect(evaluateRuleGroup(noOpenPullRequest, cardRuleFacts(card(['review'], { openPullRequestNumber: 7 })))).toBe(
      false,
    );
    expect(
      evaluateRuleGroup(noOpenPullRequest, cardRuleFacts(card(['review'], { reviewVerdict: 'request changes' }))),
    ).toBe(false);
    expect(evaluateRuleGroup(noOpenPullRequest, cardRuleFacts(card(['planning'])))).toBe(false);
  });
});
