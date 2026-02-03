/**
 * E2B Sandbox Provider
 *
 * A simplified E2B sandbox implementation that supports mounting
 * cloud filesystems (S3, GCS, R2) via FUSE.
 *
 * @see https://e2b.dev/docs
 */

import type {
  WorkspaceSandbox,
  SandboxInfo,
  ExecuteCommandOptions,
  CommandResult,
  WorkspaceFilesystem,
  MountResult,
  FilesystemMountConfig,
  ProviderStatus,
} from '@mastra/core/workspace';
import { BaseSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { Sandbox, Template } from 'e2b';
import type { TemplateBuilder, TemplateClass } from 'e2b';
import { createDefaultMountableTemplate } from './utils/template';
import type { TemplateSpec } from './utils/template';
import type { IMastraLogger } from '@mastra/core/logger';

// =============================================================================
// Mount Configuration Types
// =============================================================================
// E2B defines the mount configs it supports for FUSE mounting via s3fs/gcsfuse.

/**
 * S3 mount config for E2B (mounted via s3fs-fuse).
 * Works with AWS S3 and S3-compatible stores (MinIO, etc.).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using the public_bucket=1 option (for public buckets only).
 */
export interface E2BS3MountConfig extends FilesystemMountConfig {
  type: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region */
  region: string;
  /** S3 endpoint for S3-compatible storage (MinIO, etc.) */
  endpoint?: string;
  /** AWS access key ID (optional - omit for public buckets) */
  accessKeyId?: string;
  /** AWS secret access key (optional - omit for public buckets) */
  secretAccessKey?: string;
}

/**
 * GCS mount config for E2B (mounted via gcsfuse).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using anonymous access (for public buckets only).
 */
export interface E2BGCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  /** GCS bucket name */
  bucket: string;
  /** Service account key JSON (optional - omit for public buckets) */
  serviceAccountKey?: string;
}

/**
 * Cloudflare R2 mount config for E2B (mounted via s3fs-fuse).
 * R2 is S3-compatible with a specific endpoint format.
 */
export interface E2BR2MountConfig extends FilesystemMountConfig {
  type: 'r2';
  /** R2 account ID */
  accountId: string;
  /** R2 bucket name */
  bucket: string;
  /** R2 access key ID */
  accessKeyId: string;
  /** R2 secret access key */
  secretAccessKey: string;
}

/**
 * Union of mount configs supported by E2B sandbox.
 */
export type E2BMountConfig = E2BS3MountConfig | E2BGCSMountConfig | E2BR2MountConfig;


// =============================================================================
// E2B Sandbox Options
// =============================================================================

/**
 * Runtime types supported by E2B.
 */
export type SandboxRuntime = 'node' | 'python' | 'bash' | 'ruby' | 'go' | 'rust' | 'java' | 'cpp' | 'r';

/**
 * Context passed to mount hooks.
 */
export interface MountHookContext {
  /** The E2B sandbox instance */
  sandbox: E2BSandbox;
  /** The mount path in the sandbox */
  mountPath: string;
}

/**
 * Mount hook function type.
 * Return true to indicate the hook handled mounting (skip default behavior).
 * Return false or undefined to proceed with default mounting.
 */
export type MountHook = (
  filesystem: WorkspaceFilesystem,
  config: E2BMountConfig,
  ctx: MountHookContext,
) => Promise<boolean | void> | boolean | void;

/**
 * E2B sandbox provider configuration.
 */
