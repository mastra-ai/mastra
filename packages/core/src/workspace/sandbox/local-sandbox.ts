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
import { realpathSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { RequestContext } from '../../request-context';

import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import { expandTilde } from '../filesystem/fs-utils';
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
import {
  detectIsolation,
  isIsolationAvailable,
  generateSeatbeltProfile,
  isGeneratedSeatbeltProfile,
  wrapCommand,
} from './native-sandbox';
import type { SandboxCloneOptions } from './sandbox';
import type { SandboxInfo } from './types';

// =============================================================================
// Mount Path Validation
// =============================================================================

/**
 * Directory for mount marker files used to detect config changes across restarts.
 *
 * Resolved lazily so `os.tmpdir()` is never invoked at module-load time. The
 * Agent/evals runtime (which transitively imports this module) is bundled into
 * the Studio client, where `node:os` is shimmed to an empty object and
 * `os.tmpdir` is `undefined`. Evaluating it at import time crashes Studio boot.
 * See https://github.com/mastra-ai/mastra/issues/18519.
 */
export function getMarkerDir(): string {
  return path.join(os.tmpdir(), '.mastra-mounts');
}

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
export interface LocalSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
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
  /**
   * Named checkpoint to seed the working directory from on `start()` and to
   * persist to on `snapshot()`. When set and a matching checkpoint exists
   * under `checkpointsDirectory`, an empty/missing working directory is seeded
   * from it before start. A missing checkpoint falls back to a normal empty
   * working directory.
   */
  checkpointName?: string;
  /**
   * Fallback checkpoint used to seed the working directory when
   * `checkpointName` has no stored checkpoint yet (e.g. a repo-level warm base
   * image for a brand-new session). Boot-only: `snapshot()` keeps writing to
   * `checkpointName`.
   */
  seedCheckpointName?: string;
  /**
   * Directory where named checkpoints are stored.
   * Defaults to `<parent of workingDirectory>/.checkpoints`.
   */
  checkpointsDirectory?: string;
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
export class LocalSandbox extends MastraSandbox<string> {
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
  /**
   * SBPL the user wrote, read from `seatbeltProfilePath` at start. Set only when that file
   * already existed and does not carry our generated-profile marker. While it is undefined,
   * `wrapCommand()` generates the profile from the live `_nativeSandboxConfig` on every call,
   * so the profile always tracks the allowlist.
   */
  private _customSeatbeltProfile?: string;
  /** Where the profile file lives on disk: the configured path, or one we generated. */
  private _seatbeltProfilePath?: string;
  private _sandboxFolderPath?: string;
  private readonly _createdAt: Date;
  private readonly _instructionsOverride?: InstructionsOption;
  private _activeMountPaths: Set<string> = new Set();
  /** Snapshot of `readWritePaths` from ctor; entries here are never removed on unmount. */
  private readonly _initialReadWritePaths: Set<string>;
  /** Refcount for isolation paths added by mounts (not present in `_initialReadWritePaths`). */
  private _mountIsolationRefCount = new Map<string, number>();
  /** Normalized mount path → canonical isolation path recorded for that mount. */
  private _mountPathToIsolationPath = new Map<string, string>();
  /** Named checkpoint to seed from on start and persist to on snapshot. */
  private readonly _checkpointName?: string;
  /** Boot-only fallback checkpoint used when `_checkpointName` has no state. */
  private readonly _seedCheckpointName?: string;
  /** Directory where named checkpoints live. */
  private readonly _checkpointsDirectory: string;
  /** Chains snapshot() calls so concurrent captures never interleave. */
  private _snapshotChain: Promise<void> = Promise.resolve();

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
    this.workingDirectory = expandTilde(options.workingDirectory ?? path.join(process.cwd(), '.sandbox'));
    this.env = options.env ?? {};
    this._nativeSandboxConfig = {
      ...options.nativeSandbox,
      readWritePaths: [...(options.nativeSandbox?.readWritePaths ?? [])],
      readOnlyPaths: [...(options.nativeSandbox?.readOnlyPaths ?? [])],
    };
    this._initialReadWritePaths = new Set(this._nativeSandboxConfig.readWritePaths ?? []);
    this.isolation = requestedIsolation;
    this._instructionsOverride = options.instructions;
    this._checkpointName = options.checkpointName;
    this._seedCheckpointName = options.seedCheckpointName;
    this._checkpointsDirectory = options.checkpointsDirectory
      ? expandTilde(options.checkpointsDirectory)
      : path.join(path.dirname(this.workingDirectory), '.checkpoints');
  }

  // ---------------------------------------------------------------------------
  // Cloning
  // ---------------------------------------------------------------------------

  /**
   * Construct a sibling `LocalSandbox` that inherits this sandbox's
   * configuration (isolation, native sandbox config, instructions) with
   * per-instance overrides.
   *
   * Performs no I/O — the sandbox clone creates its working directory on its
   * own `start()`. `sandboxId` and `idleTimeoutMinutes` have no local
   * equivalent and are ignored: local sandboxes reattach by logical `id` and
   * have no provider-managed idle teardown.
   */
  clone(options: SandboxCloneOptions = {}): LocalSandbox {
    return new LocalSandbox({
      ...(options.id !== undefined && { id: options.id }),
      workingDirectory: options.workingDirectory ?? this.workingDirectory,
      env: options.env ?? this.env,
      isolation: this.isolation,
      nativeSandbox: {
        ...this._nativeSandboxConfig,
        readWritePaths: [...this._initialReadWritePaths],
        readOnlyPaths: [...(this._nativeSandboxConfig.readOnlyPaths ?? [])],
      },
      ...(this._instructionsOverride !== undefined && { instructions: this._instructionsOverride }),
      ...((options.checkpointName ?? this._checkpointName) !== undefined && {
        checkpointName: options.checkpointName ?? this._checkpointName,
      }),
      ...((options.seedCheckpointName ?? this._seedCheckpointName) !== undefined && {
        seedCheckpointName: options.seedCheckpointName ?? this._seedCheckpointName,
      }),
      checkpointsDirectory: this._checkpointsDirectory,
    });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Acquisition primitives (base-orchestrated start): an existing working
   * directory is the "found sandbox" — reattaching reports `outcome: 'connected'`,
   * a missing directory means a fresh sandbox (`outcome: 'created'`).
   *
   * This stat and the `mkdir` in `create()` are not atomic, so `'created'` is
   * best-effort: two processes starting on the same working directory can both
   * report it. Keep onStart setup idempotent.
   */
  protected override async find(): Promise<string | undefined> {
    try {
      await fs.stat(this.workingDirectory);
      return this.workingDirectory;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        throw err;
      }
      return undefined;
    }
  }

  protected override async connect(_handle: string): Promise<void> {
    await this._prepareWorkspace();
  }

  protected override async create(): Promise<void> {
    await this._prepareWorkspace();
  }

  /**
   * Shared start body for both branches: ensure the working directory
   * exists, seed it from a checkpoint when empty, and set up the seatbelt
   * profile on macOS. Everything here is idempotent.
   */
  private async _prepareWorkspace(): Promise<void> {
    this.logger.debug('Starting sandbox', {
      workingDirectory: this.workingDirectory,
      isolation: this.isolation,
    });

    await fs.mkdir(this.workingDirectory, { recursive: true });

    await this._seedFromCheckpoint();

    // Set up seatbelt profile for macOS sandboxing
    if (this.isolation === 'seatbelt') {
      const userProvidedPath = this._nativeSandboxConfig.seatbeltProfilePath;

      if (userProvidedPath) {
        // User provided a custom path
        this._seatbeltProfilePath = userProvidedPath;

        // Check if file exists at user's path
        let existingProfile: string | undefined;
        try {
          existingProfile = await fs.readFile(userProvidedPath, 'utf-8');
        } catch (err: unknown) {
          if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
          }
        }

        if (existingProfile !== undefined && !isGeneratedSeatbeltProfile(existingProfile)) {
          // The user wrote this SBPL. Keep it and pass it to sandbox-exec exactly as written.
          this._customSeatbeltProfile = existingProfile;
        } else {
          // The file is missing, or it carries our marker from an earlier run. Either way the
          // profile is ours, so generate it again and clear `_customSeatbeltProfile`: it must
          // keep tracking the allowlist that mounts change. Clearing matters when this instance
          // was started before with a user-authored profile that has since been removed or taken
          // over by us, because `stop()` leaves the cached profile in place for a later `start()`.
          this._customSeatbeltProfile = undefined;
          const generatedProfile = generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);
          // Ensure parent directory exists
          await fs.mkdir(path.dirname(userProvidedPath), { recursive: true });
          await fs.writeFile(userProvidedPath, generatedProfile, 'utf-8');
        }
      } else {
        // No custom path, use default location
        const generatedProfile = generateSeatbeltProfile(this.workingDirectory, this._nativeSandboxConfig);

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
        await fs.writeFile(this._seatbeltProfilePath, generatedProfile, 'utf-8');
      }
    }

    this.logger.debug('Sandbox started', { workingDirectory: this.workingDirectory });
  }

  // ---------------------------------------------------------------------------
  // Checkpoints
  // ---------------------------------------------------------------------------

  /** LocalSandbox persists real filesystem-backed checkpoints. */
  readonly supportsCheckpoints = true;

  /** Resolve the on-disk directory for a named checkpoint, rejecting unsafe names. */
  private _checkpointPath(name: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes('..')) {
      throw new Error(`Invalid checkpoint name: ${name}`);
    }
    return path.join(this._checkpointsDirectory, name);
  }

  /**
   * Seed an empty/missing working directory from the configured checkpoint.
   * Missing checkpoint or already-populated workdir → no-op (normal start).
   */
  private async _seedFromCheckpoint(): Promise<void> {
    if (!this._checkpointName && !this._seedCheckpointName) return;

    // Only seed an empty working directory; a populated one wins.
    const entries = await fs.readdir(this.workingDirectory).catch(() => []);
    if (entries.length > 0) return;

    // Prefer the primary checkpoint; fall back to the boot-only seed checkpoint.
    const candidates = [this._checkpointName, this._seedCheckpointName].filter(
      (name): name is string => name !== undefined,
    );
    for (const name of candidates) {
      const checkpointDir = this._checkpointPath(name);
      if (!(await this._checkpointReadable(checkpointDir))) {
        // Missing checkpoint → try the next candidate (same contract as provider 404).
        continue;
      }

      this.logger.debug('Seeding working directory from checkpoint', {
        checkpointName: name,
        checkpointDir,
      });
      try {
        await fs.cp(checkpointDir, this.workingDirectory, { recursive: true });
      } catch (error) {
        // The checkpoint was swapped away mid-copy by a concurrent
        // `_captureCheckpoint`. Wait for the replacement and copy that instead.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await fs.rm(this.workingDirectory, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(this.workingDirectory, { recursive: true });
        if (!(await this._checkpointReadable(checkpointDir))) continue;
        await fs.cp(checkpointDir, this.workingDirectory, { recursive: true });
      }
      return;
    }
  }

  /**
   * Check that a checkpoint directory exists, retrying briefly to cover the
   * instant in `_captureCheckpoint` where the old checkpoint has been renamed
   * away but the replacement has not yet been renamed into place. The window
   * is two atomic renames, so a couple of short retries close it.
   */
  private async _checkpointReadable(checkpointDir: string): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 25));
      try {
        const stat = await fs.stat(checkpointDir);
        if (stat.isDirectory()) return true;
        return false;
      } catch {
        // Missing right now — may be mid-swap; retry.
      }
    }
    return false;
  }

  /**
   * Persist the working directory as the configured named checkpoint.
   * Copies to a temp sibling, then swaps it into place with rename so a
   * concurrent boot always observes a complete checkpoint. No-op when no
   * checkpoint name is set.
   */
  async snapshot(): Promise<void> {
    if (!this._checkpointName) return;
    const run = this._snapshotChain.then(() => this._captureCheckpoint(this._checkpointName!));
    // Keep the chain alive even if this capture fails.
    this._snapshotChain = run.catch(() => {});
    return run;
  }

  private async _captureCheckpoint(name: string): Promise<void> {
    const target = this._checkpointPath(name);
    await fs.mkdir(this._checkpointsDirectory, { recursive: true });
    const tmp = path.join(this._checkpointsDirectory, `.tmp-${name}-${crypto.randomBytes(6).toString('hex')}`);
    const backup = path.join(this._checkpointsDirectory, `.bak-${name}-${crypto.randomBytes(6).toString('hex')}`);
    let targetMoved = false;
    try {
      await fs.cp(this.workingDirectory, tmp, { recursive: true });
      try {
        await fs.rename(target, backup);
        targetMoved = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await fs.rename(tmp, target);
    } catch (error) {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
      if (targetMoved) {
        await fs.rename(backup, target).catch(() => {});
      }
      throw error;
    }
    if (targetMoved) {
      await fs.rm(backup, { recursive: true, force: true }).catch(() => {});
    }
    this.logger.debug('Captured checkpoint', { checkpointName: name, target });
  }

  /**
   * Stop the local sandbox.
   * Kills background processes and unmounts all active mounts. Unlike remote
   * providers, a local sandbox has no suspend/resume — its background
   * processes ARE the runtime state, so a stopped sandbox must not leave them
   * running. Files in the working directory are untouched and `start()` works
   * again afterwards.
   * Status management is handled by the base class.
   */
  async stop(): Promise<void> {
    this.logger.debug('Stopping sandbox', { workingDirectory: this.workingDirectory });

    // Kill all background processes — "stopped" means not running.
    const procs = await this.processes.list();
    await Promise.all(procs.map(p => this.processes.kill(p.pid)));

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
    this.logger.debug('Destroying sandbox', { workingDirectory: this.workingDirectory });

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

    // Clean up the profile file only when we chose its location. A path the user configured
    // belongs to the user, so never unlink it.
    if (this._seatbeltProfilePath && !this._nativeSandboxConfig.seatbeltProfilePath) {
      try {
        await fs.unlink(this._seatbeltProfilePath);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }
    this._seatbeltProfilePath = undefined;
    this._customSeatbeltProfile = undefined;

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

    this.logger.debug('Mounting', { mountPath, hostPath });

    // Get mount config
    const config = filesystem.getMountConfig?.() as FilesystemMountConfig | undefined;
    if (!config) {
      const error = `Filesystem "${filesystem.id}" does not provide a mount config`;
      this.logger.error('Filesystem does not provide a mount config', { filesystemId: filesystem.id });
      this.mounts.set(mountPath, { filesystem, state: 'error', error });
      return { success: false, mountPath, error };
    }

    // Check if already mounted with matching config
    const existingMount = await this.checkExistingMount(hostPath, config);
    if (existingMount === 'matching') {
      this.logger.debug('Detected existing mount with correct config, skipping', {
        provider: filesystem.provider,
        filesystemId: filesystem.id,
        hostPath,
      });
      this.mounts.set(mountPath, { filesystem, state: 'mounted', config });
      this._activeMountPaths.add(mountPath);
      this.addMountPathToIsolation(mountPath, hostPath);
      return { success: true, mountPath };
    } else if (existingMount === 'foreign') {
      // Something is already mounted/symlinked here but we didn't create it — refuse to touch it
      const error = `Cannot mount at ${hostPath}: path is already occupied by an existing mount or symlink that was not created by Mastra. Unmount it manually or use a different mount path.`;
      this.logger.error('Mount path occupied by foreign mount or symlink', { hostPath });
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
      return { success: false, mountPath, error };
    } else if (existingMount === 'mismatched') {
      this.logger.debug('Config mismatch on our mount, unmounting to re-mount with new config');
      await this.unmount(mountPath);
    }

    this.logger.debug('Mount config type', { type: config.type });

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
        this.logger.error('Cannot mount at non-empty directory', { hostPath });
        this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
        return { success: false, mountPath, error };
      }
      // Empty directory from a previous failed attempt — remove so symlink can be created
      await fs.rmdir(hostPath);
    } catch (err: unknown) {
      const code = err instanceof Error && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
      if (code === 'ENOTDIR') {
        const error = `Cannot mount at ${hostPath}: path is a regular file. Use a different mount path or remove the file first.`;
        this.logger.error('Cannot mount at path that is a regular file', { hostPath });
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
      this.logger.debug('Symlinked local mount', { hostPath, basePath: localConfig.basePath });
    } catch (error) {
      this.logger.error('Error mounting filesystem', {
        provider: filesystem.provider,
        filesystemId: filesystem.id,
        hostPath,
        error,
      });
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: String(error) });

      return { success: false, mountPath, error: String(error) };
    }

    // Mark as mounted
    this.mounts.set(mountPath, { filesystem, state: 'mounted', config });
    this._activeMountPaths.add(mountPath);

    // Write marker file
    await this.writeMarkerFile(mountPath, hostPath);

    // Dynamically add host path to isolation allowlist
    this.addMountPathToIsolation(mountPath, hostPath);

    this.logger.debug('Mounted', { mountPath, hostPath });
    return { success: true, mountPath };
  }

  /**
   * Unmount a filesystem from a path.
   */
  async unmount(mountPath: string): Promise<void> {
    validateMountPath(mountPath);
    mountPath = normalizeMountPath(mountPath);

    const hostPath = this.resolveHostPath(mountPath);

    this.logger.debug('Unmounting', { mountPath, hostPath });

    this.removeMountIsolationForPath(mountPath);

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
    const markerPath = path.join(getMarkerDir(), filename);
    try {
      await fs.unlink(markerPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Remove symlink
    if (isSymlink) {
      try {
        await fs.unlink(hostPath);
        this.logger.debug('Unmounted and removed symlink', { hostPath });
      } catch {
        this.logger.debug('Could not remove symlink', { hostPath });
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
    const markerFilePath = path.join(getMarkerDir(), filename);

    try {
      await fs.mkdir(getMarkerDir(), { recursive: true });
      await fs.writeFile(markerFilePath, markerContent, 'utf-8');
    } catch {
      this.logger.debug('Could not write marker file', { markerFilePath });
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
    const markerPath = path.join(getMarkerDir(), filename);
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
    const markerPath = path.join(getMarkerDir(), filename);

    try {
      const content = await fs.readFile(markerPath, 'utf-8');
      const parsed = this.mounts.parseMarkerContent(content.trim());

      if (!parsed) {
        // Marker exists but is malformed — we created it but can't verify, treat as ours
        return 'mismatched';
      }

      const newConfigHash = this.mounts.computeConfigHash(newConfig);
      this.logger.debug('Marker check', { storedHash: parsed.configHash, newConfigHash });

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
   * - Seatbelt: pushes to readWritePaths (wrapCommand reads config each call)
   * - Bwrap: pushes to readWritePaths (buildBwrapCommand reads config each call)
   *
   * Local mounts are symlinks under `workingDirectory`. Bubblewrap cannot
   * `--bind` a symlink (it fails with "Unable to mount source on destination"),
   * so we store the canonical path (`realpath`) of the mount point — the same
   * directory the symlink refers to.
   */
  private addMountPathToIsolation(mountPath: string, hostPath: string): void {
    if (this.isolation === 'none') return;

    const normMount = normalizeMountPath(mountPath);
    if (this._mountPathToIsolationPath.has(normMount)) {
      return;
    }

    let isolationPath = hostPath;
    try {
      isolationPath = realpathSync(hostPath);
    } catch {
      // Symlink not visible yet or race; keep literal path for best-effort allowlist
    }

    if (!this._nativeSandboxConfig.readWritePaths) {
      this._nativeSandboxConfig = { ...this._nativeSandboxConfig, readWritePaths: [] };
    }
    const paths = this._nativeSandboxConfig.readWritePaths!;

    if (!paths.includes(isolationPath)) {
      paths.push(isolationPath);
    }
    if (!this._initialReadWritePaths.has(isolationPath)) {
      this._mountIsolationRefCount.set(isolationPath, (this._mountIsolationRefCount.get(isolationPath) ?? 0) + 1);
    }
    this._mountPathToIsolationPath.set(normMount, isolationPath);
    // Both backends read config.readWritePaths on every wrapCommand() call, so no extra work needed
  }

  /**
   * Reverse {@link addMountPathToIsolation}: drop refcounted paths from the allowlist on unmount
   * while preserving user-provided `readWritePaths` from construction.
   */
  private removeMountIsolationForPath(mountPath: string): void {
    if (this.isolation === 'none') return;

    const normMount = normalizeMountPath(mountPath);
    const isolationPath = this._mountPathToIsolationPath.get(normMount);
    if (isolationPath === undefined) {
      return;
    }
    this._mountPathToIsolationPath.delete(normMount);

    if (this._initialReadWritePaths.has(isolationPath)) {
      return;
    }

    const prev = this._mountIsolationRefCount.get(isolationPath) ?? 0;
    const next = prev - 1;
    if (next <= 0) {
      this._mountIsolationRefCount.delete(isolationPath);
      const paths = this._nativeSandboxConfig.readWritePaths;
      if (paths) {
        const idx = paths.indexOf(isolationPath);
        if (idx !== -1) {
          paths.splice(idx, 1);
        }
      }
    } else {
      this._mountIsolationRefCount.set(isolationPath, next);
    }
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
      // Undefined unless the user wrote their own profile file. wrapCommand() then generates
      // one from the current config, so mounts added after start() are in the allowlist.
      seatbeltProfile: this._customSeatbeltProfile,
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
