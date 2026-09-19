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
 * Directory (inside the container) where each spawned process records the PGID
 * of its process group. Created with mode 700 so only the (root) exec user can
 * write the PGID files.
 */
const PROC_DIR = '/tmp/.mastra-proc';

/**
 * Wrapper (run as the exec command) that places the user command in its own
 * process group and records the group's PGID so kill() can signal the whole
 * group later.
 *
 * Docker's exec-inspect `Pid` is a host/daemon-namespace PID and cannot be used
 * with an in-container `kill`, so we need a container-namespace identity. We use
 * a *kernel-enforced* process group as that identity:
 *
 *   1. `setsid -w` re-execs the command as a new session/process-group leader,
 *      so its PID == PGID. Every descendant inherits that PGID (unless it calls
 *      `setsid` itself) and stays reachable even if it re-parents to PID 1.
 *      `-w` keeps the wrapper (and thus the exec) alive for the whole lifetime
 *      and propagates the child's exit status — without it `setsid` forks and
 *      returns immediately, so the exec would appear to finish while the real
 *      work keeps running.
 *   2. The leader writes its own PID (`$$`) — the PGID — to a private file that
 *      only this process wrote, so the identity is kernel-owned and cannot be
 *      forged by another container process.
 *
 * If `setsid -w` is unavailable in the image (e.g. BusyBox), we degrade
 * gracefully: the command runs directly and we record its PID so kill() can
 * still signal it (descendant coverage is then best-effort). The probe
 * `setsid -w true` also covers images without setsid at all.
 *
 * Positional args: $1 = pgid file path, $2 = user command. The script text is a
 * static constant; runtime values travel only as argv, never interpolated into
 * the command string.
 */
const SPAWN_WRAPPER = `
umask 077
d="\${1%/*}"
mkdir -p "$d" 2>/dev/null
chmod 700 "$d" 2>/dev/null
if setsid -w true >/dev/null 2>&1; then
  exec setsid -w sh -c 'echo $$ > "$1" || exit 126; sh -c "$2"; ret=$?; rm -f "$1" 2>/dev/null; exit $ret' sh "$1" "$2"
fi
echo $$ > "$1" || exit 126
sh -c "$2"
ret=$?
rm -f "$1" 2>/dev/null
exit $ret
`;

/**
 * Kill script: read the recorded PGID and SIGKILL the whole process group.
 * A negative PID targets the kernel-owned process group, so descendants that
 * re-parented to PID 1 are still caught. We SIGSTOP the
 * group first to freeze fork races, then SIGKILL. The file may not exist yet if
 * kill races the leader's first write, so we briefly wait for it.
 *
 * Positional arg: $1 = pgid file path (static script; no interpolation).
 */
