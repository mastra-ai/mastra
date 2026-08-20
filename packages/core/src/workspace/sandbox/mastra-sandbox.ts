/**
 * MastraSandbox Base Class
 *
 * Abstract base class for sandbox providers that want automatic logger integration.
 * Extends MastraBase to receive the Mastra logger when registered with a Mastra instance.
 *
 * MountManager is automatically created if the subclass implements `mount()`.
 * Use `declare readonly mounts: MountManager` to get non-optional typing.
 *
 * ## Lifecycle Management
 *
 * The base class provides race-condition-safe lifecycle wrappers:
 * - `_start()` - Handles concurrent calls, status management, and mount processing
 * - `_stop()` - Handles concurrent calls and status management
 * - `_destroy()` - Handles concurrent calls and status management
 *
 * Subclasses override the plain `start()`, `stop()`, and `destroy()` methods
 * to provide their implementation. Callers use the `_`-prefixed wrappers
 * (or `callLifecycle()`) which add status tracking and race-condition safety.
 *
 * External providers can extend this class to get logger support, or implement
 * the WorkspaceSandbox interface directly if they don't need logging.
 */

import { MastraBase } from '../../base';
import type { IMastraLogger } from '../../logger';
import { RegisteredLogger } from '../../logger/constants';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { MountResult } from '../filesystem/mount';
import type { ProviderStatus, SandboxStartOutcome, SandboxStartResult } from '../lifecycle';
import { SandboxNotReadyError } from './errors';
import { MountManager } from './mount-manager';
import type { SandboxProcessManager } from './process-manager';
import type { SandboxFileInput, SandboxNetworking, WorkspaceSandbox } from './sandbox';
import type { CommandResult, ExecuteCommandOptions, SandboxInfo } from './types';
import { shellQuote } from './utils';

/**
 * Lifecycle hook that fires during sandbox state transitions.
 * Receives the sandbox instance so users can call `executeCommand`, read files, etc.
 *
 * For `onStart`, `outcome` carries the provider's {@link SandboxStartResult}:
 * `true` = this start provisioned a fresh VM, `false` = reconnected/resumed,
 * `undefined` = the provider doesn't report (not yet migrated).
 */
export type SandboxLifecycleHook = (args: {
  sandbox: WorkspaceSandbox;
  outcome?: SandboxStartOutcome;
}) => void | Promise<void>;

/**
 * Options for the MastraSandbox base class constructor.
 * Providers extend this to add their own options while inheriting lifecycle hooks.
 */
export interface MastraSandboxOptions {
  /**
   * Called inside the start lifecycle, after the sandbox reaches 'running'
   * status and before pending mounts are processed. Fires on EVERY start
   * regardless of trigger (explicit, `ensureRunning()` from a lazy command,
   * a revival after the VM was replaced), which makes it the seam for
   * once-per-VM setup: branch on `outcome` and probe/run whatever the
   * environment needs.
   *
   * A thrown error is FATAL: `start()` rejects and the sandbox is marked
   * `error`, so a caller never observes a running sandbox whose setup hook
   * failed. The next start retries the hook. (`onStop`/`onDestroy` remain
   * non-fatal observers — teardown proceeds best-effort.)
   */
  onStart?: SandboxLifecycleHook;
  /** Called before the sandbox stops */
  onStop?: SandboxLifecycleHook;
  /** Called before the sandbox is destroyed */
  onDestroy?: SandboxLifecycleHook;

  /**
   * Process manager for this sandbox.
   *
   * When provided, the base class automatically:
   * 1. Sets the sandbox back-reference on the process manager
   * 2. Exposes it via `this.processes`
   * 3. Creates a default `executeCommand` implementation (spawn + wait)
   *
   * @example
   * ```typescript
   * class MySandbox extends MastraSandbox {
   *   constructor() {
   *     super({
   *       name: 'MySandbox',
   *       processes: new MyProcessManager({ env: myEnv }),
   *     });
   *   }
   * }
   * ```
   */
  processes?: SandboxProcessManager;
}

