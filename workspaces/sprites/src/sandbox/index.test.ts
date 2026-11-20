/**
 * Sprites Sandbox Provider Tests
 *
 * Covers get-or-create, command execution and streaming, background
 * processes, stop vs destroy, and checkpoint capture, with the
 * `@fly/sprites` SDK mocked.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { spritesSandboxProvider } from '../provider';
import { SpritesSandbox } from './index';

const { MockAPIError, mockClient, mockSprite, MockSpritesClient, commands, FakeCommand } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter: Emitter } = require('node:events') as typeof import('node:events');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PassThrough: Pass } = require('node:stream') as typeof import('node:stream');

  class MockAPIError extends Error {
    constructor(public statusCode: number) {
      super(`API error ${statusCode}`);
    }
  }

  /** Minimal stand-in for SpriteCommand: PassThrough streams + exit events. */
  class FakeCommand extends Emitter {
    stdin = new Pass();
    stdout = new Pass();
    stderr = new Pass();
    stdinData = '';
    stdinEnded = false;
    signals: string[] = [];
    closed = false;
    private resolveExit!: (code: number) => void;
    private exited = false;
    private exitPromise = new Promise<number>(resolve => {
      this.resolveExit = resolve;
    });

    constructor(
      public command: string,
      public args: string[],
      public options: Record<string, unknown>,
    ) {
      super();
      this.stdin.on('data', chunk => {
        this.stdinData += chunk.toString();
      });
      this.stdin.on('end', () => {
        this.stdinEnded = true;
      });
    }

    wait() {
      return this.exitPromise;
    }
    kill(signal = 'SIGTERM') {
      this.signals.push(signal);
    }
    close() {
      this.closed = true;
      this.exit(-1);
    }
    out(data: string) {
      this.stdout.push(Buffer.from(data));
    }
    err(data: string) {
      this.stderr.push(Buffer.from(data));
    }
    exit(code: number) {
      if (this.exited) return;
      this.exited = true;
      this.stdout.push(null);
      this.stderr.push(null);
      this.resolveExit(code);
      this.emit('exit', code);
    }
  }

  const commands: FakeCommand[] = [];
  const checkpointMessages: Array<{ type: string; error?: string }> = [];

  const mockSprite = {
    name: 'test-sprite',
    id: 'sprite-123',
    status: 'running',
    url: 'https://test-sprite.sprites.app',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    spawnError: undefined as Error | undefined,
    /** Called after spawn so tests can script output; defaults to exit 0. */
    onSpawn: undefined as ((cmd: FakeCommand) => void) | undefined,
    checkpointMessages,
    spawn: vi.fn((command: string, args: string[] = [], options: Record<string, unknown> = {}) => {
      const cmd = new FakeCommand(command, args, options);
      commands.push(cmd);
      queueMicrotask(() => {
        if (mockSprite.spawnError) {
          cmd.emit('error', mockSprite.spawnError);
          return;
        }
        cmd.emit('spawn');
        queueMicrotask(() => (mockSprite.onSpawn ? mockSprite.onSpawn(cmd) : cmd.exit(0)));
      });
      return cmd;
    }),
    createCheckpoint: vi.fn(async () => ({
      processAll: async (handler: (msg: { type: string; error?: string }) => void | Promise<void>) => {
        for (const msg of checkpointMessages) await handler(msg);
      },
    })),
    delete: vi.fn().mockResolvedValue(undefined),
    closeControlConnection: vi.fn(),
  };

  const mockClient = {
    getSprite: vi.fn(),
    createSprite: vi.fn(),
    sprite: vi.fn(() => mockSprite),
  };
  const MockSpritesClient = vi.fn(function () {
    return mockClient;
  });

  return { MockAPIError, mockClient, mockSprite, MockSpritesClient, commands, FakeCommand };
});

vi.mock('@fly/sprites', () => ({
  SpritesClient: MockSpritesClient,
  APIError: MockAPIError,
}));

type Cmd = InstanceType<typeof FakeCommand>;

beforeEach(() => {
  vi.clearAllMocks();
  commands.length = 0;
  mockSprite.checkpointMessages.length = 0;
  mockSprite.spawnError = undefined;
  mockSprite.onSpawn = undefined;
  mockClient.getSprite.mockResolvedValue(mockSprite);
  mockClient.createSprite.mockResolvedValue(mockSprite);
  mockClient.sprite.mockReturnValue(mockSprite);
  delete process.env.SPRITES_TOKEN;
});

