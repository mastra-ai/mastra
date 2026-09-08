/**
 * Workspace Sandbox Interface
 *
 * Defines the contract for sandbox providers that can be used with Workspace.
 * Users pass sandbox provider instances to the Workspace constructor.
 *
 * Sandboxes provide isolated environments for code and command execution.
 * They may have their own filesystem that's separate from the workspace FS.
 *
 * Built-in providers (via ComputeSDK):
 * - E2B: Cloud sandboxes
 * - Modal: GPU-enabled sandboxes
 * - Docker: Container-based execution
 * - Local: Development-only local execution
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';
 *
 * const workspace = new Workspace({
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
 * ```
 */

import type { RequestContext } from '../../request-context';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { MountResult } from '../filesystem/mount';
import type { SandboxLifecycle } from '../lifecycle';

export type { SandboxStartOutcome, SandboxStartResult } from '../lifecycle';

import type { SandboxStartHook } from './mastra-sandbox';
import type { MountManager } from './mount-manager';
import type { SandboxProcessManager } from './process-manager';
import type { CommandResult, ExecuteCommandOptions, SandboxInfo } from './types';

// =============================================================================
// Networking Capability
// =============================================================================

/**
 * Optional networking capability for sandboxes that can expose ports publicly.
 *
 * Providers that support public port exposure (Vercel Sandbox, E2B, Daytona,
 * Modal, Blaxel, etc.) implement this to surface public URLs through the
 * abstraction. Enables preview URLs and sandbox deploys.
 */
export interface SandboxNetworking {
  /**
   * Get the public URL for an exposed port.
   *
   * @param port - The port number inside the sandbox
   * @returns The public URL for the port, or null if the port is not exposed
   *   or the sandbox is not running
   */
  getPortUrl(port: number): Promise<string | null>;
}

/** A file to write into the sandbox filesystem via {@link WorkspaceSandbox.writeFiles}. */
export interface SandboxFileInput {
  /** Destination path inside the sandbox */
  path: string;
  /** File contents */
  content: string | Buffer;
}

/**
 * Type guard: does this sandbox support the networking capability?
 *
 * @example
 * ```typescript
 * if (supportsNetworking(sandbox)) {
 *   const url = await sandbox.networking.getPortUrl(4111);
 * }
 * ```
 */
export function supportsNetworking(
  sandbox: WorkspaceSandbox,
): sandbox is WorkspaceSandbox & { networking: SandboxNetworking } {
  return typeof sandbox.networking?.getPortUrl === 'function';
}

// =============================================================================
// Computer (Desktop) Capability
// =============================================================================

/** A screenshot of the sandbox's desktop display. */
export interface ComputerScreenshot {
  /** Raw image bytes */
  data: Uint8Array;
  /** Image media type (providers normalize to PNG) */
  mediaType: 'image/png';
}

/** Screen dimensions in pixels. */
export interface ComputerScreenSize {
  width: number;
  height: number;
}

/** A position on the sandbox's desktop display, in pixels from the top-left corner. */
export interface ComputerPosition {
  x: number;
  y: number;
}

/**
 * Optional computer-use (desktop) capability for sandboxes that run a GUI
 * desktop environment.
 *
 * Providers with a controllable display (Daytona Computer Use, E2B Desktop,
 * etc.) implement this to surface screenshot, mouse, and keyboard control
 * through the abstraction. When present on a statically configured workspace
 * sandbox, the workspace tools factory emits the
 * `mastra_workspace_computer_*` tools automatically. Resolver-backed sandboxes
 * do not register these tools because their capabilities are unavailable when
 * the tool list is constructed.
 *
 * Coordinates are in pixels from the top-left corner of the display.
 * Providers normalize their SDK semantics (key names, scroll units) onto
 * this surface and may expose richer native APIs via their own accessors.
 */
export interface SandboxComputer {
  /** Capture the current display as a PNG image. */
  screenshot(): Promise<ComputerScreenshot>;

