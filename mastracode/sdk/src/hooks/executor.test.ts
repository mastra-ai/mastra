import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HookDefinition, HookStdinSession } from './types.js';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

const { executeHook } = await import('./executor.js');

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = { write: vi.fn(), end: vi.fn() };
  kill = vi.fn();
}

function makeHook(command: string): HookDefinition {
  return { type: 'command', command };
}

function makeStdin(): HookStdinSession {
  return { session_id: 'session-1', cwd: '/tmp/project', hook_event_name: 'SessionStart' };
}

describe('executeHook Windows argument handling', () => {
  let originalPlatform: NodeJS.Platform;

  beforeEach(() => {
    spawnMock.mockReset();
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('passes windowsVerbatimArguments: true when spawning cmd on win32', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    const fakeChild = new FakeChildProcess();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fakeChild.emit('close', 0));
      return fakeChild;
    });

    await executeHook(makeHook('node "C:/tools/my-hook.mjs"'), makeStdin());

    expect(spawnMock).toHaveBeenCalledWith(
      'cmd',
      ['/c', 'node "C:/tools/my-hook.mjs"'],
      expect.objectContaining({ windowsVerbatimArguments: true }),
    );
  });

  it('does not pass windowsVerbatimArguments on non-Windows platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    const fakeChild = new FakeChildProcess();
    spawnMock.mockImplementation(() => {
      setImmediate(() => fakeChild.emit('close', 0));
      return fakeChild;
    });

    await executeHook(makeHook('node "/tools/my-hook.mjs"'), makeStdin());

    const callOptions = spawnMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(callOptions).not.toHaveProperty('windowsVerbatimArguments');
  });
});
