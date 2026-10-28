import { describe, expect, it } from 'vitest';
import { signalToDataPartFormat } from '../agent/signals';
import { spanStopReasonContextSchema } from './outcome-schema';

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
    const stored = JSON.parse(JSON.stringify({ reason: 'signal_received', signals: [signal] }));
    expect(spanStopReasonContextSchema.parse(stored)).toEqual(stored);
    expect(stored.signals[0].contents[1]).toMatchObject({ data: 'QUJD', filename: 'note.txt' });
  });

  it('retains nested observer limits and structured signal content during validation', () => {
    const context = {
      reason: 'observer_failed',
      observerSpanId: 'observer',
      cause: {
        outcome: 'limit',
        stopReason: 'context_window_exceeded',
        stopReasonContext: {
          reason: 'context_window_exceeded',
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
    };
    expect(spanStopReasonContextSchema.parse(JSON.parse(JSON.stringify(context)))).toEqual(context);
    const signalInterruption = { reason: 'signal_received', signals: context.signals };
    expect(spanStopReasonContextSchema.parse(JSON.parse(JSON.stringify(signalInterruption)))).toEqual(
      signalInterruption,
    );
  });

  it.each([
    { reason: 'observer_failed' },
    { reason: 'observer_failed', cause: { outcome: 'running' } },
    {
      reason: 'observer_failed',
      cause: { outcome: 'limit', stopReasonContext: { reason: 'timeout', timeoutMs: '100' } },
    },
    { reason: 'model_error', retryable: 'yes' },
    {
      reason: 'signal_received',
      signals: [{ id: 'signal', type: 'user', createdAt: '2026-10-27', contents: [{ type: 'text', text: 12 }] }],
    },
    {
      reason: 'signal_received',
      signals: [{ id: 'signal', type: 'user', createdAt: '2026-10-27', contents: 'Stop', acceptedAt: 12 }],
    },
    { reason: 'guardrail', signals: [{ type: 'reactive', contents: 'Missing identity and timestamp' }] },
  ])('rejects invalid causal detail: %j', context => {
    expect(spanStopReasonContextSchema.safeParse(context).success).toBe(false);
  });
});