  /** Left-click at the given coordinates. */
  leftClick(x: number, y: number): Promise<void>;

  /** Right-click at the given coordinates. */
  rightClick(x: number, y: number): Promise<void>;

  /** Double-click (left button) at the given coordinates. */
  doubleClick(x: number, y: number): Promise<void>;

  /** Move the mouse cursor to the given coordinates without clicking. */
  moveMouse(x: number, y: number): Promise<void>;

  /** Press the left button at `from`, drag to `to`, and release. */
  drag(from: ComputerPosition, to: ComputerPosition): Promise<void>;

  /**
   * Scroll the display.
   *
   * @param direction - Scroll direction
   * @param amount - Scroll amount in provider-normalized ticks (positive integer)
   */
  scroll(direction: 'up' | 'down', amount: number): Promise<void>;

  /** Type text into the focused element using the keyboard. */
  type(text: string): Promise<void>;

  /**
   * Press a key or key combination.
   *
   * A single string presses one key (e.g. `'Enter'`, `'Tab'`, `'a'`).
   * An array presses a chord/hotkey (e.g. `['ctrl', 's']`).
   */
  press(key: string | string[]): Promise<void>;

  /** Get the display dimensions. */
  getScreenSize(): Promise<ComputerScreenSize>;

  /** Get the current mouse cursor position. */
  getCursorPosition(): Promise<ComputerPosition>;

  /**
   * Get a URL for a live view of the desktop (e.g. noVNC), or null when
   * unavailable. Optional — not all providers expose a viewer.
   */
  streamUrl?(): Promise<string | null>;
}

/**
 * Type guard: does this sandbox support the computer-use (desktop) capability?
 *
 * @example
 * ```typescript
 * if (supportsComputer(sandbox)) {
 *   const { data } = await sandbox.computer.screenshot();
 * }
 * ```
 */
export function supportsComputer(
  sandbox: WorkspaceSandbox,
): sandbox is WorkspaceSandbox & { computer: SandboxComputer } {
  const computer = sandbox.computer;
  return (
    typeof computer?.screenshot === 'function' &&
    typeof computer.leftClick === 'function' &&
    typeof computer.rightClick === 'function' &&
    typeof computer.doubleClick === 'function' &&
    typeof computer.moveMouse === 'function' &&
    typeof computer.drag === 'function' &&
    typeof computer.scroll === 'function' &&
    typeof computer.type === 'function' &&
    typeof computer.press === 'function' &&
    typeof computer.getScreenSize === 'function' &&
    typeof computer.getCursorPosition === 'function'
  );
}

// =============================================================================
// Sandbox Derivation
// =============================================================================

/**
 * Options for cloning a configured sandbox's configuration into an independent
 * sibling sandbox. See {@link WorkspaceSandbox.clone}.
 */
export interface SandboxCloneOptions {
  /** Unique identifier for the sandbox clone instance. */
  id?: string;
  /**
   * Reattach to an existing provider sandbox (by the provider's own id)
   * instead of provisioning a new one.
   */
  sandboxId?: string;
  /** Environment variables baked into the sandbox clone. */
  env?: Record<string, string>;
  /** Provider working directory for the sandbox clone. */
  workingDirectory?: string;
  /** Idle teardown window (minutes) for the sandbox clone. */
  idleTimeoutMinutes?: number;
  /**
   * Named checkpoint (the persisted artifact written by `snapshot()`) used to
   * seed the sandbox clone on boot and preserve its state across restarts.
   * Providers without checkpoint support may ignore this option.
   */
  checkpointName?: string;
  /**
   * Fallback checkpoint used to seed the sandbox when `checkpointName` has no
   * stored state yet (e.g. a repo-level warm base checkpoint for a brand-new
   * session). Boot-only: `snapshot()` keeps writing to `checkpointName` and
   * never overwrites the seed.
   * Providers without checkpoint support may ignore this option.
   */
  seedCheckpointName?: string;
  /** Opaque user subject attributed to provider requests for this clone. */
  actingUserId?: string;
}

