import type { RequestContext } from '@mastra/core/di';
import type {
  CommandResult,
  ExecuteCommandOptions,
  InstructionsOption,
  MastraSandboxOptions,
  ProcessInfo,
  ProviderStatus,
  SandboxCloneOptions,
  SandboxInfo,
  SpawnProcessOptions,
} from '@mastra/core/workspace';
import { MastraSandbox, ProcessHandle, SandboxNotReadyError, SandboxProcessManager } from '@mastra/core/workspace';
import type { PlatformClientOptions } from './client.js';
import { PlatformApiError, PlatformClient } from './client.js';
import type { DirectExecWebSocketFactory, ExecLease } from './direct-exec.js';
import { execViaLease } from './direct-exec.js';

export type PlatformSandboxNetworkIsolation = 'ISOLATED' | 'PRIVATE';

export interface PlatformSandboxOptions extends Omit<MastraSandboxOptions, 'processes'>, PlatformClientOptions {
  id?: string;
  environmentId?: string;
  sandboxId?: string;
  idleTimeoutMinutes?: number;
  networkIsolation?: PlatformSandboxNetworkIsolation;
  env?: Record<string, string>;
  timeout?: number;
  instructions?: InstructionsOption;
  /**
   * Injected WebSocket factory used by the direct-exec code path. Defaults to
   * the global `WebSocket` (available on Node 22+, this package's minimum) and
   * only exists so tests can drive the exec state machine deterministically
   * without a real network socket.
   */
  webSocketFactory?: DirectExecWebSocketFactory;
}

interface ExecLeaseResponse {
  provider: string;
  sandboxId: string;
  providerResourceId: string;
  jwt: string;
  wsEndpoint: string;
  subprotocol: string;
  expiresAt: string | null;
}

/**
 * How long before a lease's stated `expiresAt` we should treat it as
 * expired. Avoids a race where the JWT is valid at cache-hit time but the
 * server rejects it by the time the WebSocket handshake completes.
 */
const LEASE_REFRESH_MARGIN_MS = 60_000;

interface CreateSandboxResponse {
  id: string;
  providerResourceId?: string | null;
  status?: string;
  createdAt?: string;
  destroyedAt?: string | null;
}

/** Max attempts for `POST /sandbox` when the proxy returns transient 5xx errors. */
const CREATE_MAX_ATTEMPTS = 3;
/** Base delay between create retries; multiplied by the attempt number. */
const CREATE_RETRY_BASE_DELAY_MS = 2_000;

interface ExecResponse {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated?: boolean;
  timedOut?: boolean;
}

/**
 * Compose a shell command line from a `command` string and optional `args`.
 *
 * IMPORTANT: `command` is treated as a **shell string** and passed to the
 * remote shell verbatim so callers can use pipes, redirects, and chaining
 * (`ls -la | grep foo`). This matches the contract of {@link MastraSandbox}
 * and the local sandbox implementation. `args` are always shell-quoted so
 * they cannot inject syntax.
 *
 * Callers MUST NOT pass untrusted input as `command`. Untrusted values must
 * be passed via `args`, where they are safely quoted. Passing untrusted
 * input as `command` allows arbitrary shell syntax execution on the remote
 * sandbox.
 */
function buildCommand(command: string, args?: string[]): string {
  return args?.length ? `${command} ${args.map(shellQuote).join(' ')}` : command;
}

function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

class PlatformProcessHandle extends ProcessHandle {
  readonly pid: string;
  private readonly resultPromise: Promise<CommandResult>;
  private exitCodeValue: number | undefined;

  constructor(pid: string, resultPromise: Promise<CommandResult>, options?: SpawnProcessOptions) {
    super(options);
    this.pid = pid;
    this.resultPromise = resultPromise.then(result => {
      this.exitCodeValue = result.exitCode;
      if (result.stdout) this.emitStdout(result.stdout);
      if (result.stderr) this.emitStderr(result.stderr);
      return result;
    });
  }

  get exitCode(): number | undefined {
    return this.exitCodeValue;
  }

  async wait(): Promise<CommandResult> {
    return this.resultPromise;
  }

  async kill(): Promise<boolean> {
    // The workspace proxy has no cancel-exec endpoint; each `executeCommand`
    // is a synchronous round-trip that has already completed (or timed out)
    // by the time a handle exists to kill. Making this explicit avoids
    // callers silently believing they cancelled a still-running process.
    throw new Error('Platform sandbox command execution does not support killing individual processes');
  }

