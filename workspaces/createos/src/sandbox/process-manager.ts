import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import { CreateosSandboxNotFoundError } from '@nodeops-createos/sandbox';
import type { ManagedProcess, Sandbox, SandboxProcesses } from '@nodeops-createos/sandbox';

import { buildProcessInvocation } from '../utils/shell';
import type { CreateOSSandbox } from './index';

class CreateOSProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly processes: SandboxProcesses;
  private readonly startedAt: number;
  private readonly timeout?: number;
  private _exitCode: number | undefined;
  private _killed = false;
  private _waitPromise: Promise<CommandResult> | undefined;
  private readonly streamPromise: Promise<void>;

  constructor(process: ManagedProcess, sandbox: Sandbox, options: SpawnProcessOptions = {}) {
    super(options);
    this.pid = process.process_id;
    this.processes = sandbox.processes;
    this.startedAt = Date.now();
    this.timeout = options.timeout;
    this._exitCode = process.exit_code ?? undefined;
    this.streamPromise = this.consumeOutput();
    // Background processes may not be awaited immediately. Mark the stream
    // rejection as handled here; wait() still observes and rethrows it.
    void this.streamPromise.catch(() => {});
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  private async consumeOutput(): Promise<void> {
    try {
      for await (const event of this.processes.connect(this.pid)) {
        if (event.type === 'data') {
          if (event.stream === 'stderr') this.emitStderr(event.data);
          else this.emitStdout(event.data);
        } else if (event.type === 'exit') {
          this._exitCode = event.exitCode ?? (event.signal ? 137 : 0);
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }
    } catch (error) {
      if (!this._killed && !(error instanceof CreateosSandboxNotFoundError)) throw error;
    }
  }

  async wait(): Promise<CommandResult> {
    this._waitPromise ??= this.waitForExit();
    return this._waitPromise;
  }

  private async waitForExit(): Promise<CommandResult> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      if (this.timeout) {
        await Promise.race([
          this.streamPromise,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('MASTRA_CREATEOS_PROCESS_TIMEOUT')), this.timeout);
          }),
        ]);
      } else {
        await this.streamPromise;
      }

      if (this._exitCode === undefined) {
        const process = await this.processes.wait(this.pid, { scope: 'tree' });
        this._exitCode = process.exit_code ?? (process.signal ? 137 : 0);
      }

      return {
        success: this._exitCode === 0,
        exitCode: this._exitCode ?? 1,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this.startedAt,
        ...(this._killed && { killed: true }),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'MASTRA_CREATEOS_PROCESS_TIMEOUT') {
        await this.kill();
        this._exitCode = 124;
        return {
          success: false,
          exitCode: 124,
          stdout: this.stdout,
          stderr: this.stderr || `Command timed out after ${this.timeout}ms`,
          executionTimeMs: Date.now() - this.startedAt,
          killed: true,
          timedOut: true,
        };
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;
    this._killed = true;
    try {
      await this.processes.delete(this.pid, { graceMs: 0 });
    } catch (error) {
      if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
      return false;
    }
    this._exitCode = 137;
    return true;
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    await this.processes.input(this.pid, data);
  }

  async closeStdin(): Promise<void> {
    if (this._exitCode !== undefined) return;
    await this.processes.closeStdin(this.pid);
  }
}

export interface CreateOSProcessManagerOptions {
  defaultTimeout?: number;
}

export class CreateOSProcessManager extends SandboxProcessManager<CreateOSSandbox> {
  private readonly defaultTimeout?: number;

  constructor(options: CreateOSProcessManagerOptions = {}) {
    super();
    this.defaultTimeout = options.defaultTimeout;
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const effectiveOptions: SpawnProcessOptions = {
      ...options,
      timeout: options.timeout ?? this.defaultTimeout,
      cwd: options.cwd ?? this.sandbox.workingDirectory,
    };
    const invocation = buildProcessInvocation(command, effectiveOptions);
    const { process, sandbox } = await this.sandbox.retryOnDead(async sandbox => ({
      process: await sandbox.processes.create({ ...invocation }),
      sandbox,
    }));
    const handle = new CreateOSProcessHandle(process, sandbox, effectiveOptions);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    const { processes } = await this.sandbox.createos.processes.list();
    return processes.map(process => ({
      pid: process.process_id,
      command: process.cmd ? [process.cmd, ...(process.args ?? [])].join(' ') : undefined,
      running: process.state === 'starting' || process.state === 'running' || process.state === 'terminating',
      exitCode: process.exit_code ?? undefined,
    }));
  }

  override async get(pid: string): Promise<ProcessHandle | undefined> {
    const tracked = await super.get(pid);
    if (tracked) return tracked;
    try {
      const process = await this.sandbox.createos.processes.get(pid);
      const handle = new CreateOSProcessHandle(process, this.sandbox.createos);
      this._tracked.set(pid, handle);
      return handle;
    } catch (error) {
      if (error instanceof CreateosSandboxNotFoundError) return undefined;
      throw error;
    }
  }
}
