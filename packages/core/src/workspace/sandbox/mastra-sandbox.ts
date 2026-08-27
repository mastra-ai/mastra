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
import type { SandboxComputer, SandboxFileInput, SandboxNetworking, WorkspaceSandbox } from './sandbox';
import type { CommandResult, ExecuteCommandOptions, SandboxInfo } from './types';
import { shellQuote } from './utils';

/**
 * Lifecycle hook that fires during sandbox state transitions.
 * Receives the sandbox instance so users can call `executeCommand`, read files, etc.
 */
export type SandboxLifecycleHook = (args: { sandbox: WorkspaceSandbox }) => void | Promise<void>;

/**
 * Start hook: a {@link SandboxLifecycleHook} that additionally receives the
 * provider's {@link SandboxStartResult} `outcome`: `'created'` = this start
 * provisioned a fresh VM, `'connected'` = reconnected/resumed an existing
 * one, `undefined` = the provider doesn't report (not yet migrated).
 */
export type SandboxStartHook = (args: {
  sandbox: WorkspaceSandbox;
  outcome?: SandboxStartOutcome;
}) => void | Promise<void>;

/**
 * Options for the MastraSandbox base class constructor.
 * Providers extend this to add their own options while inheriting lifecycle hooks.
 */
export interface MastraSandboxOptions {
  /**
   * Called after the sandbox reaches 'running' status, before pending mounts
   * are processed. Fires on EVERY start regardless of trigger (explicit,
   * `ensureRunning()` from a lazy command, a revival after the VM was
   * replaced), which makes it the seam for once-per-VM setup: branch on
   * `outcome` and probe/run whatever the environment needs.
   *
   * A thrown error is FATAL: `start()` rejects and the sandbox is marked
   * `error`, and the next start retries the hook. (`onStop`/`onDestroy` stay
   * non-fatal, since teardown proceeds best-effort.)
   */
  onStart?: SandboxStartHook;
  /** Called before the sandbox stops */
  onStop?: SandboxLifecycleHook;
  /** Called before the sandbox is destroyed */
  onDestroy?: SandboxLifecycleHook;

  /**
   * Initial values for the sandbox's runtime environment overlay.
   *
   * These values are made visible to every command and spawned process
   * routed through the sandbox's process manager (which also backs the
   * built-in `executeCommand`), merged per spawn. This is an overlay, not
   * VM-level environment — providers may additionally consume their own
   * env options for creation-time semantics, and providers with custom
   * execution transports that bypass the process manager must consume the
   * overlay themselves. Update at runtime with `setEnv`.
   */
  env?: Record<string, string | undefined>;

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

  /** Optional computer-use (desktop) capability - implement to enable workspace computer tools */
  readonly computer?: SandboxComputer;

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

  /** The subclass's `start()`, captured before the constructor shadows it. */
  private readonly _implStart: () => void | Promise<SandboxStartResult | void>;

  /** Whether acquisition runs through {@link find}/{@link connect}/{@link create}. */
  private readonly _useAcquisitionPrimitives: boolean;

  /** Promise for _stop() to prevent race conditions from concurrent calls */
  protected _stopPromise?: Promise<void>;

  /** Promise for _destroy() to prevent race conditions from concurrent calls */
  protected _destroyPromise?: Promise<void>;

  /** Lifecycle callbacks */
  private _onStart?: SandboxStartHook;
  private readonly _onStop?: SandboxLifecycleHook;
  private readonly _onDestroy?: SandboxLifecycleHook;

  /**
   * Runtime environment overlay, merged into every process spawn.
   *
   * JS-private (`#`) rather than TS `private` so subclasses that declare
   * their own `env` member (several providers do) can never collide with it.
   */
  #env: Record<string, string | undefined>;