// =============================================================================
// Sandbox Interface
// =============================================================================

/**
 * Abstract sandbox interface for code and command execution.
 *
 * Providers implement this interface to provide execution capabilities.
 * Users instantiate providers and pass them to the Workspace constructor.
 *
 * Sandboxes provide isolated environments for running untrusted code.
 * They may have their own filesystem that's separate from the workspace FS.
 *
 * Lifecycle methods (from SandboxLifecycle interface) are all optional:
 * - start(): Begin operation (spin up instance)
 * - stop(): Pause operation (pause instance)
 * - destroy(): Clean up resources (terminate instance)
 * - isReady(): Check if ready for operations
 * - getInfo(): Get status and metadata
 */
export interface WorkspaceSandbox extends SandboxLifecycle<SandboxInfo> {
  /** Unique identifier for this sandbox instance */
  readonly id: string;

  /** Human-readable name (e.g., 'E2B Sandbox', 'Docker') */
  readonly name: string;

  /** Provider type identifier */
  readonly provider: string;

  /**
   * Capture the sandbox's current state as a checkpoint when the provider
   * supports it. Terminology: *snapshot* is the act of capturing; the named,
   * persisted artifact it writes is a *checkpoint*
   * (see `SandboxCloneOptions.checkpointName`).
   * Providers without checkpoint support resolve without performing work.
   */
  snapshot(): Promise<void>;

  /**
   * Whether `snapshot()` persists real checkpoints that can later seed a
   * sandbox (via `SandboxCloneOptions.checkpointName`). Providers whose
   * `snapshot()` is a no-op leave this unset/false so checkpoint-dependent
   * features (base checkpoints, boot-from-checkpoint, revival from
   * checkpoint) know to skip them.
   */
  readonly supportsCheckpoints?: boolean;

  /**
   * Get instructions describing how this sandbox works.
   * Used in tool descriptions to help agents understand execution context.
   *
   * @param opts - Optional options including request context for per-request customisation
   * @returns A string describing how to use this sandbox
   */
  getInstructions?(opts?: { requestContext?: RequestContext }): string;

  // ---------------------------------------------------------------------------
  // Cloning (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Construct an independent sibling sandbox that inherits this sandbox's
   * configuration (credentials, provider settings, defaults) with
   * per-instance overrides.
   *
   * Performs no I/O — the sandbox clone provisions (or reattaches, when
   * `sandboxId` is set) on its own `start()`. Implement this when one
   * configured sandbox should act as the template for a fleet of independent
   * sandboxes (e.g. one per project).
   *
   * Optional — consumers that need fleets (like the MastraCode web factory)
   * only support sandboxes that implement it.
   */
  clone?(options?: SandboxCloneOptions): WorkspaceSandbox;

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command and wait for it to complete.
   * Optional - if not implemented, the workspace_execute_command tool won't be available.
   *
   * @example
   * ```typescript
   * await sandbox.executeCommand('npm install');
   *
   * // With options
   * await sandbox.executeCommand('npm install', [], { timeout: 60000 });
   *
   * // With args array (each arg is shell-quoted automatically)
   * await sandbox.executeCommand('npm', ['install'], { timeout: 60000 });
   * ```
   *
   * @throws {SandboxExecutionError} if command fails to start
   * @throws {SandboxTimeoutError} if command times out
   */
  executeCommand?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  /**
   * Update the sandbox's runtime environment overlay.
   *
   * The updater receives a copy of the current overlay and returns the new
   * one. Values are made visible to subsequent commands and processes routed
   * through the sandbox's process manager; this is not VM-level environment.
   * Optional - available on sandboxes that support runtime env updates.
   *
   * @example
   * ```typescript
   * sandbox.setEnv(env => ({ ...env, GH_TOKEN: token }));
   * ```
   */
  setEnv?(update: (env: Record<string, string | undefined>) => Record<string, string | undefined>): void;

