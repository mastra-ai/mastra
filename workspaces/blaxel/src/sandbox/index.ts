/**
 * Blaxel Sandbox Provider
 *
 * A Blaxel sandbox implementation that supports mounting
 * cloud filesystems (S3, GCS, R2) via FUSE.
 *
 * @see https://docs.blaxel.ai
 */

import { SandboxInstance } from '@blaxel/core';
import type {
  SandboxInfo,
  ExecuteCommandOptions,
  CommandResult,
  WorkspaceFilesystem,
  MountResult,
  FilesystemMountConfig,
  ProviderStatus,
  MountManager,
  MastraSandboxOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';

import { shellQuote } from '../utils/shell-quote';
import { mountS3, mountGCS, LOG_PREFIX, runCommand } from './mounts';
import type { BlaxelMountConfig, BlaxelS3MountConfig, BlaxelGCSMountConfig, MountContext } from './mounts';

/** Allowlist pattern for mount paths — absolute path with safe characters only. */
const SAFE_MOUNT_PATH = /^\/[a-zA-Z0-9_.\-/]+$/;

/** Convert an unknown error to a readable string. */
function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message;
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
}

/** Allowlist for marker filenames from ls output — e.g. "mount-abc123" */
const SAFE_MARKER_NAME = /^mount-[a-z0-9]+$/;

// =============================================================================
// Blaxel Sandbox Options
// =============================================================================

/**
 * Runtime types supported by Blaxel.
 */
export type SandboxRuntime = 'node' | 'python' | 'bash' | 'ruby' | 'go' | 'rust' | 'java' | 'cpp' | 'r';

/**
 * Blaxel sandbox provider configuration.
 */
export interface BlaxelSandboxOptions extends MastraSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /**
   * Docker image to use for the sandbox.
   *
   * @default 'blaxel/py-app:latest'
   */
  image?: string;
  /**
   * Memory allocation in MB.
   *
   * @default 4096
   */
  memory?: number;
  /**
   * Execution timeout as a duration string (e.g. '5m', '1h').
   * This maps to the Blaxel sandbox TTL.
   */
  timeout?: string;
  /** Environment variables to set in the sandbox */
  env?: Record<string, string>;
  /** Custom labels for the sandbox */
  labels?: Record<string, string>;
  /** Supported runtimes (default: ['node', 'python', 'bash']) */
  runtimes?: SandboxRuntime[];
  /**
   * Ports to expose from the sandbox.
   * Each entry should have a `target` (port number) and optionally `name` and `protocol`.
   */
  ports?: Array<{ name?: string; target: number; protocol?: 'HTTP' | 'TCP' | 'UDP' }>;
}

// =============================================================================
// Blaxel Sandbox Implementation
// =============================================================================

/**
 * Blaxel cloud sandbox implementation.
 *
 * Features:
 * - Single sandbox instance lifecycle
 * - Supports mounting cloud filesystems (S3, GCS, R2) via FUSE
 * - Automatic sandbox reconnection via `createIfNotExists`
 * - Automatic sandbox timeout handling with retry
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { BlaxelSandbox } from '@mastra/blaxel';
 *
 * const sandbox = new BlaxelSandbox({
 *   timeout: '5m',
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * const result = await workspace.executeCode('console.log("Hello!")');
 * ```
 *
 * @example With S3 filesystem mounting
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { BlaxelSandbox } from '@mastra/blaxel';
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const workspace = new Workspace({
 *   mounts: {
 *     '/bucket': new S3Filesystem({
 *       bucket: 'my-bucket',
 *       region: 'us-east-1',
 *     }),
 *   },
 *   sandbox: new BlaxelSandbox({ timeout: '5m' }),
 * });
 * ```
 */
