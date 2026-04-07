/**
 * Runloop Devbox sandbox provider for Mastra workspaces.
 *
 * @see https://docs.runloop.ai
 */

import type { RequestContext } from '@mastra/core/di';
import {
  MastraSandbox,
  SandboxNotReadyError
  
  
  
} from '@mastra/core/workspace';
import type {MastraSandboxOptions, ProviderStatus, SandboxInfo} from '@mastra/core/workspace';
import type { Devbox, Runloop, SDKDevboxCreateParams } from '@runloop/api-client';
import { RunloopSDK } from '@runloop/api-client';
import type { DevboxCreateParams } from '@runloop/api-client/resources';

import { RunloopProcessManager } from './process-manager';

const LOG_PREFIX = '[RunloopSandbox]';

type InstructionsOption =
  | string
  | ((opts: { defaultInstructions: string; requestContext?: RequestContext }) => string);

export interface RunloopSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Mastra logical sandbox id */
  id?: string;
  /** API key; defaults to RUNLOOP_API_KEY */
  apiKey?: string;
  /** API base URL; defaults to RUNLOOP_BASE_URL */
  baseURL?: string | null;
  /** HTTP client timeout (ms) for Runloop SDK requests */
  clientTimeout?: number;
  /**
   * Default long-poll timeout (ms) for async execution result() / command completion.
   * @default 300_000
   */
  timeout?: number;
  /** Devbox display name (Runloop); defaults derived from Mastra id */
  devboxName?: string;
  /** Passed to devbox creation as environment_variables */
  env?: Record<string, string>;
  /** Devbox metadata (string map per Runloop API) */
  metadata?: Record<string, string>;
  blueprintId?: string | null;
  blueprintName?: string | null;
  snapshotId?: string | null;
  /**
   * Extra create params merged into SDK devbox.create* (excludes mounts/secrets/gateways —
   * use Runloop directly for those).
   */
  createParams?: Omit<SDKDevboxCreateParams, 'name' | 'environment_variables' | 'metadata' | 'mounts' | 'secrets' | 'gateways' | 'mcp'>;
  instructions?: InstructionsOption;
}

