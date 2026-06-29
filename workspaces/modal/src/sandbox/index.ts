/**
 * @see https://modal.com/docs/reference/modal.Sandbox
 */

import type { MastraSandboxOptions, ProviderStatus, SandboxInfo } from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { ClientClosedError, ModalClient, NotFoundError } from 'modal';
import type { App, Image, Sandbox } from 'modal';
import { ModalProcessManager } from './process-manager';

const LOG_PREFIX = '[ModalSandbox]';

// =============================================================================
// Options
// =============================================================================

type InstructionsOption = string | ((opts: { defaultInstructions: string }) => string);

/**
 * Modal sandbox provider configuration.
 */
export interface ModalSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Stable name for this sandbox. Reusing the same id reconnects to a running sandbox. */
  id?: string;
  /**
   * Modal App name to associate sandboxes with.
   *
   * @default 'mastra'
   */
  appName?: string;
  /**
   * Docker image to use for the sandbox.
   *
   * @default 'ubuntu:22.04'
   */
  baseImage?: string;
  /**
   * Wall-clock max lifetime in milliseconds. The sandbox is terminated when this expires,
   * regardless of activity. Modal's maximum is 24 hours (86_400_000).
   *
   * @default 300_000 // 5 minutes
   */
  timeoutMs?: number;
  /** Environment variables baked into the sandbox at create time. */
  env?: Record<string, string>;
  /** Default working directory inside the sandbox. */
  workdir?: string;
  /** Modal token ID. Falls back to MODAL_TOKEN_ID env var. */
  tokenId?: string;
  /** Modal token secret. Falls back to MODAL_TOKEN_SECRET env var. */
  tokenSecret?: string;
  /** Custom instructions for getInstructions(). String replaces the default; function receives it. */
  instructions?: InstructionsOption;
}

// =============================================================================
// ModalSandbox
// =============================================================================

/**
 * Modal cloud sandbox provider for Mastra workspaces.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { ModalSandbox } from '@mastra/modal';
 *
 * const sandbox = new ModalSandbox({
 *   baseImage: 'ubuntu:22.04',
 *   timeoutMs: 60_000,
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * const result = await workspace.executeCommand('echo hello');
 * ```
 */