export interface E2BSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /**
   * Sandbox template specification.
   *
   * - `string` - Use an existing template by ID
   * - `TemplateBuilder` - Use a custom template (e.g., from `createMountableTemplate()`)
   * - `(base) => base.aptInstall([...])` - Customize the default mountable template
   *
   * If not provided and mounting is used, a default template with s3fs will be built.
   * For best performance, pre-build your template and use the template ID.
   *
   * @see createDefaultMountableTemplate
   */
  template?: TemplateSpec;
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
  /**
   * Custom mount hook for handling filesystem mounts.
   *
   * This hook is called before the default mount behavior.
   * Return true to skip default mounting (hook handled it).
   * Return false/undefined to proceed with default mounting.
   *
   * @example Custom S3 mount
   * ```typescript
   * const sandbox = new E2BSandbox({
   *   onMount: async (filesystem, config, ctx) => {
   *     if (config.type === 's3') {
   *       // Custom S3 mounting logic
   *       await ctx.executeCommand('my-custom-mount-script', [config.bucket, ctx.mountPath]);
   *       return true; // Skip default mount
   *     }
   *     return false; // Use default mount for other types
   *   },
   * });
   * ```
   *
   * @example Sync local filesystem to sandbox
   * ```typescript
   * const sandbox = new E2BSandbox({
   *   onMount: async (filesystem, config, ctx) => {
   *     if (filesystem.provider === 'local') {
   *       // Upload local files to sandbox
   *       const files = await filesystem.readdir('/', { recursive: true });
   *       for (const file of files) {
   *         if (file.type === 'file') {
   *           const content = await filesystem.readFile(`/${file.name}`);
   *           await ctx.writeFile(`${ctx.mountPath}/${file.name}`, content);
   *         }
   *       }
   *       return true; // Skip FUSE mount (we synced files instead)
   *     }
   *   },
   * });
   * ```
   */
  onMount?: MountHook;
  /** Optional logger instance */
  logger?: IMastraLogger;
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
export class E2BSandbox extends BaseSandbox {
  readonly id: string;
  readonly name = 'E2BSandbox';
  readonly provider = 'e2b';

  private _status: ProviderStatus = 'stopped';
  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;

  private readonly timeout: number;
  private readonly templateSpec?: TemplateSpec;
  private readonly env: Record<string, string>;
  private readonly metadata: Record<string, unknown>;
  private readonly configuredRuntimes: SandboxRuntime[];
  private readonly onMountHook?: MountHook;

  /** Resolved template ID after building (if needed) */
  private _resolvedTemplateId?: string;

  /** Promise for template preparation (started in constructor) */
  private _templatePreparePromise?: Promise<string>;

  constructor(options: E2BSandboxOptions = {}) {
    super({ name: 'E2BSandbox' });
    if (options.logger) {
      this.__setLogger(options.logger);
    }

    this.id = options.id ?? this.generateId();
    this.timeout = options.timeout ?? 300_000; // 5 minutes;
    this.templateSpec = options.template;
    this.env = options.env ?? {};
    this.metadata = options.metadata ?? {};
    this.configuredRuntimes = options.runtimes ?? ['node', 'python', 'bash'];
    this.onMountHook = options.onMount;

    // Start template preparation immediately in background
    // This way template build (if needed) begins before start() is called
    this._templatePreparePromise = this.resolveTemplate().catch(err => {
      this.logger.debug(`[E2BSandbox] Template preparation error (will retry on start):`, err);
      return ''; // Return empty string, will be retried in start()
    });
  }

