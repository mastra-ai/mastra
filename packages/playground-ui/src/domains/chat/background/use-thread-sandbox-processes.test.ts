import { describe, expect, it } from 'vitest';
import { devServer, processList } from '../tools/__tests__/fixtures/background-task';
import { BACKGROUND_POLL_MS, processListPollInterval } from './use-thread-sandbox-processes';

describe('processListPollInterval', () => {
  it('keeps reading while one process still runs', () => {
    const data = processList(devServer(), devServer({ pid: '7', running: false, exitCode: 0 }));
    expect(processListPollInterval({ status: 'success', data })).toBe(BACKGROUND_POLL_MS);
  });

  it.each([
    ['every process exited', 'success', processList(devServer({ running: false, exitCode: 0 }))],
    ['the thread has no process', 'success', processList()],
    ['the last read failed, even with a running process cached', 'error', processList(devServer())],
    ['nothing was read yet', 'pending', undefined],
  ] as const)('stops when %s', (_, status, data) => {
    expect(processListPollInterval({ status, data })).toBe(false);
  });
});
