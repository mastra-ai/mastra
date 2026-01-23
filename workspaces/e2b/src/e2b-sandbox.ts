/**
 * E2B Sandbox Provider
 *
 * A simplified E2B sandbox implementation that supports mounting
 * cloud filesystems (S3, GCS, R2) via FUSE.
 *
 * @see https://e2b.dev/docs
 */

import { createHash } from 'node:crypto';

import type {
  WorkspaceSandbox,
  SandboxStatus,
  SandboxRuntime,
  SandboxInfo,
  ExecuteCommandOptions,
  CommandResult,
  WorkspaceFilesystem,
  FilesystemMountConfig,
} from '@mastra/core/workspace';
import { SandboxNotReadyError } from '@mastra/core/workspace';
import { Sandbox } from '@e2b/code-interpreter';

// =============================================================================
// Mount Configuration Types
// =============================================================================

/**
 * S3 mount configuration for E2B sandboxes.
 * E2B can mount S3 buckets using s3fs-fuse.
 */
export interface S3MountConfig extends FilesystemMountConfig {
  type: 's3';
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional endpoint for S3-compatible storage (MinIO, R2, etc.) */
  endpoint?: string;
}

/**
 * GCS mount configuration for E2B sandboxes.
 * E2B can mount GCS buckets using gcsfuse.
 */
export interface GCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  bucket: string;
  /** Service account key JSON (stringified) */
  serviceAccountKey: string;
}

/**
 * R2 mount configuration for E2B sandboxes.
 * Cloudflare R2 is S3-compatible, mounted via s3fs-fuse.
 */
export interface R2MountConfig extends FilesystemMountConfig {
  type: 'r2';
  bucket: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Supported mount config types for E2B sandbox.
 */
export type E2BMountConfig = S3MountConfig | GCSMountConfig | R2MountConfig;

/**
 * Hash credentials for marker file comparison.
 * Uses SHA-256 to create a one-way hash that can detect credential changes.
 */
function hashCredentials(accessKeyId: string, secretAccessKey: string): string {
  return createHash('sha256').update(`${accessKeyId}:${secretAccessKey}`).digest('hex').slice(0, 16);
}

// =============================================================================
// E2B Sandbox Options
// =============================================================================

/**
 * E2B sandbox provider configuration.
 */
export interface E2BSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /** Sandbox template ID */
  template?: string;
  /** Execution timeout in milliseconds
   *
   * @default 300_000 // 5 minutes
   */
  timeout?: number;
  /** Environment variables to set in the sandbox */
  env?: Record<string, string>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Supported runtimes (default: ['node', 'python', 'bash']) */
  runtimes?: SandboxRuntime[];
}

// =============================================================================
// E2B Sandbox Implementation
// =============================================================================

/**
 * Simplified E2B sandbox implementation.
 *
 * Features:
 * - Single sandbox instance lifecycle
 * - Supports mounting cloud filesystems (S3, GCS, R2) via FUSE
 * - Automatic sandbox timeout handling with retry
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox } from '@mastra/e2b';
 *
 * const sandbox = new E2BSandbox({
 *   timeout: 60000,
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * await workspace.init();
 * const result = await workspace.executeCode('console.log("Hello!")');
 * ```
 *
 * @example With S3 filesystem mounting
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox } from '@mastra/e2b';
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const workspace = new Workspace({
 *   filesystem: new S3Filesystem({
 *     bucket: 'my-bucket',
 *     region: 'us-east-1',
 *   }),
 *   sandbox: new E2BSandbox({ timeout: 60000 }),
 * });
 *
 * await workspace.init();
 * // Files written to workspace are accessible in sandbox at /workspace
 * ```
 */
