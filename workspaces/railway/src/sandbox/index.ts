/**
 * Railway Sandbox Provider
 *
 * A Railway sandbox implementation for Mastra workspaces. Provisions an
 * ephemeral, isolated Linux VM on Railway, runs commands in it via the
 * Railway TypeScript SDK, and destroys it on teardown.
 *
 * @see https://docs.railway.com/sandboxes
 */

import type {
  CommandResult,
  ExecuteCommandOptions,
  InstructionsOption,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxCloneOptions,
  SandboxInfo,
  SandboxStartOutcome,
  SandboxStartResult,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { Sandbox, SandboxFailedError, SandboxNotFoundError, SandboxTimeoutError } from 'railway';
import type { SandboxNetworkIsolation, SandboxTemplate } from 'railway';
import { shellQuote } from '../utils/shell-quote';
import { LOG_PREFIX, RailwayProcessManager } from './process-manager';

/**
 * Safety margin subtracted from the sandbox's idle timeout when scheduling the
 * pre-reap checkpoint refresh. Sized to comfortably exceed Cloud Run cold-start
 * / recycle windows so a scale event during the refresh doesn't cause the timer
 * to lose the race with Railway's idle destroy. If a caller reduces the idle
 * timeout below this margin, the refresh falls back to the 1-second floor and
 * fires almost immediately after start — surfacing the misconfiguration rather
 * than silently skipping the refresh.
 */
const CHECKPOINT_REFRESH_MARGIN_MS = 180_000;

// =============================================================================
// Public capture result
// =============================================================================

/**
 * Outcome of a {@link RailwaySandbox.captureCheckpoint} call.
 *
 * `captured` and `coalesced` both represent a successful capture the caller can
 * persist against — they carry the checkpoint name inline so callers don't have
 * to reach back into the sandbox instance to learn what they just wrote.
 * `skipped` carries a machine-readable reason so the set stays extensible
 * without another breaking change.
 */
export type CaptureCheckpointResult =
  | { status: 'captured'; checkpointName: string }
  | { status: 'coalesced'; checkpointName: string }
  | { status: 'skipped'; reason: 'no-checkpoint-name-configured' | 'sandbox-not-running' };

// =============================================================================
// Railway Sandbox Options
// =============================================================================

/**
 * Railway sandbox provider configuration.
 */
export interface RailwaySandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Unique identifier for this sandbox instance. */
  id?: string;
  /** Railway API token. Falls back to the RAILWAY_API_TOKEN env var. */
  token?: string;
  /** Railway environment ID. Falls back to the RAILWAY_ENVIRONMENT_ID env var. */
  environmentId?: string;
  /**
   * Reattach to an existing Railway sandbox by its Railway ID instead of
   * creating a new one. When set, `start()` calls `Sandbox.connect()`.
   */
  sandboxId?: string;
  /**
   * Reuse a saved Railway sandbox checkpoint as the baseline filesystem for
   * new sandboxes. When the named checkpoint is missing, the sandbox is created
   * normally and a checkpoint is captured after setup succeeds.
   */
  checkpointName?: string;
  /**
   * Fallback checkpoint used to seed a new sandbox when `checkpointName` has
   * no stored state. Snapshots continue writing to `checkpointName`.
   */
  seedCheckpointName?: string;
  /**
   * How long the sandbox can sit idle (no `exec` interaction) before Railway
   * destroys it automatically. Range depends on plan (1–120 minutes on
   * Hobby/Pro, 1–5 on Trial/Free). Defaults to the plan default when omitted.
   */
  idleTimeoutMinutes?: number;
  /**
   * Network isolation mode.
   * - `ISOLATED` (default): outbound internet only, no private network access.
   * - `PRIVATE`: joins the environment's private network.
   */
  networkIsolation?: SandboxNetworkIsolation;
  /** Environment variables baked into the sandbox, available to every command. */
  env?: Record<string, string>;
  /**
   * Provision the sandbox from a custom base image built with the Railway
   * template builder. Use this to pre-install packages or run setup steps so
   * every sandbox created from it starts ready.
   *
   * - Builder callback — receives the base `Sandbox.template()` and returns the
   *   configured template. Railway builds the template when `Sandbox.create()`
   *   runs during `start()`.
   *   ```ts
   *   template: t => t.withPackages('git', 'curl').run('npm i -g pnpm')
   *   ```
   * - Pre-built `SandboxTemplate` — pass a template to reuse it across
   *   sandboxes. Railway still builds the image during sandbox creation.
   *
   * Ignored when `sandboxId` is set (reattach) or when forking.
   */
  template?: SandboxTemplate | ((base: SandboxTemplate) => SandboxTemplate);
  /**
   * Default execution timeout in milliseconds applied to commands that don't
   * specify their own timeout. When omitted, commands run until they exit.
   */
  timeout?: number;
  /**
   * Custom instructions that override the default instructions returned by
   * `getInstructions()`.
   *
   * - `string` — Fully replaces the default instructions. Pass an empty string
   *   to suppress instructions entirely.
   * - `(opts) => string` — Receives the default instructions and optional
   *   request context so you can extend or customise per-request.
   */
  instructions?: InstructionsOption;
}

