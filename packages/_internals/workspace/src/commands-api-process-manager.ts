import { ProcessHandle, SandboxProcessManager, UnsupportedStdinCloseError } from '@mastra/core/workspace';
import type { CommandResult, MastraSandbox, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';

/** A command as E2B's envd commands API reports it (`CommandHandle`), reduced to what is used here. */
export interface CommandsApiHandle {
  readonly pid: number;
  /** `undefined` while the command runs. */
  readonly exitCode?: number;
  /** Resolves on exit 0; rejects with a `CommandExitError`-shaped error otherwise. */
  wait(): Promise<{ exitCode: number }>;
}

export interface CommandsApiStreamOptions {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  timeoutMs?: number;
}

/** The envd commands calls the process manager makes (E2B's `sandbox.commands`). */
export interface CommandsApi {
  run(
    command: string,
    opts: CommandsApiStreamOptions & {
      background: true;
      stdin?: boolean;
      cwd?: string;
      envs?: Record<string, string>;
    },
  ): Promise<CommandsApiHandle>;
  connect(pid: number, opts?: CommandsApiStreamOptions): Promise<CommandsApiHandle>;
  /** Running commands only. */
  list(): Promise<Array<{ pid: number; cmd: string; args: string[] }>>;
  kill(pid: number): Promise<boolean>;
  sendStdin(pid: number, data: string): Promise<void>;
}

/**
 * Attaching sets no deadline of its own: without one the SDK cuts the stream
 * after 60s, and the process's own timeout was set when it was spawned.
 */
export const ATTACH_TIMEOUT_MS = 0;

/** envd runs every command as `/bin/bash -l -c <command>`; show the command itself. */
function commandOf(proc: { cmd: string; args: string[] }): string {
  const [flag, c, command] = proc.args;
  if (proc.cmd === '/bin/bash' && flag === '-l' && c === '-c' && command !== undefined && proc.args.length === 3) {
    return command;
  }
  return [proc.cmd, ...proc.args].join(' ');
}

export type CommandsApiOperation = 'spawn' | 'list' | 'connect' | 'kill' | 'sendStdin';

/**
 * A process started or attached through a {@link CommandsApi}. `kill` and
 * `sendStdin` go back through the manager, so they use whatever commands
 * handle the provider currently supplies.
 */
export class CommandsApiProcessHandle extends ProcessHandle {
  readonly pid: string;
  /** The exit code `wait()` saw, for a handle that doesn't update its own. */
  private waitedExitCode?: number;
  constructor(
    protected inner: CommandsApiHandle,
    protected readonly manager: CommandsApiProcessManager<any>,
    private readonly startTime: number,
    private readonly stdinMode: SpawnProcessOptions['stdinMode'],
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = String(inner.pid);
  }

  /** Read from the commands handle, so it reflects server-side state without `wait()`. */
  get exitCode(): number | undefined {
    return this.inner.exitCode ?? this.waitedExitCode;
  }

  /** Wait for the process to exit. Providers whose output stream can drop while the process runs override this. */
  protected waitForExit(): Promise<{ exitCode: number }> {
    return this.inner.wait();
  }

  async wait(): Promise<CommandResult> {
    try {
      const result = await this.waitForExit();
      this.waitedExitCode = result.exitCode;
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this.startTime,
      };
    } catch (error) {
      // A non-zero exit rejects with a CommandExitError (`exitCode` directly);
      // some errors also carry the output in `result`.
      const errorObj = error as {
        exitCode?: number;
        error?: string;
        stdout?: string;
        stderr?: string;
        result?: { exitCode: number; error?: string; stdout: string; stderr: string };
      };
      const reportedExitCode = errorObj.result?.exitCode ?? errorObj.exitCode;
      // Only an error carrying an exit code proves the process ended.
      if (reportedExitCode !== undefined) this.waitedExitCode = reportedExitCode;
      const exitCode = reportedExitCode ?? this.exitCode ?? 1;

      // If the stream callbacks were skipped, retain and dispatch the attached
      // output through the normal path so maxRetainedBytes still applies.
      const attachedStdout = errorObj.result?.stdout || errorObj.stdout;
      const attachedStderr = errorObj.result?.stderr || errorObj.stderr;
      if (!this.stdout && !this.stdoutTruncated && attachedStdout) this.emitStdout(attachedStdout);
      if (!this.stderr && !this.stderrTruncated && attachedStderr) this.emitStderr(attachedStderr);

      const stdout = this.stdout;
      const stderr = this.stderr;
      const terminalError =
        errorObj.result?.error || errorObj.error || (error instanceof Error ? error.message : String(error));
      const errorDetail = terminalError && !stderr.includes(terminalError) ? `Error: ${terminalError}` : '';

      return {
        success: false,
        exitCode,
        stdout,
        stderr: [stderr, errorDetail].filter(Boolean).join('\n'),
        executionTimeMs: Date.now() - this.startTime,
      };
    }
  }

  async kill(): Promise<boolean> {
    if (this.exitCode !== undefined) return false;
    return this.manager.runCommands('kill', commands => commands.kill(this.inner.pid));
  }

  async sendStdin(data: string): Promise<void> {
    if (this.exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this.exitCode}`);
    }
    // Spawned with stdin detached: there is nothing to write to. Match the
    // local and Docker handles, which reject rather than send input nowhere.
    if (this.stdinMode === 'ignore') {
      throw new Error(`Process ${this.pid} was not started with stdin support`);
    }
    await this.manager.runCommands('sendStdin', commands => commands.sendStdin(this.inner.pid, data));
  }

  async closeStdin(): Promise<void> {
    throw new UnsupportedStdinCloseError('The commands API does not expose a way to close stdin for a running command');
  }
}

export interface CommandsApiProcessManagerOptions {
  env?: Record<string, string | undefined>;
  /** Default timeout in milliseconds for commands that don't specify one. */
  defaultTimeout?: number;
}

/**
 * A process manager over E2B's envd commands API. Providers supply the
 * commands handle through {@link runCommands}; everything else is shared.
 */
export abstract class CommandsApiProcessManager<
  TSandbox extends MastraSandbox = MastraSandbox,
> extends SandboxProcessManager<TSandbox> {
  protected readonly defaultTimeout?: number;

  constructor({ defaultTimeout, ...options }: CommandsApiProcessManagerOptions = {}) {
    super(options);
    this.defaultTimeout = defaultTimeout;
  }

  /** Run `fn` against the provider's current commands handle. */
  abstract runCommands<T>(operation: CommandsApiOperation, fn: (commands: CommandsApi) => Promise<T>): Promise<T>;

  /** Wrap a started or attached command. Providers override this to supply their own handle. */
  protected createHandle(
    inner: CommandsApiHandle,
    stdinMode: SpawnProcessOptions['stdinMode'],
    options?: SpawnProcessOptions,
  ): CommandsApiProcessHandle {
    return new CommandsApiProcessHandle(inner, this, Date.now(), stdinMode, options);
  }

  /** Where a command runs when the caller gives no `cwd`. */
  protected defaultCwd(): string | undefined {
    return this.sandbox.workingDirectory;
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    // The base spawn wrapper already merged the sandbox env into options.env.
    const envs = Object.fromEntries(
      Object.entries({ ...options.env }).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    return this.runCommands('spawn', async commands => {
      // Callbacks are fixed at run() time but output arrives after it
      // resolves, so `handle` is assigned before the first callback fires.
      let handle: CommandsApiProcessHandle;
      const inner = await commands.run(command, {
        background: true,
        // `stdinMode: 'ignore'` closes stdin at spawn so a command that reads
        // it (a bare `cat`) sees EOF instead of blocking forever.
        stdin: options.stdinMode !== 'ignore',
        cwd: options.cwd ?? this.defaultCwd(),
        envs,
        // Without this the SDK falls back to its own 60s connection deadline,
        // which bounds the whole command and kills anything that runs longer.
        timeoutMs: options.timeout ?? this.defaultTimeout,
        onStdout: data => handle.emitStdout(data),
        onStderr: data => handle.emitStderr(data),
      });
      handle = this.createHandle(inner, options.stdinMode, options);
      this._tracked.set(handle.pid, handle);
      return handle;
    });
  }

  /**
   * Running processes as the VM reports them, plus exited processes this
   * manager still holds, so a finished command stays visible until it is released.
   */
  async list(): Promise<ProcessInfo[]> {
    const running = await this.runCommands('list', commands => commands.list());
    const infos: ProcessInfo[] = running.map(proc => ({
      pid: String(proc.pid),
      command: commandOf(proc),
      running: true,
    }));
    const listed = new Set(infos.map(info => info.pid));
    for (const [pid, handle] of this._tracked) {
      if (handle.exitCode === undefined || listed.has(pid)) continue;
      infos.push({ pid, command: handle.command, running: false, exitCode: handle.exitCode });
    }
    return infos;
  }

  /**
   * A tracked process, or one this manager didn't start, attached through
   * `connect`. Output from before attaching is not available.
   */
  // `options.release` is applied by the base class wrapper.
  async get(pid: string, _options?: { release?: boolean }): Promise<ProcessHandle | undefined> {
    const tracked = this._tracked.get(pid);
    if (tracked) return tracked;

    const numericPid = /^\d+$/.test(pid) ? Number(pid) : undefined;
    if (numericPid === undefined) return undefined;

    let handle: CommandsApiProcessHandle;
    try {
      const inner = await this.runCommands('connect', commands =>
        commands.connect(numericPid, {
          onStdout: data => handle.emitStdout(data),
          onStderr: data => handle.emitStderr(data),
          timeoutMs: ATTACH_TIMEOUT_MS,
        }),
      );
      handle = this.createHandle(inner, undefined);
      this._tracked.set(handle.pid, handle);
      return handle;
    } catch {
      return undefined;
    }
  }
}
