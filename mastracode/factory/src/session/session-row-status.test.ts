import { describe, expect, it } from 'vitest';

import { sessionRowStatus } from './session-row-status.js';

describe('sessionRowStatus', () => {
  it('shows a sandbox still coming up over the run already registered on it', () => {
    expect(sessionRowStatus({ running: true, initializing: true })).toBe('initializing');
    expect(sessionRowStatus({ running: true, initializing: false })).toBe('working');
  });

  it('shows a run parked on a prompt as waiting while it is still in flight, and runs no marker when idle', () => {
    expect(sessionRowStatus({ running: true, initializing: false, attention: true })).toBe('ready');
    expect(sessionRowStatus({ running: false, initializing: false, attention: true })).toBe('ready');
    expect(sessionRowStatus({ running: false, initializing: false })).toBeUndefined();
  });
});