export class E2BSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name = 'E2BSandbox';
  readonly provider = 'e2b';

  /**
   * E2B sandbox supports mounting cloud filesystems (S3, GCS, R2) via FUSE.
   */
  readonly supportsMounting = true;

  private _status: SandboxStatus = 'stopped';
  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;

  private readonly timeout: number;
  private readonly template?: string;
  private readonly env: Record<string, string>;
  private readonly metadata: Record<string, unknown>;
  private readonly configuredRuntimes: SandboxRuntime[];

  /** Track mounted filesystems by mount path */
  private readonly _mounts: Map<string, { filesystem: WorkspaceFilesystem; config: E2BMountConfig }> = new Map();

  constructor(options: E2BSandboxOptions = {}) {
    this.id = options.id ?? this.generateId();
    this.timeout = options.timeout ?? 300_000; // 5 minutes;
    this.template = options.template;
    this.env = options.env ?? {};
    this.metadata = options.metadata ?? {};
    this.configuredRuntimes = options.runtimes ?? ['node', 'python', 'bash'];
  }

  private generateId(): string {
    return `e2b-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return this.configuredRuntimes;
  }

  get defaultRuntime(): SandboxRuntime {
    return this.configuredRuntimes[0] ?? 'node';
  }

  // ---------------------------------------------------------------------------
  // Mount Support
  // ---------------------------------------------------------------------------

  /**
   * Check if this sandbox can mount a specific filesystem.
   * E2B can mount S3, GCS, and R2 filesystems via FUSE.
   */
  canMount(filesystem: WorkspaceFilesystem): boolean {
    if (!filesystem.supportsMounting || !filesystem.getMountConfig) {
      return false;
    }

    const config = filesystem.getMountConfig();
    // E2B can mount cloud storage via FUSE (s3fs, gcsfuse)
    // Note: 'local' filesystems cannot be mounted into E2B since it's a remote sandbox
    return config.type === 's3' || config.type === 'gcs' || config.type === 'r2';
  }

  /**
   * Mount a filesystem at a path in the sandbox.
   * Uses FUSE tools (s3fs, gcsfuse) to mount cloud storage.
   */
  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<void> {
    console.log(`[E2B Mount] Starting mount for ${mountPath}`);

    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    if (!filesystem.getMountConfig) {
      throw new Error('Filesystem does not support mounting');
    }

    const config = filesystem.getMountConfig() as E2BMountConfig;

    // Check if already mounted (e.g., when reconnecting to existing sandbox)
    const mountCheck = await this._sandbox.commands.run(
      `mountpoint -q "${mountPath}" && echo "mounted" || echo "not mounted"`,
    );

    if (mountCheck.stdout.trim() === 'mounted') {
      // Check if the mounted config matches what we want
      // Store marker in /tmp so we don't pollute the user's bucket
      const encodedPath = mountPath.replace(/\//g, '_');
      const markerPath = `/tmp/.mastra-mounts/${encodedPath}`;
      const expectedBucket = (config as S3MountConfig).bucket;
      const expectedEndpoint = (config as S3MountConfig).endpoint || '';
      const expectedCredHash = hashCredentials(
        (config as S3MountConfig).accessKeyId,
        (config as S3MountConfig).secretAccessKey,
      );

      try {
        const markerResult = await this._sandbox.commands.run(`cat "${markerPath}" 2>/dev/null || echo ""`);
        const markerContent = markerResult.stdout.trim();
        const expectedMarker = `${expectedBucket}|${expectedEndpoint}|${expectedCredHash}`;

        console.log(
          `[E2B Mount] Current marker: "${markerContent.slice(0, 50)}...", expected: "${expectedMarker.slice(0, 50)}..."`,
        );

        if (markerContent === expectedMarker) {
          console.log(`[E2B Mount] ${mountPath} is already mounted with correct config, skipping`);
          this._mounts.set(mountPath, { filesystem, config });
          return;
        }
      } catch {
        // Marker doesn't exist or can't be read - re-mount to be safe
      }

      // Different config or no marker - unmount and re-mount
      console.log(`[E2B Mount] Config mismatch or no marker, unmounting to re-mount with new config...`);
      await this.unmount(mountPath);
    }
    console.log(`[E2B Mount] Config type: ${config.type}`);

    // Create mount directory with sudo (for paths outside home dir like /data)
    // Then chown to current user so mount works without issues
    try {
      const mkdirResult = await this._sandbox.commands.run(
        `sudo mkdir -p "${mountPath}" && sudo chown $(id -u):$(id -g) "${mountPath}"`,
      );
      console.log(`[E2B Mount] mkdir result:`, mkdirResult);
    } catch (mkdirError) {
      console.log(`[E2B Mount] mkdir error:`, mkdirError);
      throw mkdirError;
    }

    switch (config.type) {
      case 's3':
        await this.mountS3(mountPath, config);
        break;
      case 'gcs':
        await this.mountGCS(mountPath, config);
        break;
      case 'r2':
        await this.mountR2(mountPath, config);
        break;
      default:
        throw new Error(`Unsupported mount type: ${(config as FilesystemMountConfig).type}`);
    }

    this._mounts.set(mountPath, { filesystem, config });

    // Write marker file so we can detect config changes on reconnect
    // Store in /tmp so we don't pollute the user's bucket
    // Format: bucket|endpoint|credentialHash
    const encodedPath = mountPath.replace(/\//g, '_');
    const markerPath = `/tmp/.mastra-mounts/${encodedPath}`;
    const bucket = (config as S3MountConfig).bucket || '';
    const endpoint = (config as S3MountConfig).endpoint || '';
    const credHash = hashCredentials((config as S3MountConfig).accessKeyId, (config as S3MountConfig).secretAccessKey);
    const markerContent = `${bucket}|${endpoint}|${credHash}`;
    try {
      await this._sandbox.commands.run('mkdir -p /tmp/.mastra-mounts');
      await this._sandbox.files.write(markerPath, markerContent);
    } catch {
      // Non-fatal - marker is just for optimization
      console.log(`[E2B Mount] Warning: Could not write marker file at ${markerPath}`);
    }

    console.log(`[E2B Mount] Successfully mounted ${mountPath}`);
  }

  /**
   * Unmount a filesystem from a path in the sandbox.
   */
  async unmount(mountPath: string): Promise<void> {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    console.log(`[E2B Mount] Unmounting ${mountPath}...`);

    try {
      // Use fusermount for FUSE mounts, fall back to umount
      const result = await this._sandbox.commands.run(
        `sudo fusermount -u "${mountPath}" 2>/dev/null || sudo umount "${mountPath}"`,
      );
      if (result.exitCode !== 0) {
        console.log(`[E2B Mount] Unmount warning: ${result.stderr || result.stdout}`);
      }
    } catch (error) {
      console.log(`[E2B Mount] Unmount error:`, error);
      // Try lazy unmount as last resort
      await this._sandbox.commands.run(`sudo umount -l "${mountPath}" 2>/dev/null || true`);
    }

    this._mounts.delete(mountPath);

    // Clean up marker file
    const encodedPath = mountPath.replace(/\//g, '_');
    const markerPath = `/tmp/.mastra-mounts/${encodedPath}`;
    await this._sandbox.commands.run(`rm -f "${markerPath}" 2>/dev/null || true`);

    // Remove empty mount directory (only if empty, rmdir fails on non-empty)
    // Use sudo since mount directories outside home (like /data) were created with sudo
    const rmdirResult = await this._sandbox.commands.run(`sudo rmdir "${mountPath}" 2>&1`);
    if (rmdirResult.exitCode === 0) {
      console.log(`[E2B Mount] Unmounted and removed ${mountPath}`);
    } else {
      console.log(
        `[E2B Mount] Unmounted ${mountPath} (directory not removed: ${rmdirResult.stderr?.trim() || 'not empty'})`,
      );
    }
  }

  /**
   * Unmount all stale mounts that are not in the expected mounts list.
   * Call this after reconnecting to an existing sandbox to clean up old mounts.
   */
  async reconcileMounts(expectedMountPaths: string[]): Promise<void> {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    // Get current FUSE mounts in the sandbox
    const mountsResult = await this._sandbox.commands.run(
      `grep -E 'fuse\\.(s3fs|gcsfuse)' /proc/mounts | awk '{print $2}'`,
    );
    const currentMounts = mountsResult.stdout
      .trim()
      .split('\n')
      .filter(p => p.length > 0);

    // Find mounts that exist but shouldn't
    const staleMounts = currentMounts.filter(path => !expectedMountPaths.includes(path));

    for (const stalePath of staleMounts) {
      console.log(`[E2B Mount] Found stale mount at ${stalePath}, unmounting...`);
      await this.unmount(stalePath);
    }
  }

  private async mountS3(mountPath: string, config: S3MountConfig): Promise<void> {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    // Install s3fs and fuse if not present
    const checkResult = await this._sandbox.commands.run('which s3fs || echo "not found"');
    if (checkResult.stdout.includes('not found')) {
      console.log('[E2B Mount] Installing s3fs and fuse...');
      await this._sandbox.commands.run('sudo apt-get update 2>&1', { timeoutMs: 60000 });

      const installResult = await this._sandbox.commands.run(
        'sudo apt-get install -y s3fs fuse 2>&1 || sudo apt-get install -y s3fs-fuse fuse 2>&1',
        { timeoutMs: 120000 },
      );

      if (installResult.exitCode !== 0) {
        throw new Error(`Failed to install s3fs: ${installResult.stderr || installResult.stdout}`);
      }
    }

    // Get user's uid/gid for proper file ownership
    const idResult = await this._sandbox.commands.run('id -u && id -g');
    const [uid, gid] = idResult.stdout.trim().split('\n');

    // Write credentials file (remove old one first to avoid permission issues)
    const credentialsContent = `${config.accessKeyId}:${config.secretAccessKey}`;
    const credentialsPath = '/tmp/.passwd-s3fs';
    await this._sandbox.commands.run(`sudo rm -f ${credentialsPath}`);
    await this._sandbox.files.write(credentialsPath, credentialsContent);
    await this._sandbox.commands.run(`chmod 600 ${credentialsPath}`);

    // Build mount options
    const mountOptions = [
      `passwd_file=${credentialsPath}`,
      'allow_other', // Allow non-root users to access the mount
    ];

    // Set uid/gid so mounted files are owned by user, not root
    if (uid && gid) {
      mountOptions.push(`uid=${uid}`, `gid=${gid}`);
    }

    if (config.endpoint) {
      // For S3-compatible storage (MinIO, R2, etc.)
      const endpoint = config.endpoint.replace(/\/$/, '');
      mountOptions.push(`url=${endpoint}`, 'use_path_request_style', 'sigv4', 'nomultipart');
    }

    // Mount with sudo (required for /dev/fuse access)
    const mountCmd = `sudo s3fs ${config.bucket} ${mountPath} -o ${mountOptions.join(' -o ')}`;
    console.log('[E2B Mount] Mounting S3:', mountCmd.replace(credentialsPath, '***'));

    try {
      const result = await this._sandbox.commands.run(mountCmd);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to mount S3 bucket: ${result.stderr || result.stdout}`);
      }
    } catch (error: unknown) {
      const errorObj = error as { result?: { exitCode: number; stdout: string; stderr: string } };
      const stderr = errorObj.result?.stderr || '';
      const stdout = errorObj.result?.stdout || '';
      throw new Error(`Failed to mount S3 bucket: ${stderr || stdout || error}`);
    }
  }

  private async mountGCS(mountPath: string, config: GCSMountConfig): Promise<void> {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    // Install gcsfuse if not present
    const checkResult = await this._sandbox.commands.run('which gcsfuse || echo "not found"');
    if (checkResult.stdout.includes('not found')) {
      await this._sandbox.commands.run(
        'echo "deb https://packages.cloud.google.com/apt gcsfuse-jammy main" | tee /etc/apt/sources.list.d/gcsfuse.list && ' +
          'curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add - && ' +
          'apt-get update && apt-get install -y gcsfuse',
      );
    }

    // Write service account key
    await this._sandbox.files.write('/tmp/gcs-key.json', config.serviceAccountKey);

    // Mount using gcsfuse
    const mountCmd = `GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcs-key.json gcsfuse ${config.bucket} ${mountPath}`;
    const result = await this._sandbox.commands.run(mountCmd);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to mount GCS bucket: ${result.stderr}`);
    }
  }

  private async mountR2(mountPath: string, config: R2MountConfig): Promise<void> {
    // R2 is S3-compatible, use s3fs with R2 endpoint
    const s3Config: S3MountConfig = {
      type: 's3',
      bucket: config.bucket,
      region: 'auto',
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    };

    await this.mountS3(mountPath, s3Config);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this._sandbox) {
      this._status = 'running';
      return;
    }

    this._status = 'starting';

    try {
      // Try to find an existing sandbox with matching metadata first
      const existingSandbox = await this.findExistingSandbox();
      if (existingSandbox) {
        this._sandbox = existingSandbox;
        this._createdAt = new Date();
        this._status = 'running';
        console.log(`[E2BSandbox] Reconnected to existing sandbox for: ${this.id}`);
        return;
      }

      // Create a new sandbox with our logical ID in metadata
      // Using betaCreate with autoPause so sandbox pauses on timeout instead of being destroyed
      console.log(`[E2BSandbox] Creating new sandbox for: ${this.id}`);
      this._sandbox = await Sandbox.betaCreate(this.template ?? 'base', {
        autoPause: true,
        metadata: {
          ...this.metadata,
          'mastra-sandbox-id': this.id,
        },
        envs: this.env,
        timeoutMs: this.timeout,
      });

      console.log(`[E2BSandbox] Created sandbox ${this._sandbox.sandboxId} for logical ID: ${this.id}`);
      this._createdAt = new Date();
      this._status = 'running';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  /**
   * Find an existing sandbox with matching mastra-sandbox-id metadata.
   * Returns the connected sandbox if found, null otherwise.
   */
  private async findExistingSandbox(): Promise<Sandbox | null> {
    try {
      // Query E2B for existing sandbox with our logical ID in metadata
      const paginator = Sandbox.list({
        query: {
          metadata: { 'mastra-sandbox-id': this.id },
          state: ['running', 'paused'],
        },
      });

      const sandboxes = await paginator.nextItems();

      console.log('[findExistingSandbox] sandboxes:', sandboxes);

      // Sandbox.list only returns running/paused sandboxes, so no need to filter
      if (sandboxes.length > 0) {
        const existingSandbox = sandboxes[0]!;
        console.log(
          `[E2BSandbox] Found existing sandbox for ${this.id}: ${existingSandbox.sandboxId} (state: ${existingSandbox.state})`,
        );
        return await Sandbox.connect(existingSandbox.sandboxId);
      }
    } catch (e) {
      console.log(`[E2BSandbox] Error querying for existing sandbox:`, e);
      // Continue to create new sandbox
    }

    return null;
  }

  async stop(): Promise<void> {
    // Unmount all filesystems before stopping
    for (const mountPath of this._mounts.keys()) {
      await this.unmount(mountPath);
    }

    this._sandbox = null;
    this._status = 'stopped';
  }

  async destroy(): Promise<void> {
    // Unmount all filesystems
    for (const mountPath of this._mounts.keys()) {
      try {
        await this.unmount(mountPath);
      } catch {
        // Ignore errors during cleanup
      }
    }

    if (this._sandbox) {
      try {
        await this._sandbox.kill();
      } catch {
        // Ignore errors during destroy
      }
    }

    this._sandbox = null;
    this._mounts.clear();
    this._status = 'destroyed';
  }

  async isReady(): Promise<boolean> {
    return this._status === 'running' && this._sandbox !== null;
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this._status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        ...this.metadata,
        mounts: Array.from(this._mounts.keys()),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private async ensureSandbox(): Promise<Sandbox> {
    if (!this._sandbox) {
      await this.start();
    }
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  /**
   * Check if error indicates the sandbox itself is dead/gone.
   * Does NOT include code execution timeouts (those are the user's code taking too long).
   * Does NOT include "port is not open" - that needs sandbox kill, not reconnect.
   */
  private isSandboxDeadError(error: unknown): boolean {
    if (!error) return false;
    const errorStr = String(error);
    return (
      errorStr.includes('sandbox was not found') ||
      errorStr.includes('Sandbox is probably not running') ||
      errorStr.includes('Sandbox not found') ||
      errorStr.includes('sandbox has been killed')
    );
  }

  private handleSandboxTimeout(): void {
    this._sandbox = null;
    this._status = 'stopped';
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions & { _isRetry?: boolean } = {},
  ): Promise<CommandResult> {
    const sandbox = await this.ensureSandbox();

    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    console.log(`[E2B] Executing: ${fullCommand}`);

    try {
      const result = await sandbox.commands.run(fullCommand, {
        cwd: options.cwd,
        envs: options.env,
        timeoutMs: options.timeout,
        onStdout: (data: string) => {
          console.log(`[E2B] stdout: ${data}`);
          options.onStdout?.(data);
        },
        onStderr: (data: string) => {
          console.log(`[E2B] stderr: ${data}`);
          options.onStderr?.(data);
        },
      });

      const executionTimeMs = Date.now() - startTime;

      console.log(`[E2B] Exit code: ${result.exitCode} (${executionTimeMs}ms)`);

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTimeMs,
        command,
        args,
      };
    } catch (error) {
      // Handle sandbox-is-dead errors - retry once (not infinitely)
      if (this.isSandboxDeadError(error) && !options._isRetry) {
        this.handleSandboxTimeout();
        return this.executeCommand(command, args, { ...options, _isRetry: true });
      }

      const executionTimeMs = Date.now() - startTime;

      // E2B errors often contain the actual command result in error.result
      const errorObj = error as { result?: { exitCode: number; stdout: string; stderr: string } };
      const stdout = errorObj.result?.stdout || '';
      const stderr = errorObj.result?.stderr || (error instanceof Error ? error.message : String(error));
      const exitCode = errorObj.result?.exitCode ?? 1;

      console.log(`[E2B] Exit code: ${exitCode} (${executionTimeMs}ms) [error]`);
      if (stdout) console.log(`[E2B] stdout:\n${stdout}`);
      if (stderr) console.log(`[E2B] stderr:\n${stderr}`);

      return {
        success: false,
        exitCode,
        stdout,
        stderr,
        executionTimeMs,
        command,
        args,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Filesystem Operations (Sandbox's internal FS)
  // ---------------------------------------------------------------------------

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    const sandbox = await this.ensureSandbox();
    const contentStr = typeof content === 'string' ? content : content.toString('utf-8');
    await sandbox.files.write(path, contentStr);
  }

  async readFile(path: string): Promise<string> {
    const sandbox = await this.ensureSandbox();
    return sandbox.files.read(path);
  }

  async listFiles(path: string): Promise<string[]> {
    const sandbox = await this.ensureSandbox();
    const entries = await sandbox.files.list(path);
    return entries.map((e: { name: string }) => e.name);
  }
}
