import { describe, expect, it } from 'vitest';

import { decisionRetryable } from './decision-applicability.js';

describe('decisionRetryable', () => {
  it('allows only failed, retryable, not-overtaken decisions', () => {
    expect(decisionRetryable({ status: 'failed', failureCode: 'session_unavailable' }, false)).toBe(true);
    expect(decisionRetryable({ status: 'failed', failureCode: null }, false)).toBe(true);
  });

  it.each(['pending', 'retry', 'leased', 'succeeded', 'superseded', 'proposed', 'dismissed'] as const)(
    'refuses a %s decision even though its failure code is empty',
    status => {
      expect(decisionRetryable({ status, failureCode: null }, false)).toBe(false);
    },
  );

  it.each(['run_overdue', 'skill_delivery_ambiguous', 'run_terminal_event_missing', 'repository_git_missing'] as const)(
    'refuses a failure a rerun cannot fix (%s)',
    failureCode => {
      expect(decisionRetryable({ status: 'failed', failureCode }, false)).toBe(false);
    },
  );

  it('refuses a failed decision whose card has moved on', () => {
    expect(decisionRetryable({ status: 'failed', failureCode: 'session_unavailable' }, true)).toBe(false);
  });
});