  constructor(options: { name: string } & MastraSandboxOptions) {
    super({ name: options.name, component: RegisteredLogger.WORKSPACE });

    this._onStart = options.onStart;
    this._onStop = options.onStop;
    this._onDestroy = options.onDestroy;
    this.#env = { ...options.env };

    // Shadow start() with the lifecycle wrapper (same pattern as
    // SandboxProcessManager) so DIRECT start() calls get the same coalescing,
    // status handling, and onStart hook as `_start()`/`ensureRunning()`.
    const hasStartOverride = this.start !== MastraSandbox.prototype.start;
    this._implStart = this.start.bind(this);
    this.start = () => this._start();
    // Rung selection: a subclass `start()` override wins; otherwise the
    // primitives drive acquisition when `create()` is implemented. Anything
    // declared as a class field is invisible here and lands on the base
    // `start()`, which throws.
    this._useAcquisitionPrimitives = !hasStartOverride && typeof this.create === 'function';
    // A handle nobody adopts would still report `outcome: 'connected'`, so the
    // sandbox would look reconnected while running against nothing.
    if (this._useAcquisitionPrimitives && typeof this.find === 'function' && typeof this.connect !== 'function') {
      throw new Error(`${this.constructor.name}: find() requires connect() to adopt the handle it returns.`);
    }

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
  // Runtime environment overlay
  // ---------------------------------------------------------------------------

  /**
   * Update the sandbox's runtime environment overlay.
   *
   * The updater receives a copy of the current overlay and returns the new
   * one, so a single call can set, unset, or batch-update variables:
   *
   * ```typescript
   * sandbox.setEnv(env => ({ ...env, GH_TOKEN: token }));
   * ```
   *
   * Changes apply immediately to subsequent commands and processes routed
   * through the sandbox's process manager (including the built-in
   * `executeCommand`), survive provider pause/resume and VM replacement,
   * and are never written into the VM — the overlay is merged per spawn,
   * not persisted. Removing a key removes it from the overlay only;
   * env values a provider supplies on its own still apply.
   */
  setEnv(update: (env: Record<string, string | undefined>) => Record<string, string | undefined>): void {
    // Clone both directions: the updater gets a copy, and its return value is
    // cloned before storage so callers retaining either object can't mutate
    // the stored overlay.
    this.#env = { ...update({ ...this.#env }) };
  }

  /**
   * Snapshot of the current runtime environment overlay.
   *
   * Returns a fresh copy — mutating it never affects the stored overlay; use
   * {@link setEnv} to change it. The process manager reads this per spawn to
   * merge the overlay into command environments.
   */
  getEnv(): Record<string, string | undefined> {
    return { ...this.#env };
  }

  /**
   * Attach or replace the start hook after construction. The updater receives
   * the installed hook and returns its replacement, so callers compose instead
   * of clobbering a hook they didn't know about; ignoring `prev` replaces it.
   *
   * ```typescript
   * sandbox.setOnStart(prev => async args => {
   *   await prev?.(args); // whatever prepared the sandbox runs first
   *   await mySetup(args);
   * });
   * ```
   *
   * Errors stay FATAL, so a throw stops the hooks after it. Each call wraps
   * the current hook, so attach once per sandbox or the work stacks.
   */
  setOnStart(update: (previous: SandboxStartHook | undefined) => SandboxStartHook): void {
    this._onStart = update(this._onStart);
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
    // Already running — definitionally not a fresh create. Reporting
    // 'connected' (rather than nothing) keeps every path through the wrapper
    // result-bearing for providers whose `start()` always reports one.
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

    // Start already in progress — join it and share its result. The slot is
    // cleared on settle, so a failed attempt is never latched.
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
      // Status must flip to 'running' BEFORE the onStart hook: hooks run
      // commands, which reach `ensureRunning()` and would otherwise join the
      // in-flight `_startPromise` and deadlock awaiting their own start.
      // Accepted window: commands fired concurrently with start() can
      // interleave with the hook, and a start() arriving DURING the hook takes
      // the already-running early return. Callers awaiting the ORIGINAL
      // start() always observe a sandbox whose hook finished.
      this.status = 'running';
    } catch (error) {
      this.status = 'error';
      throw error;
    }

    const outcome = result?.outcome;

    // Hook failures are FATAL: a caller must never observe a running sandbox
    // whose setup failed. Nothing latches, so the next start() retries it.
    // The environment acquired above is NOT released first: providers that
    // implement find() reconnect to it on retry, but a create-only provider
    // provisions another one and leaves the first to its idle timeout.
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
   * a provider-native handle for {@link connect} to adopt, or `undefined` when
   * nothing usable exists. Avoid side effects where the provider's API allows.
   */
  protected find?(): Promise<THandle | undefined>;

  /**
   * Adopt/wake/resume the handle {@link find} returned. Throwing fails
   * `start()`: a provider that should fall back to creating fresh puts that
   * policy in `find` (return `undefined` for an unusable handle) instead.
   */
  protected connect?(handle: THandle): Promise<void> | void;

  /**
   * Provision a fresh VM/environment for this sandbox's logical id.
   * Implementing this without overriding `start()` opts into base-orchestrated
   * acquisition, which derives the outcome from the branch that ran: find then
   * connect reports 'connected', create reports 'created'.
   */
  protected create?(): Promise<void> | void;

  /** Base-orchestrated acquisition (rung 1 — see {@link start}). */
  private async _acquire(): Promise<SandboxStartResult> {
    const handle = this.find ? await this.find() : undefined;
    if (handle != null) {
      // Checked rather than optional: adopting nothing would still report
      // 'connected'. The constructor rejects this pairing, but a `connect`
      // declared as a class field is invisible there.
      if (!this.connect) {
        throw new Error(`${this.constructor.name}: find() requires connect() to adopt the handle it returns.`);
      }
      await this.connect(handle);
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
   * initializer would overwrite the wrapper. Implementing neither rung throws:
   * a sandbox with nothing to start says so with an empty `async start() {}`.
   *
   * Id-keyed getOrCreate contract: a sandbox constructed with a known `id`
   * resolves that id on start — reconnect/resume when the provider finds an
   * existing VM for it, create otherwise.
   */
  async start(): Promise<SandboxStartResult | void> {
    // Also where a misspelled override and a class-FIELD `start`/`create` land,
    // since field initializers run too late for the constructor to see them.
    throw new Error(
      `${this.constructor.name} implements neither start() nor the create() acquisition primitive, so starting it would do nothing. Implement one using method syntax.`,
    );
  }

  /**
   * Ensure the sandbox is running.
   *
   * Calls `_start()` if status is not 'running'. Useful for lazy initialization
   * where operations should automatically start the sandbox if needed.
   *
   * This is the lazy entry point into the id-keyed getOrCreate contract
   * described on {@link start}.
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
