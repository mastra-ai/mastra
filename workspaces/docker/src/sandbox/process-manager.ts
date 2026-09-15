/**
 * Docker Process Manager
 *
 * Implements SandboxProcessManager for Docker containers.
 * Uses `container.exec()` to run commands inside a long-lived container.
 * Each spawned process gets a dedicated exec instance with separate
 * stdout/stderr streams.
 */

import { randomUUID } from 'node:crypto';
import type { Duplex } from 'node:stream';

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { Container, Exec, ExecInspectInfo } from 'dockerode';

/**
 * Env var injected into every spawned exec so that, at kill time, we can find
 * the process (and its descendants) inside the *container's* PID namespace.
 * Docker's exec-inspect `Pid` is in the host/daemon namespace and does not
 * correspond to PIDs visible to an in-container `kill`, so we identify the
 * process tree by this marker instead.
 */
const PROC_MARKER_ENV = 'MASTRA_PROC_ID';

/**
 * Build a POSIX-sh script that kills every process in the container carrying
 * `MASTRA_PROC_ID=<marker>` plus all of their descendants. Children may replace
 * their environment (so they lose the marker) or be re-parented to PID 1 (so a
 * PPID walk from the marked roots alone misses them); we therefore union both
 * criteria and iterate until the set is stable to catch fork races. The set is
 * SIGSTOPped first to freeze it, then SIGKILLed.
 *
 * The marker is a UUID (no shell metacharacters), so interpolation is safe.
 */
function buildKillScript(marker: string): string {
  return `
marker='${PROC_MARKER_ENV}=${marker}'
collect() {
  found=''
  for d in /proc/[0-9]*; do
    pid=\${d#/proc/}
    [ -r "$d/environ" ] || continue
    if tr '\\0' '\\n' < "$d/environ" 2>/dev/null | grep -qxF "$marker"; then
      found="$found $pid"
    fi
  done
  # Expand to descendants by repeatedly adding any pid whose parent is in the set.
  changed=1
  while [ "$changed" = 1 ]; do
    changed=0
    for d in /proc/[0-9]*; do
      pid=\${d#/proc/}
      [ -r "$d/stat" ] || continue
      ppid=$(awk '{print $4}' "$d/stat" 2>/dev/null)
      for p in $found; do
        if [ "$ppid" = "$p" ]; then
          case " $found " in
            *" $pid "*) ;;
            *) found="$found $pid"; changed=1 ;;
          esac
        fi
      done
    done
  done
  echo "$found"
}
prev=''
i=0
while [ "$i" -lt 5 ]; do
  set=$(collect)
  [ -n "$set" ] && kill -STOP $set 2>/dev/null
  [ "$set" = "$prev" ] && break
  prev="$set"
  i=$((i + 1))
done
[ -n "$prev" ] && kill -KILL $prev 2>/dev/null
exit 0
`;
}

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
  /** @internal Set by the timeout path to distinguish timeout kills from explicit kills */
  _timedOut = false;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _stdinStream: Duplex | null = null;
  private _execStream: NodeJS.ReadWriteStream | null = null;
  /** @internal Marker used to locate this process tree in the container PID namespace. */
  readonly _procMarker: string;

  constructor(
    exec: Exec,
    container: Container,
    startTime: number,
    stdinStream: Duplex | null,
    procMarker: string,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = exec.id;
    this._exec = exec;
    this._container = container;
    this._startTime = startTime;
    this._stdinStream = stdinStream;
    this._procMarker = procMarker;
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
      // Locate and kill the process tree inside the *container's* PID namespace
      // via the marker env var. We must not use exec.inspect().Pid here: that is
      // the host/daemon-namespace PID and does not correspond to PIDs an
      // in-container `kill` can address. The sweep also catches children that
      // dropped the marker or were re-parented to PID 1.
      const killExec = await this._container.exec({
        Cmd: ['sh', '-c', buildKillScript(this._procMarker)],
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
    return new Promise<void>((resolve, reject) => {
      this._stdinStream!.write(data, error => (error ? reject(error) : resolve()));
    });
  }

  async closeStdin(): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    if (!this._stdinStream) {
      throw new Error(`Process ${this.pid} was not started with stdin support`);
    }
    const stream = this._stdinStream;
    if (stream.writableEnded) return;
    await new Promise<void>(resolve => stream.end(resolve));
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

  constructor(options: { defaultTimeout?: number } = {}) {
    super();
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

    // Unique marker so kill() can find this process (and its descendants) in the
    // container PID namespace. The base spawn wrapper already merged the sandbox
    // env into options.env; the marker is injected last so it always wins.
    const procMarker: string = randomUUID();
    const envArray = Object.entries({ ...options.env, [PROC_MARKER_ENV]: procMarker })
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
    const handle = new DockerProcessHandle(exec, container, startTime, stream, procMarker, options);
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
          killed: true,
          timedOut: handle._timedOut,
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
          handle._timedOut = true;
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