function sandbox(options: ConstructorParameters<typeof SpritesSandbox>[0] = {}) {
  return new SpritesSandbox({ id: 'test-sprite', token: 'tok', ...options });
}

describe('SpritesSandbox', () => {
  describe('constructor', () => {
    it('uses the id as the Sprite name and advertises no checkpoint seeding', () => {
      const sb = sandbox();
      expect(sb.id).toBe('test-sprite');
      expect(sb.provider).toBe('sprites');
      expect(sb.name).toBe('SpritesSandbox');
      expect(sb.status).toBe('pending');
      expect(sb.supportsCheckpoints).toBe(false);
    });

    it('generates an id when none is given', () => {
      const sb = new SpritesSandbox({ token: 'tok' });
      expect(sb.id).toMatch(/^mastra-[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('start', () => {
    it('reconnects to an existing Sprite', async () => {
      const sb = sandbox();
      await expect(sb.start()).resolves.toEqual({ outcome: 'connected' });
      expect(MockSpritesClient).toHaveBeenCalledWith('tok', undefined);
      expect(mockClient.getSprite).toHaveBeenCalledWith('test-sprite');
      expect(mockClient.createSprite).not.toHaveBeenCalled();
      expect(sb.status).toBe('running');
    });

    it('creates the Sprite with spriteConfig when it does not exist', async () => {
      mockClient.getSprite.mockRejectedValueOnce(new MockAPIError(404));
      const sb = sandbox({ spriteConfig: { ramMB: 2048 }, baseURL: 'https://example.test' });
      await expect(sb.start()).resolves.toEqual({ outcome: 'created' });
      expect(MockSpritesClient).toHaveBeenCalledWith('tok', { baseURL: 'https://example.test' });
      expect(mockClient.createSprite).toHaveBeenCalledWith('test-sprite', { ramMB: 2048 });
    });

    it('falls back to getSprite when a concurrent create wins the race', async () => {
      mockClient.getSprite.mockRejectedValueOnce(new MockAPIError(404));
      mockClient.createSprite.mockRejectedValueOnce(new MockAPIError(409));
      const sb = sandbox();
      await expect(sb.start()).resolves.toEqual({ outcome: 'connected' });
      expect(mockClient.getSprite).toHaveBeenCalledTimes(2);
    });

    it('propagates non-404 errors', async () => {
      mockClient.getSprite.mockRejectedValueOnce(new MockAPIError(500));
      const sb = sandbox();
      await expect(sb.start()).rejects.toThrow('API error 500');
      expect(mockClient.createSprite).not.toHaveBeenCalled();
    });

    it('fails clearly without a token', async () => {
      const sb = new SpritesSandbox({ id: 'test-sprite' });
      await expect(sb.start()).rejects.toThrow(/SPRITES_TOKEN/);
    });

    it('reads the token from SPRITES_TOKEN', async () => {
      process.env.SPRITES_TOKEN = 'env-tok';
      await new SpritesSandbox({ id: 'test-sprite' }).start();
      expect(MockSpritesClient).toHaveBeenCalledWith('env-tok', undefined);
    });

    it('passes the outcome to onStart', async () => {
      mockClient.getSprite.mockRejectedValueOnce(new MockAPIError(404));
      const onStart = vi.fn();
      await sandbox({ onStart }).start();
      expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'created' }));
    });
  });

  describe('executeCommand', () => {
    it('runs through sh -c with quoted args, cwd and merged env', async () => {
      mockSprite.onSpawn = cmd => {
        cmd.out('hello\n');
        cmd.exit(0);
      };
      const sb = sandbox({ env: { BASE: '1', OVERRIDE: 'base' }, workingDirectory: '/app' });
      const result = await sb.executeCommand!('echo', ['hello world'], { env: { OVERRIDE: 'cmd' } });

      expect(mockSprite.spawn).toHaveBeenCalledWith('sh', ['-c', "echo 'hello world'"], {
        cwd: '/app',
        env: { BASE: '1', OVERRIDE: 'cmd' },
      });
      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'hello\n', stderr: '' });
      // executeCommand closes stdin so stdin-reading commands cannot hang.
      expect(commands[0]!.stdinEnded).toBe(true);
    });

    it('prefers per-command cwd', async () => {
      const sb = sandbox({ workingDirectory: '/app' });
      await sb.executeCommand!('pwd', [], { cwd: '/tmp' });
      expect(mockSprite.spawn).toHaveBeenCalledWith('sh', ['-c', 'pwd'], { cwd: '/tmp' });
    });

    it('returns non-zero exit codes and stderr', async () => {
      mockSprite.onSpawn = cmd => {
        cmd.err('boom');
        cmd.exit(3);
      };
      const result = await sandbox().executeCommand!('false');
      expect(result).toMatchObject({ success: false, exitCode: 3, stderr: 'boom' });
    });

    it('streams output before the command finishes', async () => {
      let finish!: () => void;
      mockSprite.onSpawn = cmd => {
        cmd.out('first ');
        finish = () => {
          cmd.out('second');
          cmd.exit(0);
        };
      };
      const chunks: string[] = [];
      const sb = sandbox();
      const pending = sb.executeCommand!('long', [], { onStdout: c => chunks.push(c) });

      await vi.waitFor(() => expect(chunks).toEqual(['first ']));
      finish();
      const result = await pending;
      expect(chunks).toEqual(['first ', 'second']);
      expect(result.stdout).toBe('first second');
    });

    it('kills the command on timeout', async () => {
      mockSprite.onSpawn = () => {};
      const result = await sandbox().executeCommand!('sleep 100', [], { timeout: 20 });
      expect(result).toMatchObject({ success: false, exitCode: 137, killed: true, timedOut: true });
      expect(commands[0]!.signals).toEqual(['SIGKILL']);
      expect(commands[0]!.closed).toBe(true);
    });

    it('uses the sandbox default timeout', async () => {
      mockSprite.onSpawn = () => {};
      const result = await sandbox({ timeout: 20 }).executeCommand!('sleep 100');
      expect(result).toMatchObject({ timedOut: true });
    });

    it('kills the command when aborted', async () => {
      mockSprite.onSpawn = () => {};
      const controller = new AbortController();
      const pending = sandbox().executeCommand!('sleep 100', [], { abortSignal: controller.signal });
      await vi.waitFor(() => expect(commands).toHaveLength(1));
      controller.abort();
      const result = await pending;
      expect(result).toMatchObject({ success: false, killed: true });
      expect(commands[0]!.closed).toBe(true);
    });

    it('rejects when the exec session cannot be opened', async () => {
      mockSprite.spawnError = new Error('WebSocket closed before open');
      await expect(sandbox().executeCommand!('ls')).rejects.toThrow('WebSocket closed before open');
      expect(commands[0]!.closed).toBe(true);
    });
  });

  describe('background processes', () => {
    it('spawns, streams, accepts stdin and reports exit', async () => {
      mockSprite.onSpawn = () => {};
      const sb = sandbox();
      const handle = await sb.processes.spawn('cat');
      const cmd = commands[0] as Cmd;

      await handle.sendStdin('ping');
      expect(cmd.stdinData).toBe('ping');
      expect(cmd.stdinEnded).toBe(false);

      cmd.out('pong');
      await vi.waitFor(() => expect(handle.stdout).toBe('pong'));

      const listed = await sb.processes.list();
      expect(listed).toEqual([{ pid: handle.pid, command: 'cat', running: true }]);

      await handle.closeStdin();
      await vi.waitFor(() => expect(cmd.stdinEnded).toBe(true));
      cmd.exit(0);

      const result = await handle.wait();
      expect(result).toMatchObject({ success: true, exitCode: 0, stdout: 'pong' });
      expect(await sb.processes.get(handle.pid)).toBe(handle);
      expect(await sb.processes.get(handle.pid)).toBeUndefined();
    });

    it('kills a running process', async () => {
      mockSprite.onSpawn = () => {};
      const sb = sandbox();
      const handle = await sb.processes.spawn('sleep 100');
      await expect(sb.processes.kill(handle.pid)).resolves.toBe(true);
      expect(handle.exitCode).toBe(137);
      expect(await handle.kill()).toBe(false);
    });
  });

  describe('stop', () => {
    it('kills background processes and never deletes the Sprite', async () => {
      mockSprite.onSpawn = () => {};
      const sb = sandbox();
      const handle = await sb.processes.spawn('sleep 100');

      await sb._stop();

      expect(sb.status).toBe('stopped');
      expect(handle.exitCode).toBe(137);
      expect(mockSprite.closeControlConnection).toHaveBeenCalled();
      expect(mockSprite.delete).not.toHaveBeenCalled();
      expect(() => sb.sprite).toThrow();
    });

    it('reconnects on the next start', async () => {
      const sb = sandbox();
      await sb.start();
      await sb._stop();
      await expect(sb.start()).resolves.toEqual({ outcome: 'connected' });
      expect(mockClient.getSprite).toHaveBeenCalledTimes(2);
    });
  });

  describe('destroy', () => {
    it('deletes a started Sprite', async () => {
      const sb = sandbox();
      await sb.start();
      await sb._destroy();
      expect(mockSprite.delete).toHaveBeenCalledTimes(1);
      expect(sb.status).toBe('destroyed');
    });

    it('deletes the Sprite by name without a prior start', async () => {
      await sandbox().destroy();
      expect(mockClient.sprite).toHaveBeenCalledWith('test-sprite');
      expect(mockClient.getSprite).not.toHaveBeenCalled();
      expect(mockSprite.delete).toHaveBeenCalledTimes(1);
    });

    it('treats a missing Sprite as already destroyed', async () => {
      mockSprite.delete.mockRejectedValueOnce(new MockAPIError(404));
      await expect(sandbox().destroy()).resolves.toBeUndefined();
    });

    it('propagates other delete errors', async () => {
      mockSprite.delete.mockRejectedValueOnce(new MockAPIError(500));
      await expect(sandbox().destroy()).rejects.toThrow('API error 500');
    });
  });

  describe('snapshot', () => {
    it('captures a checkpoint and drains the stream', async () => {
      mockSprite.checkpointMessages.push({ type: 'info' }, { type: 'complete' });
      const sb = sandbox();
      await sb.snapshot();
      expect(sb.status).toBe('running');
      expect(mockSprite.createCheckpoint).toHaveBeenCalledWith('mastra snapshot');
    });

    it('throws when the checkpoint stream reports an error', async () => {
      mockSprite.checkpointMessages.push({ type: 'error', error: 'disk full' });
      await expect(sandbox().snapshot()).rejects.toThrow('Checkpoint failed: disk full');
    });
  });

  describe('getInfo / getInstructions', () => {
    it('reports Sprite metadata once started', async () => {
      const sb = sandbox();
      expect((await sb.getInfo()).metadata).toEqual({});
      await sb.start();
      const info = await sb.getInfo();
      expect(info).toMatchObject({ id: 'test-sprite', provider: 'sprites', status: 'running' });
      expect(info.createdAt).toEqual(mockSprite.createdAt);
      expect(info.metadata).toEqual({
        spriteId: 'sprite-123',
        spriteStatus: 'running',
        url: 'https://test-sprite.sprites.app',
      });
    });

    it('describes the environment and honors overrides', () => {
      expect(sandbox({ workingDirectory: '/app', timeout: 5000 }).getInstructions()).toContain('/app');
      expect(sandbox({ instructions: 'custom' }).getInstructions()).toBe('custom');
      expect(
        sandbox({ instructions: ({ defaultInstructions }) => `${defaultInstructions} extra` }).getInstructions(),
      ).toMatch(/Fly\.io Sprite.*extra$/);
    });
  });
});

describe('spritesSandboxProvider', () => {
  it('creates a SpritesSandbox from stored config', async () => {
    const sb = await spritesSandboxProvider.createSandbox({ id: 'from-editor', token: 'tok', timeout: 1000 });
    expect(sb).toBeInstanceOf(SpritesSandbox);
    expect(sb.id).toBe('from-editor');
    expect(spritesSandboxProvider.id).toBe('sprites');
  });

  it('ignores a stored baseURL so the env token cannot be sent to another host', async () => {
    process.env.SPRITES_TOKEN = 'server-token';
    expect(spritesSandboxProvider.configSchema?.properties).not.toHaveProperty('baseURL');

    const storedConfig = { id: 'from-editor', baseURL: 'https://attacker.example' };
    const sb = (await spritesSandboxProvider.createSandbox(storedConfig)) as SpritesSandbox;
    await sb._start();

    expect(MockSpritesClient).toHaveBeenCalledWith('server-token', undefined);
  });
});
