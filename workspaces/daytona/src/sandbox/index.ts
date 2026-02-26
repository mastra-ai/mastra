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
import type {
  SandboxInfo,
  ProviderStatus,
  MastraSandboxOptions,
  WorkspaceFilesystem,
  MountResult,
  FilesystemMountConfig,
  MountManager,
  CommandResult,
  ExecuteCommandOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';

import { compact } from '../utils/compact';
import { shellQuote } from '../utils/shell-quote';
import { DaytonaProcessManager } from './process-manager';
import { mountS3, mountGCS } from './mounts';
import type { DaytonaMountConfig, MountContext } from './mounts';
import type { DaytonaResources } from './types';

export const LOG_PREFIX = '[@mastra/daytona]';

/** Allowlist pattern for mount paths — absolute path with safe characters only. */
const SAFE_MOUNT_PATH = /^\/[a-zA-Z0-9_.\-/]+$/;

/** Allowlist for marker filenames from ls output — e.g. "mount-abc123" */
const SAFE_MARKER_NAME = /^mount-[a-z0-9]+$/;

function validateMountPath(mountPath: string): void {
  if (!SAFE_MOUNT_PATH.test(mountPath)) {
    throw new Error(
      `Invalid mount path: ${mountPath}. Must be an absolute path with alphanumeric, dash, dot, underscore, or slash characters only.`,
    );
  }
}

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
  declare readonly mounts: MountManager; // Non-optional (initialized by MastraSandbox base class)

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

      // Reconcile FUSE mounts — clean up stale mounts from a previous session
      const expectedPaths = Array.from(this.mounts.entries.keys());
      this.logger.debug(`${LOG_PREFIX} Running mount reconciliation...`);
      await this.reconcileMounts(expectedPaths);
      this.logger.debug(`${LOG_PREFIX} Mount reconciliation complete`);
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
   * Unmounts all filesystems, then stops the sandbox.
   */
  async stop(): Promise<void> {
    for (const mountPath of [...this.mounts.entries.keys()]) {
      try {
        await this.unmount(mountPath);
      } catch {
        // Best-effort unmount; sandbox may already be dead
      }
    }

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
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a command in the sandbox and return the result.
   */
  async executeCommand(command: string, args: string[] = [], options: ExecuteCommandOptions = {}): Promise<CommandResult> {
    await this.ensureRunning();
    const fullCommand = args.length > 0 ? `${command} ${args.map(shellQuote).join(' ')}` : command;
    const handle = await this.processes!.spawn(fullCommand, options);
    const result = await handle.wait();
    return { ...result, command, args };
  }

  // ---------------------------------------------------------------------------
  // Mount Support
  // ---------------------------------------------------------------------------

  /**
   * Mount a filesystem at a path in the sandbox using FUSE tools (s3fs, gcsfuse).
   */
  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    validateMountPath(mountPath);

    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    const sandbox = this._sandbox;

    this.logger.debug(`${LOG_PREFIX} Mounting "${mountPath}"...`);

    const config = filesystem.getMountConfig?.() as DaytonaMountConfig | undefined;
    if (!config) {
      const error = `Filesystem "${filesystem.id}" does not provide a mount config`;
      this.logger.error(`${LOG_PREFIX} ${error}`);
      this.mounts.set(mountPath, { filesystem, state: 'error', error });
      return { success: false, mountPath, error };
    }

    // Check if already mounted with matching config (e.g., when reconnecting)
    const existingMount = await this.checkExistingMount(mountPath, config);
    if (existingMount === 'matching') {
      this.logger.debug(`${LOG_PREFIX} Existing mount at "${mountPath}" matches config, skipping`);
      this.mounts.set(mountPath, { state: 'mounted', config });
      return { success: true, mountPath };
    } else if (existingMount === 'mismatched') {
      this.logger.debug(`${LOG_PREFIX} Config mismatch at "${mountPath}", re-mounting...`);
      await this.unmount(mountPath);
    }

    this.mounts.set(mountPath, { filesystem, state: 'mounting', config });

    // Reject non-empty directories — mounting would shadow existing files.
    // Skip the check if the path is already a mount point (stuck FUSE from a failed
    // prior unmount): its contents are remote objects, not local files to protect.
    try {
      const response = await sandbox.process.executeCommand(
        `[ -d "${mountPath}" ] && ! mountpoint -q "${mountPath}" 2>/dev/null && ` +
          `[ "$(ls -A "${mountPath}" 2>/dev/null)" ] && echo "non-empty" || echo "ok"`,
      );
      if (response.result.trim() === 'non-empty') {
        const error = `Cannot mount at ${mountPath}: directory exists and is not empty`;
        this.logger.error(`${LOG_PREFIX} ${error}`);
        this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
        return { success: false, mountPath, error };
      }
    } catch {
      // Check failed, proceed anyway
    }

    // Create/prepare the mount directory.
    // If the path is already a FUSE mount (stuck from a failed prior unmount), overlay
    // it with a tmpfs first. New FUSE-on-existing-FUSE fails because the kernel asks the
    // existing daemon to resolve the mount point path, which returns ENOENT. A tmpfs
    // overlay is kernel-native and doesn't involve the FUSE driver.
    try {
      const mkdirResponse = await sandbox.process.executeCommand(
        `mountpoint -q "${mountPath}" 2>/dev/null && sudo mount -t tmpfs tmpfs "${mountPath}" 2>/dev/null; ` +
          `sudo mkdir -p "${mountPath}" 2>/dev/null; ` +
          `sudo chown $(id -u):$(id -g) "${mountPath}"`,
      );
      if (mkdirResponse.exitCode !== 0) {
        const error = mkdirResponse.result || 'Failed to create mount directory';
        this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
        return { success: false, mountPath, error };
      }
    } catch (err) {
      const error = `Failed to create mount directory: ${err}`;
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
      return { success: false, mountPath, error };
    }

    // Build mount context — run() timeout is in ms, SDK expects seconds
    const ctx: MountContext = {
      run: async (cmd, timeoutMs) => {
        const response = await sandbox.process.executeCommand(
          cmd,
          undefined,
          undefined,
          timeoutMs !== undefined ? Math.ceil(timeoutMs / 1000) : undefined,
        );
        return {
          exitCode: response.exitCode,
          stdout: response.result,
          stderr: response.exitCode !== 0 ? response.result : '',
        };
      },
      writeFile: async (path, content) => {
        await sandbox.fs.uploadFile(Buffer.from(content), path);
      },
      logger: this.logger,
    };

    try {
      switch (config.type) {
        case 's3':
          this.logger.debug(`${LOG_PREFIX} Mounting S3 at "${mountPath}"...`);
          await mountS3(mountPath, config, ctx);
          this.logger.debug(`${LOG_PREFIX} Mounted S3 bucket at ${mountPath}`);
          break;
        case 'gcs':
          this.logger.debug(`${LOG_PREFIX} Mounting GCS at "${mountPath}"...`);
          await mountGCS(mountPath, config, ctx);
          this.logger.debug(`${LOG_PREFIX} Mounted GCS bucket at ${mountPath}`);
          break;
        default: {
          const error = `Unsupported mount type: ${(config as FilesystemMountConfig).type}`;
          this.mounts.set(mountPath, { filesystem, state: 'unsupported', config, error });
          return { success: false, mountPath, error };
        }
      }
    } catch (error) {
      this.logger.error(`${LOG_PREFIX} Error mounting "${filesystem.provider}" at "${mountPath}":`, error);
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: String(error) });
      await sandbox.process.executeCommand(`sudo rmdir "${mountPath}" 2>/dev/null || true`);
      this.logger.debug(`${LOG_PREFIX} Cleaned up directory after failed mount: ${mountPath}`);
      return { success: false, mountPath, error: String(error) };
    }

    // Mark as mounted
    this.mounts.set(mountPath, { state: 'mounted', config });

    await this.writeMarkerFile(mountPath);

    this.logger.debug(`${LOG_PREFIX} Mounted "${mountPath}"`);
    return { success: true, mountPath };
  }

  /**
   * Write a marker file so we can detect config changes on reconnect.
   */
  private async writeMarkerFile(mountPath: string): Promise<void> {
    if (!this._sandbox) return;

    const markerContent = this.mounts.getMarkerContent(mountPath);
    if (!markerContent) return;

    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;

    try {
      await this._sandbox.process.executeCommand('mkdir -p /tmp/.mastra-mounts');
      await this._sandbox.fs.uploadFile(Buffer.from(markerContent), markerPath);
    } catch {
      this.logger.debug(`${LOG_PREFIX} Warning: could not write marker file at ${markerPath}`);
    }
  }

  /**
   * Unmount a filesystem from a path in the sandbox.
   */
  async unmount(mountPath: string): Promise<void> {
    validateMountPath(mountPath);

    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    const sandbox = this._sandbox;

    this.logger.debug(`${LOG_PREFIX} Unmounting "${mountPath}"...`);

    // Try fusermount first (user-space), then lazy umount as fallback.
    // Do NOT pkill the FUSE daemon — a killed daemon leaves a stale mount
    // (ENOTCONN) that blocks subsequent mkdir/stat on the path.
    await sandbox.process.executeCommand(
      `sudo fusermount -u "${mountPath}" 2>/dev/null; ` +
        `sudo umount -l "${mountPath}" 2>/dev/null; ` +
        // Last resort: move a stuck FUSE mount aside so the directory can be cleaned up.
        `mountpoint -q "${mountPath}" 2>/dev/null && ` +
        `{ _p="/tmp/.mastra-defunct-$$"; sudo mkdir -p "$_p" && sudo mount --move "${mountPath}" "$_p" 2>/dev/null; sudo umount -l "$_p" 2>/dev/null; sudo rmdir "$_p" 2>/dev/null; }`,
    );

    this.mounts.delete(mountPath);

    // Clean up marker file and mount directory in one round-trip.
    // rm -f always exits 0, so the combined exit code reflects rmdir.
    const markerPath = `/tmp/.mastra-mounts/${this.mounts.markerFilename(mountPath)}`;
    const cleanupResult = await sandbox.process.executeCommand(
      `rm -f "${markerPath}" 2>/dev/null; sudo rmdir "${mountPath}" 2>&1`,
    );
    if (cleanupResult.exitCode === 0) {
      this.logger.debug(`${LOG_PREFIX} Removed mount directory ${mountPath}`);
    } else {
      this.logger.debug(`${LOG_PREFIX} Could not remove ${mountPath}: ${cleanupResult.result.trim() || 'not empty'}`);
    }

    this.logger.debug(`${LOG_PREFIX} Unmounted "${mountPath}"`);
  }

  /**
   * Check if a path is already mounted and whether the config matches.
   */
  private async checkExistingMount(
    mountPath: string,
    newConfig: DaytonaMountConfig,
  ): Promise<'not_mounted' | 'matching' | 'mismatched'> {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);
    const sandbox = this._sandbox;

    try {
      const mountResponse = await sandbox.process.executeCommand(
        `mountpoint -q "${mountPath}" && echo "mounted" || echo "not mounted"`,
      );
      if (mountResponse.result.trim() !== 'mounted') {
        return 'not_mounted';
      }
    } catch {
      return 'not_mounted';
    }

    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;
    let parsed;
    try {
      const markerResponse = await sandbox.process.executeCommand(`cat "${markerPath}" 2>/dev/null || echo ""`);
      parsed = this.mounts.parseMarkerContent(markerResponse.result.trim());
    } catch {
      return 'mismatched';
    }

    if (!parsed) return 'mismatched';

    const newConfigHash = this.mounts.computeConfigHash(newConfig);
    if (parsed.path === mountPath && parsed.configHash === newConfigHash) {
      return 'matching';
    }

    return 'mismatched';
  }

  /**
   * Unmount stale FUSE mounts not in the expected list.
   * Called after reconnecting to clean up mounts from a previous session.
   */
  async reconcileMounts(expectedMountPaths: string[]): Promise<void> {
    if (!this._sandbox) return;
    const sandbox = this._sandbox;

    this.logger.debug(`${LOG_PREFIX} Reconciling mounts. Expected:`, expectedMountPaths);

    // Get current FUSE mounts
    let currentMounts: string[] = [];
    try {
      const mountsResponse = await sandbox.process.executeCommand(
        `grep -E 'fuse\\.(s3fs|gcsfuse)' /proc/mounts | awk '{print $2}'`,
      );
      currentMounts = mountsResponse.result
        .trim()
        .split('\n')
        .filter(p => p.length > 0);
    } catch (err) {
      this.logger.debug(`${LOG_PREFIX} Could not read /proc/mounts: ${err}`);
      return;
    }

    // Read marker files to know which mounts we created
    let markerFiles: string[] = [];
    try {
      const markersResponse = await sandbox.process.executeCommand('ls /tmp/.mastra-mounts/ 2>/dev/null || echo ""');
      markerFiles = markersResponse.result
        .trim()
        .split('\n')
        .filter(f => f.length > 0 && SAFE_MARKER_NAME.test(f));
    } catch (err) {
      this.logger.debug(`${LOG_PREFIX} Could not read marker files: ${err}`);
    }

    // Build map of mount paths we manage
    const managedMountPaths = new Map<string, string>();
    for (const markerFile of markerFiles) {
      const markerResponse = await sandbox.process.executeCommand(
        `cat "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || echo ""`,
      );
      const parsed = this.mounts.parseMarkerContent(markerResponse.result.trim());
      if (parsed && SAFE_MOUNT_PATH.test(parsed.path)) {
        managedMountPaths.set(parsed.path, markerFile);
      }
    }

    // Unmount stale managed FUSE mounts
    for (const stalePath of currentMounts.filter(p => !expectedMountPaths.includes(p))) {
      if (managedMountPaths.has(stalePath)) {
        this.logger.debug(`${LOG_PREFIX} Unmounting stale mount at "${stalePath}"`);
        try {
          await this.unmount(stalePath);
        } catch (err) {
          this.logger.debug(`${LOG_PREFIX} Failed to unmount stale mount at "${stalePath}": ${err}`);
        }
      } else this.logger.debug(`${LOG_PREFIX} Found external FUSE mount at ${stalePath}, leaving untouched`);
    }

    // Clean up orphaned marker files and empty directories
    try {
      const expectedMarkerFiles = new Set(expectedMountPaths.map(p => this.mounts.markerFilename(p)));
      const markerToPath = new Map<string, string>();
      for (const [path, file] of managedMountPaths) {
        markerToPath.set(file, path);
      }

      for (const markerFile of markerFiles) {
        if (!expectedMarkerFiles.has(markerFile)) {
          const mountPath = markerToPath.get(markerFile);

          if (mountPath) {
            if (!currentMounts.includes(mountPath)) {
              this.logger.debug(`${LOG_PREFIX} Cleaning up orphaned marker and directory for ${mountPath}`);
              await sandbox.process.executeCommand(
                `rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null; sudo rmdir "${mountPath}" 2>/dev/null`,
              );
            }
          } else {
            // Malformed marker file - just delete it
            this.logger.debug(`${LOG_PREFIX} Removing malformed marker file: ${markerFile}`);
            await sandbox.process.executeCommand(`rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || true`);
          }
        }
      }
    } catch {
      // Ignore errors during orphan cleanup
      this.logger.debug(`${LOG_PREFIX} Error during orphan cleanup (non-fatal)`);
    }
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
