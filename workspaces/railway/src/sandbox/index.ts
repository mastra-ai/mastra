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
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { Sandbox, SandboxFailedError, SandboxNotFoundError, SandboxTimeoutError } from 'railway';
import type { SandboxNetworkIsolation, SandboxTemplate } from 'railway';
import { shellQuote } from '../utils/shell-quote';
import { LOG_PREFIX, RailwayProcessManager } from './process-manager';

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

  private readonly _token?: string;
  private readonly _environmentId?: string;
  private readonly _sandboxId?: string;
  private readonly _checkpointName?: string;
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
      processes: new RailwayProcessManager({ env: options.env }),
    });

    this.id = options.id ?? this.generateId();
    this._token = options.token ?? process.env.RAILWAY_API_TOKEN;
    this._environmentId = options.environmentId ?? process.env.RAILWAY_ENVIRONMENT_ID;
    this._sandboxId = options.sandboxId;
    this._checkpointName = options.checkpointName;
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
   */
  async start(): Promise<void> {
    if (this._sandbox) {
      return;
    }

    await this._startRailwaySandbox({ reconnectSandboxId: this._sandboxId, fallbackToCreate: false });
  }

  async restart(): Promise<void> {
    const reconnectSandboxId = this._sandbox?.id ?? this._sandboxId;
    this._cancelCheckpointRefresh();
    await this._checkpointRefreshInFlight?.catch(error => {
      this.logger.warn(`${LOG_PREFIX} Failed to flush in-flight checkpoint before restart:`, error);
    });
    this._sandbox = null;
    this._createdAt = null;
    this.status = 'starting';

    try {
      await this._startRailwaySandbox({ reconnectSandboxId, fallbackToCreate: true });
      this.status = 'running';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  async withRestartRetry<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureRunning();
    try {
      return await operation();
    } catch (error) {
      if (!this.isSandboxUnavailableError(error)) {
        throw error;
      }

      await this.restart();
      return await operation();
    } finally {
      this._scheduleCheckpointRefresh();
    }
  }

  private async _startRailwaySandbox({
    reconnectSandboxId,
    fallbackToCreate,
  }: {
    reconnectSandboxId?: string;
    fallbackToCreate: boolean;
  }): Promise<void> {
    const clientConfig = this._clientConfig();
    const createOptions = this._createOptions(clientConfig);

    this._sandbox = reconnectSandboxId
      ? await this._reconnectSandbox(reconnectSandboxId, fallbackToCreate, clientConfig, createOptions)
      : await this._createNewSandbox(createOptions);

    this._createdAt = this._sandbox.createdAt ? new Date(this._sandbox.createdAt) : new Date();
    this.logger.debug(`${LOG_PREFIX} Railway sandbox ${this._sandbox.id} ready for logical ID: ${this.id}`);
    this._scheduleCheckpointRefresh();
  }

  /**
   * Reconnect to an existing Railway sandbox, creating a fresh one when
   * `fallbackToCreate` is set and the sandbox is unavailable or not running.
   */
  private async _reconnectSandbox(
    reconnectSandboxId: string,
    fallbackToCreate: boolean,
    clientConfig: { token?: string; environmentId?: string },
    createOptions: ReturnType<RailwaySandbox['_createOptions']>,
  ): Promise<Sandbox> {
    this.logger.debug(`${LOG_PREFIX} Reconnecting to Railway sandbox ${reconnectSandboxId}...`);

    let connectedSandbox: Sandbox;
    try {
      connectedSandbox = await Sandbox.connect(reconnectSandboxId, clientConfig);
    } catch (error) {
      if (!fallbackToCreate || !this.isSandboxUnavailableError(error)) {
        throw error;
      }
      return this._createNewSandbox(createOptions);
    }

    if (connectedSandbox.status === 'RUNNING') {
      return connectedSandbox;
    }

    if (!fallbackToCreate) {
      throw new Error(`Railway sandbox ${reconnectSandboxId} is not running (status: ${connectedSandbox.status})`);
    }

    return this._createNewSandbox(createOptions);
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

  private async _createNewSandbox(createOptions: ReturnType<RailwaySandbox['_createOptions']>): Promise<Sandbox> {
    const checkpointSandbox = await this._tryCreateFromCheckpoint(createOptions);
    if (checkpointSandbox) {
      return checkpointSandbox;
    }

    if (this._templateOption) {
      const template = this._resolveTemplate();
      this.logger.debug(`${LOG_PREFIX} Creating Railway sandbox from template for: ${this.id}`);
      const sandbox = await Sandbox.create(template, createOptions);
      await this._checkpointSandbox(sandbox);
      return sandbox;
    }

    this.logger.debug(`${LOG_PREFIX} Creating Railway sandbox for: ${this.id}`);
    const sandbox = await Sandbox.create(createOptions);
    await this._checkpointSandbox(sandbox);
    return sandbox;
  }

  private async _tryCreateFromCheckpoint(
    createOptions: ReturnType<RailwaySandbox['_createOptions']>,
  ): Promise<Sandbox | undefined> {
    if (!this._checkpointName) {
      return undefined;
    }

    this.logger.debug(`${LOG_PREFIX} Creating Railway sandbox from checkpoint ${this._checkpointName} for: ${this.id}`);

    try {
      const sandbox = await Sandbox.create(this._checkpointName, createOptions);
      return sandbox;
    } catch (error) {
      if (!this.isCheckpointUnavailableError(error)) {
        throw error;
      }
      return undefined;
    }
  }

  private async _checkpointSandbox(sandbox: Sandbox): Promise<void> {
    if (!this._checkpointName) {
      return;
    }

    try {
      this.logger.debug(`${LOG_PREFIX} Capturing Railway sandbox checkpoint ${this._checkpointName} for: ${this.id}`);
      await sandbox.checkpoint(this._checkpointName);
    } catch (error) {
      if (!this.isCheckpointAlreadyExistsError(error)) {
        throw error;
      }

      await this._deleteCheckpointByName(this._checkpointName);
      await sandbox.checkpoint(this._checkpointName);
    }
  }

  private async _deleteCheckpointByName(name: string): Promise<void> {
    try {
      const checkpoint = (await Sandbox.checkpoints(this._clientConfig())).find(checkpoint => checkpoint.key === name);
      if (!checkpoint) {
        return;
      }

      await Sandbox.deleteCheckpoint(checkpoint.id, this._clientConfig());
    } catch (error) {
      if (!this.isCheckpointUnavailableError(error)) {
        throw error;
      }
    }
  }

  private _scheduleCheckpointRefresh(): void {
    if (!this._checkpointName || !this._sandbox) {
      return;
    }

    const idleTimeoutMinutes = this._idleTimeoutMinutes ?? this._sandbox.idleTimeoutMinutes;
    if (!idleTimeoutMinutes) {
      return;
    }

    if (this._checkpointRefreshTimer) {
      clearTimeout(this._checkpointRefreshTimer);
    }

    const delayMs = Math.max(1_000, idleTimeoutMinutes * 60_000 - 10_000);
    this._checkpointRefreshTimer = setTimeout(() => {
      this._checkpointRefreshTimer = null;
      const sandbox = this._sandbox;
      if (!sandbox) {
        return;
      }

      const refresh = this._checkpointSandbox(sandbox).finally(() => {
        if (this._checkpointRefreshInFlight === refresh) {
          this._checkpointRefreshInFlight = null;
        }
      });
      this._checkpointRefreshInFlight = refresh;
      this._checkpointRefreshInFlight.catch(error => {
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

  private isCheckpointUnavailableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('checkpoint') &&
      ['not found', 'does not exist', 'missing', 'unknown', 'no checkpoint'].some(phrase => message.includes(phrase))
    );
  }

  private isCheckpointAlreadyExistsError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('checkpoint') &&
      (['already exists', 'must be unused', 'unique'].some(phrase => message.includes(phrase)) ||
        (message.includes('name') && message.includes('used')))
    );
  }

  private isSandboxUnavailableError(error: unknown, seen = new Set<unknown>()): boolean {
    if (error && typeof error === 'object') {
      if (seen.has(error)) return false;
      seen.add(error);
    }

    if (
      error instanceof SandboxNotFoundError ||
      error instanceof SandboxFailedError ||
      (error instanceof SandboxTimeoutError && error.resource === 'sandbox')
    ) {
      return true;
    }

    if (error && typeof error === 'object') {
      const errorLike = error as { name?: unknown; message?: unknown; resource?: unknown; cause?: unknown };
      const name = typeof errorLike.name === 'string' ? errorLike.name : '';
      const message = typeof errorLike.message === 'string' ? errorLike.message.toLowerCase() : '';

      if (
        name === 'SandboxNotFoundError' ||
        name === 'SandboxFailedError' ||
        (name === 'SandboxTimeoutError' && errorLike.resource === 'sandbox')
      ) {
        return true;
      }

      if (
        message.includes('sandbox') &&
        ['not found', 'destroyed', 'failed', 'not running', 'unavailable'].some(phrase => message.includes(phrase))
      ) {
        return true;
      }

      if (errorLike.cause !== undefined) {
        return this.isSandboxUnavailableError(errorLike.cause, seen);
      }
    }

    return false;
  }

  /**
   * Stop the Railway sandbox.
   *
   * Railway sandboxes have no separate "stopped" state — they're either
   * running or destroyed — so stopping destroys the sandbox.
   */
  async stop(): Promise<void> {
    await this._teardown();
  }

  /**
   * Destroy the Railway sandbox and release its resources.
   */
  async destroy(): Promise<void> {
    await this._teardown();
  }

  private async _teardown(): Promise<void> {
    if (!this._sandbox) {
      this._cancelCheckpointRefresh();
      return;
    }
    const sandbox = this._sandbox;
    try {
      await this._flushCheckpointRefresh();
    } catch (error) {
      this.logger.warn(`${LOG_PREFIX} Failed to flush checkpoint before teardown:`, error);
    }
    this._sandbox = null;
    try {
      await sandbox.destroy();
    } catch (error) {
      this.logger.warn(`${LOG_PREFIX} Failed to destroy Railway sandbox ${sandbox.id}:`, error);
    }
  }

  /**
   * Resolve the configured template into a `SandboxTemplate` that Railway
   * builds during `Sandbox.create()`. Accepts either a pre-built
   * `SandboxTemplate` or a builder callback over `Sandbox.template()`.
   */
  private _resolveTemplate(): SandboxTemplate {
    const option = this._templateOption!;
    return typeof option === 'function' ? option(Sandbox.template()) : option;
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
      sandboxId: forked.id,
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
      ...(options.sandboxId !== undefined && { sandboxId: options.sandboxId }),
      ...((options.checkpointName ?? this._checkpointName) !== undefined && {
        checkpointName: options.checkpointName ?? this._checkpointName,
      }),
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

  /** Update an environment variable used by future sandbox commands. */
  setEnvironmentVariable(name: string, value: string): void {
    this._env[name] = value;
    this.processes.setEnvironmentVariable(name, value);
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
    return this.withRestartRetry(async () => {
      const fullCommand = args.length > 0 ? `${command} ${args.map(shellQuote).join(' ')}` : command;
      const timeout = options.timeout ?? this._timeout;
      const env = Object.fromEntries(
        Object.entries({ ...this._env, ...options.env }).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      );
      const startedAt = Date.now();
      const result = await this.railway.exec(fullCommand, {
        ...(timeout !== undefined && { timeoutSec: Math.ceil(timeout / 1000) }),
        ...(options.cwd !== undefined && { cwd: options.cwd }),
        ...(Object.keys(env).length > 0 && { env }),
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
    });
  }
}
