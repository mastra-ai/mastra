/**
 * Local Sandbox Provider
 *
 * A sandbox implementation that executes commands on the local machine.
 * This is the default sandbox for development and local agents.
 *
 * Supports optional native OS sandboxing:
 * - macOS: Uses seatbelt (sandbox-exec) for filesystem and network isolation
 * - Linux: Uses bubblewrap (bwrap) for namespace isolation
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { RequestContext } from '../../request-context';

import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { FilesystemMountConfig, MountResult } from '../filesystem/mount';
import type { ProviderStatus } from '../lifecycle';
import type { InstructionsOption } from '../types';
import { resolveInstructions } from '../utils';
import { IsolationUnavailableError } from './errors';
import { LocalProcessManager } from './local-process-manager';
import { MastraSandbox } from './mastra-sandbox';
import type { MastraSandboxOptions } from './mastra-sandbox';
import type { MountManager } from './mount-manager';
import type { IsolationBackend, NativeSandboxConfig } from './native-sandbox';
import { detectIsolation, isIsolationAvailable, generateSeatbeltProfile, wrapCommand } from './native-sandbox';
import type { SandboxInfo } from './types';

// =============================================================================
// Mount Path Validation
// =============================================================================

/** Directory for mount marker files used to detect config changes across restarts. */
export const MARKER_DIR = path.join(os.tmpdir(), '.mastra-mounts');

/** Allowlist pattern for mount paths — absolute path with safe characters only. */
const SAFE_MOUNT_PATH = /^\/[a-zA-Z0-9_.\-/]+$/;

