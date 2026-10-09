/** Smol microVM sandbox for Mastra workspaces. */
import { createHash, randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { MastraSandbox, SandboxAbortError } from '@mastra/core/workspace';
import type {
  CommandResult,
  ExecuteCommandOptions,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxFileInput,
  SandboxInfo,
  WriteFilesOptions,
  SandboxStartResult,
} from '@mastra/core/workspace';
import { Machine } from 'smolmachines';
import type {
  ConnectOptions,
  MachineConfig,
  ResourceSpec,
  PortSpec,
  MountSpec,
  PortableCheckpointInfo,
} from 'smolmachines';

const DEFAULT_IMAGE = 'node:22-slim';
const DEFAULT_WORKDIR = '/workspace';
const OWNER = 'mastra.sandbox';

function quote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function retainTail(old: string, chunk: string, limit: number): string {
  if (limit === Infinity) return old + chunk;
  if (limit === 0) return '';
  const bytes = Buffer.from(old + chunk);
  let tail = bytes.subarray(Math.max(0, bytes.length - limit));
  // A retained tail must start on a UTF-8 code point boundary.
  while (tail.length > 0 && (tail[0]! & 0xc0) === 0x80) tail = tail.subarray(1);
  return tail.toString('utf8');
}

export interface SmolSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Logical workspace ID used to reconnect to the same local machine. */
  id?: string;
  /** OCI image containing your tools; use null locally for Smol's built-in guest. */
  image?: string | null;
  /** Local machine by default; cloud requires Smol Cloud credentials. */
  target?: 'local' | 'cloud';
  /** Explicit cloud machine ID to adopt across process restarts. */
  machineId?: string;
  cloud?: { apiKey?: string; baseUrl?: string };
  resources?: Pick<ResourceSpec, 'cpus' | 'memoryMb' | 'storageGb'>;
  /** Guest egress policy. The cloud default is provider-managed; local defaults to open. */
  network?: boolean;
  allowHosts?: string[];
  /** Ports to publish at VM creation. Cloud image must start the listeners before create returns. */
  ports?: PortSpec[];
  /** Local host directories mounted in the VM; use with LocalFilesystem to share agent files. */
  mounts?: MountSpec[];
  /** Local path for durable checkpoints; cloud checkpoints live in the account. */
  checkpointPath?: string;
  /** Override the instructions provided to agents. */
  instructions?: string;
}

