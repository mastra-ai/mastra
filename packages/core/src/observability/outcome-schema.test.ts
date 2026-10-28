import { describe, expect, it } from 'vitest';
import { signalToDataPartFormat } from '../agent/signals';
import { spanStopReasonContextSchema, spanTerminationSchema } from './outcome-schema';

describe('stored stop-reason context', () => {
  it('preserves serialized files and signal metadata used to interrupt a request', () => {
    const signal = signalToDataPartFormat({
      type: 'user',
      contents: [
        { type: 'text', text: 'Use this attachment', providerOptions: { custom: { diagnostic: true } } },
        { type: 'file', data: new Uint8Array([65, 66, 67]), mediaType: 'text/plain', filename: 'note.txt' },
      ],
      attributes: { source: 'caller' },
      metadata: { task: 'replacement' },
      author: { id: 'user', name: 'Caller' },
      providerOptions: { custom: { instruction: 'replace' } },
    }).data;
    const stored = JSON.parse(
      JSON.stringify({
        outcome: 'interrupted',
        stopReason: 'signal_received',
        stopReasonContext: { signals: [signal] },
      }),
    );
    expect(spanTerminationSchema.parse(stored)).toEqual(stored);
    expect(spanStopReasonContextSchema.parse(stored.stopReasonContext)).toEqual(stored.stopReasonContext);
    expect(stored.stopReasonContext.signals[0].contents[1]).toMatchObject({ data: 'QUJD', filename: 'note.txt' });
  });

  it('retains nested observer limits and structured signal content during validation', () => {
    const context = {
      outcome: 'interrupted',
      stopReason: 'observer_failed',
      stopReasonContext: {
        tripwire: { processorId: 'observer', reason: 'Observer failed', retry: false, metadata: { policy: 'abort' } },
        observerSpanId: 'observer',
        cause: {
          outcome: 'limit',
          stopReason: 'context_window_exceeded',
          stopReasonContext: {
            provider: 'openai',
            errorCode: 'context_length_exceeded',
            retryable: false,
          },
        },
        signals: [
          {
            id: 'stop',
            type: 'reactive',
            createdAt: '2026-10-27T12:00:00Z',
            contents: [{ type: 'text', text: 'Observation failed', providerOptions: { custom: { diagnostic: true } } }],
            attributes: { source: 'observer' },
          },
        ],
      },
    };
    expect(spanTerminationSchema.parse(JSON.parse(JSON.stringify(context)))).toEqual(context);
    expect(spanStopReasonContextSchema.parse(context.stopReasonContext)).toEqual(context.stopReasonContext);
    const signalInterruption = {
      outcome: 'interrupted',
      stopReason: 'signal_received',
      stopReasonContext: { signals: context.stopReasonContext.signals },
    };
    expect(spanTerminationSchema.parse(JSON.parse(JSON.stringify(signalInterruption)))).toEqual(signalInterruption);
  });

  it.each([
    { outcome: 'interrupted', stopReason: 'observer_failed', stopReasonContext: {} },
    { outcome: 'interrupted', stopReason: 'observer_failed', stopReasonContext: { cause: { outcome: 'running' } } },
    {
      outcome: 'interrupted',
      stopReason: 'observer_failed',
      stopReasonContext: {
        cause: { outcome: 'limit', stopReason: 'timeout', stopReasonContext: { timeoutMs: '100' } },
      },
    },
    { outcome: 'error', stopReason: 'model_error', stopReasonContext: { retryable: 'yes' } },
    { outcome: 'limit', stopReason: 'max_steps', stopReasonContext: { timeoutMs: 100 } },
    { outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { reason: 'guardrail' } },
    { outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { tripwire: { retry: 'yes' } } },
    { outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { tripwire: { metadata: () => {} } } },
    { outcome: 'success', stopReasonContext: { maxSteps: 3 } },
    {
      outcome: 'interrupted',
      stopReason: 'signal_received',
      stopReasonContext: {
        signals: [{ id: 'signal', type: 'user', createdAt: '2026-10-27', contents: [{ type: 'text', text: 12 }] }],
      },
    },
    {
      outcome: 'interrupted',
      stopReason: 'signal_received',
      stopReasonContext: {
        signals: [{ id: 'signal', type: 'user', createdAt: '2026-10-27', contents: 'Stop', acceptedAt: 12 }],
      },
    },
    {
      outcome: 'blocked',
      stopReason: 'guardrail',
      stopReasonContext: { signals: [{ type: 'reactive', contents: 'Missing identity and timestamp' }] },
    },
  ])('rejects invalid or mismatched causal detail: %j', termination => {
    expect(spanTerminationSchema.safeParse(termination).success).toBe(false);
  });
});
