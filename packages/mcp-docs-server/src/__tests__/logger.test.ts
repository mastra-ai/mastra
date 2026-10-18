import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, getLogLevel, setLogLevel } from '../logger';

describe('createLogger', () => {
  const initialLevel = getLogLevel();
  let stderr: ReturnType<typeof vi.spyOn>;
  let stdout: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    setLogLevel(initialLevel);
    vi.restoreAllMocks();
  });

  it('filters entries below the configured --log-level', async () => {
    const logger = createLogger();
    setLogLevel('warn');

    await logger.info('hidden info');
    await logger.notice('hidden notice');
    await logger.warning('shown warning');

    const lines = stderr.mock.calls.map(call => JSON.parse(call[0] as string));
    expect(lines).toEqual([{ level: 'warning', message: 'shown warning' }]);
  });

  it('writes nothing when the level is none', async () => {
    const logger = createLogger();
    setLogLevel('none');

    await logger.error('suppressed', new Error('boom'));

    expect(stderr).not.toHaveBeenCalled();
  });

  it('keeps the event message when logging an Error', async () => {
    const logger = createLogger();
    setLogLevel('error');

    await logger.error('Failed to start server', new Error('port in use'));

    const entry = JSON.parse(stderr.mock.calls[0]![0] as string);
    expect(entry.message).toBe('Failed to start server');
    expect(entry.data).toMatchObject({ name: 'Error', message: 'port in use' });
  });

  it('never writes to stdout, which carries the stdio protocol', async () => {
    const logger = createLogger();
    setLogLevel('debug');

    await logger.info('a', { x: 1 });
    await logger.warning('b');
    await logger.error('c', new Error('d'));

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(3);
  });
});
