import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';

import { MastraLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { MastraCompositeStore, TABLE_SCHEDULE_TRIGGERS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveClient } from './db';
import { createExecuteWriteOperationWithRetry } from './db/utils';
import { LibSQLStore } from './index';

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/29885
 *
 * A failed LibSQL write printed the raw SQLite error (message, nested cause,
 * stack) through a default ConsoleLogger even when Mastra was created with
 * `logger: false` or a custom logger:
 * - the composite store never forwarded `__setLogger` to its domain stores,
 * - each domain's LibSQLDB kept its own ConsoleLogger,
 * - the shared retry helper captured that logger at construction, and
 * - its non-lock branch logged the raw error object.
 */

const MARKER = 'PRIVATE_TEST_DATABASE_DETAIL';

type LogCall = { level: 'debug' | 'info' | 'warn' | 'error'; message: string; args: unknown[] };

class CaptureLogger extends MastraLogger {
  readonly calls: LogCall[] = [];
  onWarn?: () => void;
  debug(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'debug', message, args });
  }
  info(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'info', message, args });
  }
  warn(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'warn', message, args });
    this.onWarn?.();
  }
  error(message: string, ...args: unknown[]) {
    this.calls.push({ level: 'error', message, args });
  }
  retryLogs() {
    return this.calls.filter(call => call.message.startsWith('LibSQLStore:'));
  }
  /** Everything the logger received, rendered the way a console or JSON transport would see it. */
  rendered() {
    return this.calls.map(call => `${call.message} ${inspect(call.args, { depth: 10 })}`).join('\n');
  }
}

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;

const trigger = {
  scheduleId: 'repro',
  runId: null,
  scheduledFireAt: 1,
  actualFireAt: 1,
  outcome: 'failed' as const,
};

