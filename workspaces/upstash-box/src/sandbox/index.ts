/**
 * Upstash Box Sandbox Provider
 *
 * An Upstash Box implementation for Mastra workspaces. Box is a managed cloud
 * sandbox for AI coding agents with streaming command execution, file I/O, git,
 * and snapshots.
 *
 * @see https://upstash.com/docs/box
 */

import type { MastraSandboxOptions, ProviderStatus, SandboxInfo } from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { Box, BoxError } from '@upstash/box';
import type { BoxSize, NetworkPolicy, Runtime } from '@upstash/box';
import { UpstashBoxProcessManager } from './process-manager';

const LOG_PREFIX = '[UpstashBoxSandbox]';

/** Max time to wait for a reconnected box to leave a transitional state. */
const RECONNECT_MAX_WAIT_MS = 120_000;
/** Poll interval while waiting for a reconnected box to become usable. */
const RECONNECT_POLL_MS = 2_000;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

type InstructionsOption = string | ((opts: { defaultInstructions: string }) => string);

// =============================================================================
// Options
// =============================================================================

/**
 * Upstash Box sandbox provider configuration.
 */
export interface UpstashBoxSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Logical identifier for this sandbox instance (local; not the Box id). */
  id?: string;
  /**
   * Reconnect to an existing Box by its server-side id instead of creating a
   * new one. Also set after the first `start()` so stop→start reuses the box.
   */
  boxId?: string;
  /** API key for authentication. Falls back to the `UPSTASH_BOX_API_KEY` env var. */
  apiKey?: string;
  /** API base URL. Falls back to `UPSTASH_BOX_BASE_URL` or the SDK default. */
  baseUrl?: string;
  /**
   * Runtime preinstalled in the box.
   * @default 'node'
   */
  runtime?: Runtime;
  /**
   * Resource size of the box.
   * @default 'small'
   */
  size?: BoxSize;
  /**
   * Keep the box alive instead of letting it idle-pause. Keep-alive boxes
   * cannot be paused, so `stop()` becomes a no-op for them.
   * @default false
   */
  keepAlive?: boolean;
  /** Environment variables baked into the box at create time. */
  env?: Record<string, string>;
  /** Default working directory for spawned commands. */
  workdir?: string;
  /** Network access policy controlling outbound connectivity. */
  networkPolicy?: NetworkPolicy;
  /** GitHub `owner/repo` skills to install on the box. */
  skills?: string[];
  /**
   * Default command timeout in milliseconds, applied to spawned commands that
   * don't specify their own. When omitted, commands run until they exit. Matches
   * the `timeout` semantics of the Daytona/Railway/E2B providers.
   */
  timeout?: number;
  /**
   * Request timeout in milliseconds for Box API calls (create/get/exec).
   * @default 600_000 // 10 minutes
   */
  requestTimeout?: number;
  /** Enable Box SDK debug logging. */
  debug?: boolean;
  /** Custom instructions for getInstructions(). String replaces the default; function receives it. */
  instructions?: InstructionsOption;
}

// =============================================================================
// UpstashBoxSandbox
// =============================================================================

/**
 * Upstash Box cloud sandbox provider for Mastra workspaces.
 *
 * Features:
 * - Isolated cloud sandbox via the Upstash Box SDK
 * - Streaming shell command execution
 * - Resource sizing (small / medium / large) and runtime selection
 * - Network policy and skill installation
 * - Reconnect-by-id with pause/resume lifecycle
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { UpstashBoxSandbox } from '@mastra/upstash-box';
 *
 * const sandbox = new UpstashBoxSandbox({
 *   runtime: 'node',
 *   size: 'small',
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * await workspace.init();
 * const result = await workspace.sandbox.executeCommand('echo', ['hello']);
 * ```
 *
 * @example Reconnecting to an existing box
 * ```typescript
 * const sandbox = new UpstashBoxSandbox({ boxId: 'box_abc123' });
 * ```
 */
