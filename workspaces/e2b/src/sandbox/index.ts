/**
 * E2B Sandbox Provider
 *
 * A simplified E2B sandbox implementation that supports mounting
 * cloud filesystems (S3, GCS, R2) via FUSE.
 *
 * @see https://e2b.dev/docs
 */

import type { RequestContext } from '@mastra/core/di';
import type {
  SandboxInfo,
  WorkspaceFilesystem,
  MountResult,
  FilesystemMountConfig,
  ProviderStatus,
  MountManager,
  MastraSandboxOptions,
} from '@mastra/core/workspace';

/**
 * Inlined from `@mastra/core/workspace` to avoid requiring a newer core peer dep.
 */
type InstructionsOption = string | ((opts: { defaultInstructions: string; requestContext?: RequestContext }) => string);
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { Sandbox, Template } from 'e2b';
import type { TemplateBuilder, TemplateClass } from 'e2b';
import { createDefaultMountableTemplate } from '../utils/template';
import type { TemplateSpec } from '../utils/template';
import { mountS3, mountGCS, LOG_PREFIX } from './mounts';
import type { E2BMountConfig, E2BS3MountConfig, E2BGCSMountConfig, MountContext } from './mounts';
import { E2BProcessManager } from './process-manager';

/** Allowlist pattern for mount paths — absolute path with safe characters only. */
const SAFE_MOUNT_PATH = /^\/[a-zA-Z0-9_.\-/]+$/;

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
// E2B Sandbox Options
// =============================================================================

/**
 * E2B sandbox provider configuration.
 */
export interface E2BSandboxOptions extends MastraSandboxOptions {
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

