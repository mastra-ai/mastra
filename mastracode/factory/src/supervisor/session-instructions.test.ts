import { describe, expect, it } from 'vitest';

import { SUPERVISOR_INSTRUCTIONS } from './instructions.js';

describe('supervisor session instructions', () => {
  it('distinguishes approval-free session operations and deferred or skipped changes', () => {
    expect(SUPERVISOR_INSTRUCTIONS).toContain('need no approval prompt');
    expect(SUPERVISOR_INSTRUCTIONS).toContain('update first, inspect the result, then signal');
    expect(SUPERVISOR_INSTRUCTIONS).toContain('next-run-start');
    expect(SUPERVISOR_INSTRUCTIONS).toContain('next-thread-switch');
    expect(SUPERVISOR_INSTRUCTIONS).toContain('Busy sessions skip mode and memory changes');
  });
});