export class ModalSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'ModalSandbox';
  readonly provider = 'modal';
  status: ProviderStatus = 'pending';

  declare readonly processes: ModalProcessManager;

  private _sb: Sandbox | null = null;
  private _imageSnapshot: Image | null = null; // for stop-and-resume
  private _client: ModalClient | null = null;
  private _createdAt: Date | null = null;
  private _isRetrying = false;

  private readonly appName: string;
  private readonly baseImage: string;
  private readonly timeoutMs: number;
  private readonly env: Record<string, string>;
  private readonly workdir?: string;
  private readonly tokenId?: string;
  private readonly tokenSecret?: string;
  private readonly _instructionsOverride?: InstructionsOption;

  constructor(options: ModalSandboxOptions = {}) {
    super({
      ...options,
      name: 'ModalSandbox',
      processes: new ModalProcessManager({ env: options.env ?? {} }),
    });

    this.id = options.id ?? this._generateId();
    this.appName = options.appName ?? 'mastra';
    this.baseImage = options.baseImage ?? 'ubuntu:22.04';
    this.timeoutMs = options.timeoutMs ?? 300_000;
    this.env = options.env ?? {};
    this.workdir = options.workdir;
    this.tokenId = options.tokenId;
    this.tokenSecret = options.tokenSecret;
    this._instructionsOverride = options.instructions;
  }

  /**
   * Get the underlying Modal Sandbox instance for direct SDK access.
   *
   * @throws {SandboxNotReadyError} If the sandbox has not been started.
   */
  get modal(): Sandbox {
    if (!this._sb) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sb;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Reconnects to a running sandbox with this id if one exists, otherwise creates a new one. */
  async start(): Promise<void> {
    if (this._sb) {
      return;
    }

    const client = this._getClient();

    try {
      this._sb = await client.sandboxes.fromName(this.appName, this.id);
      this._createdAt = new Date();
      this.logger.debug(`${LOG_PREFIX} Reconnected to running sandbox: ${this.id}`);
      return;
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    const app: App = await client.apps.fromName(this.appName, { createIfMissing: true });

    if (this._imageSnapshot) {
      this.logger.debug(`${LOG_PREFIX} Rebooting from snapshot: ${this.id}`);
      this._sb = await client.sandboxes.create(app, this._imageSnapshot, {
        name: this.id,
        timeoutMs: this.timeoutMs,
        env: Object.keys(this.env).length > 0 ? this.env : undefined,
        workdir: this.workdir,
      });
      this._createdAt = new Date();
      this.logger.debug(`${LOG_PREFIX} Created new sandbox from snapshot: ${this._sb?.sandboxId}`);
      return;
    }

    const image: Image = client.images.fromRegistry(this.baseImage);
    this.logger.debug(`${LOG_PREFIX} Creating sandbox: ${this.id} (baseImage: ${this.baseImage})`);
    this._sb = await client.sandboxes.create(app, image, {
      name: this.id,
      timeoutMs: this.timeoutMs,
      env: Object.keys(this.env).length > 0 ? this.env : undefined,
      workdir: this.workdir,
    });
    this._createdAt = new Date();
    this.logger.debug(`${LOG_PREFIX} Created sandbox: ${this._sb.sandboxId}`);
  }

  /**
   * Snapshot the sandbox filesystem before terminating it.
   * Future starts will create net-new sandboxes from the snapshot.
   */
  async stop(): Promise<void> {
    if (!this._sb) return;

    try {
      const procs = await this.processes.list();
      await Promise.all(procs.filter(p => p.running).map(p => this.processes.kill(p.pid)));
    } catch {
      // Best-effort: sandbox may already be dead
    }

    try {
      this._imageSnapshot = await this._sb.snapshotFilesystem();
      this.logger.debug(`${LOG_PREFIX} Snapshot created: ${this._imageSnapshot.imageId}`);
    } catch (error) {
      this.logger.debug(`${LOG_PREFIX} Snapshot failed, terminating without snapshot:`, error);
    }

    try {
      await this._sb.terminate({ wait: true });
      this.logger.debug(`${LOG_PREFIX} Sandbox terminated: ${this._sb.sandboxId}`);
      this._sb = null;
    } catch (error) {
      // Best-effort: sandbox may already be dead
      if (this.isSandboxDeadError(error)) {
        this._sb = null;
      } else {
        throw error;
      }
    }
  }

  /** Terminates the sandbox, ending its lifetime. Unlike stop(), no snapshot is preserved. */
  async destroy(): Promise<void> {
    if (this._sb) {
      try {
        const procs = await this.processes.list();
        await Promise.all(procs.filter(p => p.running).map(p => this.processes.kill(p.pid)));
      } catch {
        // Best-effort: sandbox may already be dead
      }

      try {
        await this._sb.terminate();
        this.logger.debug(`${LOG_PREFIX} Sandbox terminated: ${this._sb.sandboxId}`);
      } catch {
        // Ignore errors during destroy
      }

      this._sb = null;
    }

    this._imageSnapshot = null;
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        appName: this.appName,
        image: this._imageSnapshot?.imageId ?? this.baseImage,
        timeoutMs: this.timeoutMs,
      },
    };
  }

  getInstructions(): string {
    const defaultInstructions = this._getDefaultInstructions();
    if (this._instructionsOverride === undefined) return defaultInstructions;
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return this._instructionsOverride({ defaultInstructions });
  }

  private _getDefaultInstructions(): string {
    return `Modal cloud sandbox running ${this.baseImage}. Use executeCommand() to run shell commands.`;
  }

  // ---------------------------------------------------------------------------
  // Dead-sandbox Retry
  // ---------------------------------------------------------------------------

  private isSandboxDeadError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof ClientClosedError) return true;
    if (error instanceof NotFoundError) return true;
    const errorStr = String(error);
    return (
      errorStr.includes('sandbox not found') ||
      errorStr.includes('has been terminated') ||
      errorStr.includes('already completed') ||
      errorStr.includes('was cancelled') ||
      // gRPC NOT_FOUND (code 5)
      /status[:\s]+5\b/.test(errorStr) ||
      errorStr.includes('NOT_FOUND')
    );
  }

  private handleSandboxDead(): void {
    this._sb = null;
    this.status = 'stopped';
  }

  /** @internal Retries fn() once after restarting if the sandbox is dead. */
  async retryOnDead<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.isSandboxDeadError(error) && !this._isRetrying) {
        this.handleSandboxDead();
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
    return `modal-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private _getClient(): ModalClient {
    if (!this._client) {
      this._client = new ModalClient({
        ...(this.tokenId && { tokenId: this.tokenId }),
        ...(this.tokenSecret && { tokenSecret: this.tokenSecret }),
      });
    }
    return this._client;
  }
}
