import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { describe, expect, it } from 'vitest';
import { IndexBuildError, isRetryableDeadlock } from './pg-errors';

const wrap = (cause: unknown) =>
  new MastraError(
    {
      id: 'PG_INDEX_CREATE_FAILED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
    },
    cause,
  );

describe('init deadlock classification', () => {
  it('finds a real PostgreSQL deadlock code through domain wrappers', () => {
    expect(isRetryableDeadlock(wrap(wrap(Object.assign(new Error('deadlock detected'), { code: '40P01' }))))).toBe(
      true,
    );
  });

  it('does not multiply the exhausted index retry budget through wrappers', () => {
    const deadlock = Object.assign(new Error('deadlock detected'), { code: '40P01' });
    const exhausted = new IndexBuildError('index', 'schema', 'exhausted', deadlock);
    expect(isRetryableDeadlock(wrap(wrap(exhausted)))).toBe(false);
  });

  it.each(['23505', '42501', '42601', '57014', '08006'])('does not retry database error %s', code => {
    expect(isRetryableDeadlock(wrap(Object.assign(new Error('database failure'), { code })))).toBe(false);
  });

  it('terminates on cyclic causes rather than looping during cleanup', () => {
    const error = new Error('cycle');
    error.cause = error;
    expect(isRetryableDeadlock(error)).toBe(false);
  });
});
