import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { expect, test, vi } from 'vitest';

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  spawnMock.mockImplementation(actual.spawn);
  return { ...actual, spawn: spawnMock };
});

const { runCommand } = await import('./command.js');

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

test('rejects stream errors and terminates the active child', async () => {
  const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
  const child = Object.assign(new EventEmitter(), {
    pid: 1234,
    exitCode: null,
    signalCode: null,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  spawnMock.mockReturnValueOnce(child);

  const result = runCommand('mock-command', [], { cwd: process.cwd() });
  child.stdout.emit('error', new Error('stdout failed'));

  await expect(result).rejects.toThrow('stdout failed');
  expect(killSpy).toHaveBeenCalledWith(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL');
  killSpy.mockRestore();
});
