import { describe, expect, it } from 'vitest';

import { createPlanMode, planMode } from './plan.js';

describe('planMode', () => {
  it('delivers workflow designs through the normal plan contract', () => {
    expect(planMode.instructions).toContain(
      'include it in the implementation plan stored at the session-specific plan path',
    );
    expect(planMode.instructions).toContain('call `submit_plan({ path })`');
    expect(planMode.instructions).not.toContain('sketch it in chat');
  });

  it('never mentions submit_plan when the tool is unavailable', () => {
    const instructions = createPlanMode(false).instructions!;
    expect(instructions).not.toContain('submit_plan');
    expect(instructions).toContain('hand off the plan file as described in your system prompt');
  });
});
