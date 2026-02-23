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
import type { ProviderStatus } from '../lifecycle';
import type { InstructionsOption } from '../types';
import { resolveInstructions } from '../utils';
import { IsolationUnavailableError } from './errors';
import { LocalProcessManager } from './local-process-manager';
import { MastraSandbox } from './mastra-sandbox';
import type { MastraSandboxOptions } from './mastra-sandbox';
import type { IsolationBackend, NativeSandboxConfig } from './native-sandbox';
import { detectIsolation, isIsolationAvailable, generateSeatbeltProfile, wrapCommand } from './native-sandbox';
import type { SandboxInfo } from './types';

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
  private readonly env: NodeJS.ProcessEnv;
  private readonly _nativeSandboxConfig: NativeSandboxConfig;
  private _seatbeltProfile?: string;
  private _seatbeltProfilePath?: string;
  private _sandboxFolderPath?: string;
  private _userProvidedProfilePath = false;
  private readonly _createdAt: Date;
  private readonly _instructionsOverride?: InstructionsOption;

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
    this._nativeSandboxConfig = options.nativeSandbox ?? {};
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
   * Status management is handled by the base class.
   */
  async stop(): Promise<void> {
    this.logger.debug('[LocalSandbox] Stopping sandbox', { workingDirectory: this.workingDirectory });
  }

  /**
   * Destroy the local sandbox and clean up resources.
   * Cleans up seatbelt profile if auto-generated.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    this.logger.debug('[LocalSandbox] Destroying sandbox', { workingDirectory: this.workingDirectory });

    // Kill all background processes
    const procs = await this.processes.list();
    await Promise.all(procs.map(p => this.processes.kill(p.pid)));

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