// =============================================================================
// Railway Sandbox Implementation
// =============================================================================

/**
 * Railway sandbox provider for Mastra workspaces.
 *
 * Features:
 * - Ephemeral, isolated Linux VM via the Railway TypeScript SDK
 * - Command execution with streaming output and timeouts
 * - Configurable idle timeout and network isolation
 * - Reattach to an existing sandbox by Railway ID
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { RailwaySandbox } from '@mastra/railway';
 *
 * const sandbox = new RailwaySandbox({
 *   // token + environmentId read from RAILWAY_API_TOKEN / RAILWAY_ENVIRONMENT_ID
 *   idleTimeoutMinutes: 30,
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * const result = await workspace.executeCode('console.log("Hello!")');
 * ```
 *
 * @example Private networking
 * ```typescript
 * const sandbox = new RailwaySandbox({
 *   networkIsolation: 'PRIVATE',
 *   env: { NODE_ENV: 'production' },
 * });
 * ```
 */
export class RailwaySandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'RailwaySandbox';
  readonly provider = 'railway';
  status: ProviderStatus = 'pending';

  declare readonly processes: RailwayProcessManager;

  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;
  private _checkpointRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _checkpointRefreshInFlight: Promise<void> | null = null;
  private _sandboxId?: string;
  private _restoredCheckpointName?: string;

  private readonly _token?: string;
  private readonly _environmentId?: string;
  private readonly _checkpointName?: string;
  private readonly _seedCheckpointName?: string;
  private readonly _idleTimeoutMinutes?: number;
  private readonly _networkIsolation?: SandboxNetworkIsolation;
  private readonly _env: Record<string, string>;
  private readonly _timeout?: number;
  private readonly _instructionsOverride?: InstructionsOption;
  private readonly _templateOption?: RailwaySandboxOptions['template'];

  constructor(options: RailwaySandboxOptions = {}) {
    super({
      ...options,
      name: 'RailwaySandbox',
      processes: new RailwayProcessManager(),
    });

    this.id = options.id ?? this.generateId();
    this._token = options.token ?? process.env.RAILWAY_API_TOKEN;
    this._environmentId = options.environmentId ?? process.env.RAILWAY_ENVIRONMENT_ID;
    this._sandboxId = options.sandboxId;
    this._checkpointName = options.checkpointName;
    this._seedCheckpointName = options.seedCheckpointName;
    this._idleTimeoutMinutes = options.idleTimeoutMinutes;
    this._networkIsolation = options.networkIsolation;
    this._env = options.env ?? {};
    this._timeout = options.timeout;
    this._instructionsOverride = options.instructions;
    this._templateOption = options.template;
  }

  private generateId(): string {
    return `railway-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Get the underlying Railway Sandbox instance for direct SDK access.
   *
   * @throws {SandboxNotReadyError} If the sandbox has not been started.
   */
  get railway(): Sandbox {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start the Railway sandbox.
   *
   * Reattaches to an existing sandbox when `sandboxId` is configured,
   * otherwise provisions a new one. Resolves once the sandbox is RUNNING.
   *
   * Concurrent-caller coalescing lives in the `MastraSandbox` base class
   * (constructor-wrapped `start()`); a failed attempt is never latched.
   *
   * Reports `outcome: 'connected'` on reattach and `outcome: 'created'` when a new
   * sandbox was provisioned (including checkpoint-seeded fresh VMs).
   */
  async start(): Promise<SandboxStartResult> {
    if (this._sandbox) {
      return { outcome: 'connected' };
    }

    const clientConfig = this._clientConfig();
    const createOptions = this._createOptions(clientConfig);

    let outcome: SandboxStartOutcome = 'connected';
    if (this._sandboxId) {
      this._restoredCheckpointName = undefined;
      try {
        this._sandbox = await this._reconnectSandbox(this._sandboxId, clientConfig);
      } catch (error) {
        if (!(error instanceof SandboxNotFoundError)) {
          throw error;
        }
        this._sandbox = await this._createNewSandbox(createOptions);
        outcome = 'created';
      }
    } else {
      this._sandbox = await this._createNewSandbox(createOptions);
      outcome = 'created';
    }

    const sandbox = this._sandbox;
    this._sandboxId = sandbox.id;

    this._createdAt = sandbox.createdAt ? new Date(sandbox.createdAt) : new Date();
    this.logger.debug(`${LOG_PREFIX} Railway sandbox ${sandbox.id} ready for logical ID: ${this.id}`);
    this._scheduleCheckpointRefresh();
    return { outcome };
  }

  /**
   * Create a new Railway sandbox.
   */
  private async _createNewSandbox(createOptions: ReturnType<RailwaySandbox['_createOptions']>): Promise<Sandbox> {
    this.logger.debug(`${LOG_PREFIX} Creating Railway sandbox for: ${this.id}`);
    try {
      let checkpointToRestore: string | undefined;
      if (this._checkpointName || this._seedCheckpointName) {
        const checkpoints = await Sandbox.checkpoints(this._clientConfig());
        const checkpointNames = new Set(checkpoints.map(checkpoint => checkpoint.key));
        checkpointToRestore = checkpointNames.has(this._checkpointName ?? '')
          ? this._checkpointName
          : checkpointNames.has(this._seedCheckpointName ?? '')
            ? this._seedCheckpointName
            : undefined;
      }

      const sandbox = checkpointToRestore
        ? await Sandbox.create(checkpointToRestore, createOptions)
        : await Sandbox.create(createOptions);
      this._restoredCheckpointName = checkpointToRestore;
      return sandbox;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reconnect to an existing Railway sandbox, creating a fresh one when
   */
  private async _reconnectSandbox(
    reconnectSandboxId: string,
    clientConfig: { token?: string; environmentId?: string },
  ): Promise<Sandbox> {
    this.logger.debug(`${LOG_PREFIX} Reconnecting to Railway sandbox ${reconnectSandboxId}...`);

    let connectedSandbox: Sandbox = await Sandbox.connect(reconnectSandboxId, clientConfig);

    if (connectedSandbox.status !== 'RUNNING') {
      throw new SandboxNotFoundError({
        id: reconnectSandboxId,
        environmentId: clientConfig.environmentId ?? '',
      });
    }

    return connectedSandbox;
  }

  private _clientConfig(): { token?: string; environmentId?: string } {
    return {
      ...(this._token !== undefined && { token: this._token }),
      ...(this._environmentId !== undefined && { environmentId: this._environmentId }),
    };
  }

  private _createOptions(clientConfig: { token?: string; environmentId?: string }) {
    return {
      ...clientConfig,
      ...(this._idleTimeoutMinutes !== undefined && { idleTimeoutMinutes: this._idleTimeoutMinutes }),
      ...(this._networkIsolation !== undefined && { networkIsolation: this._networkIsolation }),
      ...(Object.keys(this._env).length > 0 && { env: this._env }),
    };
  }

  /** Persist the configured recovery checkpoint when available. */
  async snapshot(): Promise<void> {
    await this.captureCheckpoint();
  }

  /** Snapshots persist real checkpoints that can seed future sandboxes. */
  readonly supportsCheckpoints: boolean = true;

  /**
   * Capture the sandbox's checkpoint on demand, outside the idle-timer schedule.
   *
   * Intended for callers (e.g. a factory-side scheduler) that want to refresh
   * the recovery checkpoint at semantic moments — turn end, session-idle,
   * pre-teardown — rather than only just before Railway's idle destroy.
   *
   * Coalesces with any in-flight timer-driven refresh: concurrent callers join
   * the same underlying `Sandbox.checkpoint` call and receive
   * `{ status: 'coalesced', checkpointName }`. Both `captured` and `coalesced`
   * carry the checkpoint name inline so callers can persist a session→
   * checkpoint binding without a second, non-atomic read against the sandbox.
   * Returns `{ status: 'skipped', reason }` when there's nothing to capture
   * (no `checkpointName` configured, or the sandbox isn't running yet).
   *
   * On successful capture, restarts the idle-timer countdown so the next
   * timer-driven refresh is scheduled from this capture.
   *
   * Never captures without a `checkpointName` and never mutates status — safe
   * to invoke concurrently with `executeCommand`, `restart`, or `stop`.
   */
  async captureCheckpoint(): Promise<CaptureCheckpointResult> {
    const checkpointName = this._checkpointName;
    if (!checkpointName) {
      return { status: 'skipped', reason: 'no-checkpoint-name-configured' };
    }

    const sandbox = this._sandbox;
    if (!sandbox) {
      return { status: 'skipped', reason: 'sandbox-not-running' };
    }

    if (this._checkpointRefreshInFlight) {
      await this._checkpointRefreshInFlight;
      return { status: 'coalesced', checkpointName };
    }

    const capture = this._checkpointSandbox(sandbox).finally(() => {
      if (this._checkpointRefreshInFlight === capture) {
        this._checkpointRefreshInFlight = null;
      }
    });
    this._checkpointRefreshInFlight = capture;

    await capture;
    this._scheduleCheckpointRefresh();

    return { status: 'captured', checkpointName };
  }

  private async _checkpointSandbox(sandbox: Sandbox): Promise<void> {
    if (!this._checkpointName) {
      return;
    }

    this.logger.debug(`${LOG_PREFIX} Capturing Railway sandbox checkpoint ${this._checkpointName} for: ${this.id}`);

    const checkpoints = await Sandbox.checkpoints(this._clientConfig());
    const checkpointAlreadyExists = checkpoints.some(checkpoint => checkpoint.key === this._checkpointName);

    // Remove first so we can re-create a checkpoint with the same name.
    if (checkpointAlreadyExists) {
      await Sandbox.deleteCheckpoint(this._checkpointName, this._clientConfig());
    }

    await sandbox.checkpoint(this._checkpointName);
  }

  private _scheduleCheckpointRefresh(): void {
    if (!this._checkpointName || !this._sandbox) {
      return;
    }

    const idleTimeoutMinutes = this._idleTimeoutMinutes ?? this._sandbox.idleTimeoutMinutes;
    if (!idleTimeoutMinutes) {
      return;
    }

    this._cancelCheckpointRefresh();

    const delayMs = Math.max(1_000, idleTimeoutMinutes * 60_000 - CHECKPOINT_REFRESH_MARGIN_MS);
    this._checkpointRefreshTimer = setTimeout(() => {
      this._checkpointRefreshTimer = null;
      const sandbox = this._sandbox;
      if (!sandbox || this._checkpointRefreshInFlight) {
        return;
      }

      const refresh = this._checkpointSandbox(sandbox).finally(() => {
        if (this._checkpointRefreshInFlight === refresh) {
          this._checkpointRefreshInFlight = null;
        }
      });
      this._checkpointRefreshInFlight = refresh;
      refresh.catch(error => {
        this.logger.warn(`${LOG_PREFIX} Failed to refresh Railway sandbox checkpoint ${this._checkpointName}:`, error);
      });
    }, delayMs);
    this._checkpointRefreshTimer.unref?.();
  }

  private _cancelCheckpointRefresh(): void {
    if (this._checkpointRefreshTimer) {
      clearTimeout(this._checkpointRefreshTimer);
      this._checkpointRefreshTimer = null;
    }
  }

  /**
   * Stop the Railway sandbox.
   *
   * Railway sandboxes have no separate "stopped" state — they're either
   * running or destroyed — so stopping destroys the sandbox but we keep a checkpoint of the filesystem.
   */
  async stop(): Promise<void> {
    if (this._checkpointName) {
      await this._flushCheckpointRefresh().catch(error => {
        this.logger.warn(`${LOG_PREFIX} Failed to checkpoint Railway sandbox ${this._sandbox?.id}:`, error);
      });
    }

    await this._teardown();
  }

  /**
   * Destroy the Railway sandbox and release its resources including the checkpoint.
   */
  async destroy(): Promise<void> {
    this._cancelCheckpointRefresh();
    if (this._checkpointName) {
      await this._checkpointRefreshInFlight;
      await Sandbox.deleteCheckpoint(this._checkpointName, this._clientConfig()).catch(error => {
        this.logger.warn(`${LOG_PREFIX} Failed to delete Railway checkpoint ${this._checkpointName}:`, error);
      });
    }

    await this._teardown();
  }

  private async _flushCheckpointRefresh(): Promise<void> {
    this._cancelCheckpointRefresh();

    if (this._checkpointRefreshInFlight) {
      await this._checkpointRefreshInFlight;
      return;
    }

    if (this._sandbox) {
      await this._checkpointSandbox(this._sandbox);
    }
  }

  private async _teardown(): Promise<void> {
    this._cancelCheckpointRefresh();
    if (!this._sandbox) {
      return;
    }
    await this._checkpointRefreshInFlight;

    const sandbox = this._sandbox;
    this._sandbox = null;
    try {
      await sandbox.destroy();
    } catch (error) {
      this.logger.warn(`${LOG_PREFIX} Failed to destroy Railway sandbox ${sandbox.id}:`, error);
    }
  }

  /**
   * Fork this running sandbox into a new, independent `RailwaySandbox`.
   *
   * Clones the filesystem (a fresh boot, not live processes) into the same
   * environment. The returned sandbox is already started and reattached to the
   * forked Railway sandbox; it inherits this sandbox's credentials and defaults
   * unless overridden via `options`.
   *
   * @throws {SandboxNotReadyError} If this sandbox has not been started.
   */
  async fork(
    options: Pick<RailwaySandboxOptions, 'id' | 'idleTimeoutMinutes' | 'networkIsolation' | 'env'> = {},
  ): Promise<RailwaySandbox> {
    const source = this.railway;
    const forked = await source.fork({
      ...(options.idleTimeoutMinutes !== undefined && { idleTimeoutMinutes: options.idleTimeoutMinutes }),
      ...(options.networkIsolation !== undefined && { networkIsolation: options.networkIsolation }),
      ...(options.env !== undefined && { env: options.env }),
    });

    const child = new RailwaySandbox({
      ...(options.id !== undefined && { id: options.id }),
      ...(this._token !== undefined && { token: this._token }),
      ...(this._environmentId !== undefined && { environmentId: this._environmentId }),
      idleTimeoutMinutes: options.idleTimeoutMinutes ?? this._idleTimeoutMinutes,
      networkIsolation: options.networkIsolation ?? this._networkIsolation,
      env: options.env ?? this._env,
      timeout: this._timeout,
    });
    await child._start();
    return child;
  }

  /**
   * Construct a sibling `RailwaySandbox` that inherits this sandbox's
   * credentials and defaults (token, environment, checkpoint, network
   * isolation, timeout, template, instructions) with per-instance overrides.
   *
   * Unlike {@link fork}, `clone` performs no I/O and does not require this
   * sandbox to be started — the returned sandbox is not started and provisions
   * (or reattaches, when `sandboxId` is set) on its own `start()`. Use it when
   * one configured sandbox acts as the template for a fleet of independent
   * sandboxes (e.g. one per project).
   */
  clone(options: SandboxCloneOptions = {}): RailwaySandbox {
    return new RailwaySandbox({
      ...(options.id !== undefined && { id: options.id }),
      ...(this._token !== undefined && { token: this._token }),
      ...(this._environmentId !== undefined && { environmentId: this._environmentId }),
      ...((options.checkpointName ?? this._checkpointName) !== undefined && {
        checkpointName: options.checkpointName ?? this._checkpointName,
      }),
      ...(options.seedCheckpointName !== undefined && { seedCheckpointName: options.seedCheckpointName }),
      idleTimeoutMinutes: options.idleTimeoutMinutes ?? this._idleTimeoutMinutes,
      ...(this._networkIsolation !== undefined && { networkIsolation: this._networkIsolation }),
      env: options.env ?? this._env,
      ...(this._templateOption !== undefined && { template: this._templateOption }),
      ...(this._timeout !== undefined && { timeout: this._timeout }),
      ...(this._instructionsOverride !== undefined && { instructions: this._instructionsOverride }),
    });
  }

  /**
   * Whether a Railway API token was resolved at construction (explicit option
   * or the `RAILWAY_API_TOKEN` env fallback). Lets callers gate features on a
   * usable configuration without provisioning a sandbox.
   */
  get hasCredentials(): boolean {
    return this._token !== undefined && this._token !== '';
  }

  /** The configured idle teardown window in minutes, if any. */
  get idleTimeoutMinutes(): number | undefined {
    return this._idleTimeoutMinutes;
  }

  // ---------------------------------------------------------------------------
  // Info & Instructions
  // ---------------------------------------------------------------------------

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        ...(this._sandbox && {
          railwaySandboxId: this._sandbox.id,
          environmentId: this._sandbox.environmentId,
          region: this._sandbox.region,
          networkIsolation: this._sandbox.networkIsolation,
          ...(this._sandbox.idleTimeoutMinutes != null && {
            idleTimeoutMinutes: this._sandbox.idleTimeoutMinutes,
          }),
          ...(this._restoredCheckpointName && { restoredCheckpointName: this._restoredCheckpointName }),
        }),
      },
    };
  }

  getInstructions(): string {
    const defaultInstructions = this._buildDefaultInstructions();

    if (typeof this._instructionsOverride === 'string') {
      return this._instructionsOverride;
    }
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({ defaultInstructions });
    }
    return defaultInstructions;
  }

  private _buildDefaultInstructions(): string {
    const parts: string[] = [];
    parts.push('Railway cloud sandbox: an isolated Debian Linux VM with outbound internet access.');

    if (this._networkIsolation === 'PRIVATE') {
      parts.push('Joined to the environment private network.');
    }

    if (this._timeout !== undefined) {
      parts.push(`Default command timeout: ${Math.ceil(this._timeout / 1000)}s.`);
    } else {
      parts.push('Commands run until they exit unless a timeout is set.');
    }

    if (this._idleTimeoutMinutes !== undefined) {
      parts.push(`Idle timeout: ${this._idleTimeoutMinutes} minute(s).`);
    }

    return parts.join(' ');
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a command in the sandbox and return the result.
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    const status = this._sandbox?.status;

    if (status !== 'RUNNING') {
      if (!this._checkpointName) {
        throw new SandboxNotReadyError(this.id);
      }

      // TODO: this reconstructs "am I inside the current start?" from base
      // internals because status flips to 'running' before the onStart hook.
      // If the base ever gates commands on start re-entrancy directly, delete
      // this branch and let it decide.
      if (this._startPromise) {
        if (this.status === 'running') {
          // status flips to 'running' before the base class runs the
          // bootstrap/onStart phase of the CURRENT start attempt — an
          // executeCommand arriving here is running inside that attempt, and
          // joining the in-flight promise would await itself forever. Fail
          // loudly instead of hanging.
          throw new SandboxNotReadyError(this.id);
        }
        // Concurrent with someone else's in-flight start — join it.
        await this.start();
      } else {
        // The VM is provably down — reset local state so the base-class start
        // wrapper (which early-returns while status is 'running') actually
        // re-runs the reconnect/provision logic.
        this._sandbox = null;
        this.status = 'stopped';
        await this.start();
      }
    }

    const fullCommand = args.length > 0 ? `${command} ${args.map(shellQuote).join(' ')}` : command;
    const timeout = options.timeout ?? this._timeout;
    const mergedEnv = { ...this.getEnv(), ...options.env };
    const env = Object.keys(mergedEnv).length
      ? Object.fromEntries(
          Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
        )
      : undefined;
    const startedAt = Date.now();
    const result = await this.railway.exec(fullCommand, {
      ...(timeout !== undefined && { timeoutSec: Math.ceil(timeout / 1000) }),
      ...(options.cwd !== undefined && { cwd: options.cwd }),
      ...(env !== undefined && { env }),
    });
    const exitCode = result.exitCode ?? -1;
    return {
      success: exitCode === 0,
      exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      executionTimeMs: Date.now() - startedAt,
      command,
      args,
      timedOut: result.timedOut,
    };
  }
}
