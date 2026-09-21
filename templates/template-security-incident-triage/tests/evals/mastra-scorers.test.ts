import { describe, expect, it } from 'vitest';

import { securityScorers } from '../../src/mastra/scorers/security-scorers.js';

describe('security scorer registry', () => {
  it('registers five deterministic scorer definitions', () => {
    expect(Object.keys(securityScorers).sort()).toEqual([
      'attribution',
      'containmentSafety',
      'hallucination',
      'runbookCompliance',
      'severity',
    ]);
    expect(
      Object.values(securityScorers).every(
        scorer => scorer.getSteps().filter(step => step.type === 'prompt').length === 0,
      ),
    ).toBe(true);
  });
});
