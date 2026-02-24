/**
 * Daytona Sandbox Provider
 *
 * A Daytona sandbox implementation for Mastra workspaces.
 * Supports command execution, environment variables, resource configuration,
 * snapshots, and Daytona volumes.
 *
 * @see https://www.daytona.io/docs
 */

import { Daytona, DaytonaNotFoundError } from '@daytonaio/sdk';
import type {
  CreateSandboxFromImageParams,
  CreateSandboxFromSnapshotParams,
  Sandbox,
  VolumeMount,
} from '@daytonaio/sdk';
import type {
  SandboxInfo,
  ExecuteCommandOptions,
  CommandResult,
  ProviderStatus,
  MastraSandboxOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';

import { compact } from '../utils/compact';
import { shellQuote } from '../utils/shell-quote';
import type { DaytonaResources } from './types';

const LOG_PREFIX = '[@mastra/daytona]';

/** String patterns indicating the sandbox is dead/gone (@daytonaio/sdk@0.143.0). */
const SANDBOX_DEAD_PATTERNS: (string | RegExp)[] = [
  'Sandbox is not running',
  'Sandbox already destroyed',
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
    super({ ...options, name: 'DaytonaSandbox' });

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
    this.status = 'stopped';
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
    this.status = 'destroyed';
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

    parts.push(`Default working directory: /home/daytona.`);
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
    return SANDBOX_DEAD_PATTERNS.some(pattern =>
      pattern instanceof RegExp ? pattern.test(errorStr) : errorStr.includes(pattern),
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
   * Execute a shell command in the sandbox via a Daytona session.
   * Sessions provide separate stdout/stderr streams and real-time output callbacks.
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

    // Merge sandbox default env with per-command env (per-command overrides)
    const mergedEnv = { ...this.env, ...options.env };
    const envs = Object.fromEntries(
      Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    // Bake cwd and env into the command — session API has no native cwd/envVars params
    const sessionCommand = buildSessionCommand(fullCommand, options.cwd, envs);

    // Convert timeout from ms to seconds for Daytona SDK
    const effectiveTimeout = options.timeout ?? this.timeout;
    const timeoutSecs = Math.ceil(effectiveTimeout / 1000);

    const sessionId = `mastra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    this.logger.debug(`${LOG_PREFIX} Executing: ${fullCommand}`);

    try {
      await sandbox.process.createSession(sessionId);

      const { cmdId } = await sandbox.process.executeSessionCommand(sessionId, {
        command: sessionCommand,
        runAsync: true,
      });

      let stdout = '';
      let stderr = '';

      // Stream logs until the command finishes, with a client-side timeout.
      // deleteSession in the finally block kills the process if timeout fires.
      const logsPromise = sandbox.process.getSessionCommandLogs(
        sessionId,
        cmdId,
        (chunk: string) => {
          stdout += chunk;
          options.onStdout?.(chunk);
        },
        (chunk: string) => {
          stderr += chunk;
          options.onStderr?.(chunk);
        },
      );
      // Suppress the rejection that occurs when the session is deleted after timeout
      logsPromise.catch(() => {});

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Command timed out after ${effectiveTimeout}ms`)),
          effectiveTimeout,
        );
      });

      try {
        await Promise.race([logsPromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }

      const cmd = await sandbox.process.getSessionCommand(sessionId, cmdId);
      const exitCode = cmd.exitCode ?? 0;

      const executionTimeMs = Date.now() - startTime;

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
    } finally {
      // Best-effort session cleanup — sandbox may be dead or session already gone
      try {
        await sandbox.process.deleteSession(sessionId);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Build a shell command string that bakes in cwd and env vars.
 * Session commands have no native cwd/envVars params so we prepend them.
 *
 * @example
 * buildSessionCommand('npm test', '/app', { NODE_ENV: 'test' })
 * // → "export NODE_ENV=test && cd /app && npm test"
 */
function buildSessionCommand(command: string, cwd: string | undefined, envs: Record<string, string>): string {
  const parts: string[] = [];

  for (const [k, v] of Object.entries(envs)) {
    parts.push(`export ${k}=${shellQuote(v)}`);
  }

  if (cwd) {
    parts.push(`cd ${shellQuote(cwd)}`);
  }

  parts.push(command);

  return parts.join(' && ');
}