/**
 * Abstract base class for sandbox providers with logger support.
 *
 * Providers that extend this class automatically receive the Mastra logger
 * when the sandbox is used with a Mastra instance. MountManager is also
 * automatically created if the subclass implements `mount()`.
 *
 * @example
 * ```typescript
 * class MyCustomSandbox extends MastraSandbox {
 *   declare readonly mounts: MountManager;  // Non-optional type
 *   readonly id = 'my-sandbox';
 *   readonly name = 'MyCustomSandbox';
 *   readonly provider = 'custom';
 *   status: ProviderStatus = 'pending';
 *
 *   constructor() {
 *     super({
 *       name: 'MyCustomSandbox',
 *       processes: new MyProcessManager({ env: myEnv }),
 *     });
 *   }
 *
 *   async start(): Promise<void> { /* startup logic *\/ }
 *   async mount(filesystem, mountPath) { ... }
 *   async unmount(mountPath) { ... }
 * }
 * ```
 */
export abstract class MastraSandbox<THandle = unknown> extends MastraBase implements WorkspaceSandbox {
  /** Unique identifier for this sandbox instance */
  abstract readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  abstract readonly name: string;

  /** Provider type identifier */
  abstract readonly provider: string;

  /** Current status of the sandbox */
  abstract status: ProviderStatus;

  // ---------------------------------------------------------------------------
  // Optional WorkspaceSandbox members
  //
  // Re-declared here so that variables typed as `MastraSandbox` (not just
  // `WorkspaceSandbox`) can see them.  TypeScript's `implements` is a
  // constraint check, not a type merge — optional interface members are
  // invisible on the class type unless explicitly listed.
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command and wait for completion.
   *
   * Method syntax (not property syntax) is intentional — it prevents
   * `useDefineForClassFields` from emitting `this.executeCommand = undefined`
   * which would shadow prototype methods defined by subclasses.
   */
  executeCommand?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  /** Optional networking capability - implement to expose public port URLs */
  readonly networking?: SandboxNetworking;

  /**
   * Optional bulk file upload into the sandbox's own filesystem.
   *
   * Method syntax (not property syntax) is intentional — it prevents
   * `useDefineForClassFields` from emitting `this.writeFiles = undefined`
   * which would shadow prototype methods defined by subclasses.
   */
  writeFiles?(files: SandboxFileInput[]): Promise<void>;

  /** Process manager */
  readonly processes?: SandboxProcessManager;

  /** Mount manager - automatically created if subclass implements mount() */
  readonly mounts?: MountManager;

