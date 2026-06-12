import { describe, expect, it } from 'vitest';

import { GoalStateProcessor } from '../tools/builtin/goal-state-processor';

// Import via the `@mastra/core/signals` barrel so this also exercises that the
// signals barrel can pull GoalSignalProvider without an initialization cycle.
import { GoalSignalProvider } from './index';

describe('GoalSignalProvider', () => {
  it('has a stable id', () => {
    expect(new GoalSignalProvider().id).toBe('goal-signals');
  });

  it('exposes a single GoalStateProcessor input processor', () => {
    const processors = new GoalSignalProvider().getInputProcessors();
    expect(processors).toHaveLength(1);
    expect(processors[0]).toBeInstanceOf(GoalStateProcessor);
  });

  it('returns the same processor instance across calls (stable lane)', () => {
    const provider = new GoalSignalProvider();
    expect(provider.getInputProcessors()[0]).toBe(provider.getInputProcessors()[0]);
  });
});