  private generateId(): string {
    return `e2b-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): ProviderStatus {
    return this._status;
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return this.configuredRuntimes;
  }

  get defaultRuntime(): SandboxRuntime {
    return this.configuredRuntimes[0] ?? 'node';
  }

  /**
   * Get the underlying E2B Sandbox instance for direct access to E2B APIs.
   *
   * Use this when you need to access E2B features not exposed through the
   * WorkspaceSandbox interface (e.g., files API, ports, etc.).
   *
   * @throws {SandboxNotReadyError} If the sandbox has not been started
   *
   * @example Direct file operations
   * ```typescript
   * const e2bSandbox = sandbox.instance;
   * await e2bSandbox.files.write('/tmp/test.txt', 'Hello');
   * const content = await e2bSandbox.files.read('/tmp/test.txt');
   * const files = await e2bSandbox.files.list('/tmp');
   * ```
   *
   * @example Access ports
   * ```typescript
   * const e2bSandbox = sandbox.instance;
   * const url = e2bSandbox.getHost(3000);
   * ```
   */
  get instance(): Sandbox {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  // ---------------------------------------------------------------------------
  // Mount Support
  // ---------------------------------------------------------------------------

  /**
   * Update or create a mount entry in the inherited _mounts map.
   */
  private updateMountEntry(
    mountPath: string,
    filesystem: WorkspaceFilesystem,
    state: 'pending' | 'mounting' | 'mounted' | 'error' | 'unsupported',
    config?: E2BMountConfig,
    error?: string,
  ): void {
    const existing = this._mounts.get(mountPath);
    if (existing) {
      existing.state = state;
      if (config) {
        existing.config = config;
        existing.configHash = this.hashConfig(config);
      }
      if (error !== undefined) existing.error = error;
    } else {
      // Create new entry (for direct mount() calls without setMounts)
      this._mounts.set(mountPath, {
        filesystem,
        state,
        sandboxMount: true,
        config,
        configHash: config ? this.hashConfig(config) : undefined,
        error,
      });
    }
  }

  /**
   * Mount a filesystem at a path in the sandbox.
   * Uses FUSE tools (s3fs, gcsfuse) to mount cloud storage.
   *
   * If an `onMount` hook is configured, it will be called first.
   * The hook can return true to skip the default mount behavior.
   */
  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    this.logger.debug(`[E2B Mount] Starting mount for ${mountPath}`);

    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    if (!filesystem.getMountConfig) {
      this.updateMountEntry(mountPath, filesystem, 'unsupported', undefined, 'Filesystem does not support mounting');
      return { success: false, mountPath, error: 'Filesystem does not support mounting' };
    }

    const config = filesystem.getMountConfig() as E2BMountConfig;

    // Call the onMount hook if configured
    if (this.onMountHook) {
      const hookContext: MountHookContext = {
        sandbox: this,
        mountPath,
      };

      try {
        const hookHandled = await this.onMountHook(filesystem, config, hookContext);
        if (hookHandled === true) {
          this.logger.debug(`[E2B Mount] Mount handled by onMount hook for ${mountPath}`);
          this.updateMountEntry(mountPath, filesystem, 'mounted', config);
          return { success: true, mountPath };
        }
      } catch (hookError) {
        this.logger.debug(`[E2B Mount] onMount hook error:`, hookError);
        this.updateMountEntry(mountPath, filesystem, 'error', config, `Mount hook failed: ${String(hookError)}`);
        return { success: false, mountPath, error: `Mount hook failed: ${String(hookError)}` };
      }
    }

    // Check if already mounted with matching config (e.g., when reconnecting to existing sandbox)
    const existingMount = await this.checkExistingMount(mountPath, config);
    if (existingMount === 'matching') {
      this.logger.debug(`[E2B Mount] ${mountPath} is already mounted with correct config, skipping`);
      this.updateMountEntry(mountPath, filesystem, 'mounted', config);
      return { success: true, mountPath };
    } else if (existingMount === 'mismatched') {
      // Different config - unmount and re-mount
      this.logger.debug(`[E2B Mount] Config mismatch, unmounting to re-mount with new config...`);
      await this.unmount(mountPath);
    }
    this.logger.debug(`[E2B Mount] Config type: ${config.type}`);

    // Mark as mounting
    this.updateMountEntry(mountPath, filesystem, 'mounting', config);

    // Create mount directory with sudo (for paths outside home dir like /data)
    // Then chown to current user so mount works without issues
    try {
      const mkdirResult = await this._sandbox.commands.run(
        `sudo mkdir -p "${mountPath}" && sudo chown $(id -u):$(id -g) "${mountPath}"`,
      );
      this.logger.debug(`[E2B Mount] mkdir result:`, mkdirResult);
    } catch (mkdirError) {
      this.logger.debug(`[E2B Mount] mkdir error:`, mkdirError);
      this.updateMountEntry(mountPath, filesystem, 'error', config, String(mkdirError));
      return { success: false, mountPath, error: String(mkdirError) };
    }

    try {
      switch (config.type) {
        case 's3':
          await this.mountS3(mountPath, config as E2BS3MountConfig);
          break;
        case 'gcs':
          await this.mountGCS(mountPath, config as E2BGCSMountConfig);
          break;
        case 'r2':
          await this.mountR2(mountPath, config as E2BR2MountConfig);
          break;
        default:
          this.updateMountEntry(
            mountPath,
            filesystem,
            'unsupported',
            config,
            `Unsupported mount type: ${(config as FilesystemMountConfig).type}`,
          );
          return {
            success: false,
            mountPath,
            error: `Unsupported mount type: ${(config as FilesystemMountConfig).type}`,
          };
      }
    } catch (error) {
      this.updateMountEntry(mountPath, filesystem, 'error', config, String(error));
      return { success: false, mountPath, error: String(error) };
    }

    // Mark as mounted
    this.updateMountEntry(mountPath, filesystem, 'mounted', config);

    // Write marker file so we can detect config changes on reconnect
    await this.writeMarkerFile(mountPath, config);

    this.logger.debug(`[E2B Mount] Successfully mounted ${mountPath}`);
    return { success: true, mountPath };
  }

  /**
   * Write marker file for detecting config changes on reconnect.
   * Uses the base class hashConfig() for consistent config comparison.
   */
  private async writeMarkerFile(mountPath: string, config: E2BMountConfig): Promise<void> {
    if (!this._sandbox) return;

    const encodedPath = mountPath.replace(/\//g, '_');
    const markerPath = `/tmp/.mastra-mounts/${encodedPath}`;
    const markerContent = this.hashConfig(config);
    try {
      await this._sandbox.commands.run('mkdir -p /tmp/.mastra-mounts');
      await this._sandbox.files.write(markerPath, markerContent);
    } catch {
      // Non-fatal - marker is just for optimization
      this.logger.debug(`[E2B Mount] Warning: Could not write marker file at ${markerPath}`);
    }
  }

  /**
   * Unmount a filesystem from a path in the sandbox.
   */
  async unmount(mountPath: string): Promise<void> {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }

    this.logger.debug(`[E2B Mount] Unmounting ${mountPath}...`);

    try {
      // Use fusermount for FUSE mounts, fall back to umount
      const result = await this._sandbox.commands.run(
        `sudo fusermount -u "${mountPath}" 2>/dev/null || sudo umount "${mountPath}"`,
      );
      if (result.exitCode !== 0) {
        this.logger.debug(`[E2B Mount] Unmount warning: ${result.stderr || result.stdout}`);
      }
    } catch (error) {
      this.logger.debug(`[E2B Mount] Unmount error:`, error);
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
      this.logger.debug(`[E2B Mount] Unmounted and removed ${mountPath}`);
    } else {
      this.logger.debug(
        `[E2B Mount] Unmounted ${mountPath} (directory not removed: ${rmdirResult.stderr?.trim() || 'not empty'})`,
      );
    }
  }

  /**
   * Get list of current mounts in the sandbox.
   */
  async getMounts(): Promise<Array<{ path: string; filesystem: string }>> {
    return Array.from(this._mounts.entries()).map(([path, { filesystem }]) => ({
      path,
      filesystem: filesystem.provider,
    }));
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
      this.logger.debug(`[E2B Mount] Found stale mount at ${stalePath}, unmounting...`);
      await this.unmount(stalePath);
    }
  }

  /**
   * Check if a path is already mounted and if the config matches.
   *
   * @returns 'not_mounted' | 'matching' | 'mismatched'
   */
  private async checkExistingMount(
    mountPath: string,
    config: E2BMountConfig,
  ): Promise<'not_mounted' | 'matching' | 'mismatched'> {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    // Check if path is a mount point
    const mountCheck = await this._sandbox.commands.run(
      `mountpoint -q "${mountPath}" && echo "mounted" || echo "not mounted"`,
    );

    if (mountCheck.stdout.trim() !== 'mounted') {
      return 'not_mounted';
    }

    // Path is mounted - check if config matches via marker file
    const encodedPath = mountPath.replace(/\//g, '_');
    const markerPath = `/tmp/.mastra-mounts/${encodedPath}`;
    const expectedMarker = this.hashConfig(config);

    try {
      const markerResult = await this._sandbox.commands.run(`cat "${markerPath}" 2>/dev/null || echo ""`);
      const markerContent = markerResult.stdout.trim();

      this.logger.debug(`[E2B Mount] Current marker: "${markerContent}", expected: "${expectedMarker}"`);

      if (markerContent === expectedMarker) {
        return 'matching';
      }
    } catch {
      // Marker doesn't exist or can't be read - treat as mismatched
    }

    return 'mismatched';
  }

  private async mountS3(mountPath: string, config: E2BS3MountConfig): Promise<void> {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    // Check if s3fs is installed
    const checkResult = await this._sandbox.commands.run('which s3fs || echo "not found"');
    if (checkResult.stdout.includes('not found')) {
      // If using a custom template without mount deps, try to install at runtime
      this.logger.warn('[E2B Mount] s3fs not found, attempting runtime installation...');
      this.logger.info('[E2B Mount] Tip: For faster startup, use createMountableTemplate() to pre-install s3fs');

      await this._sandbox.commands.run('sudo apt-get update 2>&1', { timeoutMs: 60000 });

      const installResult = await this._sandbox.commands.run(
        'sudo apt-get install -y s3fs fuse 2>&1 || sudo apt-get install -y s3fs-fuse fuse 2>&1',
        { timeoutMs: 120000 },
      );

      if (installResult.exitCode !== 0) {
        throw new Error(
          `Failed to install s3fs. ` +
            `For S3 mounting, your template needs s3fs and fuse packages.\n\n` +
            `Option 1: Use createMountableTemplate() helper:\n` +
            `  import { E2BSandbox, createMountableTemplate } from '@mastra/e2b';\n` +
            `  const sandbox = new E2BSandbox({ template: createMountableTemplate() });\n\n` +
            `Option 2: Customize the base template:\n` +
            `  new E2BSandbox({ template: base => base.aptInstall(['your-packages']) })\n\n` +
            `Error details: ${installResult.stderr || installResult.stdout}`,
        );
      }
    }

    // Get user's uid/gid for proper file ownership
    const idResult = await this._sandbox.commands.run('id -u && id -g');
    const [uid, gid] = idResult.stdout.trim().split('\n');

    // Determine if we have credentials or using public bucket mode
    const hasCredentials = config.accessKeyId && config.secretAccessKey;
    const credentialsPath = '/tmp/.passwd-s3fs';

    if (hasCredentials) {
      // Write credentials file (remove old one first to avoid permission issues)
      const credentialsContent = `${config.accessKeyId}:${config.secretAccessKey}`;
      await this._sandbox.commands.run(`sudo rm -f ${credentialsPath}`);
      await this._sandbox.files.write(credentialsPath, credentialsContent);
      await this._sandbox.commands.run(`chmod 600 ${credentialsPath}`);
    }

    // Build mount options
    const mountOptions: string[] = [];

    if (hasCredentials) {
      mountOptions.push(`passwd_file=${credentialsPath}`);
    } else {
      // Public bucket mode - read-only access without credentials
      mountOptions.push('public_bucket=1');
      this.logger.debug('[E2B Mount] No credentials provided, mounting as public bucket (read-only)');
    }

    mountOptions.push('allow_other'); // Allow non-root users to access the mount

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
    this.logger.debug('[E2B Mount] Mounting S3:', hasCredentials ? mountCmd.replace(credentialsPath, '***') : mountCmd);

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

  private async mountGCS(mountPath: string, config: E2BGCSMountConfig): Promise<void> {
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

    // Get user's uid/gid for proper file ownership
    const idResult = await this._sandbox.commands.run('id -u && id -g');
    const [uid, gid] = idResult.stdout.trim().split('\n');

    // Build mount options
    const mountOptions: string[] = [];

    // Set uid/gid so mounted files are owned by user, not root
    if (uid && gid) {
      mountOptions.push(`uid=${uid}`, `gid=${gid}`);
    }

    const hasCredentials = !!config.serviceAccountKey;
    let mountCmd: string;

    if (hasCredentials) {
      // Write service account key
      const keyPath = '/tmp/gcs-key.json';
      await this._sandbox.commands.run(`sudo rm -f ${keyPath}`);
      await this._sandbox.files.write(keyPath, config.serviceAccountKey!);
      await this._sandbox.commands.run(`chmod 600 ${keyPath}`);

      // Mount with credentials
      const optionsStr = mountOptions.length > 0 ? `-o ${mountOptions.join(' -o ')}` : '';
      mountCmd = `GOOGLE_APPLICATION_CREDENTIALS=${keyPath} gcsfuse ${optionsStr} ${config.bucket} ${mountPath}`;
    } else {
      // Public bucket mode - read-only access without credentials
      mountOptions.push('anonymous_access');
      this.logger.debug('[E2B Mount] No credentials provided, mounting GCS as public bucket (read-only)');

      const optionsStr = mountOptions.length > 0 ? `-o ${mountOptions.join(' -o ')}` : '';
      mountCmd = `gcsfuse ${optionsStr} ${config.bucket} ${mountPath}`;
    }

    this.logger.debug('[E2B Mount] Mounting GCS:', mountCmd);

    const result = await this._sandbox.commands.run(mountCmd);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to mount GCS bucket: ${result.stderr || result.stdout}`);
    }
  }

  private async mountR2(mountPath: string, config: E2BR2MountConfig): Promise<void> {
    // R2 is S3-compatible, use s3fs with R2 endpoint
    const s3Config: E2BS3MountConfig = {
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
      // Await template preparation (started in constructor) and existing sandbox search in parallel
      const [existingSandbox, templateId] = await Promise.all([
        this.findExistingSandbox(),
        this._templatePreparePromise || this.resolveTemplate(),
      ]);

      if (existingSandbox) {
        this._sandbox = existingSandbox;
        this._createdAt = new Date();
        this._status = 'running';
        this.logger.debug(`[E2BSandbox] Reconnected to existing sandbox for: ${this.id}`);

        // Clean up stale mounts from previous config, then mount pending
        const expectedPaths = Array.from(this._mounts.keys()).filter(
          path => this._mounts.get(path)?.sandboxMount !== false,
        );
        await this.reconcileMounts(expectedPaths);
        await this.mountPending();
        return;
      }

      // If template preparation failed earlier, retry now
      let resolvedTemplateId = templateId;
      if (!resolvedTemplateId) {
        this.logger.debug(`[E2BSandbox] Template preparation failed earlier, retrying...`);
        resolvedTemplateId = await this.resolveTemplate();
      }

      // Create a new sandbox with our logical ID in metadata
      // Using betaCreate with autoPause so sandbox pauses on timeout instead of being destroyed
      this.logger.debug(`[E2BSandbox] Creating new sandbox for: ${this.id} with template: ${resolvedTemplateId}`);

      try {
        this._sandbox = await Sandbox.betaCreate(resolvedTemplateId, {
          autoPause: true,
          metadata: {
            ...this.metadata,
            'mastra-sandbox-id': this.id,
          },
          envs: this.env,
          timeoutMs: this.timeout,
        });
      } catch (createError) {
        // If template not found (404), rebuild it and retry
        const errorStr = String(createError);
        if (errorStr.includes('404') && errorStr.includes('not found') && !this.templateSpec) {
          this.logger.debug(`[E2BSandbox] Template not found, rebuilding: ${templateId}`);
          this._resolvedTemplateId = undefined; // Clear cached ID to force rebuild
          const rebuiltTemplateId = await this.buildDefaultTemplate();

          this.logger.debug(`[E2BSandbox] Retrying sandbox creation with rebuilt template: ${rebuiltTemplateId}`);
          this._sandbox = await Sandbox.betaCreate(rebuiltTemplateId, {
            autoPause: true,
            metadata: {
              ...this.metadata,
              'mastra-sandbox-id': this.id,
            },
            envs: this.env,
            timeoutMs: this.timeout,
          });
        } else {
          throw createError;
        }
      }

      this.logger.debug(`[E2BSandbox] Created sandbox ${this._sandbox.sandboxId} for logical ID: ${this.id}`);
      this._createdAt = new Date();
      this._status = 'running';

      // Mount any pending filesystems
      await this.mountPending();
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  /**
   * Build the default mountable template (bypasses exists check).
   */
  private async buildDefaultTemplate(): Promise<string> {
    const { template, id } = createDefaultMountableTemplate();
    this.logger.debug(`[E2BSandbox] Building default mountable template: ${id}...`);
    const buildResult = await Template.build(template as TemplateClass, id);
    this._resolvedTemplateId = buildResult.templateId;
    this.logger.debug(`[E2BSandbox] Template built: ${buildResult.templateId}`);
    return buildResult.templateId;
  }

  /**
   * Resolve the template specification to a template ID.
   *
   * - String: Use as-is (template ID)
   * - TemplateBuilder: Build and return the template ID
   * - Function: Apply to base mountable template, then build
   * - undefined: Use default mountable template (cached)
   */
  private async resolveTemplate(): Promise<string> {
    // If already resolved, return cached ID
    if (this._resolvedTemplateId) {
      return this._resolvedTemplateId;
    }

    // No template specified - use default mountable template with caching
    if (!this.templateSpec) {
      const { template, id } = createDefaultMountableTemplate();

      // Check if template already exists (cached from previous runs)
      const exists = await Template.exists(id);
      if (exists) {
        this.logger.debug(`[E2BSandbox] Using cached mountable template: ${id}`);
        this._resolvedTemplateId = id;
        return id;
      }

      // Build the template (first time only)
      this.logger.debug(`[E2BSandbox] Building default mountable template: ${id}...`);
      const buildResult = await Template.build(template as TemplateClass, id);
      this._resolvedTemplateId = buildResult.templateId;
      this.logger.debug(`[E2BSandbox] Template built and cached: ${buildResult.templateId}`);
      return buildResult.templateId;
    }

    // String template ID - use directly
    if (typeof this.templateSpec === 'string') {
      this._resolvedTemplateId = this.templateSpec;
      return this.templateSpec;
    }

    // TemplateBuilder or function - need to build
    let template: TemplateBuilder;
    let templateName: string;

    if (typeof this.templateSpec === 'function') {
      // Apply customization function to base mountable template
      const { template: baseTemplate } = createDefaultMountableTemplate();
      template = this.templateSpec(baseTemplate);
      // Custom templates get unique names since they're modified
      templateName = `mastra-custom-${this.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    } else {
      // Use provided TemplateBuilder directly
      template = this.templateSpec;
      templateName = `mastra-${this.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    }

    // Build the template
    this.logger.debug(`[E2BSandbox] Building custom template: ${templateName}...`);
    const buildResult = await Template.build(template as TemplateClass, templateName);
    this._resolvedTemplateId = buildResult.templateId;
    this.logger.debug(`[E2BSandbox] Template built: ${buildResult.templateId}`);

    return buildResult.templateId;
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

      this.logger.debug('[findExistingSandbox] sandboxes:', sandboxes);

      // Sandbox.list only returns running/paused sandboxes, so no need to filter
      if (sandboxes.length > 0) {
        const existingSandbox = sandboxes[0]!;
        this.logger.debug(
          `[E2BSandbox] Found existing sandbox for ${this.id}: ${existingSandbox.sandboxId} (state: ${existingSandbox.state})`,
        );
        return await Sandbox.connect(existingSandbox.sandboxId);
      }
    } catch (e) {
      this.logger.debug(`[E2BSandbox] Error querying for existing sandbox:`, e);
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
      mounts: Array.from(this._mounts.entries()).map(([path, { filesystem }]) => ({
        path,
        filesystem: filesystem.provider,
      })),
      metadata: {
        ...this.metadata,
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
    this.logger.debug(`[E2B] Executing: ${command} ${args.join(' ')}`, options);
    const sandbox = await this.ensureSandbox();

    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    this.logger.debug(`[E2B] Executing: ${fullCommand}`);

    try {
      // Convert ProcessEnv to Record<string, string> by filtering out undefined values
      const envs = options.env
        ? Object.fromEntries(
            Object.entries(options.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
          )
        : undefined;

      const result = await sandbox.commands.run(fullCommand, {
        cwd: options.cwd,
        envs,
        timeoutMs: options.timeout,
        onStdout: options.onStdout,
        onStderr: options.onStderr,
      });

      const executionTimeMs = Date.now() - startTime;

      this.logger.debug(`[E2B] Exit code: ${result.exitCode} (${executionTimeMs}ms)`);
      if (result.stdout) this.logger.debug(`[E2B] stdout:\n${result.stdout}`);
      if (result.stderr) this.logger.debug(`[E2B] stderr:\n${result.stderr}`);

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

      this.logger.debug(`[E2B] Exit code: ${exitCode} (${executionTimeMs}ms) [error]`);
      if (stdout) this.logger.debug(`[E2B] stdout:\n${stdout}`);
      if (stderr) this.logger.debug(`[E2B] stderr:\n${stderr}`);

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
}