  /** Optional mount method - implement to enable mounting support */
  mount?(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult>;

  /** Optional unmount method */
  unmount?(mountPath: string): Promise<void>;

  /** Get instructions describing how this sandbox works */
  getInstructions?(): string;

  /** Get sandbox status and metadata */
  getInfo?(): SandboxInfo | Promise<SandboxInfo>;

  /**
   * Persist the sandbox's current state when supported.
   *
   * The default implementation is a no-op for providers without snapshot support.
   */
  async snapshot(): Promise<void> {}

  /**
   * Whether `snapshot()` persists real checkpoints. Providers overriding
   * `snapshot()` with a real implementation should also override this to true.
   */
  readonly supportsCheckpoints: boolean = false;

  // ---------------------------------------------------------------------------
  // Lifecycle Promise Tracking (prevents race conditions)
  // ---------------------------------------------------------------------------

  /** Promise for _start() to prevent race conditions from concurrent calls */
  protected _startPromise?: Promise<SandboxStartResult | void>;

  /**
   * The subclass's own `start()` implementation, captured in the constructor
   * before `start` is shadowed with the lifecycle wrapper. See constructor.
   */
  private readonly _implStart: () => void | Promise<SandboxStartResult | void>;

  /**
   * Whether start acquisition runs through the {@link find}/{@link connect}/
   * {@link create} primitives (the subclass implements `create()` and does
   * NOT override `start()`). Computed once in the constructor.
   */
  private readonly _useAcquisitionPrimitives: boolean;

  /** Promise for _stop() to prevent race conditions from concurrent calls */
  protected _stopPromise?: Promise<void>;

  /** Promise for _destroy() to prevent race conditions from concurrent calls */
  protected _destroyPromise?: Promise<void>;

  /** Lifecycle callbacks */
  private readonly _onStart?: SandboxLifecycleHook;
  private readonly _onStop?: SandboxLifecycleHook;
  private readonly _onDestroy?: SandboxLifecycleHook;

  constructor(options: { name: string } & MastraSandboxOptions) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });

    this._onStart = options.onStart;
    this._onStop = options.onStop;
    this._onDestroy = options.onDestroy;

    // Wrap start() with the lifecycle path (same pattern as
    // SandboxProcessManager): capture the subclass's prototype `start()` and
    // shadow it with an instance property delegating to `_start()`, so DIRECT
    // `start()` calls get the same coalescing/status/onStart safety as
    // `_start()`/`ensureRunning()`. Subclasses keep their natural method name.
    // Requires method syntax in subclasses — a `start` class FIELD initializer
    // would overwrite this wrapper (same constraint as `executeCommand` above).
    const hasStartOverride = this.start !== MastraSandbox.prototype.start;
    this._implStart = this.start.bind(this);
    this.start = () => this._start();
    // Acquisition ladder rung selection: a subclass `start()` override wins
    // (fused-getOrCreate providers); otherwise the find/connect/create
    // primitives drive acquisition when `create()` is implemented.
    this._useAcquisitionPrimitives = !hasStartOverride && typeof this.create === 'function';

    // Automatically create MountManager if subclass implements mount()
    if (this.mount) {
      this.mounts = new MountManager({
        mount: this.mount.bind(this),
        logger: this.logger,
      });
    }

    // Wire up process manager if provided
    if (options.processes) {
      const pm = options.processes;
      // Set the sandbox back-reference. The process manager reads this
      // lazily (at call time), so it's fine that the subclass constructor
      // hasn't finished yet.
      pm.sandbox = this;
      this.processes = pm;

      // Auto-create executeCommand (spawn + wait) unless the subclass
      // defines its own implementation.
      if (!this.executeCommand) {
        this.executeCommand = async (command: string, args?: string[], opts?: ExecuteCommandOptions) => {
          const fullCommand = args?.length ? `${command} ${args.map(a => shellQuote(a)).join(' ')}` : command;
          this.logger.debug('Executing command', { sandbox: this.name, command: fullCommand, cwd: opts?.cwd });

          const handle = await pm.spawn(fullCommand, { ...opts, maxRetainedBytes: opts?.maxRetainedBytes ?? Infinity });
          try {
            const result = await handle.wait();

            this.logger.debug('Command completed', {
              sandbox: this.name,
              exitCode: result.exitCode,
              duration: result.executionTimeMs,
            });

            return { ...result, command: fullCommand };
          } finally {
            pm.release(handle.pid);
          }
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Wrappers (race-condition-safe)
  // ---------------------------------------------------------------------------

  /**
   * Start the sandbox (wrapper with status management and race-condition safety).
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management and automatically processes pending mounts after startup.
   *
   * Subclasses override `start()` to provide their startup logic.
   */
  async _start(): Promise<SandboxStartResult | void> {
    // Already running — definitionally not a fresh create, so report
    // `{ outcome: 'connected' }` (keeps concretely-typed provider `start()` signatures
    // sound: every path through the wrapper yields a result for providers
    // whose impl always reports one).
    if (this.status === 'running') {
      return { outcome: 'connected' };
    }

    // Wait for in-flight stop/destroy before starting.
    // Intentionally no .catch() — if teardown is failing, _start() should propagate
    // that error rather than silently starting on top of a broken state.
    if (this._stopPromise) await this._stopPromise;
    if (this._destroyPromise) await this._destroyPromise;

    // Cannot start a destroyed sandbox
    if (this.status === 'destroyed') {
      throw new Error('Cannot start a destroyed sandbox');
    }

    // Start already in progress - return existing promise. Joined callers
    // share the attempt's SandboxStartResult (all observe `outcome: 'created'`
    // when the shared attempt created). The slot is cleared on settle, so a
    // failed attempt is never latched.
    if (this._startPromise) {
      return this._startPromise;
    }

    // Create and store the start promise
    this._startPromise = this._executeStart();

    try {
      return await this._startPromise;
    } finally {
      this._startPromise = undefined;
    }
  }

  /**
   * Internal start execution - handles status, the onStart hook, and mount
   * processing.
   */
  private async _executeStart(): Promise<SandboxStartResult | void> {
    this.status = 'starting';

    let result: SandboxStartResult | void;
    try {
      result = this._useAcquisitionPrimitives ? await this._acquire() : await this._implStart();
      // Status must flip to 'running' BEFORE the onStart hook runs: setup
      // hooks execute commands through `executeCommand` → `pm.spawn` →
      // `ensureRunning()`, which would otherwise join the in-flight
      // `_startPromise` and deadlock awaiting its own start. This opens an
      // accepted window where commands fired concurrently with start() —
      // without awaiting it — can interleave with the hook, and where a
      // start() call arriving DURING the hook hits the already-running early
      // return and resolves before the hook completes. Callers that await
      // the ORIGINAL start() always observe a sandbox whose hook finished.
      this.status = 'running';
    } catch (error) {
      this.status = 'error';
      throw error;
    }

    const outcome = result?.outcome;

    // The onStart hook is the once-per-VM setup seam and its failures are
    // FATAL: a caller must never observe a running sandbox whose setup hook
    // failed. No state is latched, so the next start() retries the hook.
    try {
      await this._onStart?.({ sandbox: this, outcome });
    } catch (error) {
      this.status = 'error';
      throw new Error(`Sandbox '${this.id}' onStart hook failed: ${error instanceof Error ? error.message : error}`, {
        cause: error,
      });
    }

    // Process any pending mounts after successful start
    // Mount failures are tracked individually in MountManager and
    // shouldn't mark the sandbox itself as errored
    try {
      await this.mounts?.processPending();
    } catch (error) {
      // Mount failures are tracked in MountManager — log but don't affect sandbox status
      this.logger.warn('Unexpected error processing pending mounts', { error });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Acquisition primitives (optional — see start() for the rung ladder)
  // ---------------------------------------------------------------------------

  /**
   * Locate an existing VM/environment for this sandbox's logical id. Returns
   * a provider-native handle that {@link connect} adopts, or `undefined` when
   * nothing usable exists. Should avoid side effects where the provider's API
   * allows — this doubles as the existence peek consumers use to answer "does
   * a sandbox exist?" without provisioning one.
   */
  protected find?(): Promise<THandle | undefined>;

  /**
   * Adopt/wake/resume the handle {@link find} returned. Throwing fails
   * `start()` — providers whose "connect failure" should fall back to
   * creating fresh must implement that policy inside `find` (return
   * `undefined` on an unusable handle) rather than throwing here.
   */
  protected connect?(handle: THandle): Promise<void> | void;

  /**
   * Provision a fresh VM/environment for this sandbox's logical id.
   * Implementing this (without overriding `start()`) opts the provider into
   * base-orchestrated acquisition: find → connect → `{ outcome: 'connected' }`,
   * else create → `{ outcome: 'created' }` — the outcome is derived
   * structurally from which branch ran.
   */
  protected create?(): Promise<void> | void;

  /** Base-orchestrated acquisition (rung 1 — see {@link start}). */
  private async _acquire(): Promise<SandboxStartResult> {
    const handle = this.find ? await this.find() : undefined;
    if (handle != null) {
      await this.connect?.(handle);
      return { outcome: 'connected' };
    }
    await this.create!();
    return { outcome: 'created' };
  }

  /**
   * Sandbox startup. Providers plug in at one of three rungs (best available
   * wins); either way the base owns coalescing, status management, the
   * onStart setup hook, and mount processing:
   *
   * 1. Implement the {@link find}/{@link connect}/{@link create} primitives
   *    (and do NOT override `start()`) — the base orchestrates acquisition
   *    and derives the outcome structurally. For providers whose API
   *    decomposes into lookup/wake/provision.
   * 2. Override `start()` returning {@link SandboxStartResult} — for
   *    providers with a fused getOrCreate-style API where decomposition
   *    would add round-trips.
   * 3. Override `start()` returning void — the outcome is unknown.
   *
   * The base constructor wraps `start()` so direct calls are routed through
   * `_start()`. Use METHOD syntax when overriding — a class-field `start`
   * initializer would overwrite the wrapper.
   *
   * Id-keyed getOrCreate contract: a sandbox constructed with a known `id`
   * resolves that id on start — reconnect/resume when the provider finds an
   * existing VM for it, create otherwise. Note: E2B/Daytona/Local resolve
   * logical ids natively; PlatformSandbox and RailwaySandbox currently
   * reattach only via an explicit provider `sandboxId` hint (their
   * logical-id lookup is a follow-up).
   */
  async start(): Promise<SandboxStartResult | void> {
    // Default no-op — subclasses override start() or implement the
    // acquisition primitives (see the rung ladder above).
  }

  /**
   * Ensure the sandbox is running.
   *
   * Calls `_start()` if status is not 'running'. Useful for lazy initialization
   * where operations should automatically start the sandbox if needed.
   *
   * With the id-keyed getOrCreate contract (see {@link start}), this is the
   * "resolve my id to a runnable VM" entry point: reconnect/resume when the
   * provider finds an existing VM for this sandbox's id, create otherwise.
   *
   * @throws {SandboxNotReadyError} if the sandbox fails to reach 'running' status
   *
   * @example
   * ```typescript
   * async executeCommand(command: string): Promise<CommandResult> {
   *   await this.ensureRunning();
   *   // Now safe to use the sandbox
   * }
   * ```
   */
  async ensureRunning(): Promise<void> {
    // Already destroyed — cannot use this sandbox
    if (this.status === 'destroyed') {
      throw new SandboxNotReadyError(this.id);
    }
    // During teardown the sandbox is still operational (e.g. destroy()
    // may need to list/kill processes).  Allow operations to proceed
    // without trying to restart.
    if (this.status === 'destroying' || this.status === 'stopping') {
      return;
    }
    if (this.status !== 'running') {
      await this._start();
    }
    if (this.status !== 'running') {
      throw new SandboxNotReadyError(this.id);
    }
  }

  /**
   * Stop the sandbox (wrapper with status management and race-condition safety).
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management.
   *
   * Subclasses override `stop()` to provide their stop logic.
   */
  async _stop(): Promise<void> {
    // Already stopped
    if (this.status === 'stopped') {
      return;
    }

    // Wait for in-flight start before stopping
    if (this._startPromise) await this._startPromise.catch(() => {});

    // Stop already in progress - return existing promise
    if (this._stopPromise) {
      return this._stopPromise;
    }

    // Create and store the stop promise
    this._stopPromise = this._executeStop();

    try {
      await this._stopPromise;
    } finally {
      this._stopPromise = undefined;
    }
  }

  /**
   * Internal stop execution - handles status.
   */
  private async _executeStop(): Promise<void> {
    this.status = 'stopping';

    try {
      // Fire onStop callback before stopping
      await this._onStop?.({ sandbox: this });

      await this.stop();
      this.status = 'stopped';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Override this method to implement sandbox stop logic.
   *
   * Called by `_stop()` after status is set to 'stopping'.
   * Status will be set to 'stopped' on success, 'error' on failure.
   */
  async stop(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Destroy the sandbox and clean up all resources (wrapper with status management).
   *
   * This method is race-condition-safe - concurrent calls will return the same promise.
   * Handles status management.
   *
   * Subclasses override `destroy()` to provide their destroy logic.
   */
  async _destroy(): Promise<void> {
    // Already destroyed
    if (this.status === 'destroyed') {
      return;
    }

    // Never started — nothing to clean up
    if (this.status === 'pending') {
      this.status = 'destroyed';
      return;
    }

    // Wait for in-flight start/stop before destroying
    if (this._startPromise) await this._startPromise.catch(() => {});
    if (this._stopPromise) await this._stopPromise.catch(() => {});

    // Destroy already in progress - return existing promise
    if (this._destroyPromise) {
      return this._destroyPromise;
    }

    // Create and store the destroy promise
    this._destroyPromise = this._executeDestroy();

    try {
      await this._destroyPromise;
    } finally {
      this._destroyPromise = undefined;
    }
  }

  /**
   * Internal destroy execution - handles status.
   */
  private async _executeDestroy(): Promise<void> {
    this.status = 'destroying';

    try {
      // Fire onDestroy callback before destroying
      await this._onDestroy?.({ sandbox: this });

      await this.destroy();
      this.status = 'destroyed';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Override this method to implement sandbox destroy logic.
   *
   * Called by `_destroy()` after status is set to 'destroying'.
   * Status will be set to 'destroyed' on success, 'error' on failure.
   */
  async destroy(): Promise<void> {
    // Default no-op - subclasses override
  }

  // ---------------------------------------------------------------------------
  // Logger Propagation
  // ---------------------------------------------------------------------------

  /**
   * Override to propagate logger to MountManager.
   * @internal
   */
  override __setLogger(logger: IMastraLogger): void {
    super.__setLogger(logger);
    // Propagate to MountManager if it exists
    this.mounts?.__setLogger(logger);
  }
}