export class BlaxelSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'BlaxelSandbox';
  readonly provider = 'blaxel';

  // Status is managed by base class lifecycle methods
  status: ProviderStatus = 'pending';

  private _sandbox: SandboxInstance | null = null;
  private _createdAt: Date | null = null;
  private _isRetrying = false;

  private readonly image: string;
  private readonly memory: number;
  private readonly timeout?: string;
  private readonly env: Record<string, string>;
  private readonly labels: Record<string, string>;
  private readonly configuredRuntimes: SandboxRuntime[];
  private readonly ports: Array<{ name?: string; target: number; protocol?: 'HTTP' | 'TCP' | 'UDP' }>;
  declare readonly mounts: MountManager; // Non-optional (initialized by BaseSandbox)

  constructor(options: BlaxelSandboxOptions = {}) {
    super({ ...options, name: 'BlaxelSandbox' });

    this.id = options.id ?? this.generateId();
    this.image = options.image ?? 'blaxel/py-app:latest';
    this.memory = options.memory ?? 4096;
    this.timeout = options.timeout;
    this.env = options.env ?? {};
    this.labels = options.labels ?? {};
    this.configuredRuntimes = options.runtimes ?? ['node', 'python', 'bash'];
    this.ports = options.ports ?? [];
  }

  private generateId(): string {
    return `blaxel-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return this.configuredRuntimes;
  }

  get defaultRuntime(): SandboxRuntime {
    return this.configuredRuntimes[0] ?? 'node';
  }

  /**
   * Get the underlying Blaxel SandboxInstance for direct access to Blaxel APIs.
   *
   * Use this when you need to access Blaxel features not exposed through the
   * WorkspaceSandbox interface (e.g., filesystem, process management, previews, etc.).
   *
   * @throws {SandboxNotReadyError} If the sandbox has not been started
   *
   * @example Direct file operations
   * ```typescript
   * const blaxelSandbox = sandbox.instance;
   * await blaxelSandbox.fs.write('/tmp/test.txt', 'Hello');
   * const content = await blaxelSandbox.fs.read('/tmp/test.txt');
   * const files = await blaxelSandbox.fs.ls('/tmp');
   * ```
   *
   * @example Process management
   * ```typescript
   * const blaxelSandbox = sandbox.instance;
   * const proc = await blaxelSandbox.process.exec({
   *   command: 'node server.js',
   *   waitForCompletion: false,
   * });
   * ```
   */
  get instance(): SandboxInstance {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
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
    const config = filesystem.getMountConfig?.() as BlaxelMountConfig | undefined;
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
    }
    this.logger.debug(`${LOG_PREFIX} Config type: ${config.type}`);

    // Mark as mounting (handles direct mount() calls; MountManager also sets this for processPending)
    this.mounts.set(mountPath, { filesystem, state: 'mounting', config });

    // Check if directory exists and is non-empty (would shadow existing files)
    try {
      const checkResult = await runCommand(
        this._sandbox,
        `[ -d "${mountPath}" ] && [ "$(ls -A "${mountPath}" 2>/dev/null)" ] && echo "non-empty" || echo "ok"`,
      );
      if (checkResult.stdout.trim() === 'non-empty') {
        const error = `Cannot mount at ${mountPath}: directory exists and is not empty. Mounting would hide existing files. Use a different path or empty the directory first.`;
        this.logger.error(`${LOG_PREFIX} ${error}`);
        this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
        return { success: false, mountPath, error };
      }
    } catch {
      // Check failed, proceed anyway
    }

    // Create mount directory (Blaxel sandboxes run as root by default)
    this.logger.debug(`${LOG_PREFIX} Creating mount directory for ${mountPath}...`);
    const mkdirCommand = `mkdir -p "${mountPath}"`;

    this.logger.debug(`${LOG_PREFIX} Running command: ${mkdirCommand}`);
    const mkdirResult = await runCommand(this._sandbox, mkdirCommand);

    if (mkdirResult.exitCode !== 0) {
      const mkdirError = `Failed to create mount directory "${mountPath}": ${mkdirResult.stderr || mkdirResult.stdout}`;
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
          await mountS3(mountPath, config as BlaxelS3MountConfig, mountCtx);
          this.logger.debug(`${LOG_PREFIX} Mounted S3 bucket at ${mountPath}`);
          break;
        case 'gcs':
          this.logger.debug(`${LOG_PREFIX} Mounting GCS bucket at ${mountPath}...`);
          await mountGCS(mountPath, config as BlaxelGCSMountConfig, mountCtx);
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
        await runCommand(this._sandbox!, `rmdir "${mountPath}" 2>/dev/null || true`);
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
      await runCommand(this._sandbox, 'mkdir -p /tmp/.mastra-mounts');
      await this._sandbox.fs.write(markerPath, markerContent);
    } catch {
      // Non-fatal - marker is just for optimization
      this.logger.debug(`${LOG_PREFIX} Warning: Could not write marker file at ${markerPath}`);
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

    this.logger.debug(`${LOG_PREFIX} Unmounting ${mountPath}...`);

    try {
      // Use fusermount for FUSE mounts, fall back to umount
      const result = await runCommand(
        this._sandbox,
        `fusermount -u "${mountPath}" 2>/dev/null || umount "${mountPath}"`,
      );
      if (result.exitCode !== 0) {
        this.logger.debug(`${LOG_PREFIX} Unmount warning: ${result.stderr || result.stdout}`);
      }
    } catch (error) {
      this.logger.debug(`${LOG_PREFIX} Unmount error:`, error);
      // Try lazy unmount as last resort
      await runCommand(this._sandbox, `umount -l "${mountPath}" 2>/dev/null || true`);
    }

    this.mounts.delete(mountPath);

    // Clean up marker file
    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;
    await runCommand(this._sandbox, `rm -f "${markerPath}" 2>/dev/null || true`);

    // Remove empty mount directory (only if empty, rmdir fails on non-empty)
    // Use || true so a non-empty or missing directory doesn't abort unmount
    const rmdirResult = await runCommand(this._sandbox, `rmdir "${mountPath}" 2>&1`);
    if (rmdirResult.exitCode === 0) {
      this.logger.debug(`${LOG_PREFIX} Unmounted and removed ${mountPath}`);
    } else {
      this.logger.debug(
        `${LOG_PREFIX} Unmounted ${mountPath} (directory not removed: ${rmdirResult.stderr?.trim() || 'not empty'})`,
      );
    }
  }

  /**
   * Get list of current mounts in the sandbox.
   */
  async getMounts(): Promise<Array<{ path: string; filesystem: string }>> {
    return Array.from(this.mounts.entries).map(([path, entry]) => ({
      path,
      filesystem: entry.filesystem?.provider ?? entry.config?.type ?? 'unknown',
    }));
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
    );
    const currentMounts = mountsResult.stdout
      .trim()
      .split('\n')
      .filter(p => p.length > 0);

    this.logger.debug(`${LOG_PREFIX} Current FUSE mounts in sandbox:`, currentMounts);

    // Read our marker files to know which mounts WE created
    const markersResult = await runCommand(this._sandbox, `ls /tmp/.mastra-mounts/ 2>/dev/null || echo ""`);
    const markerFiles = markersResult.stdout
      .trim()
      .split('\n')
      .filter(f => f.length > 0 && SAFE_MARKER_NAME.test(f));

    // Build a map of mount paths -> marker filenames for mounts WE created
    const managedMountPaths = new Map<string, string>();
    for (const markerFile of markerFiles) {
      const markerResult = await runCommand(
        this._sandbox,
        `cat "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || echo ""`,
      );
      const parsed = this.mounts.parseMarkerContent(markerResult.stdout.trim());
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
              await runCommand(this._sandbox!, `rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || true`);

              // Try to remove the directory (will fail if not empty or doesn't exist, which is fine)
              await runCommand(this._sandbox!, `rmdir "${mountPath}" 2>/dev/null || true`);
            }
          } else {
            // Malformed marker file - just delete it
            this.logger.debug(`${LOG_PREFIX} Removing malformed marker file: ${markerFile}`);
            await runCommand(this._sandbox!, `rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || true`);
          }
        }
      }
    } catch {
      // Ignore errors during orphan cleanup
      this.logger.debug(`${LOG_PREFIX} Error during orphan cleanup (non-fatal)`);
    }
  }

  /**
   * Check if a path is already mounted and if the config matches.
   *
   * @param mountPath - The mount path to check
   * @param newConfig - The new config to compare against the stored config
   * @returns 'not_mounted' | 'matching' | 'mismatched'
   */
  private async checkExistingMount(
    mountPath: string,
    newConfig: BlaxelMountConfig,
  ): Promise<'not_mounted' | 'matching' | 'mismatched'> {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    // Check if path is a mount point
    const mountCheck = await runCommand(
      this._sandbox,
      `mountpoint -q "${mountPath}" && echo "mounted" || echo "not mounted"`,
    );

    if (mountCheck.stdout.trim() !== 'mounted') {
      return 'not_mounted';
    }

    // Path is mounted - check if config matches via marker file
    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;

    try {
      const markerResult = await runCommand(this._sandbox, `cat "${markerPath}" 2>/dev/null || echo ""`);
      const parsed = this.mounts.parseMarkerContent(markerResult.stdout.trim());

      if (!parsed) {
        return 'mismatched';
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
      // Marker doesn't exist or can't be read - treat as mismatched
    }

    return 'mismatched';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (overrides base class protected methods)
  // ---------------------------------------------------------------------------

  /**
   * Start the Blaxel sandbox.
   * Uses `createIfNotExists` to reconnect to an existing sandbox or create a new one.
   *
   * Status management and mount processing are handled by the base class.
   */
  async start(): Promise<void> {
    // Already have a sandbox instance
    if (this._sandbox) {
      return;
    }

    const sandboxName = this.toSandboxName(this.id);

    this.logger.debug(`${LOG_PREFIX} Starting sandbox: ${sandboxName}`);

    // Try to get an existing sandbox first
    const existingSandbox = await this.findExistingSandbox(sandboxName);

    if (existingSandbox) {
      this._sandbox = existingSandbox;
      this._createdAt = new Date();
      this.logger.debug(`${LOG_PREFIX} Reconnected to existing sandbox: ${sandboxName}`);

      // Clean up stale mounts from previous config
      // (processPending is called by base class after start completes)
      const expectedPaths = Array.from(this.mounts.entries.keys());
      this.logger.debug(`${LOG_PREFIX} Running mount reconciliation...`);
      await this.reconcileMounts(expectedPaths);
      this.logger.debug(`${LOG_PREFIX} Mount reconciliation complete`);
      return;
    }

    // Create a new sandbox
    this.logger.debug(`${LOG_PREFIX} Creating new sandbox: ${sandboxName}`);

    try {
      this._sandbox = await SandboxInstance.create({
        name: sandboxName,
        image: this.image,
        memory: this.memory,
        ...(this.timeout && { ttl: this.timeout }),
        envs: Object.entries(this.env).map(([name, value]) => ({ name, value })),
        labels: {
          ...this.labels,
          'mastra-sandbox-id': this.id,
        },
        ports: this.ports.map(p => ({
          name: p.name,
          target: p.target,
          protocol: p.protocol ?? 'HTTP',
        })),
      });
    } catch (createError) {
      // Blaxel API may throw plain objects instead of Error instances.
      // Wrap them so downstream code (instanceof Error checks) works correctly.
      if (createError instanceof Error) {
        throw createError;
      }
      throw new Error(errorToString(createError));
    }

    this._createdAt = new Date();
    this.logger.debug(`${LOG_PREFIX} Sandbox ready: ${sandboxName} (status: ${this._sandbox.status})`);
    // Note: processPending is called by base class after start completes
  }

  /**
   * Convert a logical sandbox ID to a valid Blaxel sandbox name.
   * Blaxel sandbox names must be DNS-safe (lowercase alphanumeric and hyphens).
   */
  private toSandboxName(id: string): string {
    const name = id
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 63);
    if (!name) {
      throw new Error(
        `Cannot derive a valid sandbox name from id "${id}". ID must contain at least one alphanumeric character.`,
      );
    }
    return name;
  }

  /**
   * Find an existing sandbox with the given name.
   * Returns the connected sandbox if found and running, null otherwise.
   */
  private async findExistingSandbox(sandboxName: string): Promise<SandboxInstance | null> {
    try {
      const existing = await SandboxInstance.get(sandboxName);

      // Only reuse if the sandbox is actually deployed (running)
      if (existing.status === 'DEPLOYED') {
        this.logger.debug(`${LOG_PREFIX} Found existing sandbox: ${sandboxName} (status: ${existing.status})`);
        return existing;
      }

      this.logger.debug(
        `${LOG_PREFIX} Found sandbox ${sandboxName} but status is ${existing.status}, creating new one`,
      );
    } catch (e) {
      this.logger.debug(`${LOG_PREFIX} No existing sandbox found for ${sandboxName}:`, e);
    }

    return null;
  }

  /**
   * Stop the Blaxel sandbox.
   * Unmounts all filesystems and releases the sandbox reference.
   * Status management is handled by the base class.
   */
  async stop(): Promise<void> {
    // Unmount all filesystems before stopping
    // Collect keys first since unmount() mutates the map
    for (const mountPath of [...this.mounts.entries.keys()]) {
      try {
        await this.unmount(mountPath);
      } catch {
        // Best-effort unmount; sandbox may already be dead
      }
    }

    this._sandbox = null;
  }

  /**
   * Destroy the Blaxel sandbox and clean up all resources.
   * Unmounts filesystems, deletes the sandbox, and clears mount state.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    // Unmount all filesystems
    // Collect keys first since unmount() mutates the map
    for (const mountPath of [...this.mounts.entries.keys()]) {
      try {
        await this.unmount(mountPath);
      } catch {
        // Ignore errors during cleanup
      }
    }

    if (this._sandbox) {
      try {
        await this._sandbox.delete();
      } catch {
        // Ignore errors during destroy
      }
    }

    this._sandbox = null;
    this.mounts.clear();
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
      mounts: Array.from(this.mounts.entries).map(([path, entry]) => ({
        path,
        filesystem: entry.filesystem?.provider ?? entry.config?.type ?? 'unknown',
      })),
      metadata: {
        ...this.labels,
        image: this.image,
        memory: this.memory,
        sandboxStatus: this._sandbox?.status,
      },
    };
  }

  /**
   * Get instructions describing this Blaxel sandbox.
   * Used by agents to understand the execution environment.
   */
  getInstructions(): string {
    const mountCount = this.mounts.entries.size;
    const mountInfo = mountCount > 0 ? ` ${mountCount} filesystem(s) mounted via FUSE.` : '';
    return `Cloud sandbox with /home/user as working directory.${mountInfo}`;
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensure the sandbox is started and return the Blaxel SandboxInstance.
   * Uses base class ensureRunning() for status management and error handling.
   * @throws {SandboxNotReadyError} if sandbox fails to start
   */
  private async ensureSandbox(): Promise<SandboxInstance> {
    await this.ensureRunning();
    return this._sandbox!;
  }

  /**
   * Check if an error indicates the sandbox itself is dead/gone.
   * Does NOT include code execution timeouts (those are the user's code taking too long).
   */
  private isSandboxDeadError(error: unknown): boolean {
    if (!error) return false;
    const errorStr = errorToString(error);
    return (
      errorStr.includes('TERMINATED') ||
      errorStr.includes('sandbox was not found') ||
      errorStr.includes('Sandbox not found')
    );
  }

  /**
   * Handle sandbox timeout by clearing the instance and resetting state.
   *
   * Bypasses the normal stop() lifecycle because the sandbox is already dead —
   * we can't unmount filesystems or run cleanup commands. Instead we reset
   * mount states to 'pending' so they get re-mounted when start() runs again.
   */
  private handleSandboxTimeout(): void {
    this._sandbox = null;

    // Reset mounted entries to pending so they get re-mounted on restart
    for (const [path, entry] of this.mounts.entries) {
      if (entry.state === 'mounted' || entry.state === 'mounting') {
        this.mounts.set(path, { state: 'pending' });
      }
    }

    this.status = 'stopped';
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command in the sandbox.
   * Automatically starts the sandbox if not already running.
   * Retries once if the sandbox is found to be dead.
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    this.logger.debug(`${LOG_PREFIX} Executing: ${command} ${args.join(' ')}`, options);
    const sandbox = await this.ensureSandbox();

    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.map(shellQuote).join(' ')}` : command;

    this.logger.debug(`${LOG_PREFIX} Executing: ${fullCommand}`);

    try {
      // Merge sandbox default env with per-command env (per-command overrides)
      // Filter out undefined values to get Record<string, string>
      const mergedEnv = { ...this.env, ...options.env };
      const envRecord = Object.fromEntries(
        Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );

      const result = await sandbox.process.exec({
        command: fullCommand,
        workingDir: options.cwd,
        env: envRecord,
        waitForCompletion: true,
        ...(options.timeout && { timeout: Math.ceil(options.timeout / 1000) }),
        ...(options.onStdout || options.onStderr
          ? {
              onStdout: options.onStdout,
              onStderr: options.onStderr,
            }
          : {}),
      });

      const executionTimeMs = Date.now() - startTime;
      const exitCode = result.exitCode ?? 0;
      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';

      this.logger.debug(`${LOG_PREFIX} Exit code: ${exitCode} (${executionTimeMs}ms)`);
      if (stdout) this.logger.debug(`${LOG_PREFIX} stdout:\n${stdout}`);
      if (stderr) this.logger.debug(`${LOG_PREFIX} stderr:\n${stderr}`);

      return {
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        executionTimeMs,
        command,
        args,
      };
    } catch (error) {
      // Handle sandbox-is-dead errors - retry once (not infinitely)
      if (this.isSandboxDeadError(error) && !this._isRetrying) {
        this.handleSandboxTimeout();
        this._isRetrying = true;
        try {
          return await this.executeCommand(command, args, options);
        } finally {
          this._isRetrying = false;
        }
      }

      const executionTimeMs = Date.now() - startTime;

      const stderr = errorToString(error);

      this.logger.debug(`${LOG_PREFIX} Execution error (${executionTimeMs}ms): ${stderr}`);

      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr,
        executionTimeMs,
        command,
        args,
      };
    }
  }
}
