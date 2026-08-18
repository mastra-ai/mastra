/**
 * Docker Sandbox Provider
 *
 * A Docker-based sandbox implementation that uses long-lived containers
 * with `docker exec` for command execution. Targets local development,
 * CI/CD, air-gapped deployments, and cost-sensitive scenarios where
 * cloud sandboxes are overkill.
 *
 * @see https://docs.docker.com/engine/api/
 */

import { isDeepStrictEqual } from 'node:util';
import type { RequestContext } from '@mastra/core/di';
import type { SandboxInfo, ProviderStatus, MastraSandboxOptions, SandboxCloneOptions } from '@mastra/core/workspace';
import { MastraSandbox, SandboxError, SandboxNotReadyError } from '@mastra/core/workspace';
import Docker from 'dockerode';
import type { Container, ContainerInfo } from 'dockerode';
import { DockerProcessManager } from './process-manager';

const LOG_PREFIX = '[DockerSandbox]';

/**
 * Inlined from `@mastra/core/workspace` to avoid requiring a newer core peer dep.
 * Canonical type: packages/core/src/workspace/sandbox/mastra-sandbox.ts
 * TODO: Remove once minimum peer dep includes InstructionsOption export.
 */
type InstructionsOption = string | ((opts: { defaultInstructions: string; requestContext?: RequestContext }) => string);

type DockerSandboxUlimit = {
  name: string;
  soft: number;
  hard: number;
};

type DockerSandboxTmpfs = Record<string, string>;

// =============================================================================
// Docker Sandbox Options
// =============================================================================

export interface DockerSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Unique identifier for this sandbox instance. Used for label-based reconnection. */
  id?: string;
  /**
   * Container display name passed to Docker as `--name`.
   * Characters outside `[a-zA-Z0-9_.-]` are replaced with `-` and the result
   * is prefixed if it would not start with an alphanumeric character.
   * @default the sandbox `id`
   */
  name?: string;
  /** Docker image to use.
   * @default 'node:22-slim'
   */
  image?: string;
  /** Container entrypoint command. Must keep the container alive.
   * @default ['sleep', 'infinity']
   */
  command?: string[];
  /** Environment variables to set in the container */
  env?: Record<string, string>;
  /** Host-to-container bind mounts (e.g., `{ '/host/path': '/container/path' }`) */
  volumes?: Record<string, string>;
  /** Docker network to join */
  network?: string;
  /** Run in privileged mode
   * @default false
   */
  privileged?: boolean;
  /** Memory limit in bytes (HostConfig.Memory). Docker treats 0 as unlimited. */
  memory?: number;
  /** Total memory plus swap in bytes (HostConfig.MemorySwap). */
  memorySwap?: number;
  /** CPU shares relative weight (HostConfig.CpuShares). */
  cpuShares?: number;
  /** CPU quota in microseconds per period (HostConfig.CpuQuota). */
  cpuQuota?: number;
  /** CPU period in microseconds (HostConfig.CpuPeriod). */
  cpuPeriod?: number;
  /** Maximum number of PIDs in the container (HostConfig.PidsLimit). */
  pidsLimit?: number;
  /** Mount the container root filesystem as read-only (HostConfig.ReadonlyRootfs). */
  readonlyRootfs?: boolean;
  /** Linux capabilities to drop (HostConfig.CapDrop), e.g. ['ALL']. */
  capDrop?: string[];
  /** Linux capabilities to add (HostConfig.CapAdd). */
  capAdd?: string[];
  /** Security options (HostConfig.SecurityOpt), e.g. ['no-new-privileges:true']. */
  securityOpt?: string[];
  /** Ulimit entries for Docker HostConfig.Ulimits. */
  ulimits?: DockerSandboxUlimit[];
  /** tmpfs mount paths with options (HostConfig.Tmpfs). */
  tmpfs?: DockerSandboxTmpfs;
  /** Default command timeout in milliseconds
   * @default 300_000 // 5 minutes
   */
  timeout?: number;
  /** Working directory inside the container
   * @default '/workspace'
   */
  workingDir?: string;
  /** Container labels for filtering and identification */
  labels?: Record<string, string>;
  /** Pass-through dockerode connection options (socket path, host, TLS certs) */
  dockerOptions?: Docker.DockerOptions;
  /**
   * Custom instructions that override the default instructions
   * returned by `getInstructions()`.
   *
   * - `string` — Fully replaces the default instructions.
   *   Pass an empty string to suppress instructions entirely.
   * - `(opts) => string` — Receives the default instructions and
   *   optional request context so you can extend or customise per-request.
   */
  instructions?: InstructionsOption;
}

