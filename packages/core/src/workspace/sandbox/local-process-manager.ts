/**
 * Local Process Manager
 *
 * Local implementation of SandboxProcessManager using execa.
 * Tracks processes in-memory since there's no server to query.
 */

import * as path from 'node:path';

import type { ResultPromise, Options as ExecaOptions } from 'execa';

import { getExeca } from './execa';
import type { LocalSandbox } from './local-sandbox';
import { ProcessHandle, SandboxProcessManager } from './process-manager';
import type { ProcessInfo, SpawnProcessOptions } from './process-manager';
import type { CommandResult } from './types';

const isWindows = process.platform === 'win32';

// =============================================================================
// Local Process Handle
// =============================================================================

/**
 * Local implementation of ProcessHandle wrapping an execa subprocess.
 * Not exported — internal to this module.
 */
class LocalProcessHandle extends ProcessHandle {
  readonly pid: string;
  exitCode: number | undefined;

  private readonly _numericPid: number;
  private subprocess: ResultPromise;
  private readonly waitPromise: Promise<CommandResult>;
  private readonly startTime: number;

  constructor(subprocess: ResultPromise, pid: number, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    this.pid = String(pid);
    this._numericPid = pid;
    this.subprocess = subprocess;
    this.startTime = startTime;

    let timedOut = false;
    const timeoutId = options?.timeout
      ? setTimeout(() => {
          timedOut = true;
          // Kill the entire process tree so child processes are also terminated.
          // We handle timeout ourselves rather than using execa's timeout option
          // because execa only kills the direct subprocess, not the process tree.
          void killProcessTree(this._numericPid, subprocess, 'SIGTERM');
        }, options.timeout)
      : undefined;

    this.waitPromise = new Promise<CommandResult>(resolve => {
      subprocess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (timedOut) {
          const timeoutMsg = `\nProcess timed out after ${options!.timeout}ms`;
          this.emitStderr(timeoutMsg);
          this.exitCode = 124;
        } else {
          this.exitCode = signal && code === null ? 128 : (code ?? 0);
        }
        resolve({
          success: this.exitCode === 0,
          exitCode: this.exitCode!,
          stdout: this.stdout,
          stderr: this.stderr,
          executionTimeMs: Date.now() - this.startTime,
          killed: signal !== null,
          timedOut,
        });
      });

      subprocess.on('error', (err: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.emitStderr(err.message);
        this.exitCode = 1;
        resolve({
          success: false,
          exitCode: 1,
          stdout: this.stdout,
          stderr: this.stderr,
          executionTimeMs: Date.now() - this.startTime,
        });
      });
    });

    subprocess.stdout?.on('data', (data: Buffer) => {
      this.emitStdout(data.toString());
    });

    subprocess.stderr?.on('data', (data: Buffer) => {
      this.emitStderr(data.toString());
    });
  }

  async wait(): Promise<CommandResult> {
    return this.waitPromise;
  }

  async kill(): Promise<boolean> {
    if (this.exitCode !== undefined) return false;
    // Kill the entire process tree to ensure child processes spawned by the
    // shell are also terminated. Without this, commands like
    // "echo foo; sleep 60" would leave orphaned children holding stdio open.
    await killProcessTree(this._numericPid, this.subprocess, 'SIGKILL');
    return true;
  }

  async sendStdin(data: string): Promise<void> {
    if (this.exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this.exitCode}`);
    }
    if (!this.subprocess.stdin) {
      throw new Error(`Process ${this.pid} does not have stdin available`);
    }
    return new Promise<void>((resolve, reject) => {
      this.subprocess.stdin!.write(data, (err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });
  }
}

// =============================================================================
// Process Tree Killing
// =============================================================================

/**
 * Kill a process and all its children.
 *
 * On Unix, we use process groups (negative PID) since processes are spawned
 * with `detached: true` which creates a new process group.
 *
 * On Windows, `process.kill(-pid)` doesn't work (no process groups), and
 * `detached: true` opens a new console window. Instead we use `taskkill /T`
 * which recursively kills the process tree by PID.
 */
async function killProcessTree(pid: number, subprocess: ResultPromise, signal: NodeJS.Signals): Promise<void> {
  if (isWindows) {
    try {
      // /T = kill child processes, /F = force, /PID = target process
      const execa = await getExeca();
      await execa('taskkill', ['/T', '/F', '/PID', String(pid)], { reject: false, stdio: 'ignore' });
    } catch {
      // taskkill binary not found — fall back to direct kill
      subprocess.kill(signal);
    }
  } else {
    try {
      process.kill(-pid, signal);
    } catch {
      subprocess.kill(signal);
    }
  }
}

// =============================================================================
// Local Process Manager
// =============================================================================

/**
 * Local implementation of SandboxProcessManager.
 * Spawns processes via execa and tracks them in-memory.
 */
export class LocalProcessManager extends SandboxProcessManager<LocalSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    let cwd = this.sandbox.workingDirectory;
    if (options.cwd) {
      if (path.isAbsolute(options.cwd)) {
        cwd = options.cwd;
      } else {
        // Prevent duplicate nesting when agent passes cwd that's already workspace-relative
        const normalizedWorkingDir = path.resolve(this.sandbox.workingDirectory);
        const normalizedOptionsCwd = path.resolve(options.cwd);
        // Check if path is already under workspace (exact match or nested subpath)
        const isAlreadyWorkspacePath =
          normalizedOptionsCwd === normalizedWorkingDir ||
          normalizedOptionsCwd.startsWith(`${normalizedWorkingDir}${path.sep}`);

        cwd = isAlreadyWorkspacePath ? normalizedOptionsCwd : path.resolve(this.sandbox.workingDirectory, options.cwd);
      }
    }
    const env = this.sandbox.buildEnv(options.env);
    const wrapped = this.sandbox.wrapCommandForIsolation(command);

    // Base options shared across all platforms.
    const baseOptions = {
      cwd,
      env,
      stdio: 'pipe' as const,
      // Don't throw on non-zero exit — we handle exit codes ourselves.
      reject: false,
      // Don't buffer output — we stream it via ProcessHandle callbacks.
      buffer: false,
      // Don't strip newlines — preserve raw output for ProcessHandle accumulation.
      stripFinalNewline: false,
      // Don't extend process.env — the sandbox controls the full environment via buildEnv().
      extendEnv: false,
    };

    let execaOptions: ExecaOptions;

    if (isWindows) {
      // On Windows, `detached: true` opens a new console window (visible cmd.exe
      // popup) and breaks stdout/stderr piping. `shell: true` without `detached`
      // works correctly — it uses cmd.exe for shell interpretation and pipes
      // stdout/stderr back to the parent process without any visible window.
      //
      // Process tree killing uses `taskkill /T` instead of Unix process groups.
      execaOptions = {
        ...baseOptions,
        shell: this.sandbox.isolation === 'none',
      };
    } else {
      // On Unix, `detached: true` creates a new process group so we can kill the
      // entire tree via `process.kill(-pid, signal)`.
      //
      // Non-isolated: use shell mode so the host shell interprets the command string
      // (pipes, redirects, chaining, etc.). Isolated (seatbelt/bwrap): the wrapper
      // already includes `sh -c` inside the sandbox, so we spawn the wrapper directly.
      execaOptions = {
        ...baseOptions,
        detached: true,
        shell: this.sandbox.isolation === 'none',
      };
    }

    const execa = await getExeca();
    const subprocess = execa(wrapped.command, wrapped.args, execaOptions);

    // execa sets pid synchronously when the process spawns successfully.
    // If pid is undefined, the spawn failed (bad cwd, missing command, etc.).
    // Await the subprocess to get execa's detailed error message.
    if (!subprocess.pid) {
      const result = await subprocess;
      throw new Error(result.message || 'Process failed to spawn');
    }

    const handle = new LocalProcessHandle(subprocess, subprocess.pid, Date.now(), options);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._tracked.values()).map(handle => ({
      pid: handle.pid,
      running: handle.exitCode === undefined,
      exitCode: handle.exitCode,
    }));
  }
}