export class SmolSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'SmolSandbox';
  readonly provider = 'smol';
  status: ProviderStatus = 'pending';
  readonly supportsCheckpoints: boolean;

  private machine?: Machine;
  private readonly config: SmolSandboxOptions;
  private readonly target: 'local' | 'cloud';
  private readonly createdAt = new Date();
  private lastCheckpoint?: PortableCheckpointInfo;

  constructor(options: SmolSandboxOptions = {}) {
    super({ ...options, name: 'SmolSandbox', workingDirectory: options.workingDirectory ?? DEFAULT_WORKDIR });
    this.id = options.id ?? randomUUID();
    this.config = options;
    this.target = options.target ?? 'local';
    this.supportsCheckpoints = this.target === 'cloud' || !!options.checkpointPath;
    if (this.target === 'local' && options.cloud) throw new Error('Smol cloud credentials require target: "cloud".');
    if (this.target === 'cloud' && options.image === null) throw new Error('Smol cloud machines require an image.');
    if (options.mounts && this.target !== 'local') throw new Error('Host directory mounts are local-only.');
    if (options.mounts?.length && options.checkpointPath)
      throw new Error('Local portable checkpoints cannot capture host mounts.');
    if (options.machineId && this.target !== 'cloud')
      throw new Error('machineId is only supported on the cloud target.');
    if (options.allowHosts && options.network === false)
      throw new Error('allowHosts and network: false cannot be combined.');
  }

  /** The underlying SDK machine, for branching and other native operations. */
  get instance(): Machine | undefined {
    return this.machine;
  }
  get checkpointInfo(): PortableCheckpointInfo | undefined {
    return this.lastCheckpoint;
  }

  private get connection(): ConnectOptions {
    return this.target === 'cloud'
      ? { target: 'cloud', ...this.config.cloud }
      : { target: 'local', handleSignals: false, waitForPorts: false };
  }

  private get machinePrefix(): string {
    const digest = createHash('sha256').update(this.id).digest('hex').slice(0, 24);
    return `mastra-${digest}`;
  }

  private get configHash(): string {
    const config = this.config;
    return createHash('sha256')
      .update(
        JSON.stringify({
          image: config.image === null ? null : config.image ?? DEFAULT_IMAGE,
          workdir: this.workingDirectory,
          resources: config.resources,
          network: config.network ?? (this.target === 'local' ? true : undefined),
          allowHosts: config.allowHosts,
          mounts: config.mounts,
          ports: config.ports,
        }),
      )
      .digest('hex');
  }

  private get machineName(): string {
    return this.target === 'cloud' ? `${this.machinePrefix}-${this.configHash.slice(0, 12)}` : this.machinePrefix;
  }

  private get labels(): Record<string, string> {
    return {
      [OWNER]: 'smol',
      'mastra.sandbox.id': this.id,
      'mastra.sandbox.config-sha256': this.configHash,
    };
  }

  async start(): Promise<SandboxStartResult> {
    if (!this.machine) {
      if (!this.config.machineId) {
        const matches = await Machine.list(
          this.connection,
          this.target === 'local' ? { labels: { [OWNER]: 'smol', 'mastra.sandbox.id': this.id } } : {},
        );
        const existing = matches.find(m => m.name === this.machineName);
        if (existing) {
          if (this.target === 'local' && existing.labels['mastra.sandbox.config-sha256'] !== this.configHash) {
            throw new Error(
              `Existing Smol machine '${existing.id}' has a different configuration; destroy it or choose another id.`,
            );
          }
          this.machine = await Machine.connect(existing.id, this.connection);
        } else if (this.target === 'cloud' && matches.some(m => m.name.startsWith(`${this.machinePrefix}-`))) {
          throw new Error(
            `Existing Smol Cloud machine for '${this.id}' has a different configuration; destroy it or choose another id.`,
          );
        }
      } else if (this.config.machineId) {
        this.machine = await Machine.connect(this.config.machineId, this.connection);
      }
    }
    if (this.machine) {
      const state = await this.machine.state();
      if (state === 'paused') await this.machine.resume();
      else if (state === 'stopped') await this.machine.start();
      else if (state !== 'running' && state !== 'started')
        throw new Error(`Cannot reconnect to Smol machine in state '${state}'.`);
      if (this.target === 'cloud') await this.machine.waitUntilReady();
      return { outcome: 'connected' };
    }
    const resources: ResourceSpec = { ...this.config.resources };
    if (this.config.allowHosts) resources.allowHosts = this.config.allowHosts;
    else if (this.config.network !== undefined || this.target === 'local') {
      resources.network = this.config.network ?? true;
    }
    const env = Object.fromEntries(
      Object.entries(this.getEnv()).filter((pair): pair is [string, string] => pair[1] !== undefined),
    );
    const create: MachineConfig = {
      image: this.config.image === null ? undefined : this.config.image ?? DEFAULT_IMAGE,
      name: this.machineName,
      workdir: this.workingDirectory,
      env,
      resources,
      ...(this.config.ports ? { ports: this.config.ports } : {}),
      ...(this.target === 'local'
        ? { labels: this.labels, detach: true, waitForPorts: false, mounts: this.config.mounts }
        : {}),
    };
    this.machine = await Machine.create(create, this.connection);
    return { outcome: 'created' };
  }

  async stop(): Promise<void> {
    if (this.machine) {
      // Portable RAM checkpoints cannot include host mounts. A normal stop
      // preserves the guest disk and syncs staged mounts for those VMs.
      if (this.target === 'local' && this.config.mounts?.length) await this.machine.stop();
      else await this.machine.pause();
    }
  }

  async destroy(): Promise<void> {
    if (!this.machine && this.config.machineId)
      this.machine = await Machine.connect(this.config.machineId, this.connection);
    if (this.machine) await this.machine.delete();
    this.machine = undefined;
  }

  async snapshot(): Promise<void> {
    if (!this.supportsCheckpoints) {
      throw new Error('Set checkpointPath to enable local Smol checkpoints.');
    }
    await this.ensureRunning();
    this.lastCheckpoint = await this.machine!.checkpoint(
      this.target === 'local' ? this.config.checkpointPath : undefined,
    );
  }

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    await this.ensureRunning();
    if (options.abortSignal?.aborted) throw new SandboxAbortError('command', options.abortSignal.reason);
    const shellCommand = args.length ? `${command} ${args.map(quote).join(' ')}` : command;
    const started = Date.now();
    const limit = options.maxRetainedBytes ?? Infinity;
    if (Number.isNaN(limit) || limit < 0) throw new Error('maxRetainedBytes must be nonnegative.');
    let stdout = '';
    let stderr = '';
    let exitCode: number | undefined;
    let timedOut = false;
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.abortSignal?.reason);
    options.abortSignal?.addEventListener('abort', onAbort, { once: true });
    const timer =
      options.timeout && Number.isFinite(options.timeout) && options.timeout > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort(new Error('Smol command timed out'));
          }, options.timeout)
        : undefined;
    try {
      for await (const event of this.machine!.execStream(['/bin/sh', '-c', shellCommand], {
        workdir: options.cwd ?? this.workingDirectory,
        env: Object.fromEntries(
          Object.entries({ ...this.getEnv(), ...options.env }).filter(
            (pair): pair is [string, string] => pair[1] !== undefined,
          ),
        ),
        signal: controller.signal,
        ...(options.timeout && Number.isFinite(options.timeout) && options.timeout > 0
          ? { timeout: Math.max(1, Math.ceil(options.timeout / 1000)) }
          : {}),
      })) {
        if (event.kind === 'error') throw new Error(event.message);
        if (event.kind === 'exit') exitCode = event.exitCode;
        if (event.kind === 'stdout') {
          options.onStdout?.(event.data);
          stdout = retainTail(stdout, event.data, limit);
        }
        if (event.kind === 'stderr') {
          options.onStderr?.(event.data);
          stderr = retainTail(stderr, event.data, limit);
        }
      }
    } catch (error) {
      if (!timedOut) {
        if (options.abortSignal?.aborted) throw new SandboxAbortError('command', options.abortSignal.reason);
        throw error;
      }
    } finally {
      if (timer) clearTimeout(timer);
      options.abortSignal?.removeEventListener('abort', onAbort);
    }
    if (exitCode === undefined && !timedOut) throw new Error('Smol command stream ended without an exit status.');
    return {
      command: shellCommand,
      args,
      stdout,
      stderr,
      success: !timedOut && exitCode === 0,
      exitCode: timedOut ? 124 : exitCode!,
      executionTimeMs: Date.now() - started,
      ...(timedOut ? { timedOut: true, ...(this.target === 'local' ? { killed: true } : {}) } : {}),
    };
  }

  async writeFiles(files: SandboxFileInput[], options: WriteFilesOptions = {}): Promise<void> {
    await this.ensureRunning();
    for (const file of files) {
      if (options.abortSignal?.aborted) throw new SandboxAbortError('writeFiles', options.abortSignal.reason);
      if (file.mode !== undefined && (!Number.isInteger(file.mode) || file.mode < 1 || file.mode > 0o777)) {
        throw new Error(`Invalid mode for ${file.path}.`);
      }
      if (!file.path) throw new Error('File destination cannot be empty.');
      const base = posix.resolve('/', this.workingDirectory ?? DEFAULT_WORKDIR);
      const target = posix.isAbsolute(file.path) ? posix.normalize(file.path) : posix.resolve(base, file.path);
      if (!posix.isAbsolute(file.path) && target !== base && !target.startsWith(`${base}/`)) {
        throw new Error(`Relative file destination escapes the working directory: ${file.path}`);
      }
      const result = await this.machine!.exec(['mkdir', '-p', posix.dirname(target)]);
      if (result.exitCode !== 0) throw new Error(`Could not create parent directory: ${result.stderr}`);
      await this.machine!.writeFile(target, file.content, file.mode);
    }
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this.createdAt,
      resources: { cpuCores: this.config.resources?.cpus, memoryMB: this.config.resources?.memoryMb },
      metadata: {
        target: this.target,
        machineId: this.machine?.id ?? this.config.machineId,
        image: this.config.image === null ? undefined : this.config.image ?? DEFAULT_IMAGE,
        checkpointId: this.lastCheckpoint?.id,
      },
    };
  }

  getInstructions(): string {
    return (
      this.config.instructions ??
      `Commands run inside an isolated Smol microVM at ${this.workingDirectory}. Workspace filesystem tools access this VM's files only when configured with the same mounted directory or a shared filesystem.`
    );
  }
}
