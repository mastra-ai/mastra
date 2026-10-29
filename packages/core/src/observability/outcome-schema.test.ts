import { describe, expect, it } from 'vitest';
import { compactStopReasonContext, spanTerminationSchema } from './outcome-schema';

describe('stored stop-reason context', () => {
  it.each([
    { stopReason: 'guardrail', stopReasonContext: { processorId: 'policy' } },
    { stopReason: 'signal_received', stopReasonContext: { signalId: 'signal-1', signalType: 'user' } },
    {
      stopReason: 'observer_failed',
      stopReasonContext: { observerSpanId: 'observer-1', causeOutcome: 'error', causeStopReason: 'model_error' },
    },
  ])('retains compact references for $stopReason', context => {
    const stored = { outcome: 'interrupted', ...context };
    expect(spanTerminationSchema.parse(stored)).toEqual(stored);
  });
  it.each([
    { stopReason: 'guardrail', stopReasonContext: { tripwire: { metadata: { password: 'secret' } } } },
    { stopReason: 'signal_received', stopReasonContext: { signals: [{ contents: 'private message' }] } },
    { stopReason: 'observer_failed', stopReasonContext: { cause: { outcome: 'error' } } },
    { stopReason: 'model_error', stopReasonContext: { message: 'private provider response' } },
    { stopReason: 'model_error', stopReasonContext: { retryable: 'yes' } },
    { stopReason: 'max_steps', stopReasonContext: { timeoutMs: 100 } },
    { stopReason: 'guardrail', stopReasonContext: { processorId: 'x'.repeat(129) } },
  ])('rejects payloads, nested causes and invalid tooltip facts: %j', context => {
    expect(spanTerminationSchema.safeParse({ outcome: 'interrupted', ...context }).success).toBe(false);
  });
  it('ignores arbitrary payloads without reading them', () => {
    expect(
      compactStopReasonContext('guardrail', {
        processorId: 'policy',
        get metadata() {
          throw new Error('must not read payload');
        },
      }),
    ).toEqual({ processorId: 'policy' });
    expect(
      compactStopReasonContext('signal_received', { signalId: 'signal-1', signalType: 'user', contents: 'secret' }),
    ).toEqual({ signalId: 'signal-1', signalType: 'user' });
  });
});
