/**
 * Workspace Lifecycle Interfaces
 *
 * Defines lifecycle contracts for workspace providers (filesystem, sandbox).
 * The base `Lifecycle` holds shared members while `FilesystemLifecycle` and
 * `SandboxLifecycle` add the methods each provider kind actually uses.
 */

// =============================================================================
// Base Lifecycle Interface
// =============================================================================

/**
 * Shared lifecycle base for workspace providers.
 *
 * Contains status tracking, destroy, readiness check, and info retrieval.
 * Provider-specific lifecycle methods live in the extended interfaces:
 * - {@link FilesystemLifecycle} adds `init()`
 * - {@link SandboxLifecycle} adds `start()` / `stop()`
 *
 * @typeParam TInfo - The type returned by getInfo() (e.g., FilesystemInfo, SandboxInfo)
 */
export interface Lifecycle<TInfo = unknown> {
  /** Current status */
  status: ProviderStatus;

  /** Error message when status is 'error' */
  error?: string;

  /**
   * Clean up all resources.
   *
   * Called when the workspace is being permanently shut down.
   * Use for operations like:
   * - Terminating cloud instances
   * - Closing all connections
   * - Cleaning up temporary files
   */
  destroy?(): void | Promise<void>;

  /** @deprecated Use `status === 'running'` instead. */
  isReady?(): boolean | Promise<boolean>;

  /**
   * Get status and metadata.
   *
   * Returns information about the current state of the provider.
   */
  getInfo?(): TInfo | Promise<TInfo>;
}

// =============================================================================
// Filesystem Lifecycle
// =============================================================================

/**
 * Lifecycle interface for filesystem providers (two-phase: init → destroy).
 *
 * @typeParam TInfo - The type returned by getInfo()
 */
export interface FilesystemLifecycle<TInfo = unknown> extends Lifecycle<TInfo> {
  /**
   * One-time setup operations.
   *
   * Called once when the workspace is first initialized.
   * Use for operations like:
   * - Creating base directories
   * - Setting up database tables
   * - Provisioning cloud resources
   * - Installing dependencies
   */
  init?(): void | Promise<void>;
}

// =============================================================================
// Sandbox Lifecycle
// =============================================================================

/**
 * Lifecycle interface for sandbox providers (three-phase: start → stop → destroy).
 *
 * @typeParam TInfo - The type returned by getInfo()
 */
export interface SandboxLifecycle<TInfo = unknown> extends Lifecycle<TInfo> {
  /**
   * Begin active operation.
   *
   * Called to transition from initialized to running state.
   * Use for operations like:
   * - Establishing connection pools
   * - Spinning up cloud instances
   * - Starting background processes
   * - Warming up caches
   */
  start?(): void | Promise<void>;

  /**
   * Pause operation, keeping state for potential restart.
   *
   * Called to temporarily stop without full cleanup.
   * Use for operations like:
   * - Closing connections (but keeping config)
   * - Pausing cloud instances
   * - Flushing buffers
   */
  stop?(): void | Promise<void>;
}

// =============================================================================
// Status Types
// =============================================================================

/**
 * Common status values for stateful providers.
 *
 * Not all providers need status tracking - local/stateless providers
 * may not use this. But providers with connection pools or cloud
 * instances can use these states.
 */
export type ProviderStatus =
  | 'pending' // Created but not initialized
  | 'initializing' // Running init()
  | 'ready' // Initialized, waiting to start (or stateless and ready)
  | 'starting' // Running start()
  | 'running' // Active and accepting requests
  | 'stopping' // Running stop()
  | 'stopped' // Stopped but can restart
  | 'destroying' // Running destroy()
  | 'destroyed' // Fully cleaned up
  | 'error'; // Something went wrong

// =============================================================================
// Lifecycle Helper
// =============================================================================

/**
 * Provider that may have lifecycle methods.
 * Used by `callLifecycle` to dispatch to the correct method.
 */
interface LifecycleProvider {
  _init?(): void | Promise<void>;
  _start?(): void | Promise<void>;
  _stop?(): void | Promise<void>;
  _destroy?(): void | Promise<void>;
  init?(): void | Promise<void>;
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
  destroy?(): void | Promise<void>;
}

/**
 * Call a lifecycle method on a provider, preferring the `_`-prefixed wrapper
 * (which adds status tracking & race-condition safety) when available,
 * falling back to the plain method for interface-only implementations.
 *
 * @example
 * ```typescript
 * await callLifecycle(sandbox, 'start');   // calls sandbox._start() ?? sandbox.start()
 * await callLifecycle(filesystem, 'init'); // calls filesystem._init() ?? filesystem.init()
 * ```
 */
export async function callLifecycle(
  provider: LifecycleProvider,
  method: 'init' | 'start' | 'stop' | 'destroy',
): Promise<void> {
  const wrapped = `_${method}` as const;
  const wrappedFn = provider[wrapped];
  if (typeof wrappedFn === 'function') {
    await wrappedFn.call(provider);
  } else {
    const plainFn = provider[method];
    if (typeof plainFn === 'function') {
      await plainFn.call(provider);
    }
  }
}
