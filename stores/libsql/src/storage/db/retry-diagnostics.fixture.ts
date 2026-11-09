import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import type { AdapterLogSink } from '@mastra/core/logger';
import { ConsoleLogger } from '@mastra/core/logger';
import { createExecuteWriteOperationWithRetry } from './utils';

// A separate process lets the regression inspect real console bytes without replacing console or the logger.
const scenario = process.argv[2]!;
const directory = await mkdtemp(join(tmpdir(), 'libsql-retry-diagnostics-'));
const url = `file:${join(directory, 'private-database-marker.db')}`;
const client = createClient({ url, timeout: 0 });
const locker = createClient({ url, timeout: 0 });
const exported: { level: string; message: string; data?: Record<string, unknown> }[] = [];
let unlock: Promise<unknown> | undefined;
let transaction: Awaited<ReturnType<typeof locker.transaction>> | undefined;
let attempts = 0;
let original: unknown;
const logger = new ConsoleLogger({ level: 'debug' });
const sink = Object.fromEntries(
  ['debug', 'info', 'warn', 'error'].map(level => [
    level,
    (message: string, data?: Record<string, unknown>) => {
      exported.push({ level, message, data });
      // Release the real competing SQLite writer only after an actual retry warning is exported.
      if (scenario === 'lock-recovery' && level === 'warn' && !unlock) unlock = transaction!.commit();
    },
  ]),
);
logger.__attachObservability({
  options: { correlation: true, export: true },
  resolveTraceFields: () => ({ trace_id: '11111111111111111111111111111111', span_id: '2222222222222222' }),
  getLogSink: () => sink as unknown as AdapterLogSink,
});
try {
  await client.execute('CREATE TABLE private_table_marker (id INTEGER PRIMARY KEY)');
  await client.execute('PRAGMA busy_timeout = 0');
  await locker.execute('PRAGMA busy_timeout = 0');
  if (scenario.startsWith('lock-')) {
    transaction = await locker.transaction('write');
    await transaction.execute('INSERT INTO private_table_marker (id) VALUES (99)');
  }
  const execute = createExecuteWriteOperationWithRetry({ logger, maxRetries: 3, initialBackoffMs: 20 });
  const write = () =>
    execute(async () => {
      attempts++;
      try {
        return await client.execute(
          scenario === 'non-lock'
            ? 'INSERT INTO missing_private_payload_marker (id) VALUES (1)'
            : 'INSERT INTO private_table_marker (id) VALUES (1)',
        );
      } catch (error) {
        original = error;
        throw error;
      }
    }, 'private-operation-marker credential=example-database-secret');
  if (scenario === 'non-lock' || scenario === 'lock-exhaustion') {
    await assert.rejects(
      write,
      error => error === original,
      'The original real database error must be rethrown unchanged.',
    );
    assert.equal(attempts, scenario === 'non-lock' ? 1 : 3);
    assert.equal(
      Number((await client.execute('SELECT COUNT(*) AS count FROM private_table_marker WHERE id = 1')).rows[0]!.count),
      0,
    );
  } else {
    assert.equal((await write()).rowsAffected, 1);
    await unlock;
    assert.equal(attempts, scenario === 'lock-recovery' ? 2 : 1);
    assert.equal(
      Number((await client.execute('SELECT COUNT(*) AS count FROM private_table_marker WHERE id = 1')).rows[0]!.count),
      1,
    );
  }
  process.send?.({ attempts, exported });
} finally {
  if (transaction && !transaction.closed) await transaction.rollback();
  client.close();
  locker.close();
  await rm(directory, { recursive: true, force: true });
}
