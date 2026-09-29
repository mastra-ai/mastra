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

/**
 * Upper bound on how long an early stream 'end' waits for an in-flight kill
 * confirmation before settling without termination metadata. The kill helper's
 * own work is bounded (the KILL_SCRIPT polls for at most ~4s), so this only
 * absorbs daemon round-trips; it exists so a wedged `inspect()` cannot leave
 * wait() pending forever.
 */
const TERMINATION_CONFIRMATION_DEADLINE_MS = 10_000;

/**
 * Resolves when `termination` settles, or after
 * TERMINATION_CONFIRMATION_DEADLINE_MS — whichever comes first. Never rejects.
 */
function waitForTermination(termination: Promise<boolean>): Promise<void> {
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, TERMINATION_CONFIRMATION_DEADLINE_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    termination.then(done, done);
  });
}

/**
 * Resolves with `work`'s value, or `fallback` if it has not settled within `ms`.
 * Never rejects. Bounds a single daemon round-trip, so one call that never
 * answers cannot leave wait() pending past its deadline.
 */
function withDeadline<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(fallback), Math.max(0, ms));
    const done = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    work.then(done, () => done(fallback));
  });
}

/**
 * Polls `exec.inspect()` until the exec reports it is no longer running, bounded
 * by `deadline` (an absolute `Date.now()` timestamp). A stream can close without
 * 'end' while the process is still alive, and settling from inspect then would
 * publish an exit for a process that never exited — but waiting unbounded could
 * leave wait() pending forever, so each call is bounded too. Returns the last
 * inspect result, which may still report Running: true if the bound was reached,
 * or undefined if no call settled in time.
 */
