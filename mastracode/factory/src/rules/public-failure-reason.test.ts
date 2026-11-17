import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import { FactoryDispatchError, FactoryRuleRejectedError } from './dispatch-errors.js';
import { FACTORY_ERROR_NAMES, publicFailureReason } from './public-failure-reason.js';

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
    const broken = new TypeError("Cannot read properties of undefined (reading 'secretField')");
    const wrapped = Object.assign(new Error('could not load board at db.internal', { cause: broken }), {
      name: 'StoredBoardError',
    });
    const reason = publicFailureReason('unknown', wrapped);
    expect(reason).toBe('Factory automation failed (StoredBoardError: TypeError)');
    expect(reason).not.toContain('db.internal');
  });

  it('names every Factory error class or excludes it on purpose', () => {
    // Wrappers that carry a failure code shown by other means, so naming them would hide the cause below.
    const notNamed = new Set(['FactoryDispatchError', 'FactoryRuleRejectedError', 'RunEndedInError']);
    const src = fileURLToPath(new URL('..', import.meta.url));
    const declared = new Set<string>();
    for (const file of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      for (const match of readFileSync(join(src, file), 'utf8').matchAll(/class (\w+Error) extends /g)) {
        declared.add(match[1]!);
      }
    }
    const unaccounted = [...declared].filter(name => !FACTORY_ERROR_NAMES.has(name) && !notNamed.has(name));
    expect(unaccounted, 'add new error classes to FACTORY_ERROR_NAMES, or to notNamed here').toEqual([]);
    expect([...FACTORY_ERROR_NAMES].filter(name => !declared.has(name))).toEqual([]);
  });
});
