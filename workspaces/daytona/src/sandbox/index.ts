/**
 * Daytona Sandbox Provider
 *
 * A Daytona sandbox implementation for Mastra workspaces.
 * Supports command execution, environment variables, resource configuration,
 * snapshots, Daytona volumes, and FUSE-based cloud filesystem mounting (S3, GCS).
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
  WorkspaceFilesystem,
  MountResult,
  FilesystemMountConfig,
  ProviderStatus,
  MountManager,
  MastraSandboxOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';

import { compact } from '../utils/compact';
import { shellQuote } from '../utils/shell-quote';
import { mountS3, mountGCS, LOG_PREFIX, runCommand } from './mounts';
import type { DaytonaMountConfig, DaytonaS3MountConfig, DaytonaGCSMountConfig, MountContext } from './mounts';
import { DaytonaProcessManager } from './process-manager';
import type { DaytonaResources } from './types';

/** Allowlist pattern for mount paths — absolute path with safe characters only. */
const SAFE_MOUNT_PATH = /^\/[a-zA-Z0-9_.\-/]+$/;

/** Default timeout for mount lifecycle shell commands (mkdir, unmount, proc reads, etc.) */
const MOUNT_COMMAND_TIMEOUT_MS = 30_000;

/** Convert an unknown error to a readable string. */
function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const maybeError = error as { message?: unknown };
    if (typeof maybeError.message === 'string') {
      return maybeError.message;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function validateMountPath(mountPath: string): void {
  if (!SAFE_MOUNT_PATH.test(mountPath)) {
    throw new Error(
      `Invalid mount path: ${mountPath}. Must be an absolute path with alphanumeric, dash, dot, underscore, or slash characters only.`,
    );
  }
  const segments = mountPath.split('/');
  if (mountPath.includes('//') || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Invalid mount path: ${mountPath}. Path traversal segments are not allowed.`);
  }
}

/** Allowlist for marker filenames from ls output — e.g. "mount-abc123" */
const SAFE_MARKER_NAME = /^mount-[a-z0-9]+$/;

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
export interface DaytonaSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
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
 * - FUSE-based cloud filesystem mounting (S3, GCS)
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

  declare readonly mounts: MountManager; // Non-optional (initialized by base class when mount() exists)

  status: ProviderStatus = 'pending';

  private _daytona: Daytona | null = null;
  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;
  private _isRetrying = false;

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

      // Clean up stale mounts from previous config
      // (processPending is called by base class after start completes)
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

    const mountCount = this.mounts.entries.size;
    const mountInfo = mountCount > 0 ? ` ${mountCount} filesystem(s) mounted via FUSE.` : '';
    parts.push(`Cloud sandbox with isolated execution (${this.language} runtime).${mountInfo}`);

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
  // Mount Support
  // ---------------------------------------------------------------------------

  /**
   * Mount a filesystem at a path in the sandbox.
   * Uses FUSE tools (s3fs, gcsfuse) to mount cloud storage.
   */
  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    validateMountPath(mountPath);

    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    this.logger.debug(`${LOG_PREFIX} Mounting "${mountPath}"...`);

    // Get mount config - MountManager validates this exists before calling mount()
    const config = filesystem.getMountConfig?.() as DaytonaMountConfig | undefined;
    if (!config) {
      const error = `Filesystem "${filesystem.id}" does not provide a mount config`;
      this.logger.error(`${LOG_PREFIX} ${error}`);
      this.mounts.set(mountPath, { filesystem, state: 'error', error });
      return { success: false, mountPath, error };
    }

    // Check if already mounted with matching config (e.g., when reconnecting to existing sandbox)
    const existingMount = await this.checkExistingMount(mountPath, config);
    if (existingMount === 'matching') {
      this.logger.debug(
        `${LOG_PREFIX} Detected existing mount for ${filesystem.provider} ("${filesystem.id}") at "${mountPath}" with correct config, skipping`,
      );
      this.mounts.set(mountPath, { state: 'mounted', config });
      return { success: true, mountPath };
    } else if (existingMount === 'mismatched') {
      // Different config - unmount and re-mount
      this.logger.debug(`${LOG_PREFIX} Config mismatch, unmounting to re-mount with new config...`);
      await this.unmount(mountPath);
    } else if (existingMount === 'unmanaged') {
      const error = `Mount path "${mountPath}" is already mounted by an unmanaged source`;
      this.logger.error(`${LOG_PREFIX} ${error}`);
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
      return { success: false, mountPath, error };
    }
    this.logger.debug(`${LOG_PREFIX} Config type: ${config.type}`);

    // Mark as mounting (handles direct mount() calls; MountManager also sets this for processPending)
    this.mounts.set(mountPath, { filesystem, state: 'mounting', config });

    // Check if directory exists and is non-empty (would shadow existing files)
    try {
      const checkResult = await runCommand(
        this._sandbox,
        `[ -d ${shellQuote(mountPath)} ] && [ "$(ls -A ${shellQuote(mountPath)} 2>/dev/null)" ] && echo "non-empty" || echo "ok"`,
        { timeout: MOUNT_COMMAND_TIMEOUT_MS },
      );
      if (checkResult.output.trim() === 'non-empty') {
        const error = `Cannot mount at ${mountPath}: directory exists and is not empty. Mounting would hide existing files. Use a different path or empty the directory first.`;
        this.logger.error(`${LOG_PREFIX} ${error}`);
        this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
        return { success: false, mountPath, error };
      }
    } catch (checkErr) {
      const checkError = `Unable to verify mount target safety for "${mountPath}": ${errorToString(checkErr)}`;
      this.logger.error(`${LOG_PREFIX} ${checkError}`);
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: checkError });
      return { success: false, mountPath, error: checkError };
    }

    // Create mount directory with sudo (for paths outside home dir like /data)
    // Then chown to current user so mount works without issues
    this.logger.debug(`${LOG_PREFIX} Creating mount directory for ${mountPath}...`);
    const quotedPath = shellQuote(mountPath);
    const mkdirCommand = `sudo mkdir -p ${quotedPath} && sudo chown $(id -u):$(id -g) ${quotedPath}`;

    this.logger.debug(`${LOG_PREFIX} Running command: ${mkdirCommand}`);
    const mkdirResult = await runCommand(this._sandbox, mkdirCommand, { timeout: MOUNT_COMMAND_TIMEOUT_MS });

    if (mkdirResult.exitCode !== 0) {
      const mkdirError = `Failed to create mount directory "${mountPath}": ${mkdirResult.output}`;
      this.logger.debug(`${LOG_PREFIX} mkdir error for "${mountPath}":`, mkdirError);
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: mkdirError });
      return { success: false, mountPath, error: mkdirError };
    }
    this.logger.debug(`${LOG_PREFIX} Created mount directory for mount path "${mountPath}":`, mkdirResult);

    // Create mount context for mount operations
    const mountCtx: MountContext = {
      sandbox: this._sandbox,
      logger: this.logger,
    };

    try {
      switch (config.type) {
        case 's3':
          this.logger.debug(`${LOG_PREFIX} Mounting S3 bucket at ${mountPath}...`);
          await mountS3(mountPath, config as DaytonaS3MountConfig, mountCtx);
          this.logger.debug(`${LOG_PREFIX} Mounted S3 bucket at ${mountPath}`);
          break;
        case 'gcs':
          this.logger.debug(`${LOG_PREFIX} Mounting GCS bucket at ${mountPath}...`);
          await mountGCS(mountPath, config as DaytonaGCSMountConfig, mountCtx);
          this.logger.debug(`${LOG_PREFIX} Mounted GCS bucket at ${mountPath}`);
          break;
        default:
          this.mounts.set(mountPath, {
            filesystem,
            state: 'unsupported',
            config,
            error: `Unsupported mount type: ${(config as FilesystemMountConfig).type}`,
          });
          return {
            success: false,
            mountPath,
            error: `Unsupported mount type: ${(config as FilesystemMountConfig).type}`,
          };
      }
    } catch (error) {
      this.logger.error(
        `${LOG_PREFIX} Error mounting "${filesystem.provider}" (${filesystem.id}) at "${mountPath}":`,
        error,
      );
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: errorToString(error) });

      // Clean up the directory we created since mount failed
      try {
        await runCommand(this._sandbox!, `sudo rmdir ${shellQuote(mountPath)} 2>/dev/null || true`, {
          timeout: MOUNT_COMMAND_TIMEOUT_MS,
        });
        this.logger.debug(`${LOG_PREFIX} Cleaned up directory after failed mount: ${mountPath}`);
      } catch {
        // Ignore cleanup errors
      }

      return { success: false, mountPath, error: errorToString(error) };
    }

    // Mark as mounted
    this.mounts.set(mountPath, { state: 'mounted', config });

    // Write marker file so we can detect config changes on reconnect
    await this.writeMarkerFile(mountPath);

    this.logger.debug(`${LOG_PREFIX} Mounted ${mountPath}`);
    return { success: true, mountPath };
  }

  /**
   * Unmount a filesystem from a path in the sandbox.
   */
  async unmount(mountPath: string): Promise<void> {
    validateMountPath(mountPath);

    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    this.logger.debug(`${LOG_PREFIX} Unmounting ${mountPath}...`);

    try {
      // Use fusermount for FUSE mounts, fall back to umount
      const result = await runCommand(
        this._sandbox,
        `sudo fusermount -u ${shellQuote(mountPath)} 2>/dev/null || sudo umount ${shellQuote(mountPath)}`,
        { timeout: MOUNT_COMMAND_TIMEOUT_MS },
      );
      if (result.exitCode !== 0) {
        this.logger.debug(`${LOG_PREFIX} Unmount warning: ${result.output}`);
      }
    } catch (error) {
      this.logger.debug(`${LOG_PREFIX} Unmount error:`, error);
      // Try lazy unmount as last resort
      await runCommand(this._sandbox, `sudo umount -l ${shellQuote(mountPath)} 2>/dev/null || true`, {
        timeout: MOUNT_COMMAND_TIMEOUT_MS,
      });
    }

    this.mounts.delete(mountPath);

    // Clean up marker file
    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;
    await runCommand(this._sandbox, `rm -f ${shellQuote(markerPath)} 2>/dev/null || true`, {
      timeout: MOUNT_COMMAND_TIMEOUT_MS,
    });

    // Remove empty mount directory (only if empty, rmdir fails on non-empty)
    // Use sudo since mount directories outside home (like /data) were created with sudo
    const rmdirResult = await runCommand(this._sandbox, `sudo rmdir ${shellQuote(mountPath)} 2>&1`, {
      timeout: MOUNT_COMMAND_TIMEOUT_MS,
    });
    if (rmdirResult.exitCode === 0) {
      this.logger.debug(`${LOG_PREFIX} Unmounted and removed ${mountPath}`);
    } else {
      this.logger.debug(
        `${LOG_PREFIX} Unmounted ${mountPath} (directory not removed: ${rmdirResult.output.trim() || 'not empty'})`,
      );
    }
  }

  /**
   * Unmount all stale mounts that are not in the expected mounts list.
   * Also cleans up orphaned directories and marker files from failed mount attempts.
   * Call this after reconnecting to an existing sandbox to clean up old mounts.
   */
  async reconcileMounts(expectedMountPaths: string[]): Promise<void> {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    this.logger.debug(`${LOG_PREFIX} Reconciling mounts. Expected paths:`, expectedMountPaths);

    // Get current FUSE mounts in the sandbox
    // Use || true to prevent failure when no FUSE mounts exist (grep exits 1 on no match)
    const mountsResult = await runCommand(
      this._sandbox,
      `grep -E 'fuse\\.(s3fs|gcsfuse)' /proc/mounts | awk '{print $2}' || true`,
      { timeout: MOUNT_COMMAND_TIMEOUT_MS },
    );
    const currentMounts = mountsResult.output
      .trim()
      .split('\n')
      .filter(p => p.length > 0);

    this.logger.debug(`${LOG_PREFIX} Current FUSE mounts in sandbox:`, currentMounts);

    // Read our marker files to know which mounts WE created
    const markersResult = await runCommand(this._sandbox, `ls /tmp/.mastra-mounts/ 2>/dev/null || echo ""`, {
      timeout: MOUNT_COMMAND_TIMEOUT_MS,
    });
    const markerFiles = markersResult.output
      .trim()
      .split('\n')
      .filter(f => f.length > 0 && SAFE_MARKER_NAME.test(f));

    // Build a map of mount paths -> marker filenames for mounts WE created
    const managedMountPaths = new Map<string, string>();
    for (const markerFile of markerFiles) {
      const markerResult = await runCommand(
        this._sandbox,
        `cat "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || echo ""`,
        { timeout: MOUNT_COMMAND_TIMEOUT_MS },
      );
      const parsed = this.mounts.parseMarkerContent(markerResult.output.trim());
      if (parsed && SAFE_MOUNT_PATH.test(parsed.path)) {
        managedMountPaths.set(parsed.path, markerFile);
      }
    }

    // Find mounts that exist but shouldn't — only unmount if WE created them (have a marker)
    const staleMounts = currentMounts.filter(path => !expectedMountPaths.includes(path));

    for (const stalePath of staleMounts) {
      if (managedMountPaths.has(stalePath)) {
        this.logger.debug(`${LOG_PREFIX} Found stale managed FUSE mount at ${stalePath}, unmounting...`);
        await this.unmount(stalePath);
      } else {
        this.logger.debug(`${LOG_PREFIX} Found external FUSE mount at ${stalePath}, leaving untouched`);
      }
    }

    // Clean up orphaned marker files and empty directories from failed mounts
    try {
      const expectedMarkerFiles = new Set(expectedMountPaths.map(p => this.mounts.markerFilename(p)));

      // Build a reverse map: markerFile -> mountPath
      const markerToPath = new Map<string, string>();
      for (const [path, file] of managedMountPaths) {
        markerToPath.set(file, path);
      }

      for (const markerFile of markerFiles) {
        // If this marker file doesn't correspond to an expected mount path, clean it up
        if (!expectedMarkerFiles.has(markerFile)) {
          const mountPath = markerToPath.get(markerFile);

          if (mountPath) {
            // Only clean up directory if not currently FUSE mounted
            if (!currentMounts.includes(mountPath)) {
              this.logger.debug(`${LOG_PREFIX} Cleaning up orphaned marker and directory for ${mountPath}`);

              // Remove marker file
              await runCommand(this._sandbox!, `rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || true`, {
                timeout: MOUNT_COMMAND_TIMEOUT_MS,
              });

              // Try to remove the directory (will fail if not empty or doesn't exist, which is fine)
              await runCommand(this._sandbox!, `sudo rmdir ${shellQuote(mountPath)} 2>/dev/null || true`, {
                timeout: MOUNT_COMMAND_TIMEOUT_MS,
              });
            }
          } else {
            // Malformed marker file - just delete it
            this.logger.debug(`${LOG_PREFIX} Removing malformed marker file: ${markerFile}`);
            await runCommand(this._sandbox!, `rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || true`, {
              timeout: MOUNT_COMMAND_TIMEOUT_MS,
            });
          }
        }
      }
    } catch {
      // Ignore errors during orphan cleanup
      this.logger.debug(`${LOG_PREFIX} Error during orphan cleanup (non-fatal)`);
    }
  }

  /**
   * Write marker file for detecting config changes on reconnect.
   * Stores both the mount path and config hash in the file.
   */
  private async writeMarkerFile(mountPath: string): Promise<void> {
    if (!this._sandbox) return;

    const markerContent = this.mounts.getMarkerContent(mountPath);
    if (!markerContent) return;

    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;
    try {
      await runCommand(this._sandbox, 'mkdir -p /tmp/.mastra-mounts', { timeout: MOUNT_COMMAND_TIMEOUT_MS });
      await this._sandbox.fs.uploadFile(Buffer.from(markerContent, 'utf-8'), markerPath);
    } catch {
      // Non-fatal - marker is just for optimization
      this.logger.debug(`${LOG_PREFIX} Warning: Could not write marker file at ${markerPath}`);
    }
  }

  /**
   * Check if a path is already mounted and if the config matches.
   *
   * @param mountPath - The mount path to check
   * @param newConfig - The new config to compare against the stored config
   * @returns 'not_mounted' | 'matching' | 'mismatched' | 'unmanaged'
   */
  private async checkExistingMount(
    mountPath: string,
    newConfig: DaytonaMountConfig,
  ): Promise<'not_mounted' | 'matching' | 'mismatched' | 'unmanaged'> {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    // Check if path is a mount point
    const mountCheck = await runCommand(
      this._sandbox,
      `mountpoint -q ${shellQuote(mountPath)} && echo "mounted" || echo "not mounted"`,
      { timeout: MOUNT_COMMAND_TIMEOUT_MS },
    );

    if (mountCheck.output.trim() !== 'mounted') {
      return 'not_mounted';
    }

    // Path is mounted - check if config matches via marker file
    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;

    try {
      const markerResult = await runCommand(this._sandbox, `cat ${shellQuote(markerPath)} 2>/dev/null || echo ""`, {
        timeout: MOUNT_COMMAND_TIMEOUT_MS,
      });
      const parsed = this.mounts.parseMarkerContent(markerResult.output.trim());

      if (!parsed) {
        return 'unmanaged';
      }

      // Compute hash of the NEW config and compare with stored hash
      const newConfigHash = this.mounts.computeConfigHash(newConfig);
      this.logger.debug(
        `${LOG_PREFIX} Marker check - stored hash: "${parsed.configHash}", new config hash: "${newConfigHash}"`,
      );

      if (parsed.path === mountPath && parsed.configHash === newConfigHash) {
        return 'matching';
      }
    } catch {
      // Marker doesn't exist or can't be read - treat as unmanaged
    }

    return 'unmanaged';
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

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