// =============================================================================
// Docker Sandbox Implementation
// =============================================================================

/**
 * Docker sandbox implementation using long-lived containers.
 *
 * Features:
 * - Long-lived container with `docker exec` for commands
 * - Bind mount support via Docker volumes
 * - Reconnection to existing containers by ID/name
 * - Container label tracking for discovery
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { DockerSandbox } from '@mastra/docker';
 *
 * const sandbox = new DockerSandbox({
 *   image: 'node:22-slim',
 *   timeout: 60000,
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * const result = await workspace.executeCode('console.log("Hello!")');
 * ```
 *
 * @example With bind mounts
 * ```typescript
 * const sandbox = new DockerSandbox({
 *   image: 'node:22-slim',
 *   volumes: { '/my/project': '/workspace/project' },
 * });
 * ```
 */
export class DockerSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'DockerSandbox';
  readonly provider = 'docker';
  status: ProviderStatus = 'pending';

  declare readonly processes: DockerProcessManager;

  /** Underlying Docker client */
  private readonly _docker: Docker;

  /** Container reference (set after start) */
  private _container: Container | null = null;

  /** Configuration */
  private readonly _containerName: string;
  private readonly _image: string;
  private readonly _command: string[];
  private readonly _env: Record<string, string>;
  private readonly _volumes: Record<string, string>;
  private readonly _network?: string;
  private readonly _privileged: boolean;
  private readonly _privilegedWasSet: boolean;
  private readonly _memory?: number;
  private readonly _memorySwap?: number;
  private readonly _cpuShares?: number;
  private readonly _cpuQuota?: number;
  private readonly _cpuPeriod?: number;
  private readonly _pidsLimit?: number;
  private readonly _readonlyRootfs?: boolean;
  private readonly _capDrop?: string[];
  private readonly _capAdd?: string[];
  private readonly _securityOpt?: string[];
  private readonly _ulimits?: DockerSandboxUlimit[];
  private readonly _tmpfs?: DockerSandboxTmpfs;
  private readonly _workingDir: string;
  private readonly _labels: Record<string, string>;
  private readonly _instructionsOverride?: InstructionsOption;
  private readonly _constructorOptions: DockerSandboxOptions;

  constructor(options: DockerSandboxOptions = {}) {
    const processManager = new DockerProcessManager({
      env: options.env ?? {},
      defaultTimeout: options.timeout ?? 300_000,
    });

    super({
      ...options,
      name: 'DockerSandbox',
      processes: processManager,
    });

    this.id = options.id ?? this._generateId();
    this._containerName = sanitizeContainerName(options.name ?? this.id);
    this._image = options.image ?? 'node:22-slim';
    this._command = options.command ?? ['sleep', 'infinity'];
    this._env = options.env ?? {};
    this._volumes = options.volumes ?? {};
    this._network = options.network;
    this._privileged = options.privileged ?? false;
    this._privilegedWasSet = options.privileged !== undefined;
    this._memory = options.memory;
    this._memorySwap = options.memorySwap;
    this._cpuShares = options.cpuShares;
    this._cpuQuota = options.cpuQuota;
    this._cpuPeriod = options.cpuPeriod;
    this._pidsLimit = options.pidsLimit;
    this._readonlyRootfs = options.readonlyRootfs;
    this._capDrop = options.capDrop;
    this._capAdd = options.capAdd;
    this._securityOpt = options.securityOpt;
    this._ulimits = options.ulimits;
    this._tmpfs = options.tmpfs;
    this._workingDir = options.workingDir ?? '/workspace';
    this._labels = {
      ...options.labels,
      'mastra.sandbox': 'true',
      'mastra.sandbox.id': this.id,
    };
    this._instructionsOverride = options.instructions;
    this._docker = new Docker(options.dockerOptions);
    this._constructorOptions = { ...options };
  }

  /**
   * Construct a sibling `DockerSandbox` that inherits this sandbox's
   * configuration (image, resource limits, security options, labels,
   * connection options) with per-instance overrides.
   *
   * Performs no I/O — the sandbox clone provisions (or reconnects to an
   * existing container labelled with the same logical `id`) on its own
   * `start()`. Use it when one configured sandbox acts as the template for a
   * fleet of independent sandboxes (e.g. one per project).
   *
   * `options.idleTimeoutMinutes` is ignored (Docker containers have no
   * provider-side idle teardown; `timeout` here is a command timeout), and
   * `options.sandboxId` is ignored because reconnection is by logical `id`.
   */
  clone(options: SandboxCloneOptions = {}): DockerSandbox {
    const { id: _id, name: _name, ...base } = this._constructorOptions;
    return new DockerSandbox({
      ...base,
      ...(options.id !== undefined && { id: options.id }),
      ...(options.env !== undefined && { env: options.env }),
    });
  }

  /**
   * Get the underlying Docker container for direct access.
   * @throws {SandboxNotReadyError} If the sandbox has not been started.
   */
  get container(): Container {
    if (!this._container) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._container;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    this.logger.debug(`${LOG_PREFIX} Starting sandbox ${this.id}...`);

    // Try to reconnect to existing container
    const existing = await this._findExistingContainer();
    if (existing) {
      this.logger.debug(`${LOG_PREFIX} Found existing container ${existing.Id}`);
      this._container = this._docker.getContainer(existing.Id);

      // Use inspect() to get authoritative container state — listContainers() state
      // can be stale immediately after stop() returns but before container fully exits
      const info = await this._container.inspect();
      // On reconnect, actual HostConfig controls whether hardening is effective.
      this._warnOnPrivilegedHardeningConflict(info.HostConfig?.Privileged ?? this._privileged);
      this._warnOnReconnectedHostConfigMismatch(existing.Id, info.HostConfig);
      const actualState = info.State?.Running ? 'running' : 'stopped';

      if (actualState !== 'running') {
        this.logger.debug(`${LOG_PREFIX} Container exists but not running (${actualState}), starting...`);
        await this._container.start();
      }

      // Provide container reference to process manager
      this.processes.setContainer(this._container);

      this.logger.debug(`${LOG_PREFIX} Reconnected to container ${existing.Id}`);
      return;
    }

    this._warnOnPrivilegedHardeningConflict(this._privileged);

    // Pull image if not available locally
    await this._ensureImage();

    // Build environment array for Docker API
    const envArray = Object.entries(this._env).map(([k, v]) => `${k}=${v}`);

    // Build bind mount array
    const binds = Object.entries(this._volumes).map(([host, container]) => `${host}:${container}`);

    // Create container
    this.logger.debug(`${LOG_PREFIX} Creating container with image ${this._image}...`);
    this._container = await this._docker.createContainer({
      name: this._containerName,
      Image: this._image,
      Cmd: this._command,
      Env: envArray,
      WorkingDir: this._workingDir,
      Labels: this._labels,
      HostConfig: {
        Binds: binds.length > 0 ? binds : undefined,
        NetworkMode: this._network,
        Privileged: this._privileged,
        Memory: this._memory,
        MemorySwap: this._memorySwap,
        CpuShares: this._cpuShares,
        CpuQuota: this._cpuQuota,
        CpuPeriod: this._cpuPeriod,
        PidsLimit: this._pidsLimit,
        ReadonlyRootfs: this._readonlyRootfs,
        CapDrop: this._capDrop,
        CapAdd: this._capAdd,
        SecurityOpt: this._securityOpt,
        Ulimits: this._ulimits?.map(toDockerUlimit),
        Tmpfs: this._tmpfs,
      },
      // Keep stdin open for interactive use
      OpenStdin: true,
      Tty: false,
    });

    // Start container
    await this._container.start();

    // Provide container reference to process manager
    this.processes.setContainer(this._container);

    this.logger.debug(`${LOG_PREFIX} Container started: ${this._container.id}`);
  }

  private _warnOnPrivilegedHardeningConflict(effectivePrivileged: boolean | undefined): void {
    if (!effectivePrivileged) return;

    // Privileged mode makes capability and security-option controls ineffective.
    // ReadonlyRootfs, ulimits, tmpfs, memory, CPU, and PID limits still apply.
    const conflictedHostConfigFields = [
      this._capDrop && this._capDrop.length > 0 ? 'CapDrop' : undefined,
      this._capAdd && this._capAdd.length > 0 ? 'CapAdd' : undefined,
      this._securityOpt && this._securityOpt.length > 0 ? 'SecurityOpt' : undefined,
    ].filter((field): field is keyof Docker.HostConfig => field !== undefined);

    if (conflictedHostConfigFields.length === 0) return;

    const optionNames = conflictedHostConfigFields.map(toDockerSandboxOptionName);

    this.logger.warn(
      `${LOG_PREFIX} Privileged containers can bypass some requested hardening controls: ${optionNames.join(', ')}`,
      { fields: optionNames, hostConfigFields: conflictedHostConfigFields },
    );
  }

  private _warnOnReconnectedHostConfigMismatch(containerId: string, hostConfig?: Docker.HostConfig): void {
    if (!hostConfig) return;

    const mismatchedHostConfigFields = this._requestedHardeningHostConfigEntries(hostConfig)
      .filter(([field, requestedValue]) => !isHostConfigValueEqual(field, hostConfig[field], requestedValue))
      .map(([field]) => field);

    if (mismatchedHostConfigFields.length === 0) return;

    if (
      !this._privilegedWasSet &&
      hostConfig.Privileged === true &&
      mismatchedHostConfigFields.includes('Privileged')
    ) {
      this.logger.warn(
        `${LOG_PREFIX} Reconnected to existing container ${containerId}; the existing container is privileged, but this DockerSandbox did not request privileged mode. Destroy and recreate the sandbox to apply the default non-privileged mode.`,
        { containerId, fields: ['privileged'], hostConfigFields: ['Privileged'] },
      );
    }

    const remainingMismatchedHostConfigFields = mismatchedHostConfigFields.filter(
      field => field !== 'Privileged' || this._privilegedWasSet,
    );

    if (remainingMismatchedHostConfigFields.length === 0) return;

    const mismatchedOptions = remainingMismatchedHostConfigFields.map(toDockerSandboxOptionName);

    this.logger.warn(
      `${LOG_PREFIX} Reconnected to existing container ${containerId}; requested Docker option(s) ${mismatchedOptions.join(
        ', ',
      )} differ from inspected HostConfig field(s) ${remainingMismatchedHostConfigFields.join(
        ', ',
      )} and cannot be applied to the existing container. Destroy and recreate the sandbox to apply them.`,
      { containerId, fields: mismatchedOptions, hostConfigFields: remainingMismatchedHostConfigFields },
    );
  }

  private _requestedHardeningHostConfigEntries(
    hostConfig?: Docker.HostConfig,
  ): Array<[keyof Docker.HostConfig, unknown]> {
    const entries: Array<[keyof Docker.HostConfig, unknown]> = [
      ['Memory', this._memory],
      ['MemorySwap', this._memorySwap],
      ['CpuShares', this._cpuShares],
      ['CpuQuota', this._cpuQuota],
      ['CpuPeriod', this._cpuPeriod],
      ['PidsLimit', this._pidsLimit],
      ['ReadonlyRootfs', this._readonlyRootfs],
      ['CapDrop', this._capDrop],
      ['CapAdd', this._capAdd],
      ['SecurityOpt', this._securityOpt],
      ['Ulimits', this._ulimits],
      ['Tmpfs', this._tmpfs],
    ];

    if (this._privilegedWasSet || hostConfig?.Privileged === true) {
      entries.unshift(['Privileged', this._privileged]);
    }

    return entries.filter((entry): entry is [keyof Docker.HostConfig, unknown] => isPresentHostConfigValue(entry[1]));
  }

  async stop(): Promise<void> {
    const container = await this._resolveContainer();
    if (!container) return;

    this.logger.debug(`${LOG_PREFIX} Stopping container ${container.id}...`);
    try {
      await container.stop({ t: 10 });
    } catch (error: unknown) {
      // Container may already be stopped
      if (!isContainerNotRunningError(error)) {
        throw error;
      }
    }
    this.processes.reset();
    this.logger.debug(`${LOG_PREFIX} Container stopped`);
  }

  async destroy(): Promise<void> {
    const container = await this._resolveContainer();
    if (!container) return;

    this.logger.debug(`${LOG_PREFIX} Destroying container ${container.id}...`);
    try {
      await container.remove({ force: true, v: true });
    } catch (error: unknown) {
      // Container may already be removed
      if (!isContainerNotFoundError(error)) {
        throw error;
      }
    }
    this.processes.reset();
    this._container = null;
    this.logger.debug(`${LOG_PREFIX} Container destroyed`);
  }

  // ---------------------------------------------------------------------------
  // Instructions
  // ---------------------------------------------------------------------------

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = [
      `You are working inside a Docker container (image: ${this._image}).`,
      `The working directory is ${this._workingDir}.`,
      'You can execute shell commands using executeCommand().',
      'You can spawn background processes using processes.spawn().',
    ].join('\n');

    if (this._instructionsOverride === undefined) return defaultInstructions;
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
  }

  // ---------------------------------------------------------------------------
  // Info
  // ---------------------------------------------------------------------------

  async getInfo(): Promise<SandboxInfo> {
    const info: SandboxInfo = {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: new Date(),
      metadata: {
        image: this._image,
        workingDir: this._workingDir,
        labels: this._labels,
      },
    };

    if (this._container) {
      try {
        const inspect = await this._container.inspect();
        info.createdAt = new Date(inspect.Created);
        info.metadata = {
          ...info.metadata,
          containerId: inspect.Id,
          containerName: inspect.Name,
          state: inspect.State.Status,
        };
      } catch {
        // Container may have been removed
      }
    }

    return info;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _generateId(): string {
    return `docker-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Resolve the container reference, looking up by label if `_container` is unset.
   * This ensures `stop()` and `destroy()` work even when the instance was created
   * with an existing container's ID but `start()` was never called.
   */
  private async _resolveContainer(): Promise<Container | null> {
    if (this._container) return this._container;
    const existing = await this._findExistingContainer();
    if (!existing) return null;
    this._container = this._docker.getContainer(existing.Id);
    return this._container;
  }

  /**
   * Find an existing container matching this sandbox's ID via labels.
   */
  private async _findExistingContainer(): Promise<ContainerInfo | null> {
    try {
      const containers = await this._docker.listContainers({
        all: true,
        filters: {
          label: [`mastra.sandbox.id=${this.id}`],
        },
      });
      return containers[0] ?? null;
    } catch (error) {
      // Log and re-throw infrastructure errors (daemon unreachable, auth, etc.)
      this.logger.debug(
        `${LOG_PREFIX} Failed to list containers: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Ensure the Docker image is available locally. Pulls if needed.
   */
  private async _ensureImage(): Promise<void> {
    try {
      await this._docker.getImage(this._image).inspect();
      this.logger.debug(`${LOG_PREFIX} Image ${this._image} available locally`);
    } catch (error) {
      // Only attempt pull if the image doesn't exist (404).
      // Re-throw infrastructure errors (daemon unreachable, auth, etc.)
      if (!isImageNotFoundError(error)) {
        throw error;
      }

      this.logger.debug(`${LOG_PREFIX} Pulling image ${this._image}...`);
      try {
        const stream = await this._docker.pull(this._image);
        await new Promise<void>((resolve, reject) => {
          this._docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this.logger.debug(`${LOG_PREFIX} Image ${this._image} pulled successfully`);
      } catch (error) {
        throw new SandboxError(
          `Failed to pull Docker image '${this._image}': ${error instanceof Error ? error.message : String(error)}`,
          'NOT_READY',
          { image: this._image, reason: 'image_pull_failed' },
        );
      }
    }
  }
}

// =============================================================================
// Error detection helpers
// =============================================================================

// Docker container name regex (`^[a-zA-Z0-9][a-zA-Z0-9_.-]+$`) — first char must be
// alphanumeric, remaining chars from `[a-zA-Z0-9_.-]`, total length ≥ 2.
function sanitizeContainerName(value: string): string {
  const replaced = value.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const withLeading = /^[a-zA-Z0-9]/.test(replaced) ? replaced : `s-${replaced}`;
  return withLeading.length >= 2 ? withLeading : `${withLeading}-sandbox`;
}

function isContainerNotRunningError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('is not running') || error.message.includes('container already stopped');
  }
  return false;
}

function isContainerNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('no such container') || (msg.includes('removal') && msg.includes('is already in progress'));
  }
  return false;
}

function isImageNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('no such image');
  }
  return false;
}

function isHostConfigValueEqual(field: keyof Docker.HostConfig, actual: unknown, expected: unknown): boolean {
  // Structural equality for the Docker HostConfig shapes exposed by DockerSandboxOptions.
  return isDeepStrictEqual(normalizeHostConfigValue(field, actual), normalizeHostConfigValue(field, expected));
}

function normalizeHostConfigValue(field: keyof Docker.HostConfig, value: unknown): unknown {
  if (value == null) return undefined;

  if ((field === 'CapAdd' || field === 'CapDrop') && Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return value.map(normalizeCapability).sort();
  }

  if (field === 'SecurityOpt' && Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return value.map(normalizeSecurityOpt).sort();
  }

  if (field === 'Tmpfs' && value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.keys(value).length === 0) return undefined;
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, options]) => [path, typeof options === 'string' ? normalizeTmpfsOptions(options) : options]),
    );
  }

  if (Array.isArray(value)) {
    if (field === 'Ulimits' && value.length === 0) return undefined;
    return value
      .map(nestedValue => normalizeHostConfigValue(field, nestedValue))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  if (field === 'Ulimits' && value && typeof value === 'object') {
    return normalizeUlimit(value);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, normalizeHostConfigValue(field, nestedValue)]),
    );
  }

  return value;
}

function isPresentHostConfigValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function normalizeCapability(capability: unknown): unknown {
  return typeof capability === 'string' ? capability.toUpperCase().replace(/^CAP_/, '') : capability;
}

function normalizeTmpfsOptions(options: string): string {
  return options
    .split(',')
    .map(option => option.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

function normalizeSecurityOpt(option: unknown): unknown {
  if (typeof option !== 'string') return option;

  const noNewPrivileges = option.match(/^no-new-privileges[:=](.+)$/i);
  if (noNewPrivileges) {
    return `no-new-privileges=${noNewPrivileges[1]}`;
  }

  return option;
}

function normalizeUlimit(value: object): unknown {
  const record = value as Record<string, unknown>;
  return {
    name: record.name ?? record.Name,
    soft: record.soft ?? record.Soft,
    hard: record.hard ?? record.Hard,
  };
}

function toDockerUlimit(ulimit: DockerSandboxUlimit): Docker.Ulimit {
  return {
    Name: ulimit.name,
    Soft: ulimit.soft,
    Hard: ulimit.hard,
  };
}

function toDockerSandboxOptionName(field: keyof Docker.HostConfig): string {
  const optionNames: Partial<Record<keyof Docker.HostConfig, string>> = {
    Privileged: 'privileged',
    Memory: 'memory',
    MemorySwap: 'memorySwap',
    CpuShares: 'cpuShares',
    CpuQuota: 'cpuQuota',
    CpuPeriod: 'cpuPeriod',
    PidsLimit: 'pidsLimit',
    ReadonlyRootfs: 'readonlyRootfs',
    CapDrop: 'capDrop',
    CapAdd: 'capAdd',
    SecurityOpt: 'securityOpt',
    Ulimits: 'ulimits',
    Tmpfs: 'tmpfs',
  };

  return optionNames[field] ?? String(field);
}
