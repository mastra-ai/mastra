import type { IMastraLogger } from '@mastra/core/logger';
import { describe, expect, it, vi } from 'vitest';

import { createExecuteWriteOperationWithRetry } from './utils';

const PRIVATE_MARKER = 'PRIVATE_TEST_DATABASE_DETAIL';
const OPERATION_DESCRIPTION = 'insert into table mastra_private_table';

function createSpyLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as IMastraLogger & Record<'debug' | 'info' | 'warn' | 'error', ReturnType<typeof vi.fn>>;
}

function serializeCalls(logger: ReturnType<typeof createSpyLogger>): string {
  const calls = [logger.debug, logger.info, logger.warn, logger.error].flatMap(fn => fn.mock.calls);
  return JSON.stringify(calls, (_key, value) => {
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
    return value;
  });
}

function makeError(code: string, message: string): Error & { code: string } {
  const cause = new Error(`${PRIVATE_MARKER} cause`);
  return Object.assign(new Error(message, { cause }), { code });
}

describe('createExecuteWriteOperationWithRetry', () => {
  it('rethrows a non-lock error unchanged and logs only bounded fields', async () => {
    const logger = createSpyLogger();
    const execute = createExecuteWriteOperationWithRetry({
      getLogger: () => logger,
      maxRetries: 3,
      initialBackoffMs: 1,
    });
    const error = makeError('SQLITE_CONSTRAINT', `${PRIVATE_MARKER} constraint failed`);
    const operation = vi.fn().mockRejectedValue(error);

    await expect(execute(operation, OPERATION_DESCRIPTION)).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('LibSQLStore: Non-lock error during write operation, not retrying', {
      errorName: 'Error',
      errorCode: 'SQLITE_CONSTRAINT',
    });
    const logged = serializeCalls(logger);
    expect(logged).not.toContain(PRIVATE_MARKER);
    expect(logged).not.toContain('mastra_private_table');
    expect(logged).not.toContain('    at ');
  });

  it('retries lock errors and returns the result once the operation recovers', async () => {
    const logger = createSpyLogger();
    const execute = createExecuteWriteOperationWithRetry({
      getLogger: () => logger,
      maxRetries: 3,
      initialBackoffMs: 1,
    });
    const operation = vi
      .fn()
      .mockRejectedValueOnce(makeError('SQLITE_BUSY', `database is locked ${PRIVATE_MARKER}`))
      .mockResolvedValueOnce('ok');

    await expect(execute(operation, OPERATION_DESCRIPTION)).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    const logged = serializeCalls(logger);
    expect(logged).not.toContain(PRIVATE_MARKER);
    expect(logged).not.toContain('mastra_private_table');
  });

  it('rethrows the original lock error after exhausting retries', async () => {
    const logger = createSpyLogger();
    const execute = createExecuteWriteOperationWithRetry({
      getLogger: () => logger,
      maxRetries: 3,
      initialBackoffMs: 1,
    });
    const error = makeError('SQLITE_BUSY', `database is locked ${PRIVATE_MARKER}`);
    const operation = vi.fn().mockRejectedValue(error);

    await expect(execute(operation, OPERATION_DESCRIPTION)).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      'LibSQLStore: Write operation failed after 3 attempts due to database lock',
      {
        errorName: 'Error',
        errorCode: 'SQLITE_BUSY',
        attempts: 3,
        maxRetries: 3,
      },
    );
    const logged = serializeCalls(logger);
    expect(logged).not.toContain(PRIVATE_MARKER);
    expect(logged).not.toContain('mastra_private_table');
  });

  it('uses the current logger when it is replaced after construction', async () => {
    const original = createSpyLogger();
    const replacement = createSpyLogger();
    let current: IMastraLogger = original;
    const execute = createExecuteWriteOperationWithRetry({
      getLogger: () => current,
      maxRetries: 3,
      initialBackoffMs: 1,
    });

    current = replacement;
    await expect(
      execute(vi.fn().mockRejectedValue(makeError('SQLITE_ERROR', 'boom')), OPERATION_DESCRIPTION),
    ).rejects.toThrow('boom');

    expect(original.error).not.toHaveBeenCalled();
    expect(replacement.error).toHaveBeenCalledTimes(1);
  });
});
