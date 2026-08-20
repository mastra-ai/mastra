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
import type { ProviderStatus, SandboxStartResult } from '../lifecycle';
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
 * For `onStart`, `created` carries the provider's {@link SandboxStartResult}:
 * `true` = this start provisioned a fresh VM, `false` = reconnected/resumed,
 * `undefined` = the provider doesn't report (not yet migrated).
 */
export type SandboxLifecycleHook = (args: { sandbox: WorkspaceSandbox; created?: boolean }) => void | Promise<void>;

/**
 * Basename of the bootstrap sentinel file. The default remote location is
 * `$HOME/<basename>`; LocalSandbox keeps it relative to its working directory.
 * Exported so hosts running a sentinel-guarded bootstrap themselves (e.g. the
 * factory fallback) guard the exact same path as {@link MastraSandbox}.
 */
export const SANDBOX_BOOTSTRAP_SENTINEL_BASENAME = '.mastra-bootstrapped';

/**
 * Options for the MastraSandbox base class constructor.
 * Providers extend this to add their own options while inheriting lifecycle hooks.
 */
export interface MastraSandboxOptions {
  /** Called after the sandbox reaches 'running' status */
  onStart?: SandboxLifecycleHook;
  /** Called before the sandbox stops */
  onStop?: SandboxLifecycleHook;
  /** Called before the sandbox is destroyed */
  onDestroy?: SandboxLifecycleHook;

  /**
   * Command run once per VM lifetime, after the first successful start of a
   * freshly created sandbox. Survives pause/resume (not re-run); re-runs on a
   * replacement VM. `env` is merged into the command's execution env only —
   * never baked into the VM (this is the channel for short-lived tokens).
   *
   * Requires the provider to implement the find/connect/create acquisition
   * primitives — the bootstrap is driven by the base's structural knowledge
   * of which branch ran (the constructor throws otherwise). The create
   * branch runs the command directly; the connect branch probes a sentinel
   * file first, so a VM whose bootstrap previously failed (or a crash
   * between create and bootstrap-complete) gets another attempt. The
   * sentinel is written only after the command succeeds; a bootstrap
   * failure rejects `start()` and marks the sandbox errored.
   */
  bootstrap?: { command: string; env?: Record<string, string>; timeoutMs?: number };

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

  /** Once-per-VM bootstrap command. See {@link MastraSandboxOptions.bootstrap}. */
  private readonly _bootstrap?: MastraSandboxOptions['bootstrap'];

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
    this._bootstrap = options.bootstrap;

    // Wrap start() with the lifecycle path (same pattern as
    // SandboxProcessManager): capture the subclass's prototype `start()` and
    // shadow it with an instance property delegating to `_start()`, so DIRECT
    // `start()` calls get the same coalescing/status/bootstrap safety as
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

