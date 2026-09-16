import { randomUUID } from 'node:crypto';

import type { RequestContext } from '@mastra/core/di';
import type {
  CommandResult,
  ExecuteCommandOptions,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxCloneOptions,
  SandboxFileInput,
  SandboxInfo,
  WriteFilesOptions,
} from '@mastra/core/workspace';
import {
  MastraSandbox,
  ProcessHandle,
  SandboxAbortError,
  SandboxNotReadyError,
  UnsupportedStdinCloseError,
  validateSandboxFileMode,
} from '@mastra/core/workspace';
import { Freestyle, FreestyleApiError } from 'freestyle';
import type { CreateVmOptions, Vm, VmData } from 'freestyle';

const LOG_PREFIX = '[FreestyleSandbox]';
const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;
const MAX_COMMAND_TIMEOUT_MS = 300_000;

type InstructionsOption = string | ((opts: { defaultInstructions: string; requestContext?: RequestContext }) => string);
type FreestyleClient = Pick<Freestyle, 'vms'>;
type FreestyleVmHandle = { vm: Vm; data: VmData };
export type FreestyleCreateOptions = Omit<CreateVmOptions, 'slug' | 'firewall'> & {
  firewall?: CreateVmOptions['firewall'];
};

class CommandOutputAccumulator extends ProcessHandle {
  readonly pid = 'freestyle-command';
  exitCode: number | undefined;

  async kill(): Promise<boolean> {
    return false;
  }

  async sendStdin(): Promise<void> {
    throw new Error('Freestyle one-shot command execution does not support stdin');
  }

  async closeStdin(): Promise<void> {
    throw new UnsupportedStdinCloseError('Freestyle one-shot command execution does not support closing stdin');
  }

  async wait(): Promise<CommandResult> {
    return {
      success: this.exitCode === 0,
      exitCode: this.exitCode ?? 1,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: 0,
    };
  }
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildCommand(command: string, args: string[] | undefined, cwd: string | undefined): string {
  const invocation = args?.length ? `${command} ${args.map(shellQuote).join(' ')}` : command;
  return cwd ? `cd ${shellQuote(cwd)} && ${invocation}` : invocation;
}

function commandTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Freestyle command timeout must be a positive number of milliseconds');
  }
  if (timeoutMs > MAX_COMMAND_TIMEOUT_MS) {
    throw new RangeError(`Freestyle command timeout must be at most ${MAX_COMMAND_TIMEOUT_MS} milliseconds`);
  }
  return Math.ceil(timeoutMs);
}

function isNotFound(error: unknown): boolean {
  return error instanceof FreestyleApiError && error.status === 404;
}

function definedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

export interface FreestyleSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Stable VM slug. Reusing it reconnects to the same VM. */
  id?: string;
  /** Freestyle API key. Falls back to FREESTYLE_API_KEY. */
  apiKey?: string;
  /** Freestyle API base URL. */
  baseUrl?: string;
  /** VM creation options. The sandbox always sets slug from id. */
  createOptions?: FreestyleCreateOptions;
  /** Default timeout for one-shot commands, up to five minutes. */
  commandTimeoutMs?: number;
  /** Custom instructions for getInstructions(). */
  instructions?: InstructionsOption;
  /** Preconfigured Freestyle SDK client, primarily for custom transports and tests. */
  client?: FreestyleClient;
}

/**
 * Persistent Freestyle VM sandbox for Mastra workspaces.
 *
 * stop() pauses the VM while preserving its memory and disk. start() reconnects
 * by stable slug and resumes it. destroy() permanently deletes the VM.
 */
export class FreestyleSandbox extends MastraSandbox<FreestyleVmHandle> {
  readonly id: string;
  readonly name = 'FreestyleSandbox';
  readonly provider = 'freestyle';
  status: ProviderStatus = 'pending';

  private readonly _client: FreestyleClient;
  private readonly _createOptions: FreestyleCreateOptions;
  private readonly _commandTimeoutMs: number;
  private readonly _instructionsOverride?: InstructionsOption;
  private readonly _constructorOptions: FreestyleSandboxOptions;
  private _vm: Vm | undefined;
  private _createdAt: Date | undefined;
  private _lastUsedAt: Date | undefined;
  private _data: VmData | undefined;

