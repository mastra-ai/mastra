import { describe, expect, it } from 'vitest';

import { stepStartedAtFromRunSteps } from './workflow-run-conversations-sort';

describe('stepStartedAtFromRunSteps', () => {
  it('returns the earliest startedAt for foreach iteration arrays', () => {
    const steps = {
      'workflow-agent-demo-foreach': [
        { status: 'success' as const, startedAt: 300 },
        { status: 'success' as const, startedAt: 100 },
      ],
    };
    expect(stepStartedAtFromRunSteps(steps, 'workflow-agent-demo-foreach')).toBe(100);
  });

  it('matches nested step keys', () => {
    const steps = {
      'nested.workflow-agent-demo-brief': { status: 'success' as const, startedAt: 500 },
    };
    expect(stepStartedAtFromRunSteps(steps, 'workflow-agent-demo-brief')).toBe(500);
  });
});
