import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { executionFailureTermination, tripwireTermination } from './execution-outcome';

function providerError(statusCode: number, code: string) {
  return new APICallError({
    message: 'Request failed',
    url: 'https://provider.invalid/v1/chat/completions',
    requestBodyValues: {},
    statusCode,
    responseBody: JSON.stringify({ error: { code } }),
  });
}

describe('execution failure cause precedence', () => {
  it('classifies the existing serialized processor error without changing workflow status', () => {
    const failure = {
      status: 'failed',
      error: { name: 'Error', message: 'Policy rejected', processorId: 'policy', options: {} },
    };
    const before = JSON.stringify(failure);
    expect(executionFailureTermination(failure)).toMatchObject({
      outcome: 'blocked',
      stopReason: 'guardrail',
      stopReasonContext: { tripwire: { reason: 'Policy rejected', processorId: 'policy' } },
    });
    expect(JSON.stringify(failure)).toBe(before);
  });
  it('does not treat context-limit wording in a runtime exception as a provider limit', () => {
    expect(executionFailureTermination(new Error('context_length_exceeded'))).toMatchObject({
      outcome: 'error',
      stopReason: 'runtime_error',
    });
  });

  it('preserves structured context exhaustion through error wrappers', () => {
    expect(
      executionFailureTermination(
        new Error('Observer failed', { cause: providerError(400, 'context_length_exceeded') }),
      ),
    ).toMatchObject({
      outcome: 'limit',
      stopReason: 'context_window_exceeded',
      stopReasonContext: { errorCode: 'context_length_exceeded' },
    });
  });

  it.each(['context_length_exceeded', 'content_filter'])(
    'prioritizes provider access denial over inconsistent code %s',
    code => {
      expect(executionFailureTermination(providerError(401, code))).toMatchObject({
        outcome: 'blocked',
        stopReason: 'authentication',
      });
    },
  );

  it('preserves structured provider facts inside a durable failure envelope', () => {
    expect(
      executionFailureTermination(
        new Error('Durable operation failed', {
          cause: {
            status: 'failed',
            error: {
              name: 'AI_APICallError',
              message: 'Provider unavailable',
              statusCode: 503,
              code: 'provider_unavailable',
              isRetryable: true,
            },
          },
        }),
      ),
    ).toMatchObject({
      outcome: 'error',
      stopReason: 'model_error',
      stopReasonContext: {
        message: 'Provider unavailable',
        errorCode: 'provider_unavailable',
        retryable: true,
      },
    });
  });

  it('terminates a cycle through a durable failure envelope', () => {
    const envelope: { status: string; error?: unknown } = { status: 'failed' };
    envelope.error = envelope;
    expect(executionFailureTermination(new Error('Cyclic failure', { cause: envelope }))).toMatchObject({
      outcome: 'error',
      stopReason: 'runtime_error',
      stopReasonContext: { message: 'Cyclic failure' },
    });
  });

  it('terminates cyclic serialized cause chains', () => {
    const error: { message: string; cause?: unknown } = { message: 'Cyclic failure' };
    error.cause = error;
    expect(executionFailureTermination(error)).toMatchObject({ outcome: 'error', stopReason: 'runtime_error' });
  });
});

it('retains observer failure classification when metadata exceeds the serialization budget', () => {
  let shared: unknown = { detail: 'repeated' };
  for (let i = 0; i < 22; i++) shared = { left: shared, right: shared };
  const cause = { outcome: 'error', stopReason: 'model_error' };
  const result = tripwireTermination({ metadata: { observerFailure: { cause }, shared } });
  expect(result).toMatchObject({ outcome: 'interrupted', stopReason: 'observer_failed', stopReasonContext: { cause } });
  expect(JSON.stringify(result)).toContain('[Circular]');
});

it('retains explicit provider identity on authentication failures', () => {
  const error = Object.assign(providerError(401, 'invalid_api_key'), { provider: 'test-provider' });
  expect(executionFailureTermination(error)).toMatchObject({
    outcome: 'blocked',
    stopReason: 'authentication',
    stopReasonContext: { provider: 'test-provider', errorCode: '401' },
  });
});