const KILL_SCRIPT = `
f="$1"
i=0
while [ ! -r "$f" ] && [ "$i" -lt 40 ]; do sleep 0.05; i=$((i + 1)); done
# If the PGID was never recorded (file absent/unreadable after the wait, or
# empty), we have no group to signal or verify — report failure rather than
# falsely claiming the tree was terminated.
[ -r "$f" ] || exit 1
pgid=$(cat "$f" 2>/dev/null)
rm -f "$f" 2>/dev/null
[ -n "$pgid" ] || exit 1
kill -STOP -"$pgid" 2>/dev/null
kill -KILL -"$pgid" 2>/dev/null
# Fallback for images without setsid: the leader is not a group leader, so also
# signal it directly.
kill -KILL "$pgid" 2>/dev/null
# Verify the group is actually gone before reporting success. kill -0 probes
# for the group's existence without sending a signal, and we poll while it
# still reports the group alive. When the probe finally fails we must inspect
# why: ESRCH ("no such process") means every member was reaped, so report
# success; EPERM or any other error means termination is unconfirmed (e.g. a
# member dropped privileges and became unsignalable), so exit nonzero and let
# kill() report failure instead of falsely claiming the tree was terminated.
j=0
while err=$(kill -0 -"$pgid" 2>&1); do
  j=$((j + 1))
  [ "$j" -ge 40 ] && exit 1
  sleep 0.05
done
case "$err" in
  *[Ss]uch\\ process*) exit 0 ;;
  *) exit 1 ;;
esac
`;

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
  private _waitResolver: ((result: CommandResult) => void) | null = null;
  private _settled = false;
  private _streamEnded = false;
  private _terminationPromise: Promise<boolean> | null = null;
  private _stdinStream: Duplex | null = null;
  private _execStream: NodeJS.ReadWriteStream | null = null;
  /** @internal Container path of the file holding this process group's PGID. */
  readonly _pgidFile: string;

  constructor(
    exec: Exec,
    container: Container,
    startTime: number,
    stdinStream: Duplex | null,
    pgidFile: string,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = exec.id;
    this._exec = exec;
    this._container = container;
    this._startTime = startTime;
    this._stdinStream = stdinStream;
    this._pgidFile = pgidFile;
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

  /** @internal Set the resolver used by the single settlement path */
  _setWaitResolver(resolve: (result: CommandResult) => void): void {
    this._waitResolver = resolve;
  }

  /** @internal Mark a timeout request before kill confirmation is available */
  _markTimedOut(): void {
    this._timedOut = true;
  }

  /** @internal Whether wait() has already settled */
  _isSettled(): boolean {
    return this._settled;
  }

  private _buildResult(exitCode: number, termination?: { killed: boolean; timedOut: boolean }): CommandResult {
    return {
      success: exitCode === 0 && termination?.timedOut !== true,
      exitCode,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: Date.now() - this._startTime,
      ...(termination ? { killed: termination.killed, timedOut: termination.timedOut } : {}),
    };
  }

  private _settle(result: CommandResult): void {
    if (this._settled) return;
    this._settled = true;
    const resolve = this._waitResolver;
    this._waitResolver = null;
    resolve?.(result);
  }

  /** @internal Settle after the main exec stream ends, waiting for any kill confirmation first */
  async _settleAfterStreamEnd(exitCode: number): Promise<void> {
    if (this._settled) return;
    this._streamEnded = true;
    this._setExitCode(exitCode);

    const termination = this._terminationPromise;
    if (termination) {
      await termination;
    }
    if (this._settled) return;

    if (this._killed) {
      this._settle(this._buildResult(137, { killed: true, timedOut: this._timedOut }));
    } else if (this._timedOut) {
      this._settle(this._buildResult(exitCode, { killed: false, timedOut: true }));
    } else {
      this._settle(this._buildResult(exitCode));
    }
  }

  /** @internal Settle a timeout whose kill helper could not confirm termination */
  _settleTimeoutFallback(): void {
    if (this._settled) return;
    this._timedOut = true;
    this._setExitCode(137);
    this._settle(this._buildResult(137, { killed: false, timedOut: true }));
  }

  /** @internal Settle a stream close when termination was already confirmed */
  _settleOnClose(): void {
    if (this._settled || !this._killed) return;
    this._setExitCode(137);
    this._settle(this._buildResult(137, { killed: true, timedOut: this._timedOut }));
  }

  /** @internal Settle a stream error without bypassing the single settlement path */
  _settleStreamError(): void {
    if (this._settled) return;
    this._setExitCode(1);
    this._settle({
      ...this._buildResult(1),
      stderr: this.stderr || 'Stream error',
    });
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

  kill(): Promise<boolean> {
    if (this._settled || this._streamEnded || this._exitCode !== undefined) {
      return Promise.resolve(false);
    }
    if (this._terminationPromise) {
      return this._terminationPromise;
    }

    this._terminationPromise = this._killProcessGroup();
    return this._terminationPromise;
  }

  private async _killProcessGroup(): Promise<boolean> {
    try {
      // Kill the process group inside the *container's* PID namespace. We must
      // not use exec.inspect().Pid here: that is the host/daemon-namespace PID
      // and does not correspond to PIDs an in-container `kill` can address. The
      // recorded PGID targets a kernel-owned group, so descendants that were
      // re-parented to PID 1 are still caught.
      const killExec = await this._container.exec({
        // Static script; the pgid file path is passed as $1 (sh sets $0='sh',
        // $1=path) so no runtime value is ever interpolated into the command.
        Cmd: ['sh', '-c', KILL_SCRIPT, 'sh', this._pgidFile],
        AttachStdout: false,
        AttachStderr: false,
      });
      const killStream = await killExec.start({});

      try {
        // Exec.start() resolves when the exec stream is opened, not when the
        // helper script exits. Poll inspect() until it finishes so we only report
        // success once the process tree has actually been killed — otherwise
        // wait() could resolve with exit 137 while targets are still running.
        let killInfo = await killExec.inspect();
        while (killInfo.Running) {
          await new Promise(resolve => setTimeout(resolve, 10));
          killInfo = await killExec.inspect();
        }
        if (killInfo.ExitCode !== 0) {
          throw new Error(`kill helper exited with code ${killInfo.ExitCode}`);
        }

        // Only publish termination metadata after the helper confirms the group
        // is gone. Settling before destroying the stream keeps an early stream
        // 'end' event from resolving wait() without that metadata.
        this._killed = true;
        this._setExitCode(137);
        this._settle(this._buildResult(137, { killed: true, timedOut: this._timedOut }));
        // Docker exec streams don't close automatically when the process is killed externally.
        this._destroyStream();
        return true;
      } finally {
        killStream.destroy();
      }
    } catch (error: unknown) {
      // ESRCH / "no such process" is expected if the process exited between inspect and kill
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (!msg.includes('no such process') && !msg.includes('esrch')) {
        // Unexpected error — not fatal but worth noting for debugging
        console.warn(`[DockerProcessManager] kill(${this.pid}) failed unexpectedly:`, error);
      }
      return false;
    } finally {
      if (!this._settled) {
        this._terminationPromise = null;
      }
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

    // Private file (unguessable name) where the command's process group records
    // its PGID, so kill() can signal the whole kernel-owned group later.
    const pgidFile = `${PROC_DIR}/${randomUUID()}`;
    const envArray = Object.entries({ ...options.env })
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([k, v]) => `${k}=${v}`);

    // `stdinMode: 'ignore'` leaves stdin unattached so the command sees EOF. A
    // command that reads stdin (a bare `rg`/`grep`/`cat` with no path argument)
    // blocks forever when stdin is attached but nothing ever writes to it.
    const attachStdin = options.stdinMode !== 'ignore';

    // Create exec instance. The command is wrapped so it runs in its own process
    // group (via setsid) and records its PGID; args travel positionally so the
    // wrapper text stays a static constant.
    const exec = await container.exec({
      Cmd: ['sh', '-c', SPAWN_WRAPPER, 'sh', pgidFile, command],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: attachStdin,
      Tty: false,
      Env: envArray.length > 0 ? envArray : undefined,
      WorkingDir: options.cwd,
    });

    // Start exec and get the multiplexed stream
    const stream = await exec.start({ hijack: true, stdin: attachStdin });

    const startTime = Date.now();
    // A null stdin stream makes sendStdin/closeStdin report the process was not
    // started with stdin support, matching `stdinMode: 'ignore'`.
    const handle = new DockerProcessHandle(exec, container, startTime, attachStdin ? stream : null, pgidFile, options);
    handle._setExecStream(stream);

    // Create the wait promise that resolves when the stream ends
    const waitPromise = new Promise<CommandResult>(resolve => {
      handle._setWaitResolver(resolve);

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
        // Get exit code from exec inspect. Settlement is coordinated through
        // the handle so a kill helper that is still confirming termination can
        // win the race without losing killed/timedOut metadata.
        let exitCode = 1;
        try {
          const info = await exec.inspect();
          exitCode = info.ExitCode ?? 1;
        } catch {
          exitCode = 1;
        }
        await handle._settleAfterStreamEnd(exitCode);
      });

      // 'close' fires when stream.destroy() is called (e.g., from kill or timeout).
      stream.on('close', () => {
        handle._settleOnClose();
      });

      stream.on('error', () => {
        handle._settleStreamError();
      });
    });

    // Wire up timeout: kill the process and destroy the stream after the timeout period.
    // Per-spawn timeout takes precedence; falls back to the sandbox-level default.
    const resolvedTimeout = options.timeout ?? this._defaultTimeout;
    if (resolvedTimeout > 0) {
      const timeoutMs = resolvedTimeout;
      const timer = setTimeout(() => {
        if (handle.exitCode === undefined && !handle._isSettled()) {
          handle._markTimedOut();
          // Await kill() so the process tree is actually terminated before the
          // stream is torn down. Destroying the stream first would resolve
          // wait() with exit 137 while the targets are still running — the exact
          // bug this fix addresses. Only force-destroy the stream if kill()
          // fails to make progress, as a last resort to unblock wait().
          const forceClose = () => {
            handle._settleTimeoutFallback();
            handle._destroyStream();
          };
          handle
            .kill()
            .then(killed => {
              if (!killed) forceClose();
            })
            .catch(forceClose);
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
