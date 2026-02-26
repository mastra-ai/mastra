/**
 * Daytona Sandbox Provider
 *
 * A Daytona sandbox implementation for Mastra workspaces.
 * Supports command execution, environment variables, resource configuration,
 * snapshots, and Daytona volumes.
 *
 * @see https://www.daytona.io/docs
 */

import { Daytona, DaytonaNotFoundError, SandboxState } from '@daytonaio/sdk';
import type {
  CreateSandboxFromImageParams,
  CreateSandboxFromSnapshotParams,
  Sandbox,
  VolumeMount,
} from '@daytonaio/sdk';
import type { SandboxInfo, ProviderStatus, MastraSandboxOptions } from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';

import { compact } from '../utils/compact';
import { DaytonaProcessManager } from './process-manager';
import type { DaytonaResources } from './types';

const LOG_PREFIX = '[@mastra/daytona]';

/** Patterns indicating the sandbox is dead/gone (@daytonaio/sdk@0.143.0). */
const SANDBOX_DEAD_PATTERNS: RegExp[] = [
  /sandbox is not running/i,
  /sandbox already destroyed/i,
  /sandbox.*not found/i,
];

// =============================================================================
// Daytona Sandbox Options
// =============================================================================

/**
 * Daytona sandbox provider configuration.
 */
export interface DaytonaSandboxOptions extends MastraSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /** API key for authentication. Falls back to DAYTONA_API_KEY env var. */
  apiKey?: string;
  /** API URL. Falls back to DAYTONA_API_URL env var or https://app.daytona.io/api. */
  apiUrl?: string;
  /** Target runner region. Falls back to DAYTONA_TARGET env var. */
  target?: string;
  /**
   * Default execution timeout in milliseconds.
   * @default 300_000 // 5 minutes
   */
  timeout?: number;
  /**
   * Sandbox runtime language.
   * @default 'typescript'
   */
  language?: 'typescript' | 'javascript' | 'python';
  /** Resource allocation for the sandbox */
  resources?: DaytonaResources;
  /** Environment variables to set in the sandbox */
  env?: Record<string, string>;
  /** Custom metadata labels */
  labels?: Record<string, string>;
  /** Pre-built snapshot ID to create sandbox from. Takes precedence over resources/image. */
  snapshot?: string;
  /**
   * Docker image to use for sandbox creation. When set, triggers image-based creation.
   * Can optionally be combined with `resources` for custom resource allocation.
   * Has no effect when `snapshot` is set.
   */
  image?: string;
  /**
   * Whether the sandbox should be ephemeral. If true, autoDeleteInterval will be set to 0
   * (delete immediately on stop).
   * @default false
   */
  ephemeral?: boolean;
  /**
   * Auto-stop interval in minutes (0 = disabled).
   * @default 15
   */
  autoStopInterval?: number;
  /**
   * Auto-archive interval in minutes (0 = maximum interval, which is 7 days).
   * @default 7 days
   */
  autoArchiveInterval?: number;
  /**
   * Daytona volumes to attach at creation.
   * Volumes are configured at sandbox creation time, not mounted dynamically.
   */
  volumes?: Array<VolumeMount>;
  /** Sandbox display name */
  name?: string;
  /** OS user to use for the sandbox */
  user?: string;
  /** Whether the sandbox port preview is public */
  public?: boolean;
  /**
   * Auto-delete interval in minutes (negative = disabled, 0 = delete immediately on stop).
   * @default disabled
   */
  autoDeleteInterval?: number;
  /** Whether to block all network access for the sandbox */
  networkBlockAll?: boolean;
  /** Comma-separated list of allowed CIDR network addresses for the sandbox */
  networkAllowList?: string;
}

// =============================================================================
// Daytona Sandbox Implementation
// =============================================================================

/**
 * Daytona sandbox provider for Mastra workspaces.
 *
 * Features:
 * - Isolated cloud sandbox via Daytona SDK
 * - Multi-runtime support (TypeScript, JavaScript, Python)
 * - Resource configuration (CPU, memory, disk)
 * - Volume attachment at creation time
 * - Automatic sandbox timeout handling with retry
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { DaytonaSandbox } from '@mastra/daytona';
 *
 * const sandbox = new DaytonaSandbox({
 *   timeout: 60000,
 *   language: 'typescript',
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * const result = await workspace.executeCode('console.log("Hello!")');
 * ```
 *
 * @example With resources and volumes
 * ```typescript
 * const sandbox = new DaytonaSandbox({
 *   resources: { cpu: 2, memory: 4, disk: 6 },
 *   volumes: [{ volumeId: 'vol-123', mountPath: '/data' }],
 *   env: { NODE_ENV: 'production' },
 * });
 * ```
 */