  /**
   * Attach or replace the sandbox's start hook after construction.
   *
   * The updater receives the currently installed hook and returns the one to
   * install, so callers compose rather than clobber. The hook runs inside every
   * start, and a thrown error fails that start. Only starts beginning after the
   * call see the new hook.
   * Optional - available on sandboxes that support runtime hook updates.
   *
   * @example
   * ```typescript
   * sandbox.setOnStart(prev => async args => {
   *   await runSetup(args);
   *   await prev?.(args);
   * });
   * ```
   */
  setOnStart?(update: (previous: SandboxStartHook | undefined) => SandboxStartHook): void;

  // ---------------------------------------------------------------------------
  // Networking (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Networking capability for sandboxes that can expose ports publicly.
   * Optional - only available on providers that support public port exposure.
   * Enables preview URLs and sandbox deploys.
   *
   * @example
   * ```typescript
   * const url = await sandbox.networking?.getPortUrl(4111);
   * ```
   */
  readonly networking?: SandboxNetworking;

  // ---------------------------------------------------------------------------
  // Computer Use (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Computer-use (desktop) capability for sandboxes with a GUI desktop.
   * Optional - only available on providers with a controllable display.
   * When present, workspace computer tools (screenshot/click/type/…) are
   * emitted automatically.
   *
   * @example
   * ```typescript
   * const { data } = await sandbox.computer?.screenshot();
   * ```
   */
  readonly computer?: SandboxComputer;

  // ---------------------------------------------------------------------------
  // File Upload (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Bulk-write files into the sandbox's own filesystem.
   * Optional fast path - providers with a native file-upload API implement this.
   * Callers should fall back to `executeCommand` when unavailable.
   *
   * @example
   * ```typescript
   * await sandbox.writeFiles?.([{ path: '/app/index.mjs', content: bundle }]);
   * ```
   */
  writeFiles?(files: SandboxFileInput[]): Promise<void>;

  // ---------------------------------------------------------------------------
  // Process Management (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Process manager.
   * Optional - if not implemented, process management tools won't be available.
   *
   * Provides methods to spawn long-running processes, list them, and interact
   * with them via their {@link ProcessHandle} (kill, sendStdin, wait, read output).
   *
   * @example
   * ```typescript
   * const handle = await sandbox.processes.spawn('node server.js');
   * console.log(handle.pid);
   *
   * const procs = await sandbox.processes.list();
   * const proc = await sandbox.processes.get(handle.pid);
   * await proc?.sendStdin('hello\n');
   * await proc?.kill();
   * ```
   */
  readonly processes?: SandboxProcessManager;

  // ---------------------------------------------------------------------------
  // Mounting Support (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Mount manager for tracking and processing filesystem mounts.
   * Only available if the sandbox implements mount().
   *
   * @example
   * ```typescript
   * // Add pending mounts
   * sandbox.mounts?.add({ '/data': s3fs });
   *
   * // Check mount entries
   * const entries = sandbox.mounts?.entries;
   * ```
   */
  readonly mounts?: MountManager;

  /**
   * Mount a filesystem at a path in the sandbox.
   * Uses FUSE tools (s3fs, gcsfuse) to mount cloud storage.
   *
   * @param filesystem - The filesystem to mount
   * @param mountPath - Path in the sandbox where filesystem should be mounted
   * @returns Mount result with success status and mount path
   * @throws {MountError} if mount fails
   * @throws {MountNotSupportedError} if sandbox doesn't support mounting
   * @throws {FilesystemNotMountableError} if filesystem cannot be mounted
   */
  mount?(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult>;

  /**
   * Unmount a filesystem from a path in the sandbox.
   *
   * @param mountPath - Path to unmount
   */
  unmount?(mountPath: string): Promise<void>;
}