describe('LibSQL write failures respect the Mastra logger (#29885)', () => {
  let tmpDir: string;
  let dbUrl: string;
  let consoleOutput: string[];
  const cleanup: Array<() => Promise<void> | void> = [];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-logger-propagation-'));
    dbUrl = `file:${path.join(tmpDir, 'repro.db')}`;
    consoleOutput = [];
    for (const method of consoleMethods) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleOutput.push(args.map(arg => (typeof arg === 'string' ? arg : inspect(arg, { depth: 10 }))).join(' '));
      });
    }
  });

  afterEach(async () => {
    for (const fn of cleanup.splice(0).reverse()) await fn();
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function createStore(options: { maxRetries?: number; initialBackoffMs?: number; busyMs?: number } = {}) {
    const store = new LibSQLStore({
      id: 'retry-log-repro',
      url: dbUrl,
      maxRetries: options.maxRetries,
      initialBackoffMs: options.initialBackoffMs,
      connectionTimeoutMs: options.busyMs,
    });
    cleanup.push(() => store.close());
    return store;
  }

  /** Make every insert into `table` fail inside SQLite with a private message, as in the issue repro. */
  async function failInsertsInto(table: string) {
    const client = resolveClient({ url: dbUrl });
    cleanup.push(() => client.close());
    await client.execute(
      `CREATE TRIGGER private_test_failure BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, '${MARKER}'); END`,
    );
  }

  it('prints nothing when Mastra is created with logger: false and a schedule trigger write fails', async () => {
    const storage = await createStore();
    const mastra = new Mastra({ storage, logger: false });
    cleanup.push(() => mastra.shutdown());
    await storage.init();
    await failInsertsInto(TABLE_SCHEDULE_TRIGGERS);
    const schedules = await storage.getStore('schedules');

    const error = await schedules!.recordTrigger(trigger).catch((e: unknown) => e);

    // The caller still gets the original database error.
    expect(String((error as Error).message)).toContain(MARKER);
    expect(consoleOutput.join('\n')).not.toContain(MARKER);
    expect(consoleOutput.join('\n')).not.toContain('LibSQLStore');
  });

  it('prints nothing when the store is wrapped in a MastraCompositeStore and Mastra uses logger: false', async () => {
    const inner = await createStore();
    const storage = new MastraCompositeStore({ id: 'outer', default: inner });
    const mastra = new Mastra({ storage, logger: false });
    cleanup.push(() => mastra.shutdown());
    await storage.init();
    await failInsertsInto(TABLE_SCHEDULE_TRIGGERS);
    const schedules = await storage.getStore('schedules');

    await expect(schedules!.recordTrigger(trigger)).rejects.toThrow(MARKER);
    expect(consoleOutput.join('\n')).not.toContain(MARKER);
    expect(consoleOutput.join('\n')).not.toContain('LibSQLStore');
  });

  it('sends the failed-write log to a logger set later with mastra.setLogger(), without the raw error', async () => {
    const first = new CaptureLogger();
    const second = new CaptureLogger();
    const storage = await createStore();
    const mastra = new Mastra({ storage, logger: first });
    cleanup.push(() => mastra.shutdown());
    await storage.init();
    await failInsertsInto(TABLE_SCHEDULE_TRIGGERS);
    const schedules = await storage.getStore('schedules');
    mastra.setLogger({ logger: second });
    // init() logged PRAGMA setup through `first`; nothing after the swap may reach it.
    const firstCallsBeforeWrite = first.calls.length;

    await expect(schedules!.recordTrigger(trigger)).rejects.toThrow(MARKER);

    const errors = second.retryLogs().filter(call => call.level === 'error');
    expect(errors.map(call => call.message)).toEqual([
      'LibSQLStore: Non-lock error during insert into table mastra_schedule_triggers, not retrying',
    ]);
    expect(first.calls.slice(firstCallsBeforeWrite)).toEqual([]);
    // Bounded diagnostics: no database message, nested cause or stack frames.
    expect(second.rendered()).not.toContain(MARKER);
    expect(second.rendered()).not.toMatch(/\n\s+at /);
    expect(consoleOutput.join('\n')).not.toContain(MARKER);
  });

  it('sends workflow snapshot write failures to the replaced logger, without the raw error', async () => {
    const logger = new CaptureLogger();
    const storage = await createStore();
    const mastra = new Mastra({ storage, logger: false });
    cleanup.push(() => mastra.shutdown());
    await storage.init();
    const workflows = await storage.getStore('workflows');
    await failInsertsInto(TABLE_WORKFLOW_SNAPSHOT);
    mastra.setLogger({ logger });

    await expect(
      workflows!.persistWorkflowSnapshot({
        workflowName: 'wf',
        runId: 'run-1',
        snapshot: { runId: 'run-1', status: 'running', context: {} } as unknown as WorkflowRunState,
      }),
    ).rejects.toThrow(MARKER);

    expect(logger.retryLogs().some(call => call.level === 'error' && call.message.includes('Non-lock error'))).toBe(
      true,
    );
    expect(logger.rendered()).not.toContain(MARKER);
    expect(consoleOutput.join('\n')).not.toContain(MARKER);
  });

  describe('database lock', () => {
    /** Hold the SQLite write lock from a second connection, as another process would. */
    async function holdWriteLock() {
      const holder = resolveClient({ url: dbUrl, connectionTimeoutMs: 1 });
      cleanup.push(() => holder.close());
      const tx = await holder.transaction('write');
      await tx.execute(`DELETE FROM ${TABLE_SCHEDULE_TRIGGERS} WHERE id = 'nothing'`);
      return tx;
    }

    it('retries a locked write, logs bounded warnings to the current logger, and succeeds once the lock is released', async () => {
      const logger = new CaptureLogger();
      const storage = await createStore({ maxRetries: 5, initialBackoffMs: 25, busyMs: 1 });
      const mastra = new Mastra({ storage, logger: false });
      cleanup.push(() => mastra.shutdown());
      await storage.init();
      const schedules = await storage.getStore('schedules');
      mastra.setLogger({ logger });

      const lock = await holdWriteLock();
      logger.onWarn = () => {
        logger.onWarn = undefined;
        void lock.commit();
      };

      await schedules!.recordTrigger({ ...trigger, id: 'after-lock' });

      const warnings = logger.retryLogs().filter(call => call.level === 'warn');
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings[0]!.message).toMatch(/Attempt 1 failed due to database lock/);
      expect(logger.retryLogs().filter(call => call.level === 'error')).toEqual([]);
      const stored = await schedules!.listTriggers('repro');
      expect(stored.map(t => t.id)).toEqual(['after-lock']);
      expect(consoleOutput.join('\n')).not.toContain('LibSQLStore');
    });

    it('rethrows the original lock error after the last retry and logs only bounded fields', async () => {
      const logger = new CaptureLogger();
      const storage = await createStore({ maxRetries: 3, initialBackoffMs: 5, busyMs: 1 });
      const mastra = new Mastra({ storage, logger: false });
      cleanup.push(() => mastra.shutdown());
      await storage.init();
      const schedules = await storage.getStore('schedules');
      mastra.setLogger({ logger });

      const lock = await holdWriteLock();
      cleanup.push(() => lock.rollback());

      const error = (await schedules!.recordTrigger(trigger).catch((e: unknown) => e)) as { code?: string };

      expect(error.code).toMatch(/SQLITE_BUSY/);
      expect(logger.retryLogs().filter(call => call.level === 'warn')).toHaveLength(2);
      const errors = logger.retryLogs().filter(call => call.level === 'error');
      expect(errors.map(call => call.message)).toEqual([
        'LibSQLStore: Operation failed after 3 attempts due to database lock',
      ]);
      // The payload carries the error code, not the error object, its message or stack.
      expect(errors[0]!.args).toEqual([expect.objectContaining({ errorCode: error.code, attempts: 3, maxRetries: 3 })]);
      expect(errors[0]!.args[0]).not.toHaveProperty('error');
      expect(logger.rendered()).not.toContain('database is locked');
      expect(consoleOutput.join('\n')).not.toContain('LibSQLStore');
    });
  });

  describe('retry helper error identity', () => {
    // Callers match on the thrown error (instanceof, code, identity), so the helper must
    // rethrow the same object it caught, not a copy or a wrapper.
    it('rethrows the exact error object for non-lock failures and after lock retries run out', async () => {
      const logger = new CaptureLogger();
      const run = createExecuteWriteOperationWithRetry({ getLogger: () => logger, maxRetries: 3, initialBackoffMs: 1 });

      const constraint = Object.assign(new Error(`SQLITE_CONSTRAINT: ${MARKER}`), { code: 'SQLITE_CONSTRAINT' });
      await expect(run(() => Promise.reject(constraint), 'insert into table t')).rejects.toBe(constraint);

      const busy = Object.assign(new Error('SQLITE_BUSY: database is locked'), { code: 'SQLITE_BUSY' });
      let attempts = 0;
      await expect(
        run(() => {
          attempts++;
          return Promise.reject(busy);
        }, 'insert into table t'),
      ).rejects.toBe(busy);
      expect(attempts).toBe(3);
      expect(logger.rendered()).not.toContain(MARKER);
      expect(logger.rendered()).not.toContain('database is locked');
    });
  });
});
