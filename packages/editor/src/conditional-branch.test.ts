import { describe, expect, it } from 'vitest';

import { matchesAnyConditionRule } from './conditional-branch';

const conditions = [
  {
    rules: {
      operator: 'AND' as const,
      conditions: [{ field: 'state.route', operator: 'equals' as const, value: 'matched' }],
    },
    steps: [],
  },
  { steps: [] },
];

describe('matchesAnyConditionRule', () => {
  it('returns true when an explicit rule matches', () => {
    expect(matchesAnyConditionRule(conditions, { state: { route: 'matched' } })).toBe(true);
  });

  it('ignores the default condition when no explicit rule matches', () => {
    expect(matchesAnyConditionRule(conditions, { state: { route: 'fallback' } })).toBe(false);
  });

  it('returns false when a graph contains only a default condition', () => {
    expect(matchesAnyConditionRule([{ steps: [] }], { state: { route: 'matched' } })).toBe(false);
  });
});