  async sendStdin(): Promise<void> {
    throw new Error('Platform sandbox command execution does not support stdin');
  }
}

class PlatformProcessManager extends SandboxProcessManager<PlatformSandbox> {
  private spawnCounter = 0;

  /**
   * Spawn a process on the remote sandbox.
   *
   * `command` is interpreted as a shell string by the remote shell, matching
   * the {@link MastraSandbox} contract. See {@link PlatformSandbox.executeCommand}
   * for the untrusted-input caveat: never pass untrusted values as `command`.
   */
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const pid = `platform-proc-${Date.now().toString(36)}-${(this.spawnCounter++).toString(36)}`;
    const resultPromise = this.sandbox.executeCommand(command, undefined, options);
    const handle = new PlatformProcessHandle(pid, resultPromise, options);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._tracked.values()).map(handle => ({
      pid: handle.pid,
      command: handle.command,
      running: handle.exitCode === undefined,
      ...(handle.exitCode !== undefined && { exitCode: handle.exitCode }),
    }));
  }
}

export class PlatformSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'PlatformSandbox';
  readonly provider = 'platform';
  status: ProviderStatus = 'pending';
  declare readonly processes: PlatformProcessManager;

  private readonly _client: PlatformClient;
  private readonly _environmentId: string;
  private _sandboxId?: string;
  private readonly _idleTimeoutMinutes?: number;
  private readonly _networkIsolation?: PlatformSandboxNetworkIsolation;
  private readonly _env: Record<string, string>;
  private readonly _timeout?: number;
  private readonly _instructionsOverride?: InstructionsOption;
  private _createdAt: Date | null = null;
  private readonly _webSocketFactory?: DirectExecWebSocketFactory;
  /**
   * Cached exec lease for this sandbox. `null` before the first exec and
   * after {@link destroy}. Refreshed when `expiresAt - LEASE_REFRESH_MARGIN_MS < now`
   * (see {@link _ensureLease}); a lease without a disclosed `expiresAt`
   * is refreshed on every call.
   */
  private _lease: (ExecLease & { expiresAtMs: number | null }) | null = null;
  /**
   * In-flight mint request; concurrent `_ensureLease` callers on a cold or
   * near-expiry cache all await this single promise so we don't burn N
   * `POST /exec-lease` round-trips when the sandbox is doing N parallel execs.
   * Cleared (regardless of success or failure) when the request settles.
   */
  private _leaseInFlight: Promise<ExecLease & { expiresAtMs: number | null }> | null = null;
  /**
   * Tri-state feature detection for the platform's exec-lease endpoint:
   *   undefined — not yet tried (default; try direct on first exec)
   *   true      — endpoint present, use direct exec
   *   false     — endpoint absent (404/501) OR the WebSocket transport failed
   *               once; fall back permanently to /exec for this sandbox
   * Sticky per instance so we make the fallback decision once per sandbox
   * lifetime instead of paying an extra round-trip on every exec.
   */
  private _directExecAvailable: boolean | undefined = undefined;

  constructor(options: PlatformSandboxOptions = {}) {
    super({ ...options, name: 'PlatformSandbox', processes: new PlatformProcessManager() });
    this.id = options.id ?? this.generateId();
    this._client = new PlatformClient(options);
    this._environmentId = options.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID ?? '';
    if (!this._environmentId && !options.sandboxId) throw new Error('environmentId is required');
    this._sandboxId = options.sandboxId;
    this._idleTimeoutMinutes = options.idleTimeoutMinutes;
    this._networkIsolation = options.networkIsolation;
    this._env = options.env ?? {};
    this._timeout = options.timeout;
    this._instructionsOverride = options.instructions;
    this._webSocketFactory = options.webSocketFactory;
  }

  private generateId(): string {
    return `platform-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Construct a sibling {@link PlatformSandbox} that inherits this sandbox's
   * credentials and defaults (access token, project, environment, network
   * isolation, timeout, instructions, env, idle timeout) with per-instance
   * overrides from `options`.
   *
   * Performs no I/O and does not require this sandbox to be started — the
   * returned sandbox is not started and provisions (or reattaches, when
   * `sandboxId` is set) on its own `start()`. Use it when one configured
   * sandbox acts as the template for a fleet of independent sandboxes
   * (e.g. one per project).
   */
  clone(options: SandboxCloneOptions = {}): PlatformSandbox {
    return new PlatformSandbox({
      ...(options.id !== undefined && { id: options.id }),
      accessToken: this._client.accessToken,
      projectId: this._client.projectId,
      fetch: this._client.fetch,
      environmentId: this._environmentId,
      ...(options.sandboxId !== undefined && { sandboxId: options.sandboxId }),
      idleTimeoutMinutes: options.idleTimeoutMinutes ?? this._idleTimeoutMinutes,
      ...(this._networkIsolation !== undefined && { networkIsolation: this._networkIsolation }),
      env: options.env ?? this._env,
      ...(this._timeout !== undefined && { timeout: this._timeout }),
      ...(this._instructionsOverride !== undefined && { instructions: this._instructionsOverride }),
      ...(this._webSocketFactory !== undefined && { webSocketFactory: this._webSocketFactory }),
    });
  }

  async start(): Promise<void> {
    if (this._sandboxId) {
      try {
        const response = await this._client.request(`/sandbox/${encodeURIComponent(this._sandboxId)}`);
        const json = (await response.json()) as CreateSandboxResponse;
        // A destroyed record (idle GC, manual delete) is not reattachable —
        // treat it like a missing sandbox so we fall through to a fresh
        // provision instead of pointing exec at a dead resource.
        if (!json.destroyedAt) {
          this._createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
          return;
        }
        this._sandboxId = undefined;
      } catch (error) {
        if (!(error instanceof PlatformApiError) || error.status !== 404) throw error;
        this._sandboxId = undefined;
      }
    }

    if (!this._environmentId) throw new Error('environmentId is required');

    const body = JSON.stringify({
      // Sent so the platform can associate the provisioned resource with a
      // caller-stable identifier (used for opt-in checkpoint recovery). The
      // platform treats it as an advisory key: unknown values fall through
      // to a fresh sandbox, matching pre-existing behavior.
      id: this.id,
      environmentId: this._environmentId,
      idleTimeoutMinutes: this._idleTimeoutMinutes,
      networkIsolation: this._networkIsolation,
      env: this._env,
    });
    // Provisioning is observed to fail intermittently with proxy 500s while
    // the provider is under load. A create either succeeds (201) or fails
    // without allocating a caller-visible resource, so retrying transient
    // 5xx responses with a short backoff is safe and keeps a single flaky
    // window from killing the caller's whole workflow.
    let response: Response | undefined;
    for (let attempt = 1; ; attempt++) {
      try {
        response = await this._client.request('/sandbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        break;
      } catch (error) {
        const transient = error instanceof PlatformApiError && error.status >= 500;
        if (!transient || attempt >= CREATE_MAX_ATTEMPTS) throw error;
        await new Promise(resolve => setTimeout(resolve, CREATE_RETRY_BASE_DELAY_MS * attempt));
      }
    }
    const json = (await response.json()) as CreateSandboxResponse;
    this._sandboxId = json.id;
    this._createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
  }

  async stop(): Promise<void> {
    await this.destroy();
  }

  async destroy(): Promise<void> {
    if (!this._sandboxId) return;
    await this._client.request(`/sandbox/${encodeURIComponent(this._sandboxId)}`, { method: 'DELETE' });
    // Clear local state so a subsequent start() creates a fresh remote sandbox
    // instead of taking the reattach branch and pointing exec at a deleted resource.
    this._sandboxId = undefined;
    this._createdAt = null;
    // Drop the exec lease with the sandbox — the JWT is tied to the provider
    // instance id and would be rejected against a fresh one.
    this._lease = null;
  }

  /**
   * Execute a command on the remote sandbox.
   *
   * `command` is a **shell string**: it is concatenated verbatim into the
   * command line sent to the remote shell, which lets callers use pipes,
   * redirects, and chaining (`ls -la | grep foo`). This matches the contract
   * of {@link MastraSandbox} and the local sandbox implementation.
   *
   * `args`, when provided, are always shell-quoted so they cannot inject
   * additional shell syntax.
   *
   * Security: callers MUST NOT pass untrusted input as `command`. If any part
   * of the invocation is derived from an untrusted source, pass it through
   * `args` (which is safely quoted) or shell-quote it yourself before
   * inclusion. Untrusted `command` values allow arbitrary shell syntax
   * execution on the remote sandbox.
   */
  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    await this.ensureRunning();
    if (!this._sandboxId) throw new SandboxNotReadyError(this.id);

    const started = Date.now();
    const fullCommand = buildCommand(command, args);
    // Nullish check so an explicit `timeout: 0` is sent as `0` (interpreted as
    // "no timeout" by the proxy) instead of being dropped by a truthy check.
    const effectiveTimeout = options?.timeout ?? this._timeout;

    // Prefer the direct-exec data plane (WebSocket straight to Railway's
    // tcp-proxy) when the platform exposes the exec-lease endpoint. Falls
    // back to the proxy /exec route on older platform deployments. See
    // ./direct-exec.ts and `docs/factory/direct-sandbox-connection.md` in
    // the Platform repo.
    if (this._directExecAvailable !== false) {
      const leaseResult = await this._tryDirectExec(fullCommand, effectiveTimeout, options);
      if (leaseResult) return { ...leaseResult, executionTimeMs: Date.now() - started };
    }
    return this._execViaProxy(fullCommand, effectiveTimeout, options, started);
  }

  private async _tryDirectExec(
    fullCommand: string,
    effectiveTimeout: number | undefined,
    options: ExecuteCommandOptions | undefined,
  ): Promise<Omit<CommandResult, 'executionTimeMs'> | null> {
    let lease: (ExecLease & { expiresAtMs: number | null }) | null;
    try {
      lease = await this._ensureLease();
    } catch (error) {
      // 404/501 → endpoint not present on this proxy deployment. Flip the
      // feature bit and take the fallback path for this call AND every
      // subsequent one on this sandbox.
      if (error instanceof PlatformApiError && (error.status === 404 || error.status === 501)) {
        this._directExecAvailable = false;
        return null;
      }
      throw error;
    }
    this._directExecAvailable = true;

    // Filter undefined values out of the env overlay so we match the
    // Record<string, string> shape execViaLease expects. `ExecuteCommandOptions.env`
    // is NodeJS.ProcessEnv (string | undefined); the proxy `/exec` path ships
    // it through JSON.stringify which drops undefined implicitly, so this is
    // just the explicit version of the same filter.
    const filteredEnv = options?.env
      ? Object.fromEntries(
          Object.entries(options.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        )
      : undefined;
    const result = await execViaLease(lease, {
      command: fullCommand,
      ...(options?.cwd !== undefined && { cwd: options.cwd }),
      ...(filteredEnv !== undefined && { env: filteredEnv }),
      ...(effectiveTimeout != null && effectiveTimeout > 0 && { timeoutMs: effectiveTimeout }),
      ...(this._webSocketFactory && { webSocketFactory: this._webSocketFactory }),
    });
    // `null` exitCode without `timedOut` means the socket closed without an
    // exit frame — i.e. a transport failure (handshake stalled, mid-stream
    // drop, expired token). Drop the cached lease AND flip the feature bit
    // so we don't burn a fresh mint + failed WS handshake on every subsequent
    // exec; fall back permanently to /exec for this sandbox. Log the close
    // metadata so we can diagnose why Railway refused the WebSocket. Timed-out
    // and normal-exit results still return synthesised / real exit codes as
    // before.
    if (result.exitCode === null && !result.timedOut) {
      // eslint-disable-next-line no-console
      console.warn(
        '[platform-workspace] direct-exec transport failed; falling back to /exec permanently for this sandbox',
        {
          sandboxId: this._sandboxId,
          opened: result.opened,
          closeCode: result.closeCode,
          closeReason: result.closeReason,
          wsEndpoint: lease.wsEndpoint,
        },
      );
      this._lease = null;
      this._directExecAvailable = false;
      return null;
    }
    const exitCode = result.exitCode ?? 124;
    return {
      success: exitCode === 0,
      exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      command: fullCommand,
    };
  }

  private async _execViaProxy(
    fullCommand: string,
    effectiveTimeout: number | undefined,
    options: ExecuteCommandOptions | undefined,
    started: number,
  ): Promise<CommandResult> {
    if (!this._sandboxId) throw new SandboxNotReadyError(this.id);
    const timeoutSec = effectiveTimeout != null ? Math.ceil(effectiveTimeout / 1000) : undefined;
    // Pass our own signal for exec so the client's default per-request
    // timeout (60s) doesn't cut off commands that expect to run longer.
    // Give the proxy a generous buffer over the requested command timeout.
    const clientSignal =
      effectiveTimeout != null && effectiveTimeout > 0 ? AbortSignal.timeout(effectiveTimeout + 30_000) : undefined;
    const response = await this._client.request(`/sandbox/${encodeURIComponent(this._sandboxId)}/exec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        command: fullCommand,
        timeoutSec,
        cwd: options?.cwd,
        env: options?.env,
      }),
      signal: clientSignal,
    });
    const json = (await response.json()) as ExecResponse;
    const exitCode = json.exitCode ?? (json.timedOut ? 124 : 1);
    return {
      success: exitCode === 0,
      exitCode,
      stdout: json.stdout,
      stderr: json.stderr,
      executionTimeMs: Date.now() - started,
      timedOut: json.timedOut,
      command: fullCommand,
    };
  }

  /**
   * Return a cached exec lease, minting a fresh one when the cache is empty
   * or the JWT is within {@link LEASE_REFRESH_MARGIN_MS} of `expiresAt`.
   *
   * Callers are expected to be on the "sandbox is running" path; we don't
   * re-check `_sandboxId` here because `executeCommand` already gated on it.
   */
  private async _ensureLease(): Promise<ExecLease & { expiresAtMs: number | null }> {
    const now = Date.now();
    // Cache hit only when we know the expiry AND we're comfortably before it.
    // A null `expiresAtMs` means the provider didn't disclose a TTL — treat
    // that as "refresh every call" rather than "cache forever", so a token
    // that turns out to be short-lived can't wedge the sandbox until restart.
    if (this._lease && this._lease.expiresAtMs !== null && this._lease.expiresAtMs - LEASE_REFRESH_MARGIN_MS > now) {
      return this._lease;
    }
    // Coalesce concurrent mints on a cold/expired cache.
    if (this._leaseInFlight) return this._leaseInFlight;
    if (!this._sandboxId) throw new SandboxNotReadyError(this.id);
    const sandboxId = this._sandboxId;
    const inFlight = (async () => {
      const response = await this._client.request(`/sandbox/${encodeURIComponent(sandboxId)}/exec-lease`, {
        method: 'POST',
      });
      const json = (await response.json()) as ExecLeaseResponse;
      const expiresAtMs = json.expiresAt ? Date.parse(json.expiresAt) : null;
      const lease = {
        jwt: json.jwt,
        wsEndpoint: json.wsEndpoint,
        subprotocol: json.subprotocol,
        expiresAt: json.expiresAt,
        // Guard against `Date.parse` returning NaN for malformed values by
        // treating them as "no expiry known", which forces a mint every call
        // rather than silently caching a broken lease forever.
        expiresAtMs: expiresAtMs !== null && !Number.isNaN(expiresAtMs) ? expiresAtMs : null,
      };
      this._lease = lease;
      return lease;
    })();
    this._leaseInFlight = inFlight;
    try {
      return await inFlight;
    } finally {
      // Clear on both success and failure so a failed mint doesn't wedge
      // future callers into awaiting the same rejected promise forever.
      if (this._leaseInFlight === inFlight) this._leaseInFlight = null;
    }
  }

  async getInfo(): Promise<SandboxInfo> {
    if (!this._sandboxId) {
      return {
        id: this.id,
        name: this.name,
        provider: this.provider,
        status: this.status,
        createdAt: this._createdAt ?? new Date(),
      };
    }
    const response = await this._client.request(`/sandbox/${encodeURIComponent(this._sandboxId)}`);
    const json = (await response.json()) as CreateSandboxResponse;
    return {
      id: json.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: json.createdAt ? new Date(json.createdAt) : (this._createdAt ?? new Date()),
      metadata: {
        // The platform assigns its own sandbox id on create (the advisory id
        // sent in the POST body is not honored). Expose it so callers that
        // persist a reattach id (e.g. the Factory sandbox fleet, which reads
        // `metadata.sandboxId`) store the id the proxy actually recognizes
        // instead of the locally generated construction id.
        sandboxId: json.id,
        providerResourceId: json.providerResourceId ?? undefined,
        platformStatus: json.status,
      },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = `Platform sandbox${this._sandboxId ? ` ${this._sandboxId}` : ''}. Execute commands with the sandbox command APIs.`;
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
    }
    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    return defaultInstructions;
  }
}
