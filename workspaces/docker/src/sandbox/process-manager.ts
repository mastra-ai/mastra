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
  /** @internal Set by kill() and timeout to distinguish forced termination from natural exit */
  _killed = false;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _stdinStream: NodeJS.WritableStream | null = null;
  private _execStream: NodeJS.ReadWriteStream | null = null;

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

  /** @internal Set the exec stream so kill() can destroy it */
  _setExecStream(stream: NodeJS.ReadWriteStream): void {
    this._execStream = stream;
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
      // Get the PID inside the container from exec inspect.
      // Single retry with 50ms delay — Docker may not have assigned a PID yet
      // if kill() is called immediately after spawn(). A polling loop with
      // backoff would be more robust under heavy load, but overkill in practice.
      let info = await this._inspectExec();
      if (!info.Running || !info.Pid) {
        await new Promise(r => setTimeout(r, 50));
        info = await this._inspectExec();
      }

      if (!info.Running) {
        this._killed = true;
        this._destroyStream();
        return false;
      }

      const pid = info.Pid;
      if (!pid) {
        this._killed = true;
        this._destroyStream();
        return false;
      }

      // Kill the process group (negative PID), fall back to direct PID
      const killExec = await this._container.exec({
        Cmd: ['sh', '-c', `kill -9 -${pid} 2>/dev/null || kill -9 ${pid}`],
        AttachStdout: false,
        AttachStderr: false,
      });
      await killExec.start({});

      // Mark as killed and destroy stream so wait() resolves.
      // Docker exec streams don't close automatically when the process is killed externally.
      this._killed = true;
      this._destroyStream();
      return true;
    } catch (error: unknown) {
      this._killed = true;
      this._destroyStream();
      // ESRCH / "no such process" is expected if the process exited between inspect and kill
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (!msg.includes('no such process') && !msg.includes('esrch')) {
        // Unexpected error — not fatal but worth noting for debugging
        console.warn(`[DockerProcessManager] kill(${this.pid}) failed unexpectedly:`, error);
      }
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

  /** @internal Force-close the exec stream to unblock wait(). */
  _destroyStream(): void {
    const stream = this._execStream as unknown as { destroy?: () => void } | null;
    if (stream && typeof stream.destroy === 'function') {
      stream.destroy();
      this._execStream = null;
    }
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
  private readonly _defaultTimeout: number;

  constructor(options: { env: Record<string, string>; defaultTimeout?: number }) {
    super(options);
    this._defaultTimeout = options.defaultTimeout ?? 0;
  }

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
    handle._setExecStream(stream);

    // Create the wait promise that resolves when the stream ends
    const waitPromise = new Promise<CommandResult>(resolve => {
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
          const exitCode = info.ExitCode ?? 1;
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

      // 'close' fires when stream.destroy() is called (e.g., from kill or timeout).
      // Only resolve with SIGKILL exit code when the process was explicitly killed;
      // natural stream close should be handled by the 'end' event above.
      // Note: Docker multiplexed streams always emit 'end' before 'close' for
      // natural exits, so the !_killed guard won't silently drop natural closes.
      stream.on('close', () => {
        if (handle.exitCode !== undefined) return; // Already resolved via 'end'
        if (!handle._killed) return; // Natural close — 'end' handles it
        handle._setExitCode(137); // SIGKILL
        resolve({
          success: false,
          exitCode: 137,
          stdout: handle.stdout,
          stderr: handle.stderr,
          executionTimeMs: Date.now() - startTime,
        });
      });

      stream.on('error', () => {
        if (handle.exitCode !== undefined) return; // Already resolved
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

    // Wire up timeout: kill the process and destroy the stream after the timeout period.
    // Per-spawn timeout takes precedence; falls back to the sandbox-level default.
    const resolvedTimeout = options.timeout ?? this._defaultTimeout;
    if (resolvedTimeout > 0) {
      const timeoutMs = resolvedTimeout;
      const timer = setTimeout(() => {
        if (handle.exitCode === undefined) {
          handle._killed = true;
          handle.kill().catch(() => {});
          // Ensure stream is destroyed even if kill() fails (e.g., PID not found)
          handle._destroyStream();
        }
      }, timeoutMs);
      // Clear timer when process exits naturally
      void waitPromise.then(() => clearTimeout(timer));
    }

    handle._setWaitPromise(waitPromise);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  /** Clear all tracked process handles and release the container reference (e.g., after container stop/destroy) */
  reset(): void {
    this._tracked.clear();
    this._container = null;
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
