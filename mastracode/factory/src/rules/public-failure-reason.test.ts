import { describe, expect, it } from 'vitest';

import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import { FactoryDispatchError, FactoryRuleRejectedError } from './dispatch-errors.js';
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
      'Agent run ended in error (the model provider was unavailable, HTTP 529)',
    );

    const wrapped = new FactoryDispatchError('run_failed', `Review ended in error: ${overloaded.message}`, {
      cause: overloaded,
    });
    const reason = publicFailureReason('run_failed', wrapped);
    expect(reason).toBe('Agent run ended in error (the model provider was unavailable, HTTP 529)');
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
      'Agent run ended in error (the model provider rate-limited the run, HTTP 429)',
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
    ).toBe('Agent run ended in error (the conversation exceeded the model context window, HTTP 400)');
    expect(
      publicFailureReason('run_failed', providerError('Your credit balance is too low', { statusCode: 400 })),
    ).toBe('Agent run ended in error (the model provider quota is exhausted, HTTP 400)');
  });

  it('does not attribute a non-provider error to the model provider from its wording alone', () => {
    expect(publicFailureReason('unknown', new Error('query timed out after 30s'))).toBe('Factory automation failed');
  });

  it('describes a board rule rejection by its code, not its reason', () => {
    const rejected = new FactoryRuleRejectedError(
      'rule_error',
      'Factory rule failed: workBoard.transitionPolicy is not a function',
    );
    const reason = publicFailureReason('unknown', rejected);
    expect(reason).toBe('Factory automation failed (a board rule threw an error)');
    expect(reason).not.toContain('transitionPolicy');
    expect(publicFailureReason('unknown', new FactoryRuleRejectedError('stale', 'card 7ddaf54d moved'))).toBe(
      'Factory automation failed (the card changed while it was being moved)',
    );
  });

  it('names a Factory error class, with what went wrong below it', () => {
    expect(publicFailureReason('unknown', new WorkItemUpdateConflictError('revision'))).toBe(
      'Factory automation failed (WorkItemUpdateConflictError)',
    );
    const refused = Object.assign(new Error('connect ECONNREFUSED 10.0.3.7:5432'), { code: 'ECONNREFUSED' });
    const wrapped = Object.assign(new Error('could not load board at db.internal', { cause: refused }), {
      name: 'StoredBoardError',
    });
    const reason = publicFailureReason('unknown', wrapped);
    expect(reason).toBe('Factory automation failed (StoredBoardError: a network connection was refused)');
    expect(reason).not.toContain('10.0.3.7');
  });

  it('describes system and database errors by their code only', () => {
    const notFound = Object.assign(new Error('getaddrinfo ENOTFOUND db.internal'), { code: 'ENOTFOUND' });
    expect(publicFailureReason('unknown', notFound)).toBe(
      'Factory automation failed (a host name could not be resolved)',
    );

    const conflict = Object.assign(new Error('duplicate key value violates unique constraint "secret_idx"'), {
      code: '23505',
      severity: 'ERROR',
    });
    expect(publicFailureReason('unknown', conflict)).toBe(
      'Factory automation failed (a database unique constraint was violated)',
    );
  });

  it('ignores codes it does not know, and SQLSTATE-shaped codes off database errors', () => {
    expect(publicFailureReason('unknown', Object.assign(new Error('x'), { code: 'internal-secret' }))).toBe(
      'Factory automation failed',
    );
    expect(publicFailureReason('unknown', Object.assign(new Error('x'), { code: '23505' }))).toBe(
      'Factory automation failed',
    );
  });
});
