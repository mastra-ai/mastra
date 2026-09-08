import { describe, expect, it } from 'vitest';

import { planMode } from './plan.js';

describe('planMode', () => {
  it('delivers workflow designs through the normal plan contract', () => {
    expect(planMode.instructions).toContain(
      'include it in the implementation plan stored at the session-specific plan path',
    );
    expect(planMode.instructions).toContain('call `submit_plan({ path })`');
    expect(planMode.instructions).not.toContain('sketch it in chat');
  });
});