export class DaytonaSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'DaytonaSandbox';
  readonly provider = 'daytona';

  status: ProviderStatus = 'pending';

  private _daytona: Daytona | null = null;
  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;
  private _isRetrying = false;
  private _workingDir: string | null = null;

  private readonly timeout: number;
  private readonly language: 'typescript' | 'javascript' | 'python';
  private readonly resources?: DaytonaResources;
  private readonly env: Record<string, string>;
  private readonly labels: Record<string, string>;
  private readonly snapshotId?: string;
  private readonly image?: string;
  private readonly ephemeral: boolean;
  private readonly autoStopInterval?: number;
  private readonly autoArchiveInterval?: number;
  private readonly autoDeleteInterval?: number;
  private readonly volumeConfigs: Array<VolumeMount>;
  private readonly sandboxName?: string;
  private readonly sandboxUser?: string;
  private readonly sandboxPublic?: boolean;
  private readonly networkBlockAll?: boolean;
  private readonly networkAllowList?: string;
  private readonly connectionOpts: { apiKey?: string; apiUrl?: string; target?: string };

  constructor(options: DaytonaSandboxOptions = {}) {
    super({
      ...options,
      name: 'DaytonaSandbox',
      processes: new DaytonaProcessManager({
        env: options.env,
        defaultTimeout: options.timeout ?? 300_000,
      }),
    });

    this.id = options.id ?? this.generateId();
    this.timeout = options.timeout ?? 300_000;
    this.language = options.language ?? 'typescript';
    this.resources = options.resources;
    this.env = options.env ?? {};
    this.labels = options.labels ?? {};
    this.snapshotId = options.snapshot;
    this.image = options.image;
    this.ephemeral = options.ephemeral ?? false;
    this.autoStopInterval = options.autoStopInterval ?? 15;
    this.autoArchiveInterval = options.autoArchiveInterval;
    this.autoDeleteInterval = options.autoDeleteInterval;
    this.volumeConfigs = options.volumes ?? [];
    this.sandboxName = options.name ?? this.id;
    this.sandboxUser = options.user;
    this.sandboxPublic = options.public;
    this.networkBlockAll = options.networkBlockAll;
    this.networkAllowList = options.networkAllowList;

    this.connectionOpts = {
      ...(options.apiKey !== undefined && { apiKey: options.apiKey }),
      ...(options.apiUrl !== undefined && { apiUrl: options.apiUrl }),
      ...(options.target !== undefined && { target: options.target }),
    };
  }

  private generateId(): string {
    return `daytona-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Get the underlying Daytona Sandbox instance for direct access to Daytona APIs.
   *
   * Use this when you need to access Daytona features not exposed through the
   * WorkspaceSandbox interface (e.g., filesystem API, git operations, LSP).
   *
   * @throws {SandboxNotReadyError} If the sandbox has not been started
   *
   * @example Direct file operations
   * ```typescript
   * const daytonaSandbox = sandbox.instance;
   * await daytonaSandbox.fs.uploadFile(Buffer.from('Hello'), '/tmp/test.txt');
   * ```
   */
  get instance(): Sandbox {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start the Daytona sandbox.
   * Reconnects to an existing sandbox with the same logical ID if one exists,
   * otherwise creates a new sandbox instance.
   */
  async start(): Promise<void> {
    if (this._sandbox) {
      return;
    }

    // Create Daytona client if not exists
    if (!this._daytona) {
      this._daytona = new Daytona(this.connectionOpts);
    }

    // Try to reconnect to an existing sandbox with the same logical ID
    const existing = await this.findExistingSandbox();
    if (existing) {
      this._sandbox = existing;
      this._createdAt = existing.createdAt ? new Date(existing.createdAt) : new Date();
      this.logger.debug(`${LOG_PREFIX} Reconnected to existing sandbox ${existing.id} for: ${this.id}`);
      await this.detectWorkingDir();
      return;
    }

    this.logger.debug(`${LOG_PREFIX} Creating sandbox for: ${this.id}`);

    // Base params shared by both creation modes
    const baseParams = compact({
      language: this.language,
      envVars: this.env,
      labels: { ...this.labels, 'mastra-sandbox-id': this.id },
      ephemeral: this.ephemeral,
      autoStopInterval: this.autoStopInterval,
      autoArchiveInterval: this.autoArchiveInterval,
      autoDeleteInterval: this.autoDeleteInterval,
      volumes: this.volumeConfigs.length > 0 ? this.volumeConfigs : undefined,
      name: this.sandboxName,
      user: this.sandboxUser,
      public: this.sandboxPublic,
      networkBlockAll: this.networkBlockAll,
      networkAllowList: this.networkAllowList,
    });

    // Snapshot takes precedence. Image alone (with optional resources) triggers image-based creation.
    // Resources without image fall back to snapshot-based creation (resources are ignored).
    if (this.resources && !this.image) {
      this.logger.warn(
        `${LOG_PREFIX} 'resources' option requires 'image' to take effect — falling back to snapshot-based creation without custom resources`,
      );
    }

    const createParams: CreateSandboxFromSnapshotParams | CreateSandboxFromImageParams =
      this.image && !this.snapshotId
        ? (compact({
            ...baseParams,
            image: this.image,
            resources: this.resources,
          }) satisfies CreateSandboxFromImageParams)
        : (compact({ ...baseParams, snapshot: this.snapshotId }) satisfies CreateSandboxFromSnapshotParams);

    // Create sandbox
    this._sandbox = await this._daytona.create(createParams);

    this.logger.debug(`${LOG_PREFIX} Created sandbox ${this._sandbox.id} for logical ID: ${this.id}`);
    this._createdAt = new Date();

    // Detect the actual working directory (don't hardcode — custom images may differ)
    await this.detectWorkingDir();
  }

  /**
   * Stop the Daytona sandbox.
   * Stops the sandbox instance and releases the reference.
   */
  async stop(): Promise<void> {
    if (this._sandbox && this._daytona) {
      try {
        await this._daytona.stop(this._sandbox);
      } catch {
        // Best-effort stop; sandbox may already be stopped
      }
    }
    this._sandbox = null;
  }

  /**
   * Destroy the Daytona sandbox and clean up all resources.
   * Deletes the sandbox and clears all state.
   */
  async destroy(): Promise<void> {
    if (this._sandbox && this._daytona) {
      try {
        await this._daytona.delete(this._sandbox);
      } catch {
        // Ignore errors during cleanup
      }
    } else if (!this._sandbox && this._daytona) {
      // Orphan cleanup: _start() may have failed after the SDK created
      // a server-side sandbox (e.g. bad image → BUILD_FAILED).
      // Try to find and delete it so it doesn't leak.
      try {
        const orphan = await this._daytona.findOne({ labels: { 'mastra-sandbox-id': this.id } });
        if (orphan) {
          await this._daytona.delete(orphan);
        }
      } catch {
        // Best-effort — orphan may not exist or may already be gone
      }
    }

    this._sandbox = null;
    this._daytona = null;
    this.mounts?.clear();
  }

  /**
   * Check if the sandbox is ready for operations.
   */
  async isReady(): Promise<boolean> {
    return this.status === 'running' && this._sandbox !== null;
  }

  /**
   * Get information about the current state of the sandbox.
   */
  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      mounts: this.mounts
        ? Array.from(this.mounts.entries).map(([path, entry]) => ({
            path,
            filesystem: entry.filesystem?.provider ?? entry.config?.type ?? 'unknown',
          }))
        : [],
      ...(this._sandbox && {
        resources: {
          cpuCores: this._sandbox.cpu,
          memoryMB: this._sandbox.memory * 1024,
          diskMB: this._sandbox.disk * 1024,
        },
      }),
      metadata: {
        language: this.language,
        ephemeral: this.ephemeral,
        ...(this.snapshotId && { snapshot: this.snapshotId }),
        ...(this.image && { image: this.image }),
        ...(this._sandbox && { target: this._sandbox.target }),
      },
    };
  }

  /**
   * Get instructions describing this Daytona sandbox.
   * Used by agents to understand the execution environment.
   */
  getInstructions(): string {
    const parts: string[] = [];

    parts.push(`Cloud sandbox with isolated execution (${this.language} runtime).`);

    if (this._workingDir) {
      parts.push(`Default working directory: ${this._workingDir}.`);
    }
    parts.push(`Command timeout: ${Math.ceil(this.timeout / 1000)}s.`);

    parts.push(`Running as user: ${this.sandboxUser ?? 'daytona'}.`);

    if (this.volumeConfigs.length > 0) {
      parts.push(`${this.volumeConfigs.length} volume(s) attached.`);
    }

    if (this.networkBlockAll) {
      parts.push(`Network access is blocked.`);
    }

    return parts.join(' ');
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Detect the actual working directory inside the sandbox via `pwd`.
   * Stores the result for use in `getInstructions()`.
   */
  private async detectWorkingDir(): Promise<void> {
    if (!this._sandbox) return;
    try {
      const result = await this._sandbox.process.executeCommand('pwd');
      const dir = result.result?.trim();
      if (dir) {
        this._workingDir = dir;
        this.logger.debug(`${LOG_PREFIX} Detected working directory: ${dir}`);
      }
    } catch {
      this.logger.debug(`${LOG_PREFIX} Could not detect working directory, will omit from instructions`);
    }
  }

  /**
   * Try to find and reconnect to an existing Daytona sandbox with the same
   * logical ID (via the mastra-sandbox-id label). Returns the sandbox if
   * found and usable, or null if a fresh sandbox should be created.
   */
  private async findExistingSandbox(): Promise<Sandbox | null> {
    const DEAD_STATES: SandboxState[] = [
      SandboxState.DESTROYED,
      SandboxState.DESTROYING,
      SandboxState.ERROR,
      SandboxState.BUILD_FAILED,
    ];

    try {
      const sandbox = await this._daytona!.findOne({ labels: { 'mastra-sandbox-id': this.id } });
      const state = sandbox.state;

      if (state && DEAD_STATES.includes(state)) {
        this.logger.debug(
          `${LOG_PREFIX} Existing sandbox ${sandbox.id} is dead (${state}), deleting and creating fresh`,
        );
        try {
          await this._daytona!.delete(sandbox);
        } catch {
          // Best-effort cleanup of dead sandbox
        }
        return null;
      }

      if (state !== SandboxState.STARTED) {
        this.logger.debug(`${LOG_PREFIX} Restarting sandbox ${sandbox.id} (state: ${state})`);
        await this._daytona!.start(sandbox);
      }

      return sandbox;
    } catch {
      // Not found or any error — create a fresh sandbox
      return null;
    }
  }

  /**
   * Check if an error indicates the sandbox is dead/gone.
   * Uses DaytonaNotFoundError from the SDK when available,
   * with string fallback for edge cases.
   *
   * String patterns observed in @daytonaio/sdk@0.143.0 error messages.
   * Update if SDK error messages change in future versions.
   */
  private isSandboxDeadError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof DaytonaNotFoundError) return true;
    const errorStr = String(error);
    return SANDBOX_DEAD_PATTERNS.some(pattern => pattern.test(errorStr));
  }

  /**
   * Handle sandbox timeout by clearing the instance and resetting state.
   */
  private handleSandboxTimeout(): void {
    this._sandbox = null;

    // Reset mounted entries to pending so they get re-mounted on restart
    if (this.mounts) {
      for (const [path, entry] of this.mounts.entries) {
        if (entry.state === 'mounted' || entry.state === 'mounting') {
          this.mounts.set(path, { state: 'pending' });
        }
      }
    }

    this.status = 'stopped';
  }

  // ---------------------------------------------------------------------------
  // Retry on Dead
  // ---------------------------------------------------------------------------

  /**
   * Execute a function, retrying once if the sandbox is found to be dead.
   * Used by DaytonaProcessManager to handle stale sandboxes transparently.
   */
  async retryOnDead<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.isSandboxDeadError(error) && !this._isRetrying) {
        this.handleSandboxTimeout();
        this._isRetrying = true;
        try {
          await this.ensureRunning();
          return await fn();
        } finally {
          this._isRetrying = false;
        }
      }
      throw error;
    }
  }
}
