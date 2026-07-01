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
  SandboxInfo,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { Sandbox } from 'railway';
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

  private readonly _token?: string;
  private readonly _environmentId?: string;
  private readonly _sandboxId?: string;
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

    const clientConfig = {
      ...(this._token !== undefined && { token: this._token }),
      ...(this._environmentId !== undefined && { environmentId: this._environmentId }),
    };

    const createOptions = {
      ...clientConfig,
      ...(this._idleTimeoutMinutes !== undefined && { idleTimeoutMinutes: this._idleTimeoutMinutes }),
      ...(this._networkIsolation !== undefined && { networkIsolation: this._networkIsolation }),
      ...(Object.keys(this._env).length > 0 && { env: this._env }),
    };

    if (this._sandboxId) {
      this.logger.debug(`${LOG_PREFIX} Reconnecting to Railway sandbox ${this._sandboxId}...`);
      this._sandbox = await Sandbox.connect(this._sandboxId, clientConfig);
    } else if (this._templateOption) {
      const template = this._resolveTemplate();
      this.logger.debug(`${LOG_PREFIX} Creating Railway sandbox from template for: ${this.id}`);
      this._sandbox = await Sandbox.create(template, createOptions);
    } else {
      this.logger.debug(`${LOG_PREFIX} Creating Railway sandbox for: ${this.id}`);
      this._sandbox = await Sandbox.create(createOptions);
    }

    this._createdAt = this._sandbox.createdAt ? new Date(this._sandbox.createdAt) : new Date();
    this.logger.debug(`${LOG_PREFIX} Railway sandbox ${this._sandbox.id} ready for logical ID: ${this.id}`);
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
      return;
    }
    const sandbox = this._sandbox;
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
    await this.ensureRunning();
    const fullCommand = args.length > 0 ? `${command} ${args.map(shellQuote).join(' ')}` : command;
    const effectiveOptions: ExecuteCommandOptions = {
      ...options,
      timeout: options.timeout ?? this._timeout,
    };
    const handle = await this.processes.spawn(fullCommand, effectiveOptions);
    const result = await handle.wait();
    return { ...result, command, args };
  }
}
