/**
 * islo Sandbox Provider
 *
 * Wraps `@islo-labs/sdk` with the Mastra `WorkspaceSandbox` contract. Token
 * exchange uses the control API, while sandbox operations use the compute API.
 * Lifecycle:
 *
 *  - start    → `sandboxes.createSandbox` (or reconnect to an existing
 *               sandbox by name, idempotent)
 *  - stop     → `sandboxes.pauseSandbox` (record retained, sandbox paused)
 *  - destroy  → `sandboxes.deleteSandbox` (sandbox marked for deletion)
 *  - executeCommand → POST `/sandboxes/{name}/exec/stream`, parse SSE,
 *                     dispatch stdout/stderr deltas to callbacks.
 *
 * The `executeCommand` path bypasses the SDK's generated stream wrapper so
 * callers see live output. Auth still comes from the SDK's `TokenProvider` so
 * refresh stays consistent.
 */

import { IsloApiClient, TokenProvider } from '@islo-labs/sdk';
import { MastraSandbox } from '@mastra/core/workspace';
import type {
  CommandResult,
  ExecuteCommandOptions,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxInfo,
} from '@mastra/core/workspace';

import { consumeIsloStream } from './sse';

const ENV_API_KEY = 'ISLO_API_KEY';
const ENV_CONTROL_URL = 'ISLO_CONTROL_URL';
const ENV_COMPUTE_URL = 'ISLO_COMPUTE_URL';
const DEFAULT_CONTROL_URL = 'https://api.islo.dev';
const DEFAULT_COMPUTE_URL = 'https://ca.compute.islo.dev';
type IsloSandboxCreatePayload = Parameters<IsloApiClient['sandboxes']['createSandbox']>[0] & {
  metadata?: Record<string, unknown>;
};

/**
 * Configuration for an `IsloSandbox` instance.
 */
export interface IsloSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Mastra-side instance ID. Auto-generated if omitted. */
  id?: string;
  /**
   * islo sandbox name. Used as the path segment for sandbox API calls.
   * If omitted, a fresh `mastra-<random>` name is generated. Reusing a name
   * across runs reconnects to the existing sandbox if it is still live.
   */
  sandboxName?: string;
  /** Container image (e.g. `docker.io/library/ubuntu:24.04`). */
  image?: string;
  /** Working directory relative to `/workspace` inside the sandbox. */
  workdir?: string;
  /** Gateway profile name or ID. Falls back to tenant default if omitted. */
  gatewayProfile?: string;
  /** Environment variables injected at sandbox-create time. */
  env?: Record<string, string>;
  /**
   * islo API key (Descope access key). Falls back to `ISLO_API_KEY` env var.
   */
  apiKey?: string;
  /**
   * Control API URL used for token exchange. Falls back to `ISLO_CONTROL_URL`,
   * then `https://api.islo.dev`.
   */
  controlUrl?: string;
  /**
   * Compute API URL used for sandbox lifecycle, files, and exec operations.
   * Falls back to `ISLO_COMPUTE_URL`, then `https://ca.compute.islo.dev`.
   */
  computeUrl?: string;
  /** Delete the sandbox record on destroy. Defaults to true. */
  deleteOnDestroy?: boolean;
  /** Sandbox-create metadata. */
  metadata?: Record<string, unknown>;
  /** Default per-command timeout in milliseconds. */
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 300_000;

