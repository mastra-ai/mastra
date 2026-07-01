/**
 * Apple container CLI sandbox provider.
 *
 * This provider maps Mastra's WorkspaceSandbox command execution contract to
 * Apple's `container` CLI. It starts a long-lived OCI Linux container and uses
 * `container exec` for commands.
 *
 * @see https://github.com/apple/container
 */

import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import type { RequestContext } from '@mastra/core/di';
import type {
  CommandResult,
  ExecuteCommandOptions,
  InstructionsOption,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxInfo,
} from '@mastra/core/workspace';
import { MastraSandbox, ProcessHandle, SandboxExecutionError } from '@mastra/core/workspace';

const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;
const DEFAULT_IMAGE = 'node:22-slim';
const DEFAULT_COMMAND = ['sleep', 'infinity'];
const DEFAULT_WORKING_DIR = '/workspace';
const APPLE_CONTAINER_CLI_GRACE_TIMEOUT_MS = 10_000;
const APPLE_CONTAINER_READY_TIMEOUT_MS = 10_000;
const APPLE_CONTAINER_READY_EXEC_TIMEOUT_MS = 5_000;
const APPLE_CONTAINER_TIMEOUT_EXIT_CODE = 124;
const APPLE_CONTAINER_TIMEOUT_MARKER = '__MASTRA_APPLE_CONTAINER_TIMEOUT__';

export interface AppleContainerCliResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  timedOut?: boolean;
  killed?: boolean;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  stdoutDroppedBytes?: number;
  stderrDroppedBytes?: number;
}

export interface AppleContainerCommandRunnerOptions {
  timeout?: number;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  maxRetainedBytes?: number;
}

export interface AppleContainerCommandRunner {
  run(args: string[], options?: AppleContainerCommandRunnerOptions): Promise<AppleContainerCliResult>;
}

export class DefaultAppleContainerCommandRunner implements AppleContainerCommandRunner {
  constructor(private readonly binary = 'container') {}

  run(args: string[], options: AppleContainerCommandRunnerOptions = {}): Promise<AppleContainerCliResult> {
    return runAppleContainerCli(this.binary, args, options);
  }
}

interface AppleContainerInspectResult {
  id?: string;
  status?:
    | string
    | {
        state?: string;
        networks?: Array<Record<string, unknown>>;
      };
  configuration?: {
    id?: string;
    hostname?: string;
    labels?: Record<string, string>;
    networks?: Array<Record<string, unknown>>;
    resources?: {
      cpus?: number;
      memoryInBytes?: number;
    };
    mounts?: unknown[];
  };
}

export interface AppleContainerSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Unique identifier for this sandbox instance. */
  id?: string;
  /** Apple container name passed to `container run --name`. Defaults to the sandbox id. */
  name?: string;
  /** OCI image to use. */
  image?: string;
  /** Container init command. Must keep the container alive for exec-based command execution. */
  command?: string[];
  /** Environment variables available to the container and every command exec. */
  env?: Record<string, string>;
  /** Host-to-container bind mounts. */
  volumes?: Record<string, string>;
  /** Raw `container run --mount` specs. */
  mounts?: string[];
  /** Apple container network attachment spec. */
  network?: string;
  /** Published port specs passed to `container run --publish`. */
  publishedPorts?: string[];
  /** Published socket specs passed to `container run --publish-socket`. */
  publishedSockets?: string[];
  /** Number of CPUs to allocate. */
  cpus?: number | string;
  /** Memory allocation, for example `1G`. */
  memory?: string;
  /** OCI platform, for example `linux/arm64`. */
  platform?: string;
  /** Image architecture when selecting a multi-arch image. */
  arch?: string;
  /** Operating system when selecting a multi-platform image. */
  os?: string;
  /** Enable Rosetta in the container. */
  rosetta?: boolean;
  /** Mount the container root filesystem as read-only. */
  readonlyRootfs?: boolean;
  /** Forward the host SSH agent socket. */
  ssh?: boolean;
  /** Enable Apple's init process in the container. */
  init?: boolean;
  /** Expose virtualization capabilities to the container. */
  virtualization?: boolean;
  /** Linux capabilities to add. */
  capAdd?: string[];
  /** Linux capabilities to drop. */
  capDrop?: string[];
  /** tmpfs destination paths. */
  tmpfs?: string[];
  /** DNS nameserver IPs. */
  dns?: string[];
  /** DNS search domains. */
  dnsSearch?: string[];
  /** Do not configure DNS in the container. */
  noDns?: boolean;
  /** Container labels. Mastra labels are always added. */
  labels?: Record<string, string>;
  /** Working directory inside the container. */
  workingDir?: string;
  /** Default command timeout in milliseconds. */
  timeout?: number;
  /** Delete the container on destroy. Defaults to true. */
  deleteOnDestroy?: boolean;
  /** Path or name for the Apple container CLI. */
  containerBinary?: string;
  /** Custom command runner, primarily for tests. */
  runner?: AppleContainerCommandRunner;
  /** Custom instructions for getInstructions(). String replaces the default; function receives it. */
  instructions?: InstructionsOption;
}