async function waitForExecToStop(exec: Exec, deadline: number): Promise<ExecInspectInfo | undefined> {
  let info: ExecInspectInfo | undefined;
  while (Date.now() < deadline) {
    info = await withDeadline<ExecInspectInfo | undefined>(exec.inspect(), deadline - Date.now(), undefined);
    if (!info || !info.Running) return info;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return info;
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
  /**
   * @internal In-flight kill confirmation, set while kill() is verifying the
   * process group is gone. An early stream 'end' awaits it (bounded) so
   * termination metadata is not dropped when the target's stream closes first.
   */
  _terminationPromise: Promise<boolean> | null = null;
  private _waitPromise: Promise<CommandResult> | null = null;
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

    // A kill already in flight owns the confirmation for this process, so share
    // it instead of starting a second helper. Otherwise the second helper
    // replaces `_terminationPromise` and clears it once it settles, leaving an
    // early stream 'end' nothing to await while the first helper is still
    // running — it would settle as a natural exit, and the first helper's later
    // success could no longer correct a result that already reported one.
    if (this._terminationPromise) return this._terminationPromise;

    // Publish the in-flight confirmation before awaiting it. Killing the target
    // tears its own exec stream down, so an early stream 'end' may arrive while
    // this is still running — it waits on this promise instead of settling as if
    // the command had exited on its own.
    const termination = this._runKillHelper();
    this._terminationPromise = termination;
    try {
      return await termination;
    } finally {
      if (this._terminationPromise === termination) this._terminationPromise = null;
    }
  }

  /**
   * Runs the kill helper and verifies the process group is gone before reporting
   * success, so a `true` result means the targets have actually stopped.
   */
  private async _runKillHelper(): Promise<boolean> {
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

        // Mark as killed and destroy stream so wait() resolves.
        // Docker exec streams don't close automatically when the process is killed externally.
        this._killed = true;
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

      // Every stream event settles through here and only the first one wins.
      // Previously 'end' resolved first and 'close' — the only path that attached
      // `killed`/`timedOut` — bailed out because the exit code was already set, so
      // a kill that tore the stream down before confirming termination produced a
      // result indistinguishable from a natural exit.
      let settled = false;
      const settle = (exitCode: number, metadata: Partial<CommandResult> = {}) => {
        if (settled) return;
        settled = true;
        handle._setExitCode(exitCode);
        resolve({
          success: exitCode === 0,
          exitCode,
          stdout: handle.stdout,
          stderr: handle.stderr,
          executionTimeMs: Date.now() - startTime,
          ...metadata,
        });
      };

      // Termination metadata rides on whichever path settles first, so a killed
      // process never looks like a natural exit. It is read from the handle, which
      // only records termination once the kill helper confirmed it (or the timeout
      // path forced the stream closed).
      const settleTerminated = () => {
        settle(137, { killed: true, timedOut: handle._timedOut }); // 137 = SIGKILL
      };

      stream.on('end', async () => {
        // Killing the target tears its own exec stream down, so 'end' can arrive
        // while kill() is still confirming the process group is gone. Wait for that
        // confirmation (bounded) before settling: settling now would publish a
        // termination-free result and disarm 'close', the only other path carrying
        // `killed`. The wait is unconditional — the timeout path records `_killed`
        // optimistically before asking kill() to confirm, so gating on it would let
        // this settle while the kill helper is still running and a failed
        // confirmation could no longer be reflected.
        if (handle._terminationPromise) {
          await waitForTermination(handle._terminationPromise);
        }
        if (settled) return;

        if (handle._killed) {
          settleTerminated();
          return;
        }

        // Natural exit — get exit code from exec inspect
        try {
          const info = await exec.inspect();
          settle(info.ExitCode ?? 1);
        } catch {
          settle(1);
        }
      });

      // 'close' fires both on a natural stream end and when kill()/timeout tears the
      // stream down. Wait for any in-flight termination confirmation first — the
      // timeout path records `_killed` before kill() confirms, so settling here
      // without waiting would publish the result while the helper is still running.
      // The wait is unconditional (like 'end'/'error') rather than gated on
      // `_killed`, so a close that races an unconfirmed kill still observes the
      // final state instead of returning while the confirmation is pending.
      stream.on('close', async () => {
        // One deadline covers the whole path, so waiting on an in-flight kill
        // confirmation cannot stack on top of a fresh exec poll: the bound the
        // settlement is documented to have is the bound it actually has.
        const deadline = Date.now() + TERMINATION_CONFIRMATION_DEADLINE_MS;
        if (handle._terminationPromise) {
          await waitForTermination(handle._terminationPromise);
        }
        if (settled) return;

        if (handle._killed) {
          settleTerminated();
          return;
        }

        // Docker multiplexed streams normally emit 'end' before 'close' for natural
        // exits, but a stream torn down by other means may close without one. A
        // closed stream does not mean the exec finished, though, so poll (bounded)
        // while it is still running rather than publishing an exit for a live
        // process; settle afterwards so wait() cannot hang once the bound elapses.
        try {
          const info = await waitForExecToStop(exec, deadline);
          if (settled) return;
          // A termination can land while the poll is running (a timeout path records
          // `_killed` before kill() confirms, and kill() itself sets it once the
          // helper has verified the process group is gone). Report the termination
          // rather than a bare exit code, or the result drops `killed`/`timedOut`.
          if (handle._killed) {
            settleTerminated();
            return;
          }
          settle(info?.ExitCode ?? 1);
        } catch {
          settle(1);
        }
      });

      stream.on('error', async () => {
        // Tearing the hijacked exec socket down can surface as a stream error
        // (ECONNRESET) rather than 'end'. Same rule as 'end': a kill that is still
        // confirming must be awaited (bounded) before this settles, otherwise the
        // error path publishes an exit-1 result with no `killed`/`timedOut` and the
        // later 'close' settlement has nothing left to correct.
        if (handle._terminationPromise) {
          await waitForTermination(handle._terminationPromise);
        }
        if (settled) return;

        if (handle._killed) {
          settleTerminated();
          return;
        }
        settle(1, { stderr: handle.stderr || 'Stream error' });
      });
    });

    // Wire up timeout: kill the process and destroy the stream after the timeout period.
    // Per-spawn timeout takes precedence; falls back to the sandbox-level default.
    const resolvedTimeout = options.timeout ?? this._defaultTimeout;
    if (resolvedTimeout > 0) {
      const timeoutMs = resolvedTimeout;
      const timer = setTimeout(() => {
        if (handle.exitCode === undefined) {
          // Record the timeout kill up front so the 'close' settlement that
          // follows _destroyStream() carries the metadata. The kill confirmation
          // is still in flight here, which is safe now that 'end' and 'error'
          // await it before settling — a helper that fails is followed by
          // forceClose(), which keeps this flag and tears the stream down anyway.
          handle._killed = true;
          handle._timedOut = true;
          // Await kill() so the process tree is actually terminated before the
          // stream is torn down. Destroying the stream first would resolve
          // wait() with exit 137 while the targets are still running — the exact
          // bug this fix addresses. Only force-destroy the stream if kill()
          // fails to make progress, as a last resort to unblock wait().
          const forceClose = () => {
            if (handle.exitCode === undefined) {
              handle._killed = true;
              handle._destroyStream();
            }
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