export class IsloSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'IsloSandbox';
  readonly provider = 'islo';
  status: ProviderStatus = 'pending';

  private readonly client: IsloApiClient;
  private readonly tokenProvider: TokenProvider;
  private readonly controlUrl: string;
  private readonly computeUrl: string;
  private readonly sandboxName: string;
  private readonly image?: string;
  private readonly workdir?: string;
  private readonly gatewayProfile?: string;
  private readonly env: Record<string, string>;
  private readonly metadata: Record<string, unknown>;
  private readonly defaultTimeoutMs: number;
  private readonly deleteOnDestroy: boolean;

  private _createdAt: Date | null = null;

  constructor(options: IsloSandboxOptions = {}) {
    super({ ...options, name: 'IsloSandbox' });

    const apiKey = options.apiKey ?? process.env[ENV_API_KEY];
    if (!apiKey) {
      throw new Error(
        `IsloSandbox: missing ${ENV_API_KEY}; set the env var or pass { apiKey } to the constructor`,
      );
    }
    const controlUrl = (options.controlUrl ?? process.env[ENV_CONTROL_URL] ?? DEFAULT_CONTROL_URL).replace(/\/$/, '');
    const computeUrl = (options.computeUrl ?? process.env[ENV_COMPUTE_URL] ?? DEFAULT_COMPUTE_URL).replace(/\/$/, '');

    this.id = options.id ?? generateIsloSandboxInstanceId();
    this.sandboxName = options.sandboxName ?? generateSandboxName();
    this.image = options.image;
    this.workdir = options.workdir;
    this.gatewayProfile = options.gatewayProfile;
    this.env = options.env ?? {};
    this.metadata = options.metadata ?? {};
    this.defaultTimeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.deleteOnDestroy = options.deleteOnDestroy ?? true;
    this.controlUrl = controlUrl;
    this.computeUrl = computeUrl;

    this.tokenProvider = new TokenProvider({ apiKey, baseUrl: controlUrl });
    this.client = new IsloApiClient({
      apiKey: () => this.tokenProvider.getToken(),
      environment: computeUrl,
      baseUrl: computeUrl,
    });
  }

  /**
   * Direct access to the underlying `@islo-labs/sdk` client for
   * features not surfaced through the `WorkspaceSandbox` contract (e.g.
   * snapshots, sessions, file transfer).
   */
  get islo(): IsloApiClient {
    return this.client;
  }

  /** Sandbox name used in the islo API path. */
  get name_(): string {
    return this.sandboxName;
  }

  override async start(): Promise<void> {
    // Reconnect to an existing live sandbox with this name if present.
    const existing = await this.findExistingSandbox();
    if (existing) {
      if (existing.resume) {
        this.logger.debug(`resuming existing islo sandbox ${this.sandboxName}`);
        const resumed = await this.client.sandboxes.resumeSandbox({ sandbox_name: this.sandboxName });
        this._createdAt = resumed.created_at ? new Date(resumed.created_at) : existing.createdAt;
      } else {
        this._createdAt = existing.createdAt;
      }
      this.logger.debug(`reconnected to existing islo sandbox ${this.sandboxName}`);
      return;
    }

    this.logger.debug(`creating islo sandbox ${this.sandboxName}`);
    const createPayload: IsloSandboxCreatePayload = {
      name: this.sandboxName,
      image: this.image,
      workdir: this.workdir,
      gateway_profile: this.gatewayProfile,
      env: nullifyValues(this.env),
      metadata: emptyToUndefined(this.metadata),
    };
    const created = await this.client.sandboxes.createSandbox(createPayload);
    this._createdAt = created.created_at ? new Date(created.created_at) : new Date();
  }

  override async stop(): Promise<void> {
    try {
      await this.client.sandboxes.pauseSandbox({ sandbox_name: this.sandboxName });
    } catch (err) {
      // Stop is best-effort; log and continue. The destroy path will clean up.
      this.logger.warn(`islo pause failed for ${this.sandboxName}`, { error: serializeError(err) });
    }
  }

  override async destroy(): Promise<void> {
    if (!this.deleteOnDestroy) {
      return;
    }
    try {
      await this.client.sandboxes.deleteSandbox({ sandbox_name: this.sandboxName });
    } catch (err) {
      this.logger.warn(`islo delete failed for ${this.sandboxName}`, { error: serializeError(err) });
    }
  }

  override async getInfo(): Promise<SandboxInfo> {
    const info: SandboxInfo = {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        sandboxName: this.sandboxName,
        controlUrl: this.controlUrl,
        computeUrl: this.computeUrl,
        ...this.metadata,
      },
    };
    return info;
  }

  override async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    await this.ensureRunning();

    const fullCommand = args.length > 0 ? [command, ...args] : [command];
    const startTime = Date.now();
    const timeoutMs = options.timeout ?? this.defaultTimeoutMs;
    const cwd = options.cwd ?? this.workdir;
    const envOverride = options.env ? mergeEnv(this.env, options.env) : this.env;

    const url = `${this.computeUrl}/sandboxes/${encodeURIComponent(this.sandboxName)}/exec/stream`;
    const token = await this.tokenProvider.getToken();
    const timeoutSecs = timeoutMs > 0 ? Math.ceil(timeoutMs / 1000) : undefined;

    // Wire up timeout + caller's abort signal.
    const controller = new AbortController();
    const timeoutHandle =
      timeoutMs > 0
        ? setTimeout(() => controller.abort(new Error(`islo executeCommand timed out after ${timeoutMs}ms`)), timeoutMs)
        : null;
    const callerSignal = options.abortSignal;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort(callerSignal.reason);
      } else {
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'text/event-stream',
        },
        body: JSON.stringify({
          args: fullCommand,
          workdir: cwd ?? null,
          env_vars: nullifyValues(envOverride),
          timeout_secs: timeoutSecs,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
      const aborted = (err as { name?: string })?.name === 'AbortError';
      return {
        success: false,
        exitCode: aborted ? 124 : 1,
        stdout: '',
        stderr: aborted ? `command aborted: ${(err as Error).message}` : (err as Error).message,
        executionTimeMs: Date.now() - startTime,
        timedOut: aborted && !callerSignal?.aborted,
        killed: aborted && !!callerSignal?.aborted,
        command,
        args,
      };
    }

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
      throw new Error(
        `islo exec stream ${response.status} ${response.statusText}: ${text.slice(0, 200)}`,
      );
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    let exitCode = 0;

    try {
      const result = await consumeIsloStream(response.body, {
        onStdout: (data) => {
          stdout += data;
          options.onStdout?.(data);
        },
        onStderr: (data) => {
          stderr += data;
          options.onStderr?.(data);
        },
      });
      if (!result.sawExit || result.exitCode === null) {
        throw new Error('islo exec stream ended without a valid exit event');
      }
      exitCode = result.exitCode;
    } catch (err) {
      const aborted = (err as { name?: string })?.name === 'AbortError';
      if (aborted) {
        timedOut = !callerSignal?.aborted;
        killed = !!callerSignal?.aborted;
        exitCode = 124;
      } else {
        throw err;
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);
    }

    return {
      success: exitCode === 0,
      exitCode,
      stdout,
      stderr,
      executionTimeMs: Date.now() - startTime,
      timedOut,
      killed,
      command,
      args,
    };
  }

  /**
   * Look up an existing islo sandbox by name. Returns null if it doesn't
   * exist, has been deleted, or the lookup raised a 404.
   */
  private async findExistingSandbox(): Promise<{ createdAt: Date; resume: boolean } | null> {
    try {
      const sandbox = await this.client.sandboxes.getSandbox({ sandbox_name: this.sandboxName });
      const status = sandbox?.status;
      if (!sandbox || isDeletedStatus(status)) {
        return null;
      }
      if (isUnusableStatus(status)) {
        throw new Error(
          `islo sandbox ${this.sandboxName} is ${status}; delete it or choose a new sandboxName before starting`,
        );
      }
      return {
        createdAt: sandbox.created_at ? new Date(sandbox.created_at) : new Date(),
        resume: isPausedStatus(status),
      };
    } catch (err) {
      if (isNotFoundError(err)) {
        return null;
      }
      throw err;
    }
  }
}

function isDeletedStatus(status: string | undefined): boolean {
  if (!status) return false;
  return status === 'deleted';
}

function isUnusableStatus(status: string | undefined): boolean {
  if (!status) return false;
  return status === 'failed' || status === 'stopped' || status === 'terminated';
}

function isPausedStatus(status: string | undefined): boolean {
  if (!status) return false;
  return status === 'paused' || status === 'suspended';
}

function isNotFoundError(err: unknown): boolean {
  const status = (err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status;
  return status === 404;
}

function nullifyValues(record: Record<string, string>): Record<string, string | null> | undefined {
  const keys = Object.keys(record);
  if (keys.length === 0) return undefined;
  const out: Record<string, string | null> = {};
  for (const k of keys) {
    out[k] = record[k] ?? null;
  }
  return out;
}

function emptyToUndefined<T extends Record<string, unknown>>(record: T): T | undefined {
  return Object.keys(record).length === 0 ? undefined : record;
}

function mergeEnv(base: Record<string, string>, overlay: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function generateIsloSandboxInstanceId(): string {
  return `islo-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateSandboxName(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `mastra-${random}`;
}
