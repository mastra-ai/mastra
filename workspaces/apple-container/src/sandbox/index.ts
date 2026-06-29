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
import type { RequestContext } from '@mastra/core/di';
import type {
  CommandResult,
  ExecuteCommandOptions,
  InstructionsOption,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxInfo,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxExecutionError } from '@mastra/core/workspace';

const LOG_PREFIX = '[AppleContainerSandbox]';
const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;
const DEFAULT_IMAGE = 'node:22-slim';
const DEFAULT_COMMAND = ['sleep', 'infinity'];
const DEFAULT_WORKING_DIR = '/workspace';

export interface AppleContainerCliResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  timedOut?: boolean;
  killed?: boolean;
}

export interface AppleContainerCommandRunnerOptions {
  timeout?: number;
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
  status?: string;
  networks?: Array<Record<string, unknown>>;
  configuration?: {
    id?: string;
    hostname?: string;
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
  readOnlyRootfs?: boolean;
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
  /** tmpfs mount specs. */
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
  private readonly _readOnlyRootfs: boolean;
  private readonly _ssh: boolean;
  private readonly _init: boolean;
  private readonly _virtualization: boolean;
  private readonly _capAdd: string[];
  private readonly _capDrop: string[];
  private readonly _tmpfs: string[];
  private readonly _dns: string[];
  private readonly _dnsSearch: string[];
  private readonly _noDns: boolean;
  private readonly _labels: Record<string, string>;
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
    this._readOnlyRootfs = options.readOnlyRootfs ?? false;
    this._ssh = options.ssh ?? false;
    this._init = options.init ?? true;
    this._virtualization = options.virtualization ?? false;
    this._capAdd = options.capAdd ?? [];
    this._capDrop = options.capDrop ?? [];
    this._tmpfs = options.tmpfs ?? [];
    this._dns = options.dns ?? [];
    this._dnsSearch = options.dnsSearch ?? [];
    this._noDns = options.noDns ?? false;
    this._labels = {
      ...options.labels,
      'mastra.sandbox': 'true',
      'mastra.sandbox.id': this.id,
    };
    this._workingDir = options.workingDir ?? DEFAULT_WORKING_DIR;
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
    const existing = await this._inspectContainer();
    if (existing) {
      this._containerId = existing.configuration?.id ?? this._containerName;
      if (!isRunning(existing)) {
        const result = await this._runner.run(['start', this.containerId]);
        this._assertSuccess(result, `start Apple container ${this.containerId}`);
      }
      return;
    }

    const result = await this._runner.run(this._buildRunArgs());
    this._assertSuccess(result, `create Apple container ${this._containerName}`);
    this._containerId = this._containerName;
  }

  async stop(): Promise<void> {
    const existing = await this._inspectContainer();
    if (!existing || !isRunning(existing)) {
      return;
    }

    const result = await this._runner.run(['stop', this.containerId]);
    if (!result.success && !isMissingContainerMessage(result.stderr)) {
      this.logger.warn(`${LOG_PREFIX} Failed to stop container ${this.containerId}: ${result.stderr}`);
    }
  }

  async destroy(): Promise<void> {
    if (!this._deleteOnDestroy) {
      await this.stop();
      return;
    }

    const existing = await this._inspectContainer();
    if (!existing) {
      return;
    }

    const result = await this._runner.run(['delete', '--force', this.containerId]);
    if (!result.success && !isMissingContainerMessage(result.stderr)) {
      this.logger.warn(`${LOG_PREFIX} Failed to delete container ${this.containerId}: ${result.stderr}`);
    }
  }

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    await this.ensureRunning();

    const fullCommand = [command, ...args].map(shellQuote).join(' ');
    const env = { ...this._env, ...options.env };
    const cliArgs = [
      'exec',
      ...envFlags(env),
      '--workdir',
      options.cwd ?? this._workingDir,
      this.containerId,
      'sh',
      '-lc',
      fullCommand,
    ];

    const result = await this._runner.run(cliArgs, {
      timeout: options.timeout ?? this._timeout,
      abortSignal: options.abortSignal,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
      maxRetainedBytes: options.maxRetainedBytes,
    });

    return { ...result, command: fullCommand, args };
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
        containerName: this._containerName,
        containerId: this.containerId,
        image: this._image,
        workingDir: this._workingDir,
        ...(inspect?.status && { appleContainerStatus: inspect.status }),
        ...(inspect?.networks && { networks: inspect.networks }),
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