export class UpstashBoxSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'UpstashBoxSandbox';
  readonly provider = 'upstash-box';
  status: ProviderStatus = 'pending';

  declare readonly processes: UpstashBoxProcessManager;

  private _box: Box | null = null;
  private _boxId?: string;
  private _createdAt: Date | null = null;
  private _isRetrying = false;

  private readonly apiKey?: string;
  private readonly baseUrl?: string;
  private readonly runtime: Runtime;
  private readonly size: BoxSize;
  private readonly keepAlive: boolean;
  private readonly env: Record<string, string>;
  private readonly workdir?: string;
  private readonly networkPolicy?: NetworkPolicy;
  private readonly skills?: string[];
  private readonly requestTimeout: number;
  private readonly debug: boolean;
  private readonly _instructionsOverride?: InstructionsOption;
  /** Whether `id` was auto-generated (and thus unique) vs. user-supplied. */
  private readonly _idWasGenerated: boolean;

  constructor(options: UpstashBoxSandboxOptions = {}) {
    super({
      ...options,
      name: 'UpstashBoxSandbox',
      processes: new UpstashBoxProcessManager({
        env: options.env ?? {},
        workdir: options.workdir,
        defaultTimeout: options.timeout,
      }),
    });

    this._idWasGenerated = options.id === undefined;
    this.id = options.id ?? this._generateId();
    this._boxId = options.boxId;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.runtime = options.runtime ?? 'node';
    this.size = options.size ?? 'small';
    this.keepAlive = options.keepAlive ?? false;
    this.env = options.env ?? {};
    this.workdir = options.workdir;
    this.networkPolicy = options.networkPolicy;
    this.skills = options.skills;
    this.requestTimeout = options.requestTimeout ?? 600_000;
    this.debug = options.debug ?? false;
    this._instructionsOverride = options.instructions;
  }

  /**
   * The underlying Box instance, for direct access to Box APIs not surfaced
   * through the WorkspaceSandbox interface (files, git, snapshots, etc.).
   *
   * @throws {SandboxNotReadyError} If the sandbox has not been started.
   */
  get box(): Box {
    if (!this._box) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._box;
  }

  /** The server-side Box id, available once the sandbox has started. */
  get remoteId(): string | undefined {
    return this._boxId;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start the box. Reconnects to an existing box when a `boxId` is known
   * (option or a prior start), otherwise creates a fresh one.
   */
  async start(): Promise<void> {
    if (this._box) {
      return;
    }

    const connOpts = {
      ...(this.apiKey !== undefined && { apiKey: this.apiKey }),
      ...(this.baseUrl !== undefined && { baseUrl: this.baseUrl }),
    };

    // Try to reconnect to a known box first.
    if (this._boxId) {
      try {
        const existing = await Box.get(this._boxId, {
          ...connOpts,
          timeout: this.requestTimeout,
          debug: this.debug,
        });

        if (await this.waitForUsableBox(existing)) {
          this._box = existing;
          this._createdAt = new Date();
          this.logger.debug(`${LOG_PREFIX} Reconnected to box ${this._boxId} for: ${this.id}`);
          return;
        }

        // Box is gone/unusable — fall through to create a fresh one.
        this.logger.debug(`${LOG_PREFIX} Box ${this._boxId} is not usable, creating a fresh one`);
        this._boxId = undefined;
      } catch (error) {
        if (!this.isBoxGoneError(error)) {
          throw error;
        }
        this.logger.debug(`${LOG_PREFIX} Box ${this._boxId} no longer exists, creating a fresh one`);
        this._boxId = undefined;
      }
    }

    this.logger.debug(`${LOG_PREFIX} Creating box for: ${this.id}`);
    try {
      this._box = await Box.create({
        ...connOpts,
        name: this.id,
        runtime: this.runtime,
        size: this.size,
        keepAlive: this.keepAlive,
        ...(Object.keys(this.env).length > 0 && { env: this.env }),
        ...(this.networkPolicy && { networkPolicy: this.networkPolicy }),
        ...(this.skills?.length && { skills: this.skills }),
        timeout: this.requestTimeout,
        debug: this.debug,
      });
    } catch (error) {
      // The server may have provisioned the box before the failure surfaced
      // (e.g. readiness polling threw) without returning its id. We can only
      // identify it by name — which is safe to delete ONLY when the id was
      // auto-generated (and therefore unique to this instance). A user-supplied
      // id may be shared by concurrent instances, so deleting by name could nuke
      // a sibling's live box — warn instead.
      if (this._idWasGenerated) {
        await this.cleanupOrphanByName(connOpts).catch(() => {});
      } else {
        this.logger.warn(
          `${LOG_PREFIX} Box.create failed; a box named "${this.id}" may have been orphaned. Not auto-deleting because the id was user-supplied (it may be shared by other instances) — remove it manually if needed.`,
        );
      }
      throw error;
    }
    this._boxId = this._box.id;
    this._createdAt = new Date();
    this.logger.debug(`${LOG_PREFIX} Created box ${this._box.id} for logical id: ${this.id}`);
  }

  /**
   * Stop the box, releasing compute while preserving state so a later `start()`
   * can resume it. Keep-alive boxes cannot be paused, so this becomes a no-op
   * that just drops the local reference.
   */
  async stop(): Promise<void> {
    if (!this._box) return;

    if (!this.keepAlive) {
      try {
        await this._box.pause();
        this.logger.debug(`${LOG_PREFIX} Paused box ${this._box.id}`);
      } catch (error) {
        // Best-effort — box may already be paused or gone.
        this.logger.debug(`${LOG_PREFIX} Pause failed (non-fatal):`, error);
      }
    }

    // Keep `_boxId` so start() can reconnect.
    this._box = null;
  }

  /**
   * Destroy the box permanently and clear all state.
   */
  async destroy(): Promise<void> {
    const box = this._box;
    if (box) {
      try {
        await box.delete();
        this.logger.debug(`${LOG_PREFIX} Deleted box ${box.id}`);
      } catch {
        // Ignore errors during cleanup.
      }
    } else if (this._boxId) {
      // Orphan cleanup: start() may have stored a box id then failed; delete it
      // so it doesn't leak.
      try {
        await Box.delete({
          boxIds: this._boxId,
          ...(this.apiKey !== undefined && { apiKey: this.apiKey }),
          ...(this.baseUrl !== undefined && { baseUrl: this.baseUrl }),
        });
      } catch {
        // Best-effort — box may not exist or may already be gone.
      }
    }

    this._box = null;
    this._boxId = undefined;
  }

  /** Whether the sandbox is ready for operations. */
  async isReady(): Promise<boolean> {
    return this.status === 'running' && this._box !== null;
  }

  /** Information about the current state of the sandbox. */
  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        runtime: this.runtime,
        size: this.size,
        keepAlive: this.keepAlive,
        ...(this._boxId && { boxId: this._boxId }),
      },
    };
  }

  /**
   * Instructions describing this sandbox. Used by agents to understand the
   * execution environment.
   */
  getInstructions(): string {
    const defaultInstructions = this._getDefaultInstructions();
    if (this._instructionsOverride === undefined) return defaultInstructions;
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return this._instructionsOverride({ defaultInstructions });
  }

  private _getDefaultInstructions(): string {
    const parts = [
      `Upstash Box cloud sandbox (${this.runtime} runtime, ${this.size} size).`,
      'Use executeCommand() to run shell commands.',
    ];
    if (this.workdir) {
      parts.push(`Default working directory: ${this.workdir}.`);
    }
    return parts.join(' ');
  }

  // ---------------------------------------------------------------------------
  // Dead-box Retry
  // ---------------------------------------------------------------------------

  /** True when an error indicates the box no longer exists / is gone. */
  private isBoxGoneError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof BoxError && error.statusCode === 404) return true;
    const errorStr = String(error);
    return (
      errorStr.includes('not found') ||
      errorStr.includes('does not exist') ||
      errorStr.includes('has been deleted')
    );
  }

  private handleBoxDead(): void {
    this._box = null;
    this.status = 'stopped';
  }

  /**
   * Execute a function, retrying once if the box is found to be gone.
   * Used by the process manager to handle stale boxes transparently.
   * @internal
   */
  async retryOnDead<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.isBoxGoneError(error) && !this._isRetrying) {
        // The stored box is gone — drop the id so we create a fresh one.
        this._boxId = undefined;
        this.handleBoxDead();
        this._isRetrying = true;
        try {
          await this.ensureRunning();
          return await fn();
        } finally {
          this._isRetrying = false;
        }
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private _generateId(): string {
    return `box-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Wait for a reconnected box to reach a usable state before handing it back,
   * so commands don't fire against a box that's still provisioning.
   *
   * - `running` / `idle` → usable
   * - `paused` → resume once, then keep polling until it settles
   * - `creating` → poll until it settles
   * - `deleted` / `error` → not usable (caller creates a fresh box)
   *
   * @returns true if the box is usable, false if it's gone and should be recreated.
   */
  private async waitForUsableBox(box: Box): Promise<boolean> {
    const deadline = Date.now() + RECONNECT_MAX_WAIT_MS;
    let resumed = false;

    while (true) {
      const { status } = await box.getStatus();

      if (status === 'deleted' || status === 'error') {
        return false;
      }
      if (status === 'running' || status === 'idle') {
        return true;
      }
      // Resuming a paused box may fail for a real reason (auth, quota, backend) —
      // let that propagate rather than silently treating the box as usable.
      if (status === 'paused' && !resumed) {
        await box.resume();
        resumed = true;
        continue; // re-check immediately
      }

      // Still 'creating' (or transitioning out of 'paused') — wait for it to settle.
      if (Date.now() >= deadline) {
        throw new Error(
          `${LOG_PREFIX} Timed out waiting for box ${box.id} to become usable (still "${status}" after ${RECONNECT_MAX_WAIT_MS}ms)`,
        );
      }
      await sleep(RECONNECT_POLL_MS);
    }
  }

  /**
   * Best-effort cleanup of an orphaned box left by a failed Box.create().
   * Deletes boxes named for this sandbox. Only called when the id was
   * auto-generated (hence unique to this instance), so this can't collide with
   * another instance's box.
   */
  private async cleanupOrphanByName(conn: { apiKey?: string; baseUrl?: string }): Promise<void> {
    const boxes = await Box.list(conn);
    const orphanIds = boxes.filter(b => b.name === this.id).map(b => b.id);
    if (orphanIds.length > 0) {
      this.logger.debug(`${LOG_PREFIX} Cleaning up ${orphanIds.length} orphaned box(es) named "${this.id}"`);
      await Box.delete({ ...conn, boxIds: orphanIds });
    }
  }
}
