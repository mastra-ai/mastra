import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BlaxelProcessManager } from './process-manager';
import type { BlaxelSandbox } from './index';

type StreamCallbacks = {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
};

function createFakeSandbox() {
  let callbacks: StreamCallbacks = {};
  let finishStream!: () => void;
  const streamDone = new Promise<void>(resolve => {
    finishStream = resolve;
  });

  const process = {
    exec: vi.fn().mockResolvedValue({ pid: 'proc-1' }),
    streamLogs: vi.fn((_pid: string, cbs: StreamCallbacks) => {
      callbacks = cbs;
      return { close: vi.fn(), wait: () => streamDone };
    }),
    get: vi.fn().mockResolvedValue({ status: 'completed', exitCode: 0 }),
    kill: vi.fn().mockResolvedValue(undefined),
    writeStdin: vi.fn().mockResolvedValue(undefined),
    closeStdin: vi.fn().mockResolvedValue(undefined),
  };

  const sandbox = {
    blaxel: { process },
    workingDirectory: '/home/user',
    retryOnDead: <T>(fn: () => Promise<T>) => fn(),
    ensureRunning: vi.fn().mockResolvedValue(undefined),
    getEnv: () => ({}),
  };

  return {
    sandbox,
    process,
    emitStdout: (line: string) => callbacks.onStdout?.(line),
    emitStderr: (line: string) => callbacks.onStderr?.(line),
    finishStream,
  };
}

describe('BlaxelProcessManager', () => {
  let fake: ReturnType<typeof createFakeSandbox>;
  let manager: BlaxelProcessManager;

  beforeEach(() => {
    fake = createFakeSandbox();
    manager = new BlaxelProcessManager();
    manager.sandbox = fake.sandbox as unknown as BlaxelSandbox;
  });

  describe('stdin', () => {
    it('opens a stdin pipe by default', async () => {
      await manager.spawn('cat');
      expect(fake.process.exec).toHaveBeenCalledWith(expect.objectContaining({ stdin: true }));
    });

    it('does not open a stdin pipe when stdinMode is ignore', async () => {
      await manager.spawn('cat', { stdinMode: 'ignore' });
      expect(fake.process.exec).toHaveBeenCalledWith(expect.objectContaining({ stdin: false }));
    });

    it('sendStdin writes to the process stdin', async () => {
      const handle = await manager.spawn('cat');
      await handle.sendStdin('hello\n');
      expect(fake.process.writeStdin).toHaveBeenCalledWith('proc-1', 'hello\n');
    });

    it('closeStdin closes the process stdin', async () => {
      const handle = await manager.spawn('cat');
      await handle.closeStdin();
      expect(fake.process.closeStdin).toHaveBeenCalledWith('proc-1');
    });

    it('writer stream writes data and closes stdin on end', async () => {
      const handle = await manager.spawn('cat');
      await new Promise<void>((resolve, reject) => {
        handle.writer.on('error', reject);
        handle.writer.end('payload', resolve);
      });
      expect(fake.process.writeStdin).toHaveBeenCalledWith('proc-1', 'payload');
      expect(fake.process.closeStdin).toHaveBeenCalledWith('proc-1');
    });

    it('rejects stdin operations when spawned with stdinMode ignore', async () => {
      const handle = await manager.spawn('cat', { stdinMode: 'ignore' });
      await expect(handle.sendStdin('data')).rejects.toThrow('not started with stdin support');
      await expect(handle.closeStdin()).rejects.toThrow('not started with stdin support');
      expect(fake.process.writeStdin).not.toHaveBeenCalled();
      expect(fake.process.closeStdin).not.toHaveBeenCalled();
    });

    it('rejects sendStdin after the process exits, but closeStdin is a no-op', async () => {
      const handle = await manager.spawn('cat');
      fake.finishStream();
      await handle.wait();

      await expect(handle.sendStdin('late')).rejects.toThrow('already exited');
      await expect(handle.closeStdin()).resolves.toBeUndefined();
      expect(fake.process.writeStdin).not.toHaveBeenCalled();
      expect(fake.process.closeStdin).not.toHaveBeenCalled();
    });
  });

  describe('output', () => {
    it('restores line terminators stripped by streamLogs', async () => {
      const onStdout = vi.fn();
      const onStderr = vi.fn();
      const handle = await manager.spawn('printf "a\\nb\\n"', { onStdout, onStderr });

      fake.emitStdout('{"type":"a"}');
      fake.emitStdout('{"type":"b"}');
      fake.emitStderr('warn');

      expect(handle.stdout).toBe('{"type":"a"}\n{"type":"b"}\n');
      expect(handle.stderr).toBe('warn\n');
      expect(onStdout.mock.calls).toEqual([['{"type":"a"}\n'], ['{"type":"b"}\n']]);
      expect(onStderr.mock.calls).toEqual([['warn\n']]);

      fake.finishStream();
      const result = await handle.wait();
      expect(result.stdout).toBe('{"type":"a"}\n{"type":"b"}\n');
    });
  });
});