    // The once-per-VM bootstrap is driven by the base's structural knowledge
    // of whether acquisition created or reconnected — only the primitives
    // path has that. Fail loudly rather than silently never bootstrapping.
    if (this._bootstrap && !this._useAcquisitionPrimitives) {
      throw new Error(
        `Sandbox '${options.name}' was given a bootstrap command, but bootstrap requires the ` +
          `find/connect/create acquisition primitives (a start() override opts out of base-orchestrated ` +
          `acquisition). Migrate the provider to the primitives or run setup yourself after start().`,
      );
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
    // `created: false` (keeps concretely-typed provider `start()` signatures
    // sound: every path through the wrapper yields a result for providers
    // whose impl always reports one).
    if (this.status === 'running') {
      return { created: false };
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
    // share the attempt's SandboxStartResult (all observe `created: true`
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
   * Internal start execution - handles status, bootstrap, and mount processing.
   */
  private async _executeStart(): Promise<SandboxStartResult | void> {
    this.status = 'starting';

    let result: SandboxStartResult | void;
    try {
      result = this._useAcquisitionPrimitives ? await this._acquire() : await this._implStart();
      // Status must flip to 'running' BEFORE the bootstrap runs: the bootstrap
      // executes through `executeCommand` → `pm.spawn` → `ensureRunning()`,
      // which would otherwise join the in-flight `_startPromise` and deadlock
      // awaiting its own start. This opens a (new, accepted) window where
      // commands fired concurrently with start() — without awaiting it — can
      // run during bootstrap, and where a start() call arriving DURING the
      // bootstrap hits the already-running early return (which must precede
      // the join check: an onStart hook calling start() would deadlock
      // otherwise) and resolves before the bootstrap completes. Callers that
      // await the ORIGINAL start() always observe a fully bootstrapped VM.
      this.status = 'running';
    } catch (error) {
      this.status = 'error';
      throw error;
    }

    const created = result?.created;

    if (this._bootstrap) {
      try {
        await this._runBootstrapOnce({ skipSentinel: created === true });
      } catch (error) {
        // A half-bootstrapped VM must not report running; no sentinel was
        // written, so the next start() re-attempts the bootstrap.
        this.status = 'error';
        throw error;
      }
    }

    // Fire onStart callback after sandbox is running — treat failure as non-fatal
    // so that a bad callback doesn't kill an otherwise healthy sandbox
    try {
      await this._onStart?.({ sandbox: this, created });
    } catch (error) {
      this.logger.warn('onStart callback failed', { error });
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
   * base-orchestrated acquisition: find → connect → `{ created: false }`,
   * else create → `{ created: true }` — the `created` flag is derived
   * structurally from which branch ran.
   */
  protected create?(): Promise<void> | void;

  /** Base-orchestrated acquisition (rung 1 — see {@link start}). */
  private async _acquire(): Promise<SandboxStartResult> {
    const handle = this.find ? await this.find() : undefined;
    if (handle != null) {
      await this.connect?.(handle);
      return { created: false };
    }
    await this.create!();
    return { created: true };
  }

  /**
   * Sentinel file marking a VM as bootstrapped. Quoted into shell commands,
   * so `$HOME` expands in the remote shell. LocalSandbox overrides this to a
   * working-directory-relative path — host `$HOME` is shared across local
   * sandboxes and would collide.
   */
  protected get bootstrapSentinelPath(): string {
    return `$HOME/${SANDBOX_BOOTSTRAP_SENTINEL_BASENAME}`;
  }

  /**
   * Probe whether the bootstrap sentinel exists. The base implementation runs
   * a POSIX `test -f` over the sandbox exec path, which is correct for the
   * Linux VMs remote providers manage. Providers with a native files API (or
   * host-filesystem access, like LocalSandbox) can override this to skip the
   * shell round-trip and stay OS-independent. A failed probe reads as
   * "absent" — worst case the (idempotent) bootstrap re-runs.
   */
  protected async probeBootstrapSentinel(): Promise<boolean> {
    if (!this.executeCommand) return false;
    const probe = await this.executeCommand(`test -f "${this.bootstrapSentinelPath}"`);
    return probe.exitCode === 0;
  }

  /**
   * Write the bootstrap sentinel after a successful bootstrap. Base
   * implementation is a shell `touch`; same override seam as
   * {@link probeBootstrapSentinel}. Failures are non-fatal to the caller —
   * throw freely, `_runBootstrapOnce` downgrades it to a warning.
   */
  protected async writeBootstrapSentinel(): Promise<void> {
    if (!this.executeCommand) return;
    const touch = await this.executeCommand(`touch "${this.bootstrapSentinelPath}"`);
    if (touch.exitCode !== 0) {
      throw new Error(`touch exited with ${touch.exitCode}`);
    }
  }

  /**
   * Whether both sentinel operations are the base shell implementations —
   * when they are, the guarded bootstrap folds probe + command + marker
   * write into a single exec. An override of either (LocalSandbox's host-fs
   * ops, a provider using native metadata) takes the decomposed path so the
   * override is actually honored.
   */
  private get _sentinelOpsAreShell(): boolean {
    return (
      this.probeBootstrapSentinel === MastraSandbox.prototype.probeBootstrapSentinel &&
      this.writeBootstrapSentinel === MastraSandbox.prototype.writeBootstrapSentinel
    );
  }

  /**
   * Run the configured bootstrap command once per VM lifetime.
   *
   * `skipSentinel` is set on the create branch (the base just provisioned
   * this VM — definitely fresh, no probe). The connect branch probes first,
   * so a VM whose bootstrap previously failed (or a crash between create and
   * bootstrap-complete) gets another attempt. The sentinel is written only
   * after success; a sentinel-write failure is non-fatal (the idempotent
   * bootstrap merely re-runs on a future reconnect).
   */
  private async _runBootstrapOnce({ skipSentinel }: { skipSentinel: boolean }): Promise<void> {
    const bootstrap = this._bootstrap;
    if (!bootstrap) return;
    if (!this.executeCommand) {
      throw new Error(`Sandbox '${this.id}' has a bootstrap command but no executeCommand implementation`);
    }

    const execOpts = {
      ...(bootstrap.env && { env: bootstrap.env }),
      ...(bootstrap.timeoutMs !== undefined && { timeout: bootstrap.timeoutMs }),
    };

    if (this._sentinelOpsAreShell) {
      // Single-exec path: guard, command, and marker in one shell invocation.
      // The command's own exit code is preserved; a failed marker write is
      // ignored (same non-fatal semantics as the decomposed path).
      const sentinel = this.bootstrapSentinelPath;
      const guard = skipSentinel ? '' : `if [ -f "${sentinel}" ]; then exit 0; fi\n`;
      const script = `${guard}{\n${bootstrap.command}\n}\nrc=$?\n[ "$rc" -eq 0 ] && touch "${sentinel}" 2>/dev/null\nexit "$rc"`;
      this.logger.debug('Running sandbox bootstrap command', { sandbox: this.name });
      const result = await this.executeCommand(script, undefined, execOpts);
      if (result.exitCode !== 0) {
        const stderr = (result.stderr ?? '').slice(-2000);
        throw new Error(`Sandbox bootstrap command failed (exit ${result.exitCode}): ${stderr}`);
      }
      return;
    }

    if (!skipSentinel && (await this.probeBootstrapSentinel())) {
      this.logger.debug('Bootstrap sentinel present — skipping bootstrap', { sandbox: this.name });
      return;
    }

    this.logger.debug('Running sandbox bootstrap command', { sandbox: this.name });
    const result = await this.executeCommand(bootstrap.command, undefined, execOpts);
    if (result.exitCode !== 0) {
      const stderr = (result.stderr ?? '').slice(-2000);
      throw new Error(`Sandbox bootstrap command failed (exit ${result.exitCode}): ${stderr}`);
    }

    try {
      await this.writeBootstrapSentinel();
    } catch (error) {
      // Non-fatal: bootstrap succeeded; a missing sentinel only means the
      // (idempotent) bootstrap may re-run on a future reconnect.
      this.logger.warn('Failed to write bootstrap sentinel', { sandbox: this.name, error });
    }
  }

  /**
   * Sandbox startup. Providers plug in at one of three rungs (best available
   * wins); either way the base owns coalescing, status management, the
   * once-per-VM bootstrap, and mount processing:
   *
   * 1. Implement the {@link find}/{@link connect}/{@link create} primitives
   *    (and do NOT override `start()`) — the base orchestrates acquisition
   *    and derives `created` structurally. For providers whose API
   *    decomposes into lookup/wake/provision.
   * 2. Override `start()` returning {@link SandboxStartResult} — for
   *    providers with a fused getOrCreate-style API where decomposition
   *    would add round-trips.
   * 3. Override `start()` returning void — `created` is unknown; the
   *    bootstrap sentinel probe covers correctness.
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
