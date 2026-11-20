import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { WriterBusyError } from '../../src/mastra/knowledge/writer-lock.ts';
import { ReviewConflict } from '../../src/mastra/review/contracts.ts';
import { isRetryablePublicationError } from '../../src/mastra/review/publication-errors.ts';

const coded = (code: string) => Object.assign(new Error('Storage operation failed'), { code });

test('publication retries only recognized transient failures, including wrapped storage causes', () => {
  for (const error of [
    new WriterBusyError('/synthetic/writer.sqlite'),
    ...[
      'SQLITE_BUSY',
      'SQLITE_BUSY_SNAPSHOT',
      'SQLITE_LOCKED_SHAREDCACHE',
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'UND_ERR_SOCKET',
    ].map(coded),
    Object.assign(new Error('SQLite contention'), { code: 'ERR_SQLITE_ERROR', errcode: 5 }),
    new Error('Storage adapter wrapper', { cause: coded('ECONNREFUSED') }),
  ])
    assert.equal(isRetryablePublicationError(error), true, String(error));

  for (const error of [
    new ReviewConflict('Evidence changed'),
    z.string().safeParse(42).error,
    ...[
      'SQLITE_CONSTRAINT_TRIGGER',
      'SQLITE_READONLY',
      'SQLITE_CORRUPT',
      'SQLITE_FULL',
      'EACCES',
      'SQLITE_BUSY_LOOKALIKE',
    ].map(coded),
    new Error('Unknown error with SQLITE_BUSY or ECONNRESET in its message'),
    new Error('Storage wrapper', { cause: new Error('Unknown storage failure') }),
    'ECONNRESET',
    null,
  ])
    assert.equal(isRetryablePublicationError(error), false, String(error));
});