export class RunloopSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'RunloopSandbox';
  readonly provider = 'runloop';

  declare readonly processes: RunloopProcessManager;

  status: ProviderStatus = 'pending';

  private readonly _sdk: RunloopSDK;
  private _devbox: Devbox | null = null;
  private _suspendedDevboxId: string | null = null;
  private _createdAt: Date | null = null;
  private _isRetrying = false;

  private readonly _timeout: number;
  private readonly _devboxName: string;
  private readonly _defaultEnv: Record<string, string>;
  private readonly _metadata: Record<string, string>;
  private readonly _blueprintId?: string | null;
  private readonly _blueprintName?: string | null;
  private readonly _snapshotId?: string | null;
  private readonly _createParams: Omit<
    SDKDevboxCreateParams,
    'name' | 'environment_variables' | 'metadata' | 'mounts' | 'secrets' | 'gateways' | 'mcp'
  >;
  private readonly _instructionsOverride?: InstructionsOption;

  constructor(options: RunloopSandboxOptions = {}) {
    super({
      name: 'RunloopSandbox',
      onStart: options.onStart,
      onStop: options.onStop,
      onDestroy: options.onDestroy,
      processes: new RunloopProcessManager({ env: options.env }),
    });

    this.id = options.id ?? this.generateId();
    this._timeout = options.timeout ?? 300_000;
    this._devboxName = options.devboxName ?? `mastra-${this.id}`.slice(0, 120);
    this._defaultEnv = options.env ?? {};
    this._metadata = options.metadata ?? {};
    this._blueprintId = options.blueprintId;
    this._blueprintName = options.blueprintName;
    this._snapshotId = options.snapshotId;
    this._createParams = options.createParams ?? {};
    this._instructionsOverride = options.instructions;

    const bearerToken = options.apiKey ?? process.env.RUNLOOP_API_KEY;
    if (!bearerToken?.trim()) {
      throw new Error(`${LOG_PREFIX} Missing API key. Set RUNLOOP_API_KEY or pass apiKey in options.`);
    }

    this._sdk = new RunloopSDK({
      bearerToken,
      baseURL: options.baseURL ?? process.env.RUNLOOP_BASE_URL ?? undefined,
      timeout: options.clientTimeout,
    });
  }

  /** Low-level Runloop API client (for sendStdIn, etc.). */
  get runloopApi(): Runloop {
    return this._sdk.api;
  }

  /** Active Devbox instance after start. */
  getRunloopDevbox(): Devbox {
    if (!this._devbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._devbox;
  }

  /** Runloop devbox id when provisioned (running or suspended). */
  get runloopDevboxId(): string | null {
    return this._devbox?.id ?? this._suspendedDevboxId;
  }

  /**
   * Shut down the remote devbox without running full Mastra destroy (for integration tests
   * simulating external termination / retry recovery).
   */
  async shutdownRunloopDevboxOnly(): Promise<void> {
    const id = this._devbox?.id ?? this._suspendedDevboxId;
    if (!id) return;
    try {
      await this._sdk.devbox.fromId(id).shutdown();
    } catch {
      // ignore — devbox may already be gone
    }
    this._devbox = null;
    this._suspendedDevboxId = null;
  }

  get defaultCommandTimeout(): number {
    return this._timeout;
  }

  private generateId(): string {
    return `runloop-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildCreateParams(): DevboxCreateParams {
    return {
      ...this._createParams,
      name: this._devboxName,
      environment_variables: { ...this._defaultEnv },
      metadata: Object.keys(this._metadata).length > 0 ? { ...this._metadata } : undefined,
    };
  }

  private async provisionDevbox(): Promise<Devbox> {
    const params = this.buildCreateParams();
    if (this._snapshotId) {
      return this._sdk.devbox.createFromSnapshot(this._snapshotId, params);
    }
    if (this._blueprintId) {
      return this._sdk.devbox.createFromBlueprintId(this._blueprintId, params);
    }
    if (this._blueprintName) {
      return this._sdk.devbox.createFromBlueprintName(this._blueprintName, params);
    }
    return this._sdk.devbox.create(params);
  }

  async start(): Promise<void> {
    if (this._devbox) {
      return;
    }

    if (this._suspendedDevboxId) {
      const d = this._sdk.devbox.fromId(this._suspendedDevboxId);
      await d.resume({ longPoll: { timeoutMs: this._timeout } });
      this._devbox = d;
      this._suspendedDevboxId = null;
      this.logger.debug(`${LOG_PREFIX} Resumed devbox ${this._devbox.id} for ${this.id}`);
      return;
    }

    this.logger.debug(`${LOG_PREFIX} Creating devbox for ${this.id}...`);
    this._devbox = await this.provisionDevbox();
    this._createdAt = new Date();
    this.logger.debug(`${LOG_PREFIX} Devbox ${this._devbox.id} ready for ${this.id}`);
  }

  async stop(): Promise<void> {
    try {
      const procs = await this.processes.list();
      await Promise.all(procs.map(p => this.processes.kill(p.pid).catch(() => {})));
    } catch {
      // best-effort
    }

    if (this._devbox) {
      try {
        await this._devbox.suspend();
        await this._devbox.awaitSuspended({ longPoll: { timeoutMs: this._timeout } });
        this._suspendedDevboxId = this._devbox.id;
      } catch (e) {
        this.logger.warn(`${LOG_PREFIX} suspend failed`, { error: e });
        this._suspendedDevboxId = this._devbox.id;
      }
      this._devbox = null;
    }
  }

  async destroy(): Promise<void> {
    try {
      const procs = await this.processes.list();
      await Promise.all(procs.map(p => this.processes.kill(p.pid).catch(() => {})));
    } catch {
      // best-effort
    }

    const id = this._devbox?.id ?? this._suspendedDevboxId;
    if (id) {
      try {
        const d = this._sdk.devbox.fromId(id);
        await d.shutdown();
      } catch {
        // ignore
      }
    }

    this._devbox = null;
    this._suspendedDevboxId = null;
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        runloopDevboxId: this.runloopDevboxId ?? undefined,
      },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    if (this._instructionsOverride === undefined) return this.defaultInstructions();
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return this._instructionsOverride({
      defaultInstructions: this.defaultInstructions(),
      requestContext: opts?.requestContext,
    });
  }

  private defaultInstructions(): string {
    return `Commands run on a Runloop Devbox (isolated Linux environment). Workspace filesystem mounts are not bridged into this sandbox; use Runloop devbox configuration for code or data at startup if needed.`;
  }

  /**
   * Retry an operation once if the devbox appears terminated (idle timeout, external shutdown).
   */
  async retryOnDead<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.isDevboxGoneError(error) && !this._isRetrying) {
        this._devbox = null;
        this._suspendedDevboxId = null;
        this._isRetrying = true;
        try {
          this.processes.clearTracked();
          await this.ensureRunning();
          return await fn();
        } finally {
          this._isRetrying = false;
        }
      }
      throw error;
    }
  }

  private isDevboxGoneError(error: unknown): boolean {
    const s = String(error instanceof Error ? error.message : error);
    return (
      /shutdown/i.test(s) ||
      /not found/i.test(s) ||
      /404/i.test(s) ||
      /suspended/i.test(s) ||
      /not running/i.test(s)
    );
  }
}
