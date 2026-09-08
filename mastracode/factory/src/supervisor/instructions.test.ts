import { expect, it } from 'vitest';
import { SUPERVISOR_INSTRUCTIONS } from './instructions.js';

it('keeps manual filing separate from approval-gated worker startup', () => {
  expect(SUPERVISOR_INSTRUCTIONS).toContain('do not leave intake on their own');
  expect(SUPERVISOR_INSTRUCTIONS).toContain('factory_transition_work_item');
  expect(SUPERVISOR_INSTRUCTIONS).toContain('existing card rather than creating a duplicate');
});
