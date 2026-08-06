import { expect, test } from 'vitest';
import { runCommand } from './command.js';

test('rejects when a child process cannot start', async () => {
  await expect(runCommand('missing-experiment-command', [], { cwd: process.cwd() })).rejects.toThrow();
});

test('escalates timed out commands that ignore SIGTERM', async () => {
  const result = await runCommand(
    process.execPath,
    ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
    { cwd: process.cwd(), timeoutMs: 100 },
  );

  expect(result.timedOut).toBe(true);
  expect(result.signal).toBe('SIGKILL');
}, 10_000);
