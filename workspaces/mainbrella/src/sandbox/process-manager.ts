import { setTimeout as delay } from 'node:timers/promises';

import { MainbrellaError, terminalExecutionStates } from '@mainbrella/sdk';
import type { Execution, ExecutionRecord } from '@mainbrella/sdk';
import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';

import type { MainbrellaSandbox } from './index';

function exitCode(record: Pick<ExecutionRecord, 'status' | 'exitCode'>): number {
  if (record.status === 'timed_out') return 124;
  if (record.status === 'canceled') return 137;
  return record.exitCode ?? 1;
}

class MainbrellaProcessHandle extends ProcessHandle {
  readonly pid: string;
  private record?: ExecutionRecord;
  private readonly completion: Promise<void>;
  private readonly streamAbort = new AbortController();
  private readonly startedAt = Date.now();

  constructor(
    private readonly execution: Execution,
    options: SpawnProcessOptions,
    private readonly streaming: boolean,
    private readonly stdin: boolean,
    initialRecord?: ExecutionRecord,
  ) {
    super(options);
    this.pid = execution.id;
    if (initialRecord && terminalExecutionStates.has(initialRecord.status)) {
      this.record = initialRecord;
      this.emitStdout(initialRecord.stdout);
      this.emitStderr(initialRecord.stderr);
      this.completion = Promise.resolve();
    } else {
      this.completion = this.observe();
    }
    // A spawned job can outlive the caller. Keep failures available to wait()
    // without an unhandled rejection when nobody is currently waiting.
    void this.completion.catch(() => {});
  }

  get exitCode(): number | undefined {
    return this.record ? exitCode(this.record) : undefined;
  }

  override get stdoutTruncated(): boolean {
    return super.stdoutTruncated || this.record?.outputTruncated === true;
  }

  override get stderrTruncated(): boolean {
    return super.stderrTruncated || this.record?.outputTruncated === true;
  }

  private async observe(): Promise<void> {
    if (this.streaming) {
      let failures = 0;
      while (!this.streamAbort.signal.aborted) {
        try {
          for await (const event of this.execution.events({ signal: this.streamAbort.signal })) {
            failures = 0;
            if (event.type === 'stdout') this.emitStdout(event.data);
            else if (event.type === 'stderr') this.emitStderr(event.data);
          }
          break;
        } catch (error) {
          if (this.streamAbort.signal.aborted) throw new MainbrellaError('execution_detached');
          // Resume the SAME job at the SDK's last received cursor. Never start
          // the command again after a dropped connection.
          if (!(error instanceof MainbrellaError) || error.status >= 400 || ++failures > 3) throw error;
          await delay(250 * failures, undefined, { signal: this.streamAbort.signal });
        }
      }
    }
    if (this.streamAbort.signal.aborted) throw new MainbrellaError('execution_detached');
    let record = await this.execution.get();
    if (!this.streaming) {
      while (!terminalExecutionStates.has(record.status)) {
        await delay(250, undefined, { signal: this.streamAbort.signal });
        record = await this.execution.get();
      }
    }
    if (!terminalExecutionStates.has(record.status)) throw new MainbrellaError('execution_incomplete');
    if (!this.streaming) {
      this.emitStdout(record.stdout);
      this.emitStderr(record.stderr);
    }
    this.record = record;
  }

  async wait(): Promise<CommandResult> {
    await this.completion;
    const record = this.record!;
    return {
      success: record.status === 'succeeded' && record.exitCode === 0 && !record.timedOut && !record.outputTruncated,
      exitCode: exitCode(record),
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: Date.now() - this.startedAt,
      timedOut: record.timedOut || record.status === 'timed_out',
      killed: record.status === 'canceled' || record.status === 'interrupted',
    };
  }

  async kill(): Promise<boolean> {
    if (this.record) return false;
    const result = await this.execution.cancel();
    return result.status === 'canceled' || !terminalExecutionStates.has(result.status);
  }

  async sendStdin(data: string): Promise<void> {
    if (!this.stdin) throw new Error('This Mainbrella process was started without stdin support');
    // Input is not idempotent. The SDK sends it once and surfaces uncertainty.
    await this.execution.stdin.write(Buffer.from(data));
  }

  async closeStdin(): Promise<void> {
    if (!this.stdin) throw new Error('This Mainbrella process was started without stdin support');
    await this.execution.stdin.close();
  }

  detach(): void {
    this.streamAbort.abort();
  }
}

/** Managed Mainbrella jobs; IDs are execution UUIDs, not guest operating system PIDs. */
export class MainbrellaProcessManager extends SandboxProcessManager<MainbrellaSandbox> {
  constructor(private readonly options: { defaultTimeout: number } = { defaultTimeout: 30_000 }) {
    super();
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    options.abortSignal?.throwIfAborted();
    const capabilities = await this.sandbox.getCapabilities();
    const timeoutMs = options.timeout ?? this.options.defaultTimeout;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > capabilities.execution.maxManagedTimeoutMs) {
      throw new RangeError(`Mainbrella timeout must be between 1 and ${capabilities.execution.maxManagedTimeoutMs}`);
    }
    const stdin = options.stdinMode !== 'ignore';
    if (stdin && !capabilities.execution.stdin) throw new MainbrellaError('stdin_unavailable');
    const invocation = options.originalInvocation;
    if (invocation && !capabilities.execution.argv) throw new MainbrellaError('argv_unavailable');
    const env = Object.fromEntries(
      Object.entries(options.env ?? {}).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    const execution = await this.sandbox.mainbrella.commands.start(
      invocation ? [invocation.command, ...invocation.args] : command,
      { timeoutMs, stdin, cwd: options.cwd ?? this.sandbox.workingDirectory, env },
    );
    const handle = new MainbrellaProcessHandle(
      execution,
      options,
      capabilities.execution.streaming && capabilities.execution.reconnect,
      stdin,
    );
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    if (!(await this.sandbox.getCapabilities()).execution.managedProcessListing) {
      return Array.from(this._tracked.values(), handle => ({
        pid: handle.pid,
        command: handle.command,
        running: handle.exitCode === undefined,
        exitCode: handle.exitCode,
      }));
    }
    const { executions } = await this.sandbox.mainbrella.commands.list();
    return executions
      .filter(record => !this._dismissed.has(record.id))
      .map(record => ({
        pid: record.id,
        running: !terminalExecutionStates.has(record.status),
        exitCode: terminalExecutionStates.has(record.status) ? exitCode(record) : undefined,
        command: this._tracked.get(record.id)?.command,
      }));
  }

  async get(pid: string): Promise<ProcessHandle | undefined> {
    const tracked = this._tracked.get(pid);
    if (tracked) return tracked;
    const execution = this.sandbox.mainbrella.commands.attach(pid);
    let record: ExecutionRecord;
    try {
      record = await execution.get();
    } catch (error) {
      if (error instanceof MainbrellaError && error.code === 'execution_not_found') return undefined;
      throw error;
    }
    const capabilities = await this.sandbox.getCapabilities();
    const handle = new MainbrellaProcessHandle(
      execution,
      {},
      capabilities.execution.streaming && capabilities.execution.reconnect,
      record.stdinEnabled === true && capabilities.execution.stdin,
      record,
    );
    this._tracked.set(pid, handle);
    return handle;
  }

  /** Detach local streams after generation-qualified container cleanup. */
  detach(): void {
    for (const handle of this._tracked.values()) {
      if (handle instanceof MainbrellaProcessHandle) handle.detach();
    }
    this._tracked.clear();
    this._dismissed.clear();
  }
}
