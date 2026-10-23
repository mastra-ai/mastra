/**
 * Sprites Process Manager
 *
 * Runs each spawned command as its own `SpriteCommand` (a WebSocket exec
 * session on the Sprite) and streams stdout/stderr into the core
 * `ProcessHandle` buffers as chunks arrive.
 */

import type { SpriteCommand } from '@fly/sprites';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { SpritesSandbox } from './index';

export const LOG_PREFIX = '[SpritesSandbox]';

/** Exit code reported for processes terminated by `kill()` or a timeout. */
const KILLED_EXIT_CODE = 137;

class SpritesProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _cmd: SpriteCommand;
  private readonly _startTime = Date.now();
  private readonly _done: Promise<void>;
  private _exitCode: number | undefined;
  private _killed = false;
  private _timedOut = false;
  private _timeoutId: ReturnType<typeof setTimeout> | undefined;
  private _error: Error | undefined;

  constructor(pid: string, cmd: SpriteCommand, options: SpawnProcessOptions, timeout: number | undefined) {
    super(options);
    this.pid = pid;
    this._cmd = cmd;

    cmd.stdout.setEncoding('utf8');
    cmd.stderr.setEncoding('utf8');
    cmd.stdout.on('data', (chunk: string) => this.emitStdout(chunk));
    cmd.stderr.on('data', (chunk: string) => this.emitStderr(chunk));
    // SpriteCommand is an EventEmitter: an unhandled 'error' would crash the process.
    cmd.on('error', (error: Error) => {
      this._error ??= error;
    });

    // Output streams end right after the exit frame, so waiting for both
    // guarantees every chunk has been emitted before the exit code is published.
    this._done = Promise.all([cmd.wait(), streamEnded(cmd.stdout), streamEnded(cmd.stderr)]).then(([code]) => {
      clearTimeout(this._timeoutId);
      this._exitCode = this._killed ? KILLED_EXIT_CODE : code < 0 ? 1 : code;
    });

    if (timeout !== undefined && timeout > 0) {
      this._timeoutId = setTimeout(() => {
        this._timedOut = true;
        void this.kill();
      }, timeout);
    }
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  async wait(): Promise<CommandResult> {
    await this._done;
    const exitCode = this._exitCode!;
    let stderr = this.stderr;
    if (exitCode !== 0 && !stderr && this._error && !this._killed) {
      stderr = this._error.message;
    }
    return {
      success: exitCode === 0,
      exitCode,
      stdout: this.stdout,
      stderr,
      executionTimeMs: Date.now() - this._startTime,
      ...(this._killed && { killed: true }),
      ...(this._timedOut && { timedOut: true }),
    };
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined || this._killed) return false;
    this._killed = true;
    clearTimeout(this._timeoutId);
    // Signal the remote process, then drop the connection. Closing the
    // (non-detachable) exec session makes the server reap the process even if
    // the signal could not be delivered.
    this._cmd.kill('SIGKILL');
    this._cmd.close();
    return true;
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`${LOG_PREFIX} Cannot write to stdin: process ${this.pid} has exited`);
    }
    await new Promise<void>((resolve, reject) => {
      this._cmd.stdin.write(data, error => (error ? reject(error) : resolve()));
    });
  }

  async closeStdin(): Promise<void> {
    this._cmd.stdin.end();
  }
}

export class SpritesProcessManager extends SandboxProcessManager<SpritesSandbox> {
  private _spawnCounter = 0;

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    // The base spawn wrapper has already merged the sandbox env into options.env.
    const env = Object.fromEntries(
      Object.entries(options.env ?? {}).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    const cwd = options.cwd ?? this.sandbox.workingDirectory;

    const cmd = this.sandbox.sprite.spawn('sh', ['-c', command], {
      ...(cwd && { cwd }),
      ...(Object.keys(env).length > 0 && { env }),
    });
    try {
      await waitForSpawn(cmd);
    } catch (error) {
      // Drop any half-opened exec connection so failed spawns don't leak sockets.
      cmd.close();
      throw error;
    }

    if (options.stdinMode === 'ignore') {
      cmd.stdin.end();
    }

    const pid = `sprites-proc-${Date.now().toString(36)}-${(++this._spawnCounter).toString(36)}`;
    const handle = new SpritesProcessHandle(pid, cmd, options, options.timeout ?? this.sandbox.defaultTimeout);
    this._tracked.set(pid, handle);
    return handle;
  }

  /**
   * Lists processes spawned by this instance. The Sprites exec API has no
   * listing for non-detachable commands, so processes started elsewhere are
   * not included.
   */
  async list(): Promise<ProcessInfo[]> {
    return [...this._tracked.values()].map(handle => ({
      pid: handle.pid,
      command: handle.command,
      running: handle.exitCode === undefined,
      ...(handle.exitCode !== undefined && { exitCode: handle.exitCode }),
    }));
  }

  /** Kill every running process spawned by this instance. Does not start the sandbox. */
  async killAll(): Promise<void> {
    const running = [...this._tracked.values()].filter(handle => handle.exitCode === undefined);
    await Promise.all(running.map(handle => this.kill(handle.pid)));
  }
}

function waitForSpawn(cmd: SpriteCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSpawn = () => {
      cmd.off('error', onError);
      resolve();
    };
    const onError = (error: Error) => {
      cmd.off('spawn', onSpawn);
      reject(error);
    };
    cmd.once('spawn', onSpawn);
    cmd.once('error', onError);
  });
}

function streamEnded(stream: NodeJS.ReadableStream): Promise<void> {
  return new Promise(resolve => {
    stream.once('end', () => resolve());
    stream.once('close', () => resolve());
  });
}