export class AppleContainerSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'AppleContainerSandbox';
  readonly provider = 'apple-container';
  status: ProviderStatus = 'pending';

  private readonly _containerName: string;
  private readonly _configuredName?: string;
  private readonly _image: string;
  private readonly _command: string[];
  private readonly _env: Record<string, string>;
  private readonly _volumes: Record<string, string>;
  private readonly _mounts: string[];
  private readonly _network?: string;
  private readonly _publishedPorts: string[];
  private readonly _publishedSockets: string[];
  private readonly _cpus?: number | string;
  private readonly _memory?: string;
  private readonly _platform?: string;
  private readonly _arch?: string;
  private readonly _os?: string;
  private readonly _rosetta: boolean;
  private readonly _readonlyRootfs: boolean;
  private readonly _ssh: boolean;
  private readonly _init: boolean;
  private readonly _virtualization: boolean;
  private readonly _capAdd: string[];
  private readonly _capDrop: string[];
  private readonly _tmpfs: string[];
  private readonly _dns: string[];
  private readonly _dnsSearch: string[];
  private readonly _noDns: boolean;
  private readonly _userLabels: Record<string, string>;
  private readonly _labels: Record<string, string>;
  private readonly _configHash: string;
  private readonly _workingDir: string;
  private readonly _timeout: number;
  private readonly _deleteOnDestroy: boolean;
  private readonly _runner: AppleContainerCommandRunner;
  private readonly _instructionsOverride?: InstructionsOption;
  private readonly _createdAt: Date;

  private _containerId?: string;

  constructor(options: AppleContainerSandboxOptions = {}) {
    super({
      ...options,
      name: 'AppleContainerSandbox',
    });

    this.id = options.id ?? generateId();
    this._configuredName = options.name;
    this._containerName = sanitizeContainerName(options.name ?? this.id);
    this._image = options.image ?? DEFAULT_IMAGE;
    this._command = options.command ?? DEFAULT_COMMAND;
    this._env = options.env ?? {};
    this._volumes = options.volumes ?? {};
    this._mounts = options.mounts ?? [];
    this._network = options.network;
    this._publishedPorts = options.publishedPorts ?? [];
    this._publishedSockets = options.publishedSockets ?? [];
    this._cpus = options.cpus;
    this._memory = options.memory;
    this._platform = options.platform;
    this._arch = options.arch;
    this._os = options.os;
    this._rosetta = options.rosetta ?? false;
    this._readonlyRootfs = options.readonlyRootfs ?? false;
    this._ssh = options.ssh ?? false;
    this._init = options.init ?? true;
    this._virtualization = options.virtualization ?? false;
    this._capAdd = options.capAdd ?? [];
    this._capDrop = options.capDrop ?? [];
    this._tmpfs = options.tmpfs ?? [];
    validateTmpfsPaths(this._tmpfs);
    this._dns = options.dns ?? [];
    this._dnsSearch = options.dnsSearch ?? [];
    this._noDns = options.noDns ?? false;
    this._workingDir = options.workingDir ?? DEFAULT_WORKING_DIR;
    this._userLabels = options.labels ?? {};
    this._configHash = hashConfig(this._runtimeConfigForHash());
    this._labels = {
      ...this._userLabels,
      'mastra.sandbox': 'true',
      'mastra.sandbox.id': this.id,
      'mastra.sandbox.config-hash': this._configHash,
    };
    this._timeout = options.timeout ?? DEFAULT_COMMAND_TIMEOUT_MS;
    this._deleteOnDestroy = options.deleteOnDestroy ?? true;
    this._runner = options.runner ?? new DefaultAppleContainerCommandRunner(options.containerBinary);
    this._instructionsOverride = options.instructions;
    this._createdAt = new Date();
  }

  get containerId(): string {
    return this._containerId ?? this._containerName;
  }

  async start(): Promise<void> {
    await this._runPlainLifecycle('starting', 'running', () => this._startContainer());
  }

  async stop(): Promise<void> {
    await this._runPlainLifecycle('stopping', 'stopped', () => this._stopContainer());
  }

  async destroy(): Promise<void> {
    await this._runPlainLifecycle('destroying', 'destroyed', () => this._destroyContainer());
  }

  private async _startContainer(): Promise<void> {
    const existing = await this._inspectContainer();
    if (existing) {
      this._assertMastraOwned(existing);
      this._assertCompatibleConfig(existing);
      this._containerId = existing.configuration?.id ?? this._containerName;
      if (!isRunning(existing)) {
        const result = await this._runCli(['start', this.containerId]);
        this._assertSuccess(result, `start Apple container ${this.containerId}`);
        await this._waitUntilContainerReady(`start Apple container ${this.containerId}`);
      }
      return;
    }

    const env = envFlags(this._env);
    const result = await this._runCli(this._buildRunArgs(env.args), { env: env.env });
    this._assertSuccess(result, `create Apple container ${this._containerName}`);
    this._containerId = this._containerName;
    try {
      await this._waitUntilContainerReady(`create Apple container ${this._containerName}`);
    } catch (error) {
      if (this._deleteOnDestroy) {
        await this._deleteContainerIgnoringMissing();
      }
      throw error;
    }
  }

  private async _stopContainer(): Promise<void> {
    const existing = await this._inspectContainer();
    if (!existing) {
      return;
    }
    this._assertMastraOwned(existing);
    if (!isRunning(existing)) {
      return;
    }

    const result = await this._runCli(['stop', this.containerId]);
    if (!result.success && !isMissingContainerMessage(result.stderr)) {
      this._assertSuccess(result, `stop Apple container ${this.containerId}`);
    }
  }

  private async _destroyContainer(): Promise<void> {
    if (!this._deleteOnDestroy) {
      await this._stopContainer();
      return;
    }

    const existing = await this._inspectContainer();
    if (!existing) {
      return;
    }
    this._assertMastraOwned(existing);

    await this._deleteContainerIgnoringMissing();
  }

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    await this.ensureRunning();

    const commandTimeout = options.timeout ?? this._timeout;
    const hasCommandTimeout = Number.isFinite(commandTimeout) && commandTimeout > 0;
    const fullCommand = buildShellCommand(command, args);
    const shellCommand = hasCommandTimeout ? buildTimeoutShellCommand(fullCommand, commandTimeout) : fullCommand;
    const env = envFlags({ ...this._env, ...options.env });
    const cliArgs = [
      'exec',
      ...env.args,
      '--workdir',
      options.cwd ?? this._workingDir,
      this.containerId,
      'sh',
      '-lc',
      shellCommand,
    ];

    const result = await this._runner.run(cliArgs, {
      timeout: hasCommandTimeout ? commandTimeout + APPLE_CONTAINER_CLI_GRACE_TIMEOUT_MS : undefined,
      env: env.env,
      abortSignal: options.abortSignal,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
      maxRetainedBytes: options.maxRetainedBytes,
    });

    const timedOut =
      result.exitCode === APPLE_CONTAINER_TIMEOUT_EXIT_CODE && result.stderr.includes(APPLE_CONTAINER_TIMEOUT_MARKER);
    const stderr = timedOut ? stripTimeoutMarker(result.stderr) : result.stderr;

    return {
      ...result,
      stderr,
      ...(timedOut && { timedOut: true, killed: true }),
      command: fullCommand,
      args,
    };
  }

  async getInfo(): Promise<SandboxInfo> {
    const inspect = this._containerId ? await this._inspectContainer() : undefined;
    const resources = inspect?.configuration?.resources;

    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt,
      resources: resources
        ? {
            cpuCores: resources.cpus,
            memoryMB: resources.memoryInBytes ? Math.round(resources.memoryInBytes / 1024 / 1024) : undefined,
          }
        : undefined,
      metadata: {
        ...this._serializableConfig(),
      },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = this._buildDefaultInstructions();
    if (typeof this._instructionsOverride === 'string') {
      return this._instructionsOverride;
    }
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
    }
    return defaultInstructions;
  }

  private _buildDefaultInstructions(): string {
    const parts = [
      `Apple container sandbox: commands run inside a local OCI Linux container from image ${this._image}.`,
      `Working directory: ${this._workingDir}.`,
    ];

    const volumeCount = Object.keys(this._volumes).length + this._mounts.length;
    if (volumeCount > 0) {
      parts.push(`${volumeCount} host mount(s) are configured.`);
    }
    if (this._timeout > 0) {
      parts.push(`Default command timeout: ${Math.ceil(this._timeout / 1000)}s.`);
    }

    return parts.join(' ');
  }

  private async _runPlainLifecycle(
    activeStatus: ProviderStatus,
    completeStatus: ProviderStatus,
    operation: () => Promise<void>,
  ): Promise<void> {
    const managedByBaseWrapper = this.status === activeStatus;
    if (!managedByBaseWrapper) {
      this.status = activeStatus;
    }

    try {
      await operation();
      if (!managedByBaseWrapper) {
        this.status = completeStatus;
      }
    } catch (error) {
      if (!managedByBaseWrapper) {
        this.status = 'error';
      }
      throw error;
    }
  }

  private async _inspectContainer(): Promise<AppleContainerInspectResult | undefined> {
    const result = await this._runCli(['inspect', this.containerId]);
    if (!result.success) {
      if (isMissingContainerMessage(result.stderr)) return undefined;
      this._assertSuccess(result, `inspect Apple container ${this.containerId}`);
      return undefined;
    }

    try {
      const parsed = JSON.parse(result.stdout) as AppleContainerInspectResult[] | AppleContainerInspectResult;
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (error) {
      throw new SandboxExecutionError(
        `Failed to parse Apple container inspect output for ${this.containerId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        1,
        result.stdout,
        result.stderr,
      );
    }
  }

  private _buildRunArgs(envArgs: string[]): string[] {
    const args = ['run', '-d', '--name', this._containerName, '--workdir', this._workingDir];

    args.push(...envArgs);
    for (const [hostPath, containerPath] of Object.entries(this._volumes)) {
      args.push('--volume', `${hostPath}:${containerPath}`);
    }
    for (const mount of this._mounts) args.push('--mount', mount);
    for (const [key, value] of Object.entries(this._labels)) args.push('--label', `${key}=${value}`);
    for (const port of this._publishedPorts) args.push('--publish', port);
    for (const socket of this._publishedSockets) args.push('--publish-socket', socket);
    for (const cap of this._capAdd) args.push('--cap-add', cap);
    for (const cap of this._capDrop) args.push('--cap-drop', cap);
    for (const tmpfs of this._tmpfs) args.push('--tmpfs', tmpfs);
    for (const dns of this._dns) args.push('--dns', dns);
    for (const domain of this._dnsSearch) args.push('--dns-search', domain);

    if (this._network) args.push('--network', this._network);
    if (this._cpus !== undefined) args.push('--cpus', String(this._cpus));
    if (this._memory !== undefined) args.push('--memory', this._memory);
    if (this._platform) args.push('--platform', this._platform);
    if (this._arch) args.push('--arch', this._arch);
    if (this._os) args.push('--os', this._os);
    if (this._rosetta) args.push('--rosetta');
    if (this._readonlyRootfs) args.push('--read-only');
    if (this._ssh) args.push('--ssh');
    if (this._init) args.push('--init');
    if (this._virtualization) args.push('--virtualization');
    if (this._noDns) args.push('--no-dns');

    args.push(this._image, ...this._command);
    return args;
  }

  private async _waitUntilContainerReady(action: string): Promise<void> {
    const deadline = Date.now() + APPLE_CONTAINER_READY_TIMEOUT_MS;
    let lastResult: AppleContainerCliResult | undefined;

    while (Date.now() < deadline) {
      const inspect = await this._inspectContainer();
      if (!inspect) {
        throw new SandboxExecutionError(
          `${action} failed because Apple container ${this.containerId} disappeared`,
          1,
          '',
          '',
        );
      }

      this._assertMastraOwned(inspect);
      this._assertCompatibleConfig(inspect);

      if (!isRunning(inspect)) {
        const state = getContainerState(inspect) ?? 'not running';
        throw new SandboxExecutionError(
          `${action} failed because Apple container ${this.containerId} is ${state}`,
          1,
          '',
          '',
        );
      }

      lastResult = await this._runCli(['exec', this.containerId, 'sh', '-lc', 'true'], {
        timeout: APPLE_CONTAINER_READY_EXEC_TIMEOUT_MS,
      });
      if (lastResult.success) return;

      if (!isMissingContainerMessage(lastResult.stderr) && !/not running|not yet running/i.test(lastResult.stderr)) {
        break;
      }

      await delay(100);
    }

    throw new SandboxExecutionError(
      `${action} failed because Apple container ${this.containerId} did not become ready for exec`,
      lastResult?.exitCode ?? 1,
      lastResult?.stdout ?? '',
      lastResult?.stderr ?? '',
    );
  }

  private async _deleteContainerIgnoringMissing(): Promise<void> {
    const result = await this._runCli(['delete', '--force', this.containerId]);
    if (!result.success && !isMissingContainerMessage(result.stderr)) {
      this._assertSuccess(result, `delete Apple container ${this.containerId}`);
    }
  }

  private _runtimeConfigForHash(): Record<string, unknown> {
    return {
      image: this._image,
      command: this._command,
      env: this._env,
      volumes: this._volumes,
      mounts: this._mounts,
      network: this._network,
      publishedPorts: this._publishedPorts,
      publishedSockets: this._publishedSockets,
      cpus: this._cpus,
      memory: this._memory,
      platform: this._platform,
      arch: this._arch,
      os: this._os,
      rosetta: this._rosetta,
      readonlyRootfs: this._readonlyRootfs,
      ssh: this._ssh,
      init: this._init,
      virtualization: this._virtualization,
      capAdd: this._capAdd,
      capDrop: this._capDrop,
      tmpfs: this._tmpfs,
      dns: this._dns,
      dnsSearch: this._dnsSearch,
      noDns: this._noDns,
      labels: this._userLabels,
      workingDir: this._workingDir,
    };
  }

  private _serializableConfig(): Record<string, unknown> {
    return compactConfig({
      id: this.id,
      name: this._configuredName,
      image: this._image,
      command: this._command,
      env: this._env,
      volumes: this._volumes,
      mounts: this._mounts,
      network: this._network,
      publishedPorts: this._publishedPorts,
      publishedSockets: this._publishedSockets,
      cpus: this._cpus,
      memory: this._memory,
      platform: this._platform,
      arch: this._arch,
      os: this._os,
      rosetta: this._rosetta,
      readonlyRootfs: this._readonlyRootfs,
      ssh: this._ssh,
      init: this._init,
      virtualization: this._virtualization,
      capAdd: this._capAdd,
      capDrop: this._capDrop,
      tmpfs: this._tmpfs,
      dns: this._dns,
      dnsSearch: this._dnsSearch,
      noDns: this._noDns,
      labels: this._userLabels,
      workingDir: this._workingDir,
      timeout: this._timeout,
      deleteOnDestroy: this._deleteOnDestroy,
    });
  }

  private _assertSuccess(result: AppleContainerCliResult, action: string): void {
    if (result.success) return;
    throw new SandboxExecutionError(
      `${action} failed with exit code ${result.exitCode}: ${result.stderr}`,
      result.exitCode,
      result.stdout,
      result.stderr,
    );
  }

  private _assertMastraOwned(inspect: AppleContainerInspectResult): void {
    if (isMastraOwned(inspect, this.id)) return;
    throw new SandboxExecutionError(
      `Refusing to manage Apple container ${this.containerId} because it is not labeled as Mastra sandbox ${this.id}`,
      1,
      '',
      '',
    );
  }

  private _assertCompatibleConfig(inspect: AppleContainerInspectResult): void {
    const existingHash = inspect.configuration?.labels?.['mastra.sandbox.config-hash'];
    if (!existingHash || existingHash === this._configHash) return;
    throw new SandboxExecutionError(
      `Refusing to manage Apple container ${this.containerId} because its immutable configuration does not match sandbox ${this.id}`,
      1,
      '',
      '',
    );
  }

  private _runCli(args: string[], options: AppleContainerCommandRunnerOptions = {}): Promise<AppleContainerCliResult> {
    return this._runner.run(args, {
      timeout: this._timeout,
      ...options,
    });
  }
}

export function runAppleContainerCli(
  binary: string,
  args: string[],
  options: AppleContainerCommandRunnerOptions = {},
): Promise<AppleContainerCliResult> {
  const handle = new AppleContainerCliProcess(binary, args, options);
  return handle.wait() as Promise<AppleContainerCliResult>;
}

class AppleContainerCliProcess extends ProcessHandle {
  readonly pid: string;
  exitCode: number | undefined;

  private readonly child: ChildProcessByStdio<null, Readable, Readable>;
  private readonly waitPromise: Promise<AppleContainerCliResult>;
  private readonly startedAt = Date.now();
  private killed = false;
  private timedOut = false;
  private forceKillTimeout: NodeJS.Timeout | undefined;

  constructor(binary: string, args: string[], options: AppleContainerCommandRunnerOptions = {}) {
    super({
      maxRetainedBytes: options.maxRetainedBytes,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
    });

    this.child = spawn(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env ? { ...process.env, ...options.env } : process.env,
    });
    this.pid = this.child.pid ? String(this.child.pid) : `${binary}:${args.join(' ')}`;

    let settled = false;
    const stdoutDecoder = new StringDecoder();
    const stderrDecoder = new StringDecoder();
    let stdoutDecoderEnded = false;
    let stderrDecoderEnded = false;
    let timeout: NodeJS.Timeout | undefined;
    const onAbort = (): void => {
      void this.kill();
    };

    const flushStdout = (): void => {
      if (stdoutDecoderEnded) return;
      stdoutDecoderEnded = true;
      const data = stdoutDecoder.end();
      if (data) this.emitStdout(data);
    };
    const flushStderr = (): void => {
      if (stderrDecoderEnded) return;
      stderrDecoderEnded = true;
      const data = stderrDecoder.end();
      if (data) this.emitStderr(data);
    };

    const finish = (exitCode: number): AppleContainerCliResult => {
      this.exitCode = exitCode;
      return {
        success: exitCode === 0,
        exitCode,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this.startedAt,
        killed: this.killed,
        timedOut: this.timedOut,
      };
    };

    const cleanup = (): void => {
      if (timeout) clearTimeout(timeout);
      if (this.forceKillTimeout) clearTimeout(this.forceKillTimeout);
      options.abortSignal?.removeEventListener('abort', onAbort);
    };

    this.waitPromise = new Promise((resolve, reject) => {
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      this.child.stdout.on('data', (chunk: Buffer) => {
        const data = stdoutDecoder.write(chunk);
        if (data) this.emitStdout(data);
      });
      this.child.stderr.on('data', (chunk: Buffer) => {
        const data = stderrDecoder.write(chunk);
        if (data) this.emitStderr(data);
      });

      this.child.stdout.on('end', flushStdout);
      this.child.stderr.on('end', flushStderr);

      this.child.on('error', error => {
        settle(() => {
          flushStdout();
          flushStderr();
          reject(
            error instanceof Error && 'code' in error && error.code === 'ENOENT'
              ? new SandboxExecutionError(`Apple container CLI not found: ${binary}`, 127, this.stdout, error.message)
              : error,
          );
        });
      });

      this.child.on('close', code => {
        settle(() => {
          flushStdout();
          flushStderr();
          resolve(finish(code ?? (this.killed ? 137 : 1)));
        });
      });
    });

    timeout =
      options.timeout && options.timeout > 0
        ? setTimeout(() => {
            this.timedOut = true;
            void this.kill();
          }, options.timeout)
        : undefined;
    if (options.abortSignal) {
      if (options.abortSignal.aborted) {
        void this.kill();
      } else {
        options.abortSignal.addEventListener('abort', onAbort, { once: true });
      }
    }
  }

  async wait(): Promise<AppleContainerCliResult> {
    return this.waitPromise;
  }

  async kill(): Promise<boolean> {
    if (this.exitCode !== undefined || this.child.killed) return false;
    this.killed = true;
    this.child.kill('SIGTERM');
    this.forceKillTimeout = setTimeout(() => {
      if (this.exitCode === undefined && this.child.exitCode === null && this.child.signalCode === null) {
        this.child.kill('SIGKILL');
      }
    }, 1000);
    this.forceKillTimeout.unref();
    return true;
  }

  async sendStdin(): Promise<void> {
    throw new Error('Apple container CLI runner does not support stdin');
  }
}

function generateId(): string {
  return `apple-container-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeContainerName(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, '-');
  return /^[a-zA-Z0-9]/.test(sanitized) ? sanitized : `c-${sanitized}`;
}

function buildShellCommand(command: string, args: string[]): string {
  return args.length > 0 ? [command, ...args].map(shellQuote).join(' ') : command;
}

function buildTimeoutShellCommand(command: string, timeoutMs: number): string {
  const timeoutSeconds = formatTimeoutSeconds(timeoutMs);
  const innerScript = [
    `sh -lc ${shellQuote(command)} & child=$!`,
    `trap 'kill -TERM "$child" 2>/dev/null; wait "$child" 2>/dev/null; exit ${APPLE_CONTAINER_TIMEOUT_EXIT_CODE}' TERM INT`,
    'wait "$child"; code=$?',
    'trap - TERM INT',
    'printf "%s" "$code" > "$MASTRA_TIMEOUT_RESULT_FILE"',
    'exit "$code"',
  ].join('; ');
  return [
    'result_file="/tmp/.mastra-apple-container-exit-$$"',
    'rm -f "$result_file"',
    `MASTRA_TIMEOUT_RESULT_FILE="$result_file" timeout ${timeoutSeconds}s sh -lc ${shellQuote(innerScript)}`,
    'timeout_code=$?',
    'if [ -f "$result_file" ]; then code="$(cat "$result_file")"; rm -f "$result_file"; exit "$code"; fi',
    'rm -f "$result_file"',
    `case "$timeout_code" in 124|137|143) printf '%s\\n' ${shellQuote(APPLE_CONTAINER_TIMEOUT_MARKER)} >&2; exit ${APPLE_CONTAINER_TIMEOUT_EXIT_CODE};; *) exit "$timeout_code";; esac`,
  ].join('; ');
}

function formatTimeoutSeconds(timeoutMs: number): string {
  return Math.max(timeoutMs / 1000, 0.001)
    .toFixed(3)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
}

function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function stripTimeoutMarker(stderr: string): string {
  return stderr
    .split('\n')
    .filter(line => line.trim() !== APPLE_CONTAINER_TIMEOUT_MARKER)
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

function envFlags(env: Record<string, string | undefined>): { args: string[]; env: Record<string, string> } {
  const args: string[] = [];
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable name for Apple container command: ${key}`);
    }
    args.push('--env', key);
    childEnv[key] = value;
  }
  return { args, env: childEnv };
}

function isRunning(inspect: AppleContainerInspectResult): boolean {
  return getContainerState(inspect) === 'running';
}

function getContainerState(inspect: AppleContainerInspectResult): string | undefined {
  return typeof inspect.status === 'string' ? inspect.status : inspect.status?.state;
}

function isMastraOwned(inspect: AppleContainerInspectResult, sandboxId: string): boolean {
  const labels = inspect.configuration?.labels;
  return labels?.['mastra.sandbox'] === 'true' && labels['mastra.sandbox.id'] === sandboxId;
}

function isMissingContainerMessage(message: string): boolean {
  return /not found|no such|does not exist|unknown container/i.test(message);
}

function validateTmpfsPaths(tmpfs: string[]): void {
  for (const entry of tmpfs) {
    if (!entry.startsWith('/') || /[:,]/.test(entry)) {
      throw new Error(
        `Invalid Apple container tmpfs path "${entry}". Apple container --tmpfs accepts container paths only, for example "/tmp".`,
      );
    }
  }
}

function compactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (isPlainRecord(value) && Object.keys(value).length === 0) continue;
    result[key] = value;
  }
  return result;
}

function hashConfig(config: Record<string, unknown>): string {
  return createHash('sha256')
    .update(stableStringify(compactConfig(config)))
    .digest('hex')
    .slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