function validateMountPath(mountPath: string): void {
  if (!SAFE_MOUNT_PATH.test(mountPath)) {
    throw new Error(
      `Invalid mount path: ${mountPath}. Must be an absolute path with alphanumeric, dash, dot, underscore, or slash characters only.`,
    );
  }
  const segments = mountPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Invalid mount path: ${mountPath}. Root path "/" is not allowed.`);
  }
  if (segments.some(seg => seg === '.' || seg === '..')) {
    throw new Error(`Invalid mount path: ${mountPath}. Path segments cannot be "." or "..".`);
  }
}

/** Canonicalize mount path so `/data`, `/data/`, `//data` all resolve to `/data`. */
function normalizeMountPath(mountPath: string): string {
  return `/${mountPath.split('/').filter(Boolean).join('/')}`;
}

// =============================================================================
// Local Sandbox
// =============================================================================

/**
 * Local sandbox provider configuration.
 */
export interface LocalSandboxOptions extends MastraSandboxOptions {
  /** Unique identifier for this sandbox instance */
  id?: string;
  /** Working directory for command execution */
  workingDirectory?: string;
  /**
   * Environment variables to set for command execution.
   * PATH is included by default unless overridden (needed for finding executables).
   * Other host environment variables are not inherited unless explicitly passed.
   *
   * @example
   * ```typescript
   * // Default - only PATH is available
   * env: undefined
   *
   * // Add specific variables
   * env: { NODE_ENV: 'production', HOME: process.env.HOME }
   *
   * // Full host environment (less secure)
   * env: process.env
   * ```
   */
  env?: NodeJS.ProcessEnv;
  /** Default timeout for operations in ms (default: 30000) */
  timeout?: number;
  /**
   * Isolation backend for sandboxed execution.
   * - 'none': No sandboxing (direct execution on host) - default
   * - 'seatbelt': macOS sandbox-exec (built-in on macOS)
   * - 'bwrap': Linux bubblewrap (requires installation)
   *
   * Use `LocalSandbox.detectIsolation()` to get the recommended backend.
   * @default 'none'
   */
  isolation?: IsolationBackend;
  /**
   * Configuration for native sandboxing.
   * Only used when isolation is 'seatbelt' or 'bwrap'.
   */
  nativeSandbox?: NativeSandboxConfig;
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

/**
 * Local sandbox implementation.
 *
 * Executes commands directly on the host machine.
 * This is the recommended sandbox for development and trusted local execution.
 *
 * @example
 * ```typescript
 * import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';
 *
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new LocalSandbox({ workingDirectory: './my-workspace' }),
 * });
 *
 * await workspace.init();
 * const result = await workspace.executeCommand('node', ['script.js']);
 * ```
 */
export class LocalSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'LocalSandbox';
  readonly provider = 'local';

  status: ProviderStatus = 'pending';

  readonly workingDirectory: string;
  readonly isolation: IsolationBackend;
  declare readonly processes: LocalProcessManager;
  declare readonly mounts: MountManager;
  private readonly env: NodeJS.ProcessEnv;
  private _nativeSandboxConfig: NativeSandboxConfig;
  private _seatbeltProfile?: string;
  private _seatbeltProfilePath?: string;
  private _sandboxFolderPath?: string;
  private _userProvidedProfilePath = false;
  private readonly _createdAt: Date;
  private readonly _instructionsOverride?: InstructionsOption;
  private _activeMountPaths: Set<string> = new Set();

  constructor(options: LocalSandboxOptions = {}) {
    // Validate isolation backend before super (fail fast)
    const requestedIsolation = options.isolation ?? 'none';
    if (requestedIsolation !== 'none' && !isIsolationAvailable(requestedIsolation)) {
      const detection = detectIsolation();
      throw new IsolationUnavailableError(requestedIsolation, detection.message);
    }

    super({
      ...options,
      name: 'LocalSandbox',
      processes: new LocalProcessManager({ env: options.env ?? {} }),
    });

    this.id = options.id ?? this.generateId();
    this._createdAt = new Date();
    this.workingDirectory = options.workingDirectory ?? path.join(process.cwd(), '.sandbox');
    this.env = options.env ?? {};
    this._nativeSandboxConfig = {
      ...options.nativeSandbox,
      readWritePaths: [...(options.nativeSandbox?.readWritePaths ?? [])],
      readOnlyPaths: [...(options.nativeSandbox?.readOnlyPaths ?? [])],
    };
    this.isolation = requestedIsolation;
    this._instructionsOverride = options.instructions;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start the local sandbox.
   * Creates working directory and sets up seatbelt profile if using macOS isolation.
   * Status management is handled by the base class.
   */
  async start(): Promise<void> {
    this.logger.debug('[LocalSandbox] Starting sandbox', {
      workingDirectory: this.workingDirectory,
      isolation: this.isolation,
    });

    await fs.mkdir(this.workingDirectory, { recursive: true });

    // Set up seatbelt profile for macOS sandboxing
    if (this.isolation === 'seatbelt') {
      const userProvidedPath = this._nativeSandboxConfig.seatbeltProfilePath;

      if (userProvidedPath) {
        // User provided a custom path
        this._seatbeltProfilePath = userProvidedPath;
        this._userProvidedProfilePath = true;

        // Check if file exists at user's path
        try {
          this._seatbeltProfile = await fs.readFile(userProvidedPath, 'utf-8');
        } catch (err: unknown) {
          if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
          }
          // File doesn't exist, generate default and write to user's path
          this._seatbeltProfile = generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);
          // Ensure parent directory exists
          await fs.mkdir(path.dirname(userProvidedPath), { recursive: true });
          await fs.writeFile(userProvidedPath, this._seatbeltProfile, 'utf-8');
        }
      } else {
        // No custom path, use default location
        this._seatbeltProfile = generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);

        // Generate a deterministic hash from workspace path and config
        // This allows identical sandboxes to share profiles while preventing collisions
        const configHash = crypto
          .createHash('sha256')
          .update(this.workingDirectory)
          .update(JSON.stringify(this._nativeSandboxConfig))
          .digest('hex')
          .slice(0, 8);

        // Write profile to .sandbox-profiles/ in cwd (outside working directory)
        // This prevents sandboxed processes from reading/modifying their own security profile
        this._sandboxFolderPath = path.join(process.cwd(), '.sandbox-profiles');
        await fs.mkdir(this._sandboxFolderPath, { recursive: true });
        this._seatbeltProfilePath = path.join(this._sandboxFolderPath, `seatbelt-${configHash}.sb`);
        await fs.writeFile(this._seatbeltProfilePath, this._seatbeltProfile, 'utf-8');
      }
    }

    this.logger.debug('[LocalSandbox] Sandbox started', { workingDirectory: this.workingDirectory });
  }

  /**
   * Stop the local sandbox.
   * Unmounts all active mounts before stopping.
   * Status management is handled by the base class.
   */
  async stop(): Promise<void> {
    this.logger.debug('[LocalSandbox] Stopping sandbox', { workingDirectory: this.workingDirectory });

    // Unmount all active mounts (best-effort)
    for (const mountPath of [...this._activeMountPaths]) {
      try {
        await this.unmount(mountPath);
      } catch {
        // Best-effort unmount
      }
    }
  }

  /**
   * Destroy the local sandbox and clean up resources.
   * Unmounts all filesystems, clears mount state, and cleans up seatbelt profile.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    this.logger.debug('[LocalSandbox] Destroying sandbox', { workingDirectory: this.workingDirectory });

    // Kill all background processes
    const procs = await this.processes.list();
    await Promise.all(procs.map(p => this.processes.kill(p.pid)));

    // Unmount all active mounts
    for (const mountPath of [...this._activeMountPaths]) {
      try {
        await this.unmount(mountPath);
      } catch {
        // Ignore errors during cleanup
      }
    }
    this._activeMountPaths.clear();
    this.mounts.clear();

    // Clean up seatbelt profile only if it was auto-generated (not user-provided)
    if (this._seatbeltProfilePath && !this._userProvidedProfilePath) {
      try {
        await fs.unlink(this._seatbeltProfilePath);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }
    this._seatbeltProfilePath = undefined;
    this._seatbeltProfile = undefined;
    this._userProvidedProfilePath = false;

    // Try to remove .sandbox folder if empty
    if (this._sandboxFolderPath) {
      try {
        await fs.rmdir(this._sandboxFolderPath);
      } catch {
        // Ignore errors - folder may not be empty or may not exist
      }
      this._sandboxFolderPath = undefined;
    }
  }

  /** @deprecated Use `status === 'running'` instead. */
  async isReady(): Promise<boolean> {
    return this.status === 'running';
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt,
      resources: {
        memoryMB: Math.round(os.totalmem() / 1024 / 1024),
        cpuCores: os.cpus().length,
      },
      metadata: {
        workingDirectory: this.workingDirectory,
        platform: os.platform(),
        nodeVersion: process.version,
        isolation: this.isolation,
        isolationConfig:
          this.isolation !== 'none'
            ? {
                allowNetwork: this._nativeSandboxConfig.allowNetwork ?? false,
                readOnlyPaths: this._nativeSandboxConfig.readOnlyPaths,
                readWritePaths: this._nativeSandboxConfig.readWritePaths,
              }
            : undefined,
      },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    return resolveInstructions(this._instructionsOverride, () => this._getDefaultInstructions(), opts?.requestContext);
  }

  private _getDefaultInstructions(): string {
    return `Local command execution. Working directory: "${this.workingDirectory}".`;
  }

  // ---------------------------------------------------------------------------
  // Internal Utils
  // ---------------------------------------------------------------------------

  private generateId(): string {
    return `local-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Build the environment object for execution.
   * Always includes PATH by default (needed for finding executables).
   * Merges the sandbox's configured env with any additional env from the command.
   * @internal Used by LocalProcessManager.
   */
  buildEnv(additionalEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH, // Always include PATH for finding executables
      ...this.env,
      ...additionalEnv,
    };
  }

  // ---------------------------------------------------------------------------
  // Mount Support
  // ---------------------------------------------------------------------------

  /**
   * Mount a filesystem at a path on the local host.
   *
   * - **local** — Creates a symlink from `<workingDir>/<mount>` to the basePath.
   *
   * Virtual mount paths (e.g. `/s3`) are resolved under the sandbox's workingDirectory.
   * Other mount types can be handled via the `onMount` hook.
   */
  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    validateMountPath(mountPath);
    mountPath = normalizeMountPath(mountPath);

    // Resolve virtual mount path to host filesystem path
    const hostPath = this.resolveHostPath(mountPath);

    this.logger.debug(`[LocalSandbox] Mounting "${mountPath}" → "${hostPath}"...`);

    // Get mount config
    const config = filesystem.getMountConfig?.() as FilesystemMountConfig | undefined;
    if (!config) {
      const error = `Filesystem "${filesystem.id}" does not provide a mount config`;
      this.logger.error(`[LocalSandbox] ${error}`);
      this.mounts.set(mountPath, { filesystem, state: 'error', error });
      return { success: false, mountPath, error };
    }

    // Check if already mounted with matching config
    const existingMount = await this.checkExistingMount(hostPath, config);
    if (existingMount === 'matching') {
      this.logger.debug(
        `[LocalSandbox] Detected existing mount for ${filesystem.provider} ("${filesystem.id}") at "${hostPath}" with correct config, skipping`,
      );
      this.mounts.set(mountPath, { filesystem, state: 'mounted', config });
      this._activeMountPaths.add(mountPath);
      this.addMountPathToIsolation(hostPath);
      return { success: true, mountPath };
    } else if (existingMount === 'foreign') {
      // Something is already mounted/symlinked here but we didn't create it — refuse to touch it
      const error = `Cannot mount at ${hostPath}: path is already occupied by an existing mount or symlink that was not created by Mastra. Unmount it manually or use a different mount path.`;
      this.logger.error(`[LocalSandbox] ${error}`);
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
      return { success: false, mountPath, error };
    } else if (existingMount === 'mismatched') {
      this.logger.debug(`[LocalSandbox] Config mismatch on our mount, unmounting to re-mount with new config...`);
      await this.unmount(mountPath);
    }

    this.logger.debug(`[LocalSandbox] Config type: ${config.type}`);

    // Reject unsupported types early — before any filesystem work
    if (config.type !== 'local') {
      const error = `Unsupported mount type: ${(config as FilesystemMountConfig).type}`;
      this.mounts.set(mountPath, { filesystem, state: 'unsupported', config, error });
      return { success: false, mountPath, error };
    }

    this.mounts.set(mountPath, { filesystem, state: 'mounting', config });

    // Check if host path exists and would conflict with the symlink
    try {
      const entries = await fs.readdir(hostPath);
      if (entries.length > 0) {
        const error = `Cannot mount at ${hostPath}: directory exists and is not empty. Mounting would hide existing files. Use a different path or empty the directory first.`;
        this.logger.error(`[LocalSandbox] ${error}`);
        this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
        return { success: false, mountPath, error };
      }
      // Empty directory from a previous failed attempt — remove so symlink can be created
      await fs.rmdir(hostPath);
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
      if (code === 'ENOTDIR') {
        const error = `Cannot mount at ${hostPath}: path is a regular file. Use a different mount path or remove the file first.`;
        this.logger.error(`[LocalSandbox] ${error}`);
        this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
        return { success: false, mountPath, error };
      }
      // ENOENT: path doesn't exist yet — exactly what we want for symlink creation
    }

    // Create symlink: ensure parent directory exists, then link
    const localConfig = config as { type: 'local'; basePath: string };
    try {
      await fs.mkdir(path.dirname(hostPath), { recursive: true });
      await fs.symlink(localConfig.basePath, hostPath);
      this.logger.debug(`[LocalSandbox] Symlinked local mount ${hostPath} → ${localConfig.basePath}`);
    } catch (error) {
      this.logger.error(
        `[LocalSandbox] Error mounting "${filesystem.provider}" (${filesystem.id}) at "${hostPath}":`,
        error,
      );
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: String(error) });

      return { success: false, mountPath, error: String(error) };
    }

    // Mark as mounted
    this.mounts.set(mountPath, { filesystem, state: 'mounted', config });
    this._activeMountPaths.add(mountPath);

    // Write marker file
    await this.writeMarkerFile(mountPath, hostPath);

    // Dynamically add host path to isolation allowlist
    this.addMountPathToIsolation(hostPath);

    this.logger.debug(`[LocalSandbox] Mounted ${mountPath} → ${hostPath}`);
    return { success: true, mountPath };
  }

  /**
   * Unmount a filesystem from a path.
   */
  async unmount(mountPath: string): Promise<void> {
    validateMountPath(mountPath);
    mountPath = normalizeMountPath(mountPath);

    const hostPath = this.resolveHostPath(mountPath);

    this.logger.debug(`[LocalSandbox] Unmounting ${mountPath} (${hostPath})...`);

    // Check if it's a symlink — symlinks are just unlinked, not FUSE-unmounted
    let isSymlink = false;
    try {
      const stats = await fs.lstat(hostPath);
      isSymlink = stats.isSymbolicLink();
    } catch {
      // Path doesn't exist — proceed with cleanup
    }

    this.mounts.delete(mountPath);
    this._activeMountPaths.delete(mountPath);

    // Clean up marker file
    const filename = this.mounts.markerFilename(hostPath);
    const markerPath = path.join(MARKER_DIR, filename);
    try {
      await fs.unlink(markerPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Remove symlink
    if (isSymlink) {
      try {
        await fs.unlink(hostPath);
        this.logger.debug(`[LocalSandbox] Unmounted and removed symlink ${hostPath}`);
      } catch {
        this.logger.debug(`[LocalSandbox] Could not remove symlink ${hostPath}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Mount Helpers (private)
  // ---------------------------------------------------------------------------

  /**
   * Write a marker file for detecting config changes.
   * Uses hostPath (resolved OS path) for the marker filename and content,
   * and mountPath (virtual path) for looking up the entry.
   */
  private async writeMarkerFile(mountPath: string, hostPath: string): Promise<void> {
    const entry = this.mounts.get(mountPath);
    if (!entry?.configHash) return;

    const filename = this.mounts.markerFilename(hostPath);
    const markerContent = `${hostPath}|${entry.configHash}`;
    const markerFilePath = path.join(MARKER_DIR, filename);

    try {
      await fs.mkdir(MARKER_DIR, { recursive: true });
      await fs.writeFile(markerFilePath, markerContent, 'utf-8');
    } catch {
      this.logger.debug(`[LocalSandbox] Warning: Could not write marker file at ${markerFilePath}`);
    }
  }

  /**
   * Check if a path is already mounted and if the config matches.
   * Uses hostPath (resolved OS path) for checking the actual mount point.
   */
  private async checkExistingMount(
    hostPath: string,
    newConfig: FilesystemMountConfig,
  ): Promise<'not_mounted' | 'matching' | 'mismatched' | 'foreign'> {
    // Check if it's a symlink (local mount)
    try {
      const stats = await fs.lstat(hostPath);
      if (stats.isSymbolicLink() && newConfig.type === 'local') {
        // Validate symlink target matches config before checking marker
        const linkTarget = await fs.readlink(hostPath).catch(() => null);
        const resolvedTarget = linkTarget ? path.resolve(path.dirname(hostPath), linkTarget) : null;
        const expectedTarget = path.resolve((newConfig as { type: 'local'; basePath: string }).basePath);
        if (!resolvedTarget || resolvedTarget !== expectedTarget) {
          // Symlink exists but points somewhere else — check if we created it
          return (await this.hasMarkerFile(hostPath)) ? 'mismatched' : 'foreign';
        }
        // Symlink target matches — validate via marker file
        return this.checkMarkerFile(hostPath, newConfig);
      } else if (stats.isSymbolicLink()) {
        // Symlink exists for a non-local config — check if we created it
        return (await this.hasMarkerFile(hostPath)) ? 'mismatched' : 'foreign';
      }
    } catch {
      // Not a symlink or doesn't exist — treat as not mounted
    }
    return 'not_mounted';
  }

  /**
   * Check if a marker file exists for a given host path (regardless of content).
   * Returns true if we previously created a mount here.
   */
  private async hasMarkerFile(hostPath: string): Promise<boolean> {
    const filename = this.mounts.markerFilename(hostPath);
    const markerPath = path.join(MARKER_DIR, filename);
    try {
      await fs.access(markerPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a marker file matches the given config.
   * Returns 'matching' if hash matches, 'mismatched' if hash differs,
   * or 'foreign' if no marker exists (we didn't create this mount).
   */
  private async checkMarkerFile(
    hostPath: string,
    newConfig: FilesystemMountConfig,
  ): Promise<'matching' | 'mismatched' | 'foreign'> {
    const filename = this.mounts.markerFilename(hostPath);
    const markerPath = path.join(MARKER_DIR, filename);

    try {
      const content = await fs.readFile(markerPath, 'utf-8');
      const parsed = this.mounts.parseMarkerContent(content.trim());

      if (!parsed) {
        // Marker exists but is malformed — we created it but can't verify, treat as ours
        return 'mismatched';
      }

      const newConfigHash = this.mounts.computeConfigHash(newConfig);
      this.logger.debug(
        `[LocalSandbox] Marker check — stored hash: "${parsed.configHash}", new config hash: "${newConfigHash}"`,
      );

      if (parsed.path === hostPath && parsed.configHash === newConfigHash) {
        return 'matching';
      }

      return 'mismatched';
    } catch {
      // No marker file — this mount was not created by us
      return 'foreign';
    }
  }

  /**
   * Dynamically add a mount path to the sandbox isolation allowlist.
   *
   * - Seatbelt: pushes to readWritePaths, regenerates inline profile
   * - Bwrap: pushes to readWritePaths (buildBwrapCommand reads config each call)
   */
  private addMountPathToIsolation(mountPath: string): void {
    if (this.isolation === 'none') return;

    // Add to readWritePaths
    if (!this._nativeSandboxConfig.readWritePaths) {
      this._nativeSandboxConfig = { ...this._nativeSandboxConfig, readWritePaths: [] };
    }
    if (!this._nativeSandboxConfig.readWritePaths!.includes(mountPath)) {
      this._nativeSandboxConfig.readWritePaths!.push(mountPath);
    }

    // Seatbelt: regenerate the inline profile so the next executeCommand() picks it up
    if (this.isolation === 'seatbelt') {
      this._seatbeltProfile = generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);
    }
    // Bwrap: buildBwrapCommand reads config.readWritePaths each call, so no extra work needed
  }

  // ---------------------------------------------------------------------------
  // Isolation
  // ---------------------------------------------------------------------------

  /**
   * Resolve a virtual mount path to a host filesystem path.
   *
   * Virtual paths like "/s3" become `<workingDir>/s3`. This differs from E2B
   * where root-level paths like `/s3` are used directly (E2B runs in a VM with sudo).
   * LocalSandbox runs on the host, so mounts are scoped under workingDirectory.
   */
  private resolveHostPath(mountPath: string): string {
    return path.join(this.workingDirectory, mountPath.replace(/^\/+/, ''));
  }

  /**
   * Wrap a command with the configured isolation backend.
   * @internal Used by LocalProcessManager for background process isolation.
   */
  wrapCommandForIsolation(command: string): { command: string; args: string[] } {
    if (this.isolation === 'none') {
      return { command, args: [] };
    }

    return wrapCommand(command, {
      backend: this.isolation,
      workspacePath: this.workingDirectory,
      seatbeltProfile: this._seatbeltProfile,
      config: this._nativeSandboxConfig,
    });
  }

  /**
   * Detect the best available isolation backend for this platform.
   * Returns detection result with backend recommendation and availability.
   *
   * @example
   * ```typescript
   * const result = LocalSandbox.detectIsolation();
   * const sandbox = new LocalSandbox({
   *   isolation: result.available ? result.backend : 'none',
   * });
   * ```
   */
  static detectIsolation() {
    return detectIsolation();
  }
}