  /** Domain for self-hosted E2B. Falls back to E2B_DOMAIN env var. */
  domain?: string;
  /** API URL for self-hosted E2B. Falls back to E2B_API_URL env var. */
  apiUrl?: string;
  /** API key for authentication. Falls back to E2B_API_KEY env var. */
  apiKey?: string;
  /** Access token for authentication. Falls back to E2B_ACCESS_TOKEN env var. */
  accessToken?: string;
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
 *   mounts: {
 *     '/bucket': new S3Filesystem({
 *       bucket: 'my-bucket',
 *       region: 'us-east-1',
 *     }),
 *   },
 *   sandbox: new E2BSandbox({ timeout: 60000 }),
 * });
 *
 * ```
 */
export class E2BSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'E2BSandbox';
  readonly provider = 'e2b';
  status: ProviderStatus = 'pending';

  declare readonly mounts: MountManager; // Non-optional (initialized by BaseSandbox)
  declare readonly processes: E2BProcessManager;

  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;
  private _isRetrying = false;
  private readonly timeout: number;
  private readonly templateSpec?: TemplateSpec;
  private readonly env: Record<string, string>;
  private readonly metadata: Record<string, unknown>;
  private readonly connectionOpts: Record<string, string>;
  private readonly _instructionsOverride?: InstructionsOption;

  /** Resolved template ID after building (if needed) */
  private _resolvedTemplateId?: string;

  /** Promise for template preparation (started in constructor) */
  private _templatePreparePromise?: Promise<string>;

  constructor(options: E2BSandboxOptions = {}) {
    super({
      ...options,
      name: 'E2BSandbox',
      processes: new E2BProcessManager({ env: options.env ?? {} }),
    });

    this.id = options.id ?? this.generateId();
    this.timeout = options.timeout ?? 300_000; // 5 minutes;
    this.templateSpec = options.template;
    this.env = options.env ?? {};
    this.metadata = options.metadata ?? {};
    this.connectionOpts = {
      ...(options.domain && { domain: options.domain }),
      ...(options.apiUrl && { apiUrl: options.apiUrl }),
      ...(options.apiKey && { apiKey: options.apiKey }),
      ...(options.accessToken && { accessToken: options.accessToken }),
    };

    this._instructionsOverride = options.instructions;

    // Start template preparation immediately in background
    // This way template build (if needed) begins before start() is called
    this._templatePreparePromise = this.resolveTemplate().catch(err => {
      this.logger.debug(`${LOG_PREFIX} Template preparation error (will retry on start):`, err);
      return ''; // Return empty string, will be retried in start()
    });
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
   * const e2b = sandbox.e2b;
   * await e2b.files.write('/tmp/test.txt', 'Hello');
   * const content = await e2b.files.read('/tmp/test.txt');
   * const files = await e2b.files.list('/tmp');
   * ```
   *
   * @example Access ports
   * ```typescript
   * const e2b = sandbox.e2b;
   * const url = e2b.getHost(3000);
   * ```
   */
  get e2b(): Sandbox {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start the E2B sandbox.
   * Handles template preparation, existing sandbox reconnection, and new sandbox creation.
   *
   * Status management and mount processing are handled by the base class.
   */
  async start(): Promise<void> {
    // Already have a sandbox instance
    if (this._sandbox) {
      return;
    }

    // Await template preparation (started in constructor) and existing sandbox search in parallel
    const [existingSandbox, templateId] = await Promise.all([
      this.findExistingSandbox(),
      this._templatePreparePromise || this.resolveTemplate(),
    ]);

    if (existingSandbox) {
      this._sandbox = existingSandbox;
      this._createdAt = new Date();
      this.logger.debug(`${LOG_PREFIX} Reconnected to existing sandbox for: ${this.id}`);

      // Clean up stale mounts from previous config
      // (processPending is called by base class after start completes)
      const expectedPaths = Array.from(this.mounts.entries.keys());
      this.logger.debug(`${LOG_PREFIX} Running mount reconciliation...`);
      await this.reconcileMounts(expectedPaths);
      this.logger.debug(`${LOG_PREFIX} Mount reconciliation complete`);
      return;
    }

    // If template preparation failed earlier, retry now
    let resolvedTemplateId = templateId;
    if (!resolvedTemplateId) {
      this.logger.debug(`${LOG_PREFIX} Template preparation failed earlier, retrying...`);
      resolvedTemplateId = await this.resolveTemplate();
    }

    // Create a new sandbox with our logical ID in metadata
    // Using betaCreate with autoPause so sandbox pauses on timeout instead of being destroyed
    this.logger.debug(`${LOG_PREFIX} Creating new sandbox for: ${this.id} with template: ${resolvedTemplateId}`);

    try {
      this._sandbox = await Sandbox.betaCreate(resolvedTemplateId, {
        ...this.connectionOpts,
        autoPause: true,
        metadata: {
          ...this.metadata,
          'mastra-sandbox-id': this.id,
        },
        timeoutMs: this.timeout,
      });
    } catch (createError) {
      // If template not found (404), rebuild it and retry
      const errorStr = String(createError);
      if (errorStr.includes('404') && errorStr.includes('not found') && !this.templateSpec) {
        this.logger.debug(`${LOG_PREFIX} Template not found, rebuilding: ${templateId}`);
        this._resolvedTemplateId = undefined; // Clear cached ID to force rebuild
        const rebuiltTemplateId = await this.buildDefaultTemplate();

        this.logger.debug(`${LOG_PREFIX} Retrying sandbox creation with rebuilt template: ${rebuiltTemplateId}`);
        this._sandbox = await Sandbox.betaCreate(rebuiltTemplateId, {
          ...this.connectionOpts,
          autoPause: true,
          metadata: {
            ...this.metadata,
            'mastra-sandbox-id': this.id,
          },
          timeoutMs: this.timeout,
        });
      } else {
        throw createError;
      }
    }

    this.logger.debug(`${LOG_PREFIX} Created sandbox ${this._sandbox.sandboxId} for logical ID: ${this.id}`);
    this._createdAt = new Date();

    // Note: processPending is called by base class after start completes
  }

  /**
   * Stop the E2B sandbox.
   * Unmounts all filesystems and releases the sandbox reference.
   * Status management is handled by the base class.
   */
  async stop(): Promise<void> {
    // Kill all background processes before stopping
    try {
      const procs = await this.processes.list();
      await Promise.all(procs.map(p => this.processes.kill(p.pid)));
    } catch {
      // Best-effort: sandbox may already be dead
    }

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
   * Destroy the E2B sandbox and clean up all resources.
   * Unmounts filesystems, kills the sandbox, and clears mount state.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    if (this._sandbox) {
      // Kill all background processes
      try {
        const procs = await this.processes.list();
        await Promise.all(procs.map(p => this.processes.kill(p.pid)));
      } catch {
        // Best-effort: sandbox may already be dead
      }

      // Unmount all filesystems
      // Collect keys first since unmount() mutates the map
      for (const mountPath of [...this.mounts.entries.keys()]) {
        try {
          await this.unmount(mountPath);
        } catch {
          // Ignore errors during cleanup
        }
      }

      try {
        await this._sandbox.kill();
      } catch {
        // Ignore errors during destroy
      }

      this._sandbox = null;
    }

    this.mounts.clear();
  }

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
        ...this.metadata,
      },
    };
  }

  /**
   * Get instructions describing this E2B sandbox.
   * Used by agents to understand the execution environment.
   */
  getInstructions(opts?: { requestContext?: RequestContext }): string {
    if (this._instructionsOverride === undefined) return this._getDefaultInstructions();
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    const defaultInstructions = this._getDefaultInstructions();
    return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
  }

  private _getDefaultInstructions(): string {
    const mountCount = this.mounts.entries.size;
    const mountInfo = mountCount > 0 ? ` ${mountCount} filesystem(s) mounted via FUSE.` : '';
    return `Cloud sandbox.${mountInfo}`;
  }

  // ---------------------------------------------------------------------------
  // Mounting
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
    const config = filesystem.getMountConfig?.() as E2BMountConfig | undefined;
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
      const checkResult = await this._sandbox.commands.run(
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

    // Create mount directory with sudo (for paths outside home dir like /data)
    // Then chown to current user so mount works without issues
    try {
      this.logger.debug(`${LOG_PREFIX} Creating mount directory for ${mountPath}...`);
      const mkdirCommand = `sudo mkdir -p "${mountPath}" && sudo chown $(id -u):$(id -g) "${mountPath}"`;

      this.logger.debug(`${LOG_PREFIX} Running command: ${mkdirCommand}`);
      const mkdirResult = await this._sandbox.commands.run(mkdirCommand);

      this.logger.debug(`${LOG_PREFIX} Created mount directory for mount path "${mountPath}":`, mkdirResult);
    } catch (mkdirError) {
      this.logger.debug(`${LOG_PREFIX} mkdir error for "${mountPath}":`, mkdirError);
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: String(mkdirError) });
      return { success: false, mountPath, error: String(mkdirError) };
    }

    // Create mount context for mount operations
    const mountCtx: MountContext = {
      sandbox: this._sandbox,
      logger: this.logger,
    };

    try {
      switch (config.type) {
        case 's3':
          this.logger.debug(`${LOG_PREFIX} Mounting S3 bucket at ${mountPath}...`);
          await mountS3(mountPath, config as E2BS3MountConfig, mountCtx);
          this.logger.debug(`${LOG_PREFIX} Mounted S3 bucket at ${mountPath}`);
          break;
        case 'gcs':
          this.logger.debug(`${LOG_PREFIX} Mounting GCS bucket at ${mountPath}...`);
          await mountGCS(mountPath, config as E2BGCSMountConfig, mountCtx);
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
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: String(error) });

      // Clean up the directory we created since mount failed
      try {
        await this._sandbox!.commands.run(`sudo rmdir "${mountPath}" 2>/dev/null || true`);
        this.logger.debug(`${LOG_PREFIX} Cleaned up directory after failed mount: ${mountPath}`);
      } catch {
        // Ignore cleanup errors
      }

      return { success: false, mountPath, error: String(error) };
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
      const result = await this._sandbox.commands.run(
        `sudo fusermount -u "${mountPath}" 2>/dev/null || sudo umount "${mountPath}"`,
      );
      if (result.exitCode !== 0) {
        this.logger.debug(`${LOG_PREFIX} Unmount warning: ${result.stderr || result.stdout}`);
      }
    } catch (error) {
      this.logger.debug(`${LOG_PREFIX} Unmount error:`, error);
      // Try lazy unmount as last resort
      await this._sandbox.commands.run(`sudo umount -l "${mountPath}" 2>/dev/null || true`);
    }

    this.mounts.delete(mountPath);

    // Clean up marker file
    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;
    await this._sandbox.commands.run(`rm -f "${markerPath}" 2>/dev/null || true`);

    // Remove empty mount directory (only if empty, rmdir fails on non-empty)
    // Use sudo since mount directories outside home (like /data) were created with sudo
    const rmdirResult = await this._sandbox.commands.run(`sudo rmdir "${mountPath}" 2>&1`);
    if (rmdirResult.exitCode === 0) {
      this.logger.debug(`${LOG_PREFIX} Unmounted and removed ${mountPath}`);
    } else {
      this.logger.debug(
        `${LOG_PREFIX} Unmounted ${mountPath} (directory not removed: ${rmdirResult.stderr?.trim() || 'not empty'})`,
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
    const mountsResult = await this._sandbox.commands.run(
      `grep -E 'fuse\\.(s3fs|gcsfuse)' /proc/mounts | awk '{print $2}'`,
    );
    const currentMounts = mountsResult.stdout
      .trim()
      .split('\n')
      .filter(p => p.length > 0);

    this.logger.debug(`${LOG_PREFIX} Current FUSE mounts in sandbox:`, currentMounts);

    // Read our marker files to know which mounts WE created
    const markersResult = await this._sandbox.commands.run(`ls /tmp/.mastra-mounts/ 2>/dev/null || echo ""`);
    const markerFiles = markersResult.stdout
      .trim()
      .split('\n')
      .filter(f => f.length > 0 && SAFE_MARKER_NAME.test(f));

    // Build a map of mount paths → marker filenames for mounts WE created
    const managedMountPaths = new Map<string, string>();
    for (const markerFile of markerFiles) {
      const markerResult = await this._sandbox.commands.run(
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

      // Build a reverse map: markerFile → mountPath
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
              await this._sandbox.commands.run(`rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || true`);

              // Try to remove the directory (will fail if not empty or doesn't exist, which is fine)
              await this._sandbox.commands.run(`sudo rmdir "${mountPath}" 2>/dev/null || true`);
            }
          } else {
            // Malformed marker file - just delete it
            this.logger.debug(`${LOG_PREFIX} Removing malformed marker file: ${markerFile}`);
            await this._sandbox.commands.run(`rm -f "/tmp/.mastra-mounts/${markerFile}" 2>/dev/null || true`);
          }
        }
      }
    } catch {
      // Ignore errors during orphan cleanup
      this.logger.debug(`${LOG_PREFIX} Error during orphan cleanup (non-fatal)`);
    }
  }

  // ---------------------------------------------------------------------------
  // Deprecated
  // ---------------------------------------------------------------------------

  /** @deprecated Use `e2b` instead. */
  get instance(): Sandbox {
    return this.e2b;
  }

  /** @deprecated Use `status === 'running'` instead. */
  async isReady(): Promise<boolean> {
    return this.status === 'running' && this._sandbox !== null;
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private generateId(): string {
    return `e2b-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Find an existing sandbox with matching mastra-sandbox-id metadata.
   * Returns the connected sandbox if found, null otherwise.
   */
  private async findExistingSandbox(): Promise<Sandbox | null> {
    try {
      // Query E2B for existing sandbox with our logical ID in metadata
      const paginator = Sandbox.list({
        ...this.connectionOpts,
        query: {
          metadata: { 'mastra-sandbox-id': this.id },
          state: ['running', 'paused'],
        },
      });

      const sandboxes = await paginator.nextItems();

      this.logger.debug(`${LOG_PREFIX} sandboxes:`, sandboxes);

      // Sandbox.list only returns running/paused sandboxes, so no need to filter
      if (sandboxes.length > 0) {
        const existingSandbox = sandboxes[0]!;
        this.logger.debug(
          `${LOG_PREFIX} Found existing sandbox for ${this.id}: ${existingSandbox.sandboxId} (state: ${existingSandbox.state})`,
        );
        return await Sandbox.connect(existingSandbox.sandboxId, this.connectionOpts);
      }
    } catch (e) {
      this.logger.debug(`${LOG_PREFIX} Error querying for existing sandbox:`, e);
      // Continue to create new sandbox
    }

    return null;
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
      const exists = await Template.exists(id, this.connectionOpts);
      if (exists) {
        this.logger.debug(`${LOG_PREFIX} Using cached mountable template: ${id}`);
        this._resolvedTemplateId = id;
        return id;
      }

      // Build the template (first time only)
      this.logger.debug(`${LOG_PREFIX} Building default mountable template: ${id}...`);
      const buildResult = await Template.build(template as TemplateClass, id, this.connectionOpts);
      this._resolvedTemplateId = buildResult.templateId;
      this.logger.debug(`${LOG_PREFIX} Template built and cached: ${buildResult.templateId}`);
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
    this.logger.debug(`${LOG_PREFIX} Building custom template: ${templateName}...`);
    const buildResult = await Template.build(template as TemplateClass, templateName, this.connectionOpts);
    this._resolvedTemplateId = buildResult.templateId;
    this.logger.debug(`${LOG_PREFIX} Template built: ${buildResult.templateId}`);

    return buildResult.templateId;
  }

  /**
   * Build the default mountable template (bypasses exists check).
   */
  private async buildDefaultTemplate(): Promise<string> {
    const { template, id } = createDefaultMountableTemplate();
    this.logger.debug(`${LOG_PREFIX} Building default mountable template: ${id}...`);
    const buildResult = await Template.build(template as TemplateClass, id, this.connectionOpts);
    this._resolvedTemplateId = buildResult.templateId;
    this.logger.debug(`${LOG_PREFIX} Template built: ${buildResult.templateId}`);
    return buildResult.templateId;
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
      await this._sandbox.commands.run('mkdir -p /tmp/.mastra-mounts');
      await this._sandbox.files.write(markerPath, markerContent);
    } catch {
      // Non-fatal - marker is just for optimization
      this.logger.debug(`${LOG_PREFIX} Warning: Could not write marker file at ${markerPath}`);
    }
  }

  /**
   * Check if a path is already mounted and if the config matches.
   */
  private async checkExistingMount(
    mountPath: string,
    newConfig: E2BMountConfig,
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
    const filename = this.mounts.markerFilename(mountPath);
    const markerPath = `/tmp/.mastra-mounts/${filename}`;

    try {
      const markerResult = await this._sandbox.commands.run(`cat "${markerPath}" 2>/dev/null || echo ""`);
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

  /**
   * Check if an error indicates the sandbox itself is dead/gone.
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

  /**
   * Execute an operation with automatic retry if the sandbox is found to be dead.
   *
   * When the E2B sandbox times out or crashes mid-operation, this method
   * resets sandbox state, restarts it, and retries the operation once.
   *
   * @internal Used by E2BProcessManager to handle dead sandboxes during spawn.
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