  constructor(options: FreestyleSandboxOptions = {}) {
    super({ ...options, name: 'FreestyleSandbox' });

    this.id = options.id ?? `mastra-${randomUUID().slice(0, 12)}`;
    this._client =
      options.client ??
      new Freestyle({
        ...(options.apiKey !== undefined && { apiKey: options.apiKey }),
        ...(options.baseUrl !== undefined && { baseUrl: options.baseUrl }),
      });
    this._createOptions = { ...options.createOptions };
    this._commandTimeoutMs = commandTimeout(options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
    this._instructionsOverride = options.instructions;
    this._constructorOptions = { ...options };
  }

  clone(options: SandboxCloneOptions = {}): FreestyleSandbox {
    const { id: _id, createOptions, ...base } = this._constructorOptions;
    return new FreestyleSandbox({
      ...base,
      ...(options.id !== undefined && { id: options.id }),
      ...(options.sandboxId !== undefined && { id: options.sandboxId }),
      ...(options.env !== undefined && { env: options.env }),
      ...(options.workingDirectory !== undefined && { workingDirectory: options.workingDirectory }),
      createOptions: {
        ...createOptions,
        ...(options.idleTimeoutMinutes !== undefined && { idleTimeoutSeconds: options.idleTimeoutMinutes * 60 }),
      },
    });
  }

  /** The underlying Freestyle VM for snapshots, PTYs, networking, and other SDK operations. */
  get vm(): Vm {
    if (!this._vm) throw new SandboxNotReadyError(this.id);
    return this._vm;
  }

  protected override async find(): Promise<FreestyleVmHandle | undefined> {
    try {
      const data = await this._client.vms.get(this._vm?.id ?? this.id);
      return { vm: this._client.vms.ref(data.id), data };
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  protected override async connect(handle: FreestyleVmHandle): Promise<void> {
    let data = handle.data;
    if (data.state !== 'running') data = await handle.vm.start();
    this.adopt(handle.vm, data);
    this.logger.debug(`${LOG_PREFIX} Connected to VM ${data.id}`);
  }

  protected override async create(): Promise<void> {
    const { firewall, ...options } = this._createOptions;
    const result = await this._client.vms.create({
      idleTimeoutSeconds: null,
      autoDeleteSeconds: null,
      automaticRestart: true,
      ...options,
      slug: this.id,
      firewall: firewall ?? {
        rules: [{ action: 'allow', source: {}, destination: { public: true } }],
      },
    });
    this.adopt(result.vm, result.data);
    this.logger.debug(`${LOG_PREFIX} Created VM ${result.vmId}`);
  }

  async stop(): Promise<void> {
    if (!this._vm) return;
    try {
      const data = await this._vm.data();
      if (data.state === 'running') this._data = await this._vm.pause();
    } catch (error) {
      if (!isNotFound(error)) throw error;
      this._vm = undefined;
      this._data = undefined;
    }
  }

  async destroy(): Promise<void> {
    if (!this._vm) return;
    try {
      await this._vm.delete();
    } catch (error) {
      if (!isNotFound(error)) throw error;
    } finally {
      this._vm = undefined;
      this._data = undefined;
    }
  }

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    await this.ensureRunning();
    if (options?.abortSignal?.aborted) throw new SandboxAbortError('command');

    const fullCommand = buildCommand(command, args, options?.cwd ?? this.workingDirectory);
    const timeoutMs = commandTimeout(options?.timeout ?? this._commandTimeoutMs);
    const env = definedEnv({ ...this.getEnv(), ...options?.env });
    const startedAt = Date.now();
    const output = new CommandOutputAccumulator({
      maxRetainedBytes: options?.maxRetainedBytes ?? Infinity,
      onStdout: options?.onStdout,
      onStderr: options?.onStderr,
    });

    const result = await this.vm.exec({
      command: fullCommand,
      timeoutMs,
      ...(Object.keys(env).length > 0 && { env }),
    });
    if (result.stdout) output.emitStdout(result.stdout);
    if (result.stderr) output.emitStderr(result.stderr);

    const timedOut = result.statusCode === null;
    const exitCode = timedOut ? 124 : (result.statusCode ?? 1);
    output.exitCode = exitCode;
    this._lastUsedAt = new Date();

    return {
      command: fullCommand,
      args,
      success: exitCode === 0 && !timedOut,
      exitCode,
      stdout: output.stdout,
      stderr: output.stderr,
      executionTimeMs: Date.now() - startedAt,
      timedOut,
      stdoutTruncated: output.stdoutTruncated,
      stderrTruncated: output.stderrTruncated,
      stdoutDroppedBytes: output.stdoutDroppedBytes,
      stderrDroppedBytes: output.stderrDroppedBytes,
    };
  }

  async writeFiles(files: SandboxFileInput[], options: WriteFilesOptions = {}): Promise<void> {
    await this.ensureRunning();
    if (options.abortSignal?.aborted) throw new SandboxAbortError('file write');

    await Promise.all(
      files.map(async file => {
        if (file.mode !== undefined) validateSandboxFileMode(file.mode);
        await this.vm.fs.writeFile(file.path, file.content, {
          ...(file.mode !== undefined && { mode: file.mode }),
          ...(options.abortSignal !== undefined && { signal: options.abortSignal }),
        });
      }),
    );
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = [
      'Freestyle hardware-virtualized Linux VM with full root access.',
      'The VM keeps its filesystem and runtime state when paused, then resumes on the next start.',
      'Use executeCommand() for foreground shell commands and writeFiles() for direct file uploads.',
      'Background process management and interactive stdin are not exposed by this provider.',
    ].join('\n');
    if (this._instructionsOverride === undefined) return defaultInstructions;
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
  }

  async getInfo(): Promise<SandboxInfo> {
    let data = this._data;
    if (this._vm) {
      try {
        data = await this._vm.data();
        this._data = data;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }

    return {
      id: data?.id ?? this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      lastUsedAt: this._lastUsedAt,
      resources: data
        ? {
            cpuCores: data.resources.cpu,
            memoryMB: data.resources.memory,
            diskMB: data.resources.storage,
          }
        : undefined,
      metadata: {
        slug: data?.slug ?? this.id,
        vmState: data?.state,
        snapshotId: data?.snapshotId,
        persistent: true,
        hardwareVirtualized: true,
      },
    };
  }

  private adopt(vm: Vm, data: VmData): void {
    this._vm = vm;
    this._data = data;
    this._createdAt = new Date(data.createdAt);
  }
}
