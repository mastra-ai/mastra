/**
 * Vercel Sandbox Provider
 *
 * Creates ephemeral Linux microVMs via the @vercel/sandbox SDK.
 * Each sandbox is a full Firecracker VM with persistent filesystem,
 * real shell, sudo access, and support for background processes.
 *
 * @see https://vercel.com/docs/vercel-sandbox
 */

import type { RequestContext } from '@mastra/core/di';
import type {
  SandboxInfo,
  MastraSandboxOptions,
  ProviderStatus,
  InstructionsOption,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import type { Sandbox, NetworkPolicy } from '@vercel/sandbox';

import { VercelProcessManager } from './process-manager';

const LOG_PREFIX = '[VercelSandbox]';

// =============================================================================
// Options
// =============================================================================

export interface VercelSandboxOptions extends MastraSandboxOptions {
  /** Runtime image. @default 'node24' */
  runtime?: 'node24' | 'node22' | 'python3.13';
  /** Number of virtual CPUs. @default 2 */
  vcpus?: 1 | 2 | 4 | 8;
  /** Sandbox timeout in ms. @default 300000 (5 minutes) */
  timeout?: number;
  /** Ports to expose for public access via sandbox.domain(). */
  ports?: number[];
  /** Environment variables for commands in this sandbox. */
  env?: Record<string, string>;
  /** Network firewall policy. @default 'allow-all' */
  networkPolicy?: NetworkPolicy;
  /**
   * Custom instructions that override the default instructions
   * returned by `getInstructions()`.
   */
  instructions?: InstructionsOption;
}

// =============================================================================
// Implementation
// =============================================================================

export class VercelSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'VercelSandbox';
  readonly provider = 'vercel';
  status: ProviderStatus = 'pending';

  private readonly _runtime: NonNullable<VercelSandboxOptions['runtime']>;
  private readonly _vcpus: number;
  private readonly _timeout: number;
  private readonly _ports: number[];
  private readonly _env: Record<string, string>;
  private readonly _networkPolicy?: NetworkPolicy;
  private readonly _instructionsOverride?: InstructionsOption;

  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;

  constructor(options: VercelSandboxOptions = {}) {
    super({
      ...options,
      name: 'VercelSandbox',
      processes: new VercelProcessManager({ env: options.env ?? {} }),
    });

    this.id = `vercel-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._runtime = options.runtime ?? 'node24';
    this._vcpus = options.vcpus ?? 2;
    this._timeout = options.timeout ?? 300_000;
    this._ports = options.ports ?? [];
    this._env = options.env ?? {};
    this._networkPolicy = options.networkPolicy;
    this._instructionsOverride = options.instructions;
  }

  /**
   * Access the underlying @vercel/sandbox Sandbox instance.
   * Throws SandboxNotReadyError if the sandbox hasn't been started.
   */
  get vercel(): Sandbox {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sandbox;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this._sandbox) {
      return;
    }

    this.logger.debug(`${LOG_PREFIX} Creating Vercel Sandbox microVM...`);

    // Dynamic import — @vercel/sandbox is a peer/optional dependency
    const { Sandbox } = await import('@vercel/sandbox');

    this._sandbox = await Sandbox.create({
      runtime: this._runtime,
      resources: { vcpus: this._vcpus },
      timeout: this._timeout,
      ports: this._ports.length > 0 ? this._ports : undefined,
      env: Object.keys(this._env).length > 0 ? this._env : undefined,
      networkPolicy: this._networkPolicy,
    });

    this._createdAt = new Date();
    this.logger.debug(
      `${LOG_PREFIX} Sandbox ready: ${this._sandbox.sandboxId} (status: ${this._sandbox.status})`,
    );
  }

  async stop(): Promise<void> {
    if (this._sandbox) {
      try {
        await this._sandbox.stop();
      } catch (error) {
        this.logger.warn(`${LOG_PREFIX} Error stopping sandbox:`, error);
      }
      this._sandbox = null;
    }
  }

  async destroy(): Promise<void> {
    if (this._sandbox) {
      try {
        await this._sandbox.stop({ blocking: true });
      } catch (error) {
        this.logger.warn(`${LOG_PREFIX} Error destroying sandbox:`, error);
      }
      this._sandbox = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Info & Instructions
  // ---------------------------------------------------------------------------

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    if (this._instructionsOverride === undefined) return this._getDefaultInstructions();
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    const defaultInstructions = this._getDefaultInstructions();
    return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
  }

  private _getDefaultInstructions(): string {
    return [
      'Vercel Sandbox — ephemeral Linux microVM.',
      'Features:',
      '- Full Linux environment with persistent filesystem.',
      '- Real shell with sudo access.',
      '- Background processes supported (use detached mode).',
      `- Runtime: ${this._runtime}.`,
      '- Default working directory: /vercel/sandbox.',
      `- Timeout: ${this._timeout / 1000} seconds.`,
      this._ports.length > 0
        ? `- Exposed ports: ${this._ports.join(', ')} (accessible via sandbox.domain()).`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        sandboxId: this._sandbox?.sandboxId,
        runtime: this._runtime,
        vcpus: this._vcpus,
        timeout: this._timeout,
        vmStatus: this._sandbox?.status,
      },
    };
  }
}
