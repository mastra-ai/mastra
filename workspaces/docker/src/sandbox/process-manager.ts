/**
 * Docker Process Manager
 *
 * Implements SandboxProcessManager for Docker containers.
 * Uses `container.exec()` to run commands inside a long-lived container.
 * Each spawned process gets a dedicated exec instance with separate
 * stdout/stderr streams.
 */

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { Container, Exec, ExecInspectInfo } from 'dockerode';

// =============================================================================
// Docker Process Handle
// =============================================================================

/**
 * Wraps a Docker exec instance to conform to Mastra's ProcessHandle.
 * Not exported — internal to this module.
 *
 * Listener dispatch is handled by the base class. The manager's spawn()
 * method wires Docker stream callbacks to handle.emitStdout/emitStderr.
 */
class DockerProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _exec: Exec;
  private readonly _container: Container;
  private readonly _startTime: number;
  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _stdinStream: NodeJS.WritableStream | null = null;

  constructor(
    exec: Exec,
    container: Container,
    startTime: number,
    stdinStream: NodeJS.WritableStream | null,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = exec.id;
    this._exec = exec;
    this._container = container;
    this._startTime = startTime;
    this._stdinStream = stdinStream;
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /** @internal Set exit code when stream closes */
  _setExitCode(code: number): void {
    this._exitCode = code;
  }

  /** @internal Set the wait promise from spawn */
  _setWaitPromise(p: Promise<CommandResult>): void {
    this._waitPromise = p;
  }

  async wait(): Promise<CommandResult> {
    if (this._waitPromise) {
      return this._waitPromise;
    }

    // If no wait promise set yet, poll exec inspect
    const info = await this._inspectExec();
    return {
      success: (info.ExitCode ?? 1) === 0,
      exitCode: info.ExitCode ?? 1,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: Date.now() - this._startTime,
    };
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;

    try {
      // Get the PID inside the container from exec inspect
      const info = await this._inspectExec();
      if (!info.Running) return false;

      const pid = info.Pid;
      if (!pid) return false;

      // Kill the process tree inside the container
      const killExec = await this._container.exec({
        Cmd: ['kill', '-9', String(pid)],
        AttachStdout: false,
        AttachStderr: false,
      });
      await killExec.start({});
      return true;
    } catch {
      return false;
    }
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    if (!this._stdinStream) {
      throw new Error(`Process ${this.pid} was not started with stdin support`);
    }
    this._stdinStream.write(data);
  }

  private async _inspectExec(): Promise<ExecInspectInfo> {
    return this._exec.inspect();
  }
}

// =============================================================================
// Docker Process Manager
// =============================================================================

/**
 * Docker implementation of SandboxProcessManager.
 * Uses `container.exec()` with stream-based I/O.
 */
export class DockerProcessManager extends SandboxProcessManager {
  private _container: Container | null = null;

  /** @internal Called by DockerSandbox after container is ready */
  setContainer(container: Container): void {
    this._container = container;
  }

  /** Get the container, throwing if not set */
  private get container(): Container {
    if (!this._container) {
      throw new Error('Docker container not available. Has the sandbox been started?');
    }
    return this._container;
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const container = this.container;

    // Merge default env with per-spawn env
    const mergedEnv = { ...this.env, ...options.env };
    const envArray = Object.entries(mergedEnv)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([k, v]) => `${k}=${v}`);

    // Create exec instance
    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: false,
      Env: envArray.length > 0 ? envArray : undefined,
      WorkingDir: options.cwd,
    });

    // Start exec and get the multiplexed stream
    const stream = await exec.start({ hijack: true, stdin: true });

    const startTime = Date.now();
    const handle = new DockerProcessHandle(exec, container, startTime, stream, options);

    // Create the wait promise that resolves when the stream ends
    const waitPromise = new Promise<CommandResult>((resolve) => {
      // Demux the multiplexed stream into stdout/stderr
      // Docker multiplexes stdout/stderr into a single stream with 8-byte headers
      // when Tty is false. We need to parse these headers.
      const buffer: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        buffer.push(chunk);
        // Process all complete frames in the buffer
        let combined = Buffer.concat(buffer);
        buffer.length = 0;

        while (combined.length >= 8) {
          const type = combined[0]; // 1 = stdout, 2 = stderr
          const size = combined.readUInt32BE(4);

          if (combined.length < 8 + size) {
            // Incomplete frame, save for next chunk
            buffer.push(combined);
            break;
          }

          const payload = combined.subarray(8, 8 + size).toString('utf-8');
          if (type === 1) {
            handle.emitStdout(payload);
          } else if (type === 2) {
            handle.emitStderr(payload);
          }

          combined = combined.subarray(8 + size);
        }

        // Save any remaining partial data
        if (combined.length > 0 && buffer.length === 0) {
          buffer.push(combined);
        }
      });

      stream.on('end', async () => {
        // Get exit code from exec inspect
        try {
          const info = await exec.inspect();
          const exitCode = info.ExitCode ?? 0;
          handle._setExitCode(exitCode);
          resolve({
            success: exitCode === 0,
            exitCode,
            stdout: handle.stdout,
            stderr: handle.stderr,
            executionTimeMs: Date.now() - startTime,
          });
        } catch {
          handle._setExitCode(1);
          resolve({
            success: false,
            exitCode: 1,
            stdout: handle.stdout,
            stderr: handle.stderr,
            executionTimeMs: Date.now() - startTime,
          });
        }
      });

      stream.on('error', () => {
        handle._setExitCode(1);
        resolve({
          success: false,
          exitCode: 1,
          stdout: handle.stdout,
          stderr: handle.stderr || 'Stream error',
          executionTimeMs: Date.now() - startTime,
        });
      });
    });

    handle._setWaitPromise(waitPromise);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    const results: ProcessInfo[] = [];

    for (const [pid, handle] of this._tracked) {
      results.push({
        pid,
        command: handle.command,
        running: handle.exitCode === undefined,
        exitCode: handle.exitCode,
      });
    }

    return results;
  }
}
