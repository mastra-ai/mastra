/**
 * Daytona Sandbox Provider
 *
 * A Daytona sandbox implementation for Mastra workspaces.
 * Supports command execution, environment variables, resource configuration,
 * snapshots, and Daytona volumes.
 *
 * @see https://www.daytona.io/docs
 */

import { Daytona } from '@daytonaio/sdk';
import type { Sandbox } from '@daytonaio/sdk';
import type {
  SandboxInfo,
  ExecuteCommandOptions,
  CommandResult,
  ProviderStatus,
  MastraSandboxOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';

import { shellQuote } from '../utils/shell-quote';
import type { DaytonaResources } from './types';

const LOG_PREFIX = '[@mastra/daytona]';

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
  /** Pre-built snapshot ID to create sandbox from */
  snapshot?: string;
  /**
   * Auto-delete sandbox on stop.
   * @default false
   */
  ephemeral?: boolean;
  /**
   * Minutes before auto-stop (0 = disabled).
   * @default 15
   */
  autoStopInterval?: number;
  /** Minutes before auto-archiving */
  autoArchiveInterval?: number;
  /**
   * Daytona volumes to attach at creation.
   * Volumes are configured at sandbox creation time, not mounted dynamically.
   */
  volumes?: Array<{ volumeId: string; mountPath: string }>;
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
 * - Resource configuration (CPU, memory, disk, GPU)
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
 *   resources: { cpu: 2, memory: 4, disk: 20 },
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

  private readonly timeout: number;
  private readonly language: string;
  private readonly resources?: DaytonaResources;
  private readonly env: Record<string, string>;
  private readonly labels: Record<string, string>;
  private readonly snapshotId?: string;
  private readonly ephemeral: boolean;
  private readonly autoStopInterval?: number;
  private readonly autoArchiveInterval?: number;
  private readonly volumeConfigs: Array<{ volumeId: string; mountPath: string }>;
  private readonly connectionOpts: { apiKey?: string; apiUrl?: string; target?: string };

  constructor(options: DaytonaSandboxOptions = {}) {
    super({ ...options, name: 'DaytonaSandbox' });

    this.id = options.id ?? this.generateId();
    this.timeout = options.timeout ?? 300_000;
    this.language = options.language ?? 'typescript';
    this.resources = options.resources;
    this.env = options.env ?? {};
    this.labels = options.labels ?? {};
    this.snapshotId = options.snapshot;
    this.ephemeral = options.ephemeral ?? false;
    this.autoStopInterval = options.autoStopInterval ?? 15;
    this.autoArchiveInterval = options.autoArchiveInterval;
    this.volumeConfigs = options.volumes ?? [];

    this.connectionOpts = {
      ...(options.apiKey && { apiKey: options.apiKey }),
      ...(options.apiUrl && { apiUrl: options.apiUrl }),
      ...(options.target && { target: options.target }),
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
   * Creates a Daytona client and sandbox instance.
   */
  async start(): Promise<void> {
    if (this._sandbox) {
      return;
    }

    // Create Daytona client if not exists
    if (!this._daytona) {
      this._daytona = new Daytona(this.connectionOpts);
    }

    this.logger.debug(`${LOG_PREFIX} Creating sandbox for: ${this.id}`);

    // Build creation params
    const createParams: Record<string, unknown> = {
      language: this.language,
      envVars: this.env,
      labels: {
        ...this.labels,
        'mastra-sandbox-id': this.id,
      },
      ephemeral: this.ephemeral,
      autoStopInterval: this.autoStopInterval,
    };

    if (this.autoArchiveInterval !== undefined) {
      createParams.autoArchiveInterval = this.autoArchiveInterval;
    }

    if (this.snapshotId) {
      createParams.snapshot = this.snapshotId;
    }

    if (this.volumeConfigs.length > 0) {
      createParams.volumes = this.volumeConfigs;
    }

    if (this.resources) {
      createParams.resources = this.resources;
    }

    // Create sandbox
    this._sandbox = await this._daytona.create(createParams as Parameters<Daytona['create']>[0]);

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
      metadata: {
        language: this.language,
        ...(this.resources && { resources: this.resources }),
        ...(this.snapshotId && { snapshot: this.snapshotId }),
      },
    };
  }

  /**
   * Get instructions describing this Daytona sandbox.
   * Used by agents to understand the execution environment.
   */
  getInstructions(): string {
    const langInfo = this.language !== 'typescript' ? ` (${this.language} runtime)` : '';
    const volumeCount = this.volumeConfigs.length;
    const volumeInfo = volumeCount > 0 ? ` ${volumeCount} volume(s) attached.` : '';
    return `Cloud sandbox with isolated execution environment${langInfo}.${volumeInfo}`;
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensure the sandbox is started and return the Daytona Sandbox instance.
   */
  private async ensureSandbox(): Promise<Sandbox> {
    await this.ensureRunning();
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  /**
   * Check if an error indicates the sandbox is dead/gone.
   */
  private isSandboxDeadError(error: unknown): boolean {
    if (!error) return false;
    const errorStr = String(error);
    return (
      errorStr.includes('sandbox was not found') ||
      errorStr.includes('Sandbox not found') ||
      errorStr.includes('not running') ||
      errorStr.includes('sandbox has been deleted')
    );
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
      const mergedEnv = { ...this.env, ...options.env };
      const envs = Object.fromEntries(
        Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );

      // Convert timeout from ms to seconds for Daytona SDK
      const timeoutSecs = options.timeout ? Math.ceil(options.timeout / 1000) : undefined;

      const response = await sandbox.process.executeCommand(fullCommand, options.cwd, envs, timeoutSecs);

      const executionTimeMs = Date.now() - startTime;

      // Daytona ExecuteResponse has exitCode and result (stdout)
      const stdout = response.result ?? '';
      const stderr = '';

      this.logger.debug(`${LOG_PREFIX} Exit code: ${response.exitCode} (${executionTimeMs}ms)`);
      if (stdout) this.logger.debug(`${LOG_PREFIX} stdout:\n${stdout}`);

      return {
        success: response.exitCode === 0,
        exitCode: response.exitCode,
        stdout,
        stderr,
        executionTimeMs,
        command,
        args,
      };
    } catch (error) {
      // Handle sandbox-is-dead errors - retry once
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

      // Try to extract result from error
      const errorObj = error as { exitCode?: number; result?: string };
      const stdout = errorObj.result ?? '';
      const stderr = error instanceof Error ? error.message : String(error);
      const exitCode = errorObj.exitCode ?? 1;

      this.logger.debug(`${LOG_PREFIX} Exit code: ${exitCode} (${executionTimeMs}ms) [error]`);
      if (stdout) this.logger.debug(`${LOG_PREFIX} stdout:\n${stdout}`);
      if (stderr) this.logger.debug(`${LOG_PREFIX} stderr:\n${stderr}`);

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
