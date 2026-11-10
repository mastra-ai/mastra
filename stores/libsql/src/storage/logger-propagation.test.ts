import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IMastraLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from './index';

const PRIVATE_MARKER = 'PRIVATE_TEST_DATABASE_DETAIL';

type TestClient = { execute: (sql: string) => Promise<unknown> };
const getClient = (store: LibSQLStore): TestClient => (store as unknown as { client: TestClient }).client;

const createSpyLogger = () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
  };
  return logger as typeof logger & IMastraLogger;
};

describe('LibSQLStore logger propagation', () => {
  let tmpDir: string;
  let consoleOutput: string[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-logger-test-'));
    consoleOutput = [];
    const capture = (...args: unknown[]) => {
      consoleOutput.push(args.map(arg => (typeof arg === 'string' ? arg : String(arg))).join(' '));
    };
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation(capture);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const failScheduleTriggerInserts = async (store: LibSQLStore) => {
    await getClient(store).execute(
      `CREATE TRIGGER private_test_failure BEFORE INSERT ON mastra_schedule_triggers BEGIN SELECT RAISE(ABORT, '${PRIVATE_MARKER}'); END`,
    );
  };

  const recordFailingTrigger = async (store: LibSQLStore) => {
    const schedules = await store.getStore('schedules');
    return schedules!
      .recordTrigger({ scheduleId: 'repro', runId: null, scheduledFireAt: 1, actualFireAt: 1, outcome: 'failed' })
      .then(
        () => undefined,
        (error: unknown) => error,
      );
  };

  it('logs nothing to the console for a failed write when the Mastra logger is disabled', async () => {
    const store = new LibSQLStore({ id: 'logger-disabled', url: `file:${path.join(tmpDir, 'mastra.db')}` });
    const mastra = new Mastra({ storage: store, logger: false });
    try {
      await store.init();
      await failScheduleTriggerInserts(store);

      const error = await recordFailingTrigger(store);

      expect(error).toBeInstanceOf(Error);
      expect(String((error as Error).message)).toContain(PRIVATE_MARKER);
      expect(consoleOutput.filter(line => line.includes('LibSQLStore'))).toEqual([]);
      expect(consoleOutput.join('\n')).not.toContain(PRIVATE_MARKER);
    } finally {
      await mastra.shutdown();
      await store.close();
    }
  });

  it('routes failed-write diagnostics to the configured logger without raw error details', async () => {
    const logger = createSpyLogger();
    const store = new LibSQLStore({ id: 'logger-custom', url: `file:${path.join(tmpDir, 'mastra.db')}` });
    const mastra = new Mastra({ storage: store, logger });
    try {
      await store.init();
      await failScheduleTriggerInserts(store);

      const error = await recordFailingTrigger(store);

      expect(error).toBeInstanceOf(Error);
      expect(logger.error).toHaveBeenCalledWith(
        'LibSQLStore: Non-lock error during write operation, not retrying',
        expect.objectContaining({ errorCode: expect.anything() }),
      );
      const allCalls = [...logger.debug.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls];
      expect(JSON.stringify(allCalls)).not.toContain(PRIVATE_MARKER);
      const retryCalls = allCalls.filter(([message]) => String(message).includes('write'));
      expect(retryCalls.length).toBeGreaterThan(0);
      expect(JSON.stringify(retryCalls)).not.toContain('mastra_schedule_triggers');
      expect(consoleOutput.join('\n')).not.toContain(PRIVATE_MARKER);
    } finally {
      await mastra.shutdown();
      await store.close();
    }
  });
});
