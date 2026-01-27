/**
 * Shared Lifecycle Interface
 *
 * Defines common lifecycle methods for workspace providers (filesystem, sandbox).
 * All methods are optional - implementations provide what they need.
 */

// =============================================================================
// Lifecycle Interface
// =============================================================================

/**
 * Common lifecycle interface for workspace providers.
 *
 * Both filesystem and sandbox providers can implement any of these methods
 * based on their requirements. The Workspace class will call available
 * methods in the appropriate order.
 *
 * @typeParam TInfo - The type returned by getInfo() (e.g., FilesystemInfo, SandboxInfo)
 *
 * @example
 * ```typescript
 * // A simple local provider might only implement init
 * class LocalFilesystem implements WorkspaceFilesystem {
 *   async init() {
 *     await fs.mkdir(this.basePath, { recursive: true });
 *   }
 * }
 *
 * // A cloud provider might implement the full lifecycle
 * class CloudSandbox implements WorkspaceSandbox {
 *   async init() { // provision template }
 *   async start() { // spin up instance }
 *   async stop() { // pause instance }
 *   async destroy() { // terminate instance }
 *   async isReady() { return this.status === 'running'; }
 *   async getInfo() { return { ...metadata }; }
 * }
 * ```
 */
export interface Lifecycle<TInfo = unknown> {
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
  init?(): Promise<void>;

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
  start?(): Promise<void>;

  /**
   * Pause operation, keeping state for potential restart.
   *
   * Called to temporarily stop without full cleanup.
   * Use for operations like:
   * - Closing connections (but keeping config)
   * - Pausing cloud instances
   * - Flushing buffers
   */
  stop?(): Promise<void>;

  /**
   * Clean up all resources.
   *
   * Called when the workspace is being permanently shut down.
   * Use for operations like:
   * - Terminating cloud instances
   * - Closing all connections
   * - Cleaning up temporary files
   */
  destroy?(): Promise<void>;

  /**
   * Check if ready for operations.
   *
   * Returns true if the provider is ready to handle requests.
   * Use for checking:
   * - Connection health
   * - Instance status
   * - Resource availability
   */
  isReady?(): Promise<boolean>;

  /**
   * Get status and metadata.
   *
   * Returns information about the current state of the provider.
   */
  getInfo?(): Promise<TInfo>;
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