  private async _inspectContainer(): Promise<AppleContainerInspectResult | undefined> {
    const result = await this._runner.run(['inspect', this.containerId]);
    if (!result.success) {
      if (!isMissingContainerMessage(result.stderr)) {
        this.logger.debug(`${LOG_PREFIX} inspect failed for ${this.containerId}: ${result.stderr}`);
      }
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

  private _buildRunArgs(): string[] {
    const args = ['run', '-d', '--name', this._containerName, '--workdir', this._workingDir];

    args.push(...envFlags(this._env));
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
    if (this._readOnlyRootfs) args.push('--read-only');
    if (this._ssh) args.push('--ssh');
    if (this._init) args.push('--init');
    if (this._virtualization) args.push('--virtualization');
    if (this._noDns) args.push('--no-dns');

    args.push(this._image, ...this._command);
    return args;
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
}

export function runAppleContainerCli(
  binary: string,
  args: string[],
  options: AppleContainerCommandRunnerOptions = {},
): Promise<AppleContainerCliResult> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let stdoutDroppedBytes = 0;
    let stderrDroppedBytes = 0;
    let settled = false;
    let killed = false;
    let timedOut = false;

    const child = spawn(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (exitCode: number): void => {
      if (settled) return;
      settled = true;
      resolve({
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        executionTimeMs: Date.now() - startedAt,
        killed,
        timedOut,
        ...(stdoutDroppedBytes > 0 && { stdoutTruncated: true, stdoutDroppedBytes }),
        ...(stderrDroppedBytes > 0 && { stderrTruncated: true, stderrDroppedBytes }),
      });
    };

    const kill = (): void => {
      if (child.killed) return;
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 1000).unref();
    };

    let timeout: NodeJS.Timeout | undefined;
    if (options.timeout && options.timeout > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        kill();
      }, options.timeout);
    }

    const onAbort = (): void => kill();
    if (options.abortSignal) {
      if (options.abortSignal.aborted) {
        kill();
      } else {
        options.abortSignal.addEventListener('abort', onAbort, { once: true });
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      const data = chunk.toString('utf8');
      const retained = appendRetainedOutput(stdout, stdoutDroppedBytes, data, options.maxRetainedBytes);
      stdout = retained.output;
      stdoutDroppedBytes = retained.droppedBytes;
      options.onStdout?.(data);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const data = chunk.toString('utf8');
      const retained = appendRetainedOutput(stderr, stderrDroppedBytes, data, options.maxRetainedBytes);
      stderr = retained.output;
      stderrDroppedBytes = retained.droppedBytes;
      options.onStderr?.(data);
    });

    child.on('error', error => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      options.abortSignal?.removeEventListener('abort', onAbort);
      reject(
        error instanceof Error && 'code' in error && error.code === 'ENOENT'
          ? new SandboxExecutionError(`Apple container CLI not found: ${binary}`, 127, stdout, error.message)
          : error,
      );
    });

    child.on('close', code => {
      if (timeout) clearTimeout(timeout);
      options.abortSignal?.removeEventListener('abort', onAbort);
      finish(code ?? (killed ? 137 : 1));
    });
  });
}

function generateId(): string {
  return `apple-container-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeContainerName(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, '-');
  return /^[a-zA-Z0-9]/.test(sanitized) ? sanitized : `c-${sanitized}`;
}

function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function appendRetainedOutput(
  currentOutput: string,
  currentDroppedBytes: number,
  chunk: string,
  maxRetainedBytes: number | undefined,
): { output: string; droppedBytes: number } {
  if (maxRetainedBytes === undefined || maxRetainedBytes === Infinity) {
    return { output: currentOutput + chunk, droppedBytes: currentDroppedBytes };
  }
  if (maxRetainedBytes <= 0) {
    return { output: '', droppedBytes: currentDroppedBytes + Buffer.byteLength(chunk) };
  }

  let output = currentOutput + chunk;
  let outputBytes = Buffer.byteLength(output);
  if (outputBytes <= maxRetainedBytes) {
    return { output, droppedBytes: currentDroppedBytes };
  }

  let droppedBytes = currentDroppedBytes;
  while (output.length > 0 && outputBytes > maxRetainedBytes) {
    const firstCodePoint = output.codePointAt(0);
    if (firstCodePoint === undefined) break;
    const firstChar = String.fromCodePoint(firstCodePoint);
    output = output.slice(firstChar.length);
    const byteLength = Buffer.byteLength(firstChar);
    outputBytes -= byteLength;
    droppedBytes += byteLength;
  }

  return { output, droppedBytes };
}

function envFlags(env: Record<string, string | undefined>): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable name for Apple container command: ${key}`);
    }
    args.push('--env', `${key}=${value}`);
  }
  return args;
}

function isRunning(inspect: AppleContainerInspectResult): boolean {
  return inspect.status === 'running';
}

function isMissingContainerMessage(message: string): boolean {
  return /not found|no such|does not exist|unknown container/i.test(message);
}
