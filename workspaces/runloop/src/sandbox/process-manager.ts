/**
 * Runloop Devbox process manager — wraps cmd.execAsync and Execution.result/kill.
 * Stdin uses api.devboxes.executions.sendStdIn; OO Execution has no sendStdin helper.
 */

import {
  ProcessHandle,
  SandboxProcessManager
  
  
  
} from '@mastra/core/workspace';
import type {CommandResult, ProcessInfo, SpawnProcessOptions} from '@mastra/core/workspace';
import type { Execution, Runloop } from '@runloop/api-client';

import { shellQuote } from '../utils/shell-quote';
import type { RunloopSandbox } from './runloop-sandbox';

function wrapCommand(command: string, options: SpawnProcessOptions): string {
  let cmd = command;
  const env = options.env;
  if (env && Object.keys(env).length > 0) {
    const parts = Object.entries(env)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .map(([k, v]) => `export ${k}=${shellQuote(v)}`);
    cmd = `${parts.join(' && ')} && ${cmd}`;
  }
  if (options.cwd) {
    cmd = `cd ${shellQuote(options.cwd)} && ${cmd}`;
  }
  return cmd;
}

class RunloopProcessHandle extends ProcessHandle {
  readonly pid: string;

  private _exitCode: number | undefined;
  private readonly _execution: Execution;
  private readonly _devboxId: string;
  private readonly _api: Runloop;
  private readonly _startTime: number;
  private readonly _spawnOptions?: SpawnProcessOptions;
  private _waitPromise: Promise<CommandResult> | undefined;

  constructor(
    api: Runloop,
    devboxId: string,
    execution: Execution,
    startTime: number,
    spawnOptions?: SpawnProcessOptions,
  ) {
    super(spawnOptions);
    this._api = api;
    this._devboxId = devboxId;
    this._execution = execution;
    this._startTime = startTime;
    this._spawnOptions = spawnOptions;
    this.pid = execution.executionId;
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  async wait(): Promise<CommandResult> {
    if (this._waitPromise) {
      return this._waitPromise;
    }

    this._waitPromise = (async (): Promise<CommandResult> => {
      const timeoutMs = this._spawnOptions?.timeout ?? 300_000;
      const result = await this._execution.result({
        longPoll: { timeoutMs },
        signal: this._spawnOptions?.abortSignal ?? undefined,
      });

      this._exitCode = result.exitCode ?? (result.success ? 0 : 1);
      const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);

      return {
        success: result.success,
        exitCode: this._exitCode,
        stdout,
        stderr,
        executionTimeMs: Date.now() - this._startTime,
      };
    })();

    return this._waitPromise;
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;
    try {
      await this._execution.kill();
      return true;
    } catch {
      return false;
    }
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    await this._api.devboxes.executions.sendStdIn(this._devboxId, this.pid, { text: data });
  }
}

export class RunloopProcessManager extends SandboxProcessManager<RunloopSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    return this.sandbox.retryOnDead(async () => {
      await this.sandbox.ensureRunning();
      const devbox = this.sandbox.getRunloopDevbox();

      const mergedOpts: SpawnProcessOptions = {
        ...options,
        timeout: options.timeout ?? this.sandbox.defaultCommandTimeout,
      };

      const mergedEnv = { ...this.env, ...mergedOpts.env };
      const envOnly: Record<string, string> = {};
      for (const [k, v] of Object.entries(mergedEnv)) {
        if (typeof v === 'string') envOnly[k] = v;
      }
      const wrapped = wrapCommand(command, { ...mergedOpts, env: envOnly });
      const start = Date.now();

      // Deferred reference — Runloop delivers streaming data asynchronously after
      // execAsync resolves, so handle is always assigned by the time callbacks fire.
      let handle: RunloopProcessHandle;

      const execution = await devbox.cmd.execAsync(wrapped, {
        attach_stdin: true,
        stdout: (line: string) => handle.emitStdout(line),
        stderr: (line: string) => handle.emitStderr(line),
      });

      handle = new RunloopProcessHandle(this.sandbox.runloopApi, devbox.id, execution, start, mergedOpts);
      handle.command = command;
      this._tracked.set(handle.pid, handle);

      const abortSignal = mergedOpts.abortSignal;
      if (abortSignal) {
        const onAbort = () => {
          handle.kill().catch(() => {});
        };
        if (abortSignal.aborted) {
          onAbort();
        } else {
          abortSignal.addEventListener('abort', onAbort, { once: true });
          handle.wait().then(
            () => abortSignal.removeEventListener('abort', onAbort),
            () => abortSignal.removeEventListener('abort', onAbort),
          );
        }
      }

      return handle;
    });
  }

  /** Clear all tracked process handles (e.g. after devbox re-provisioning). */
  clearTracked(): void {
    this._tracked.clear();
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._tracked.values()).map((h: ProcessHandle) => ({
      pid: h.pid,
      command: h.command,
      running: h.exitCode === undefined,
      exitCode: h.exitCode,
    }));
  }
}
