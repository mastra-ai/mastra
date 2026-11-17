import { describe, expect, it } from 'vitest';

import { FactoryDispatchError } from './dispatch-errors.js';
import { publicFailureReason } from './public-failure-reason.js';

function providerError(message: string, fields: Record<string, unknown>): Error {
  return Object.assign(new Error(message), { name: 'AI_APICallError', ...fields });
}

describe('publicFailureReason', () => {
  it('shows only the label when the error cannot be classified', () => {
    expect(publicFailureReason('unknown', new Error('connect ECONNREFUSED 10.0.3.7:5432 (db-internal)'))).toBe(
      'Factory automation failed',
    );
    expect(publicFailureReason('unknown', 'raw string')).toBe('Factory automation failed');
    expect(publicFailureReason('unknown', undefined)).toBe('Factory automation failed');
  });

  it('names built-in error kinds without their messages', () => {
    expect(publicFailureReason('unknown', new TypeError('workBoard.transitionPolicy is not a function'))).toBe(
      'Factory automation failed (TypeError)',
    );
  });

  it('never repeats a custom error name, which code can set to anything', () => {
    const error = Object.assign(new Error('x'), { name: 'Postgres at db.internal:5432' });
    expect(publicFailureReason('unknown', error)).toBe('Factory automation failed');
  });

  it('classifies provider failures into fixed wording, including when wrapped as a cause', () => {
    const overloaded = providerError('Overloaded: request req_01ABC for org org-123', { statusCode: 529 });
    expect(publicFailureReason('run_failed', overloaded)).toBe(
      'Agent run ended in error (the model provider was unavailable)',
    );

    const wrapped = new FactoryDispatchError('run_failed', `Review ended in error: ${overloaded.message}`, {
      cause: overloaded,
    });
    const reason = publicFailureReason('run_failed', wrapped);
    expect(reason).toBe('Agent run ended in error (the model provider was unavailable)');
    expect(reason).not.toContain('req_01ABC');
    expect(reason).not.toContain('org-123');
  });

  it('finds a provider failure below intermediate wrappers', () => {
    const rateLimited = providerError('Rate limit for org-123 exceeded', { statusCode: 429 });
    const modelCall = new Error('model call failed at https://llm.internal/v1', { cause: rateLimited });
    const wrapped = new FactoryDispatchError('run_failed', `Review ended in error: ${modelCall.message}`, {
      cause: modelCall,
    });
    expect(publicFailureReason('run_failed', wrapped)).toBe(
      'Agent run ended in error (the model provider rate-limited the run)',
    );
  });

  it('stops on a cyclic cause chain', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    const b = new Error('b', { cause: a });
    a.cause = b;
    expect(publicFailureReason('unknown', a)).toBe('Factory automation failed');
  });

  it('recognizes context overflow and quota from the provider response', () => {
    expect(
      publicFailureReason(
        'run_failed',
        providerError('prompt is too long: 250000 tokens > 200000 maximum', { statusCode: 400 }),
      ),
    ).toBe('Agent run ended in error (the conversation exceeded the model context window)');
    expect(
      publicFailureReason('run_failed', providerError('Your credit balance is too low', { statusCode: 400 })),
    ).toBe('Agent run ended in error (the model provider quota is exhausted)');
  });

  it('does not attribute a non-provider error to the model provider from its wording alone', () => {
    expect(publicFailureReason('unknown', new Error('query timed out after 30s'))).toBe('Factory automation failed');
  });
});
