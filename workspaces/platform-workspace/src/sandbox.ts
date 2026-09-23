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
  SandboxStartResult,
  SpawnProcessOptions,
} from '@mastra/core/workspace';
import {
  MastraSandbox,
  ProcessHandle,
  UnsupportedStdinCloseError,
  SandboxNotReadyError,
  SandboxProcessManager,
} from '@mastra/core/workspace';
import type { PlatformClientOptions, PlatformRequestOptions } from './client.js';
import { PlatformApiError, PlatformClient } from './client.js';
import type { DirectExecWebSocketFactory, ExecLease } from './direct-exec.js';
import { execViaLease } from './direct-exec.js';
import type { E2BExecRunner } from './e2b-exec.js';
import { execViaE2BLease } from './e2b-exec.js';
import type { PrivateNetExecOptions, PrivateNetExecResult, PrivateNetFetch } from './private-net-exec.js';
import { execViaPrivateNetwork, PrivateNetExecHttpError } from './private-net-exec.js';
import type { SandboxTemplateBuilder, SerializedSandboxTemplate } from './template.js';
import { getSandboxTemplateBuildEnvs, serializeSandboxTemplate } from './template.js';

export type PlatformSandboxNetworkIsolation = 'ISOLATED' | 'PRIVATE';

export type PlatformSandboxTemplate =
  | SandboxTemplateBuilder
  | (() => SandboxTemplateBuilder | undefined | Promise<SandboxTemplateBuilder | undefined>);

/**
 * In-process `sandboxId → instanceUrl` map that lets
 * {@link PlatformSandbox.executeCommand} dial the in-sandbox sidecar over
 * Railway's private network instead of paying for a lease + WebSocket
 * round-trip through Railway's public control plane.
 *
 * The workspace proxy discovers each sandbox's IPv6 during
 * `POST /v1/:provider/projects/:pid/sandbox` and returns it as `instanceUrl` on the
 * create + get responses (see the platform inline-discovery issue). The
 * `PlatformSandbox` client copies that field into this registry from both
 * {@link PlatformSandbox.start} branches (fresh provision + reattach), evicts
 * on {@link PlatformSandbox.destroy}, and evicts again on any observed
 * transport failure so the next exec falls back to the lease path cleanly.
 *
 * See:
 *   - `.scratch/factory-deploy/issue-runtime-sandbox-address-discovery.md`
 *   - `.scratch/factory-deploy/issue-platform-sandbox-exec-via-private-network.md`
 */
export interface SandboxAddressRegistry {
  set(sandboxId: string, instanceUrl: string): void;
  get(sandboxId: string): string | undefined;
  delete(sandboxId: string): void;
}

export interface PlatformSandboxOptions extends Omit<MastraSandboxOptions, 'processes'>, PlatformClientOptions {
  id?: string;
  environmentId?: string;
  sandboxId?: string;
  /** Boot-only fallback checkpoint for a fresh sandbox whose primary recovery key has no state. */
  seedCheckpointName?: string;
  /**
   * Template builder or a lazy resolver for one. The resolver runs only when
   * start() must provision a fresh sandbox. Platform content-addresses the
   * serialized definition and starts or reuses its provider build without
   * blocking sandbox creation. With E2B, cpuCount() and memoryMB() default to 2
   * CPUs and 1,024 MB; the latest setters determine the template identity and
   * stale fallback is restricted to builds with the same effective resources.
   * A provider-base fallback may use provider-default resources while the exact
   * build is pending; inspect templatePending to detect that case. Railway
   * ignores the resource setters. `setEnvs(values, { ephemeral: true })`
   * supplies build-only values outside the serialized definition, content
   * identity, and persistent template record. Resolver failures also fall back
   * to the provider default and are retried on the next fresh provision.
   */
  template?: PlatformSandboxTemplate;
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
  /** Injected E2B direct-exec implementation used by tests. */
  e2bExecRunner?: E2BExecRunner;
  /**
   * Injected fetch implementation used by the private-network exec code path
   * to dial the in-sandbox sidecar. Defaults to `globalThis.fetch` and only
   * exists so tests can drive that transport without a real HTTP server.
   * Note: this is separate from the `fetch` on {@link PlatformClientOptions},
   * which is used for calls to the workspace proxy.
   */
  privateNetFetch?: PrivateNetFetch;
  /**
   * Registry that maps `sandboxId → instanceUrl` for the private-network
   * exec path. When set, {@link PlatformSandbox.start} populates it from the
   * `instanceUrl` field workspace-proxy returns on create + get responses,
   * and {@link PlatformSandbox.executeCommand} looks it up before every exec
   * and tries the private-network transport first, falling back to the lease
   * path on any transport failure (and invalidating the registry entry so
   * the next call goes to the lease path cleanly). When absent, all execs
   * go straight to the lease path — this is the pre-existing behavior and
   * the expected mode outside the shipyard runtime. See
   * {@link SandboxAddressRegistry}.
   */
  addressRegistry?: SandboxAddressRegistry;
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

interface CachedExecLease extends ExecLease {
  provider: string;
  sandboxId: string;
  providerResourceId: string;
  expiresAtMs: number | null;
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
  /**
   * Present when the sandbox booted from a prior member of the same
   * template family or the provider base template while the requested
   * exact template continues to build in the background. Absent when the
   * sandbox booted on the exact template. See {@link SandboxTemplatePending}
   * for semantics.
   *
   * Only emitted by the create route today; reattach responses never carry
   * this field.
   */
  templatePending?: SandboxTemplatePending;
  /**
   * Full sidecar URL (`http://[<ipv6>]:<port>`) the runtime can dial over
   * Railway's private network to reach the in-sandbox exec sidecar. The
   * workspace proxy discovers the sandbox's IPv6 during `Sandbox.create()`
   * via one `sandbox.exec("awk … /proc/net/if_inet6")` and stores it in
   * `environment_sandboxes.instance_url`; the same field is echoed on
   * `GET /sandbox/:id`. `null` when discovery failed (returned by the proxy
   * so the runtime knows to skip private-net dial for this sandbox rather
   * than fall back on a missing-field ambiguity).
   */
  instanceUrl?: string | null;
}

/** Max attempts for `POST /sandbox` when the proxy returns transient 5xx errors. */
const CREATE_MAX_ATTEMPTS = 3;
/** Base delay between create retries; multiplied by the attempt number. */
const CREATE_RETRY_BASE_DELAY_MS = 2_000;

/**
 * Observability handle for a template that was requested but is still being
 * built by the platform. Present on {@link CreateSandboxResponse} and echoed
 * as {@link PlatformSandbox.templatePending} when the sandbox booted from
 * a prior member of the same template family or from the provider's base
 * template while the exact template continues to build in the background.
 * Absent when the sandbox booted on the exact template.
 *
 * `PlatformSandbox` does not act on this: freshness is reconciled by the
 * caller's own `onStart` runtime setup (e.g. `git fetch && checkout`), not
 * by replaying template operations inside the running sandbox.
 */
export interface SandboxTemplatePending {
  templateId: string;
  retryAfterMs: number;
}

/**
 * How long to wait for the in-sandbox sidecar's `/health` endpoint to respond
 * before giving up and leaving the address registry unpopulated (execs fall
 * back to the lease path). This bounds the fire-and-forget probe that runs
 * after `start()` resolves; the sandbox is usable immediately — the probe
 * only controls whether early execs go via private-net or lease.
 */
const SIDECAR_PROBE_TIMEOUT_MS = 30_000;
/** Delay between sidecar probe attempts. */
const SIDECAR_PROBE_INTERVAL_MS = 250;
/**
 * How long `executeCommand` waits for the transport to become ready before
 * falling back to the lease path. This is much shorter than
 * `SIDECAR_PROBE_TIMEOUT_MS` because we want execs to proceed quickly if
 * the sidecar is slow to boot — the probe continues in the background and
 * later execs will use private-net once it succeeds.
 */
const TRANSPORT_READY_WAIT_MS = 5_000;

/**
 * Diagnostic error thrown when the direct-exec WebSocket transport fails
 * twice in a row (opening handshake refused or socket closed mid-stream
 * without an `exit` frame). Distinguishes "the sandbox transport is broken"
 * from "your command failed" so callers can decide whether to retry at a
 * higher level (e.g. reprovision the sandbox) or surface the error.
 *
 * `opened` is `true` when the WebSocket completed its handshake at least
 * once before closing; `false` when Railway refused the upgrade outright.
 */
export class SandboxExecTransportError extends Error {
  readonly sandboxId: string | undefined;
  readonly command: string;
  readonly attempts: number;
  readonly opened: boolean;
  readonly closeCode: number | undefined;
  readonly closeReason: string | undefined;
  readonly wsEndpoint: string;

  constructor(
    message: string,
    diagnostics: {
      sandboxId?: string;
      command: string;
      attempts: number;
      opened: boolean;
      closeCode?: number;
      closeReason?: string;
      wsEndpoint: string;
    },
  ) {
    super(message);
    this.name = 'SandboxExecTransportError';
    this.sandboxId = diagnostics.sandboxId;
    this.command = diagnostics.command;
    this.attempts = diagnostics.attempts;
    this.opened = diagnostics.opened;
    this.closeCode = diagnostics.closeCode;
    this.closeReason = diagnostics.closeReason;
    this.wsEndpoint = diagnostics.wsEndpoint;
  }
}

/**
 * Outcome of {@link PlatformSandbox.captureCheckpoint}. Mirrors the shape of
 * the OSS `@mastra/railway` `RailwaySandbox.captureCheckpoint()` return so a
 * caller (e.g. the factory fleet) can branch on `status`/`reason` uniformly
 * across providers without knowing which one is underneath.
 *
 * `captured` and `coalesced` both represent a successful capture the caller
 * can persist against — they carry the checkpoint name inline so callers
 * don't have to reach back into the sandbox instance to learn what was
 * written. `skipped` carries a machine-readable `reason` so the discriminant
 * set stays extensible.
 *
 * Note: the platform proxy's own `skipped` (returned when the upstream
 * sandbox is already destroyed) is mapped to `sandbox-not-running` here to
 * keep the discriminant identical to the OSS provider. The diagnostic
 * distinction (pre-flight vs post-hoc discovery) is preserved in log lines,
 * not the return type — see {@link PlatformSandbox.captureCheckpoint}.
 */
export type CaptureCheckpointResult =
  | { status: 'captured'; checkpointName: string }
  | { status: 'coalesced'; checkpointName: string }
  | { status: 'skipped'; reason: 'no-checkpoint-name-configured' | 'sandbox-not-running' };

/**
 * Thrown when `/exec-lease` returns 410 Gone — the sandbox has been destroyed
 * (Railway destroy, quota reclamation, etc.). The client cannot recover from
 * this on its own because it does not own the binding store; only the fleet
 * layer can clear the stale sandbox id and provision a fresh one. Callers
 * (typically `SandboxFleet`) must catch this and reprovision-and-replay.
 *
 * When this is thrown the cached `_lease` and `_sandboxId` on the sandbox
 * instance are cleared, so the next `ensureRunning()` on a reused instance
 * will re-provision cleanly.
 */
export class SandboxDestroyedError extends Error {
  readonly sandboxId: string | undefined;
  readonly command: string;
  readonly attempts: number;

  constructor(message: string, diagnostics: { sandboxId?: string; command: string; attempts: number }) {
    super(message);
    this.name = 'SandboxDestroyedError';
    this.sandboxId = diagnostics.sandboxId;
    this.command = diagnostics.command;
    this.attempts = diagnostics.attempts;
  }
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

  async closeStdin(): Promise<void> {
    throw new UnsupportedStdinCloseError('Platform sandbox command execution does not support closing stdin');
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
  /**
   * Populated from the platform's create/reattach response when the sandbox
   * booted from a prior member of the same template family or the provider
   * base template while the requested exact template continues to build in
   * the background.
   * `undefined` when the sandbox booted on the exact template (or when no
   * template was requested). Observability-only; consumers reconcile freshness
   * in their own runtime setup and reprovision to pick up the ready template
   * on a later start.
   */
  templatePending?: SandboxTemplatePending;

  private readonly _client: PlatformClient;
  private readonly _usesProviderRoutes: boolean;
  private readonly _environmentId: string;
  private _sandboxId?: string;
  private readonly _seedCheckpointName?: string;
  private _templateDefinition?: SerializedSandboxTemplate;
  private _templateBuildEnvs?: Record<string, string>;
  private readonly _template?: PlatformSandboxTemplate;
  private _templateResolutionInFlight?: Promise<void>;
  private readonly _idleTimeoutMinutes?: number;
  private readonly _networkIsolation?: PlatformSandboxNetworkIsolation;
  private readonly _env: Record<string, string>;
  private readonly _timeout?: number;
  private readonly _instructionsOverride?: InstructionsOption;
  private _createdAt: Date | null = null;
  private readonly _webSocketFactory?: DirectExecWebSocketFactory;
  private readonly _e2bExecRunner: E2BExecRunner;
  private readonly _privateNetFetch?: PrivateNetFetch;
  /**
   * Registry that maps `sandboxId → instanceUrl` for the private-network
   * exec path. Injected by the composition site via
   * {@link PlatformSandboxOptions.addressRegistry} and populated by this
   * class itself in `start()` when the workspace-proxy's create/reattach
   * response includes an `instanceUrl` field. The registry IS the cache —
   * there is no per-instance mirror on `PlatformSandbox`, so every exec is
   * a `Map.get()` (in the default in-process impl) against the live view.
   * When absent, executes go straight to the lease path with no extra
   * round-trip.
   */
  private readonly _addressRegistry?: SandboxAddressRegistry;
  /**
   * Cached exec lease for this sandbox. `null` before the first exec and
   * after {@link destroy}. Refreshed when `expiresAt - LEASE_REFRESH_MARGIN_MS < now`
   * (see {@link _ensureLease}); a lease without a disclosed `expiresAt`
   * is refreshed on every call.
   */
  private _lease: CachedExecLease | null = null;
  /**
   * In-flight mint request; concurrent `_ensureLease` callers on a cold or
   * near-expiry cache all await this single promise so we don't burn N
   * `POST /exec-lease` round-trips when the sandbox is doing N parallel execs.
   * Cleared (regardless of success or failure) when the request settles.
   */
  private _leaseInFlight: Promise<CachedExecLease> | null = null;
  /**
   * True when this sandbox was constructed with a caller-supplied `id` (the
   * recovery key the proxy hashes into an on-provider checkpoint name).
   * `captureCheckpoint()` needs this to distinguish "no checkpoint intent"
   * (auto-generated random id — capture would land under a name no future
   * boot would look for) from "capture on demand". Cloned sandboxes route
   * `checkpointName` through `id`, so both entry points set this the same
   * way.
   */
  private readonly _hasRecoveryKey: boolean;
  /**
   * In-flight `captureCheckpoint()` request. Concurrent callers on the same
   * instance coalesce onto this single promise so we don't burn N `POST
   * /checkpoint` round-trips when the fleet fires several turn-end captures
   * before the first one resolves. Cleared when the request settles.
   */
  private _captureInFlight: Promise<CaptureCheckpointResult> | null = null;
  /**
   * Generation token for the sidecar probe. Incremented on every `start()`
   * and on teardown. The probe captures this value when it begins; if the
   * generation has changed by the time the probe succeeds, the probe skips
   * the `set()` to avoid re-populating a deleted or superseded sandbox entry.
   */
  private _probeGeneration = 0;
  /**
   * In-flight sidecar probe promise. Concurrent `executeCommand` callers that
   * arrive before the registry is populated all await this single promise so
   * we don't fire N independent lease requests during the sidecar boot window.
   * Once the probe resolves (success or timeout), callers check the registry
   * and proceed — either via private-net (probe succeeded) or via lease (probe
   * failed/timed out, but now coalesced via `_leaseInFlight`).
   */
  private _transportReadyPromise: Promise<void> | null = null;
  /**
   * The sidecar address of the most recent `start()`, kept so a timed-out
   * probe can be restarted by a later exec ({@link _awaitTransportReady})
   * instead of pinning the sandbox to the lease path for its lifetime.
   */
  private _probeTarget: { sandboxId: string; instanceUrl: string } | null = null;

  constructor(options: PlatformSandboxOptions = {}) {
    super({ ...options, name: 'PlatformSandbox', processes: new PlatformProcessManager() });
    this._hasRecoveryKey = options.id !== undefined;
    this.id = options.id ?? this.generateId();
    this._client = new PlatformClient(options);
    this._environmentId = options.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID ?? '';
    if (!this._environmentId && !options.sandboxId) throw new Error('environmentId is required');
    this._sandboxId = options.sandboxId;
    this._seedCheckpointName = options.seedCheckpointName;
    this._usesProviderRoutes = options.template !== undefined;
    this._template = options.template;
    this._idleTimeoutMinutes = options.idleTimeoutMinutes;
    this._networkIsolation = options.networkIsolation;
    this._env = options.env ?? {};
    this._timeout = options.timeout;
    this._instructionsOverride = options.instructions;
    this._webSocketFactory = options.webSocketFactory;
    this._e2bExecRunner = options.e2bExecRunner ?? execViaE2BLease;
    this._privateNetFetch = options.privateNetFetch;
    this._addressRegistry = options.addressRegistry;
  }

  private generateId(): string {
    return `platform-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private _request(path: string, options: PlatformRequestOptions = {}): Promise<Response> {
    return this._usesProviderRoutes ? this._client.requestProvider(path, options) : this._client.request(path, options);
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
    // The proxy hashes `body.id` on POST /sandbox to look up a prior
    // checkpoint. A stable `checkpointName` is only useful if it round-trips
    // to `body.id`, so route it through the sandbox id when the caller
    // didn't pick one explicitly. Without this, every clone gets a random
    // id and no boot ever hits its captured checkpoint (see
    // issue-platform-sandbox-clone-drops-checkpoint-name.md).
    const id = options.id ?? options.checkpointName;
    const seedCheckpointName =
      options.seedCheckpointName ??
      (this._client.sandboxProvider === 'e2b' ? options.checkpointName : undefined) ??
      this._seedCheckpointName;
    const clone = new PlatformSandbox({
      ...(id !== undefined && { id }),
      accessToken: this._client.accessToken,
      projectId: this._client.projectId,
      ...(this._usesProviderRoutes || this._client.sandboxProvider !== 'railway'
        ? { sandboxProvider: this._client.sandboxProvider }
        : {}),
      actingUserId: options.actingUserId ?? this._client.actingUserId,
      ...(this._client.sessionId !== undefined && { sessionId: this._client.sessionId }),
      ...(this._client.threadId !== undefined && { threadId: this._client.threadId }),
      fetch: this._client.fetch,
      environmentId: this._environmentId,
      ...(options.sandboxId !== undefined && { sandboxId: options.sandboxId }),
      ...(seedCheckpointName !== undefined && { seedCheckpointName }),
      ...(this._template !== undefined && { template: this._template }),
      idleTimeoutMinutes: options.idleTimeoutMinutes ?? this._idleTimeoutMinutes,
      ...(this._networkIsolation !== undefined && { networkIsolation: this._networkIsolation }),
      env: options.env ?? this._env,
      ...(this._timeout !== undefined && { timeout: this._timeout }),
      ...(this._instructionsOverride !== undefined && { instructions: this._instructionsOverride }),
      ...(this._webSocketFactory !== undefined && { webSocketFactory: this._webSocketFactory }),
      e2bExecRunner: this._e2bExecRunner,
      ...(this._privateNetFetch !== undefined && { privateNetFetch: this._privateNetFetch }),
      // Propagate the registry — the clone is a different sandbox with a
      // different id, so it will `get()` its OWN address (or nothing) out
      // of the shared registry, not the parent's. See
      // `.scratch/factory-deploy/issue-platform-sandbox-exec-via-private-network.md`.
      ...(this._addressRegistry !== undefined && { addressRegistry: this._addressRegistry }),
    });
    clone._templateDefinition = this._templateDefinition ? structuredClone(this._templateDefinition) : undefined;
    clone._templateBuildEnvs = this._templateBuildEnvs ? { ...this._templateBuildEnvs } : undefined;
    return clone;
  }

  /**
   * Start the sandbox: reattach to a known provider `sandboxId` when one is
   * set and still live, otherwise provision a fresh sandbox via the proxy.
   *
   * Concurrent-caller coalescing lives in the `MastraSandbox` base class
   * (constructor-wrapped `start()`): joined callers share one attempt and
   * observe its result; the in-flight slot is cleared on settle so a failed
   * attempt is not a permanent latch.
   *
   * Reports `outcome: 'connected'` on reattach and `outcome: 'created'` on provision.
   * Note: a `POST /sandbox` seeded from an id-keyed checkpoint is still a
   * fresh VM and reports `outcome: 'created'`.
   */
  async start(): Promise<SandboxStartResult> {
    const startedAt = Date.now();
    if (this._sandboxId) {
      try {
        const requestStartedAt = Date.now();
        const response = await this._request(`/sandbox/${encodeURIComponent(this._sandboxId)}`);
        const requestMs = Date.now() - requestStartedAt;
        const json = (await response.json()) as CreateSandboxResponse;
        // A destroyed record (idle GC, manual delete) is not reattachable —
        // treat it like a missing sandbox so we fall through to a fresh
        // provision instead of pointing exec at a dead resource.
        if (!json.destroyedAt) {
          this._createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
          // Reattach responses never carry templatePending — the field is
          // set only by the create route. Leave the instance's value alone.
          this._populateAddressFromResponse(json);
          this._logStartComplete(json.id, startedAt, requestMs, 'reattach');
          return { outcome: 'connected' };
        }
        this._sandboxId = undefined;
      } catch (error) {
        if (!(error instanceof PlatformApiError) || error.status !== 404) throw error;
        this._sandboxId = undefined;
      }
    }

    if (!this._environmentId) throw new Error('environmentId is required');

    await this._prepareLazyTemplate();

    const createBody = () =>
      JSON.stringify({
        // Sent so the platform can associate the provisioned resource with a
        // caller-stable identifier (used for opt-in checkpoint recovery). The
        // platform treats it as an advisory key: unknown values fall through
        // to a fresh sandbox, matching pre-existing behavior.
        id: this.id,
        seedCheckpointName: this._seedCheckpointName,
        templateDefinition: this._templateDefinition,
        templateBuildEnvs: this._templateBuildEnvs,
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
    //
    // Template builds never block a create anymore: the proxy always returns
    // a running sandbox on the best available fallback (a prior member of the
    // same template family if one exists, otherwise the provider base
    // template) and surfaces `templatePending` in the 201 body describing the
    // build that continues in the background.
    let response: Response | undefined;
    const requestStartedAt = Date.now();
    for (let attempt = 1; ; attempt++) {
      try {
        response = await this._request('/sandbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: createBody(),
        });
        break;
      } catch (error) {
        const transient = error instanceof PlatformApiError && error.status >= 500;
        if (!transient || attempt >= CREATE_MAX_ATTEMPTS) throw error;
        await new Promise(resolve => setTimeout(resolve, CREATE_RETRY_BASE_DELAY_MS * attempt));
      }
    }
    const requestMs = Date.now() - requestStartedAt;
    const json = (await response.json()) as CreateSandboxResponse;
    this._sandboxId = json.id;
    this._createdAt = json.createdAt ? new Date(json.createdAt) : new Date();
    this.templatePending = json.templatePending;
    this._populateAddressFromResponse(json);
    this._logStartComplete(json.id, startedAt, requestMs, 'provision');
    return { outcome: 'created' };
  }

  private async _prepareLazyTemplate(): Promise<void> {
    if (this._templateDefinition !== undefined || this._template === undefined) return;
    if (!this._templateResolutionInFlight) {
      const attempt = this._resolveTemplate();
      this._templateResolutionInFlight = attempt.finally(() => {
        this._templateResolutionInFlight = undefined;
      });
    }
    await this._templateResolutionInFlight;
  }

  private async _resolveTemplate(): Promise<void> {
    try {
      const resolved = typeof this._template === 'function' ? await this._template() : this._template;
      if (!resolved) return;
      this._templateDefinition = serializeSandboxTemplate(resolved);
      this._templateBuildEnvs = getSandboxTemplateBuildEnvs(resolved);
    } catch (error) {
      this.logger.warn(
        `Platform sandbox template resolution failed; using provider default template: ${String(error)}`,
      );
    }
  }

  /**
   * One timing summary per completed `start()` — the whole
   * `PlatformSandbox`-visible boot in a single greppable line.
   *
   * `requestMs` is the proxy round-trip (`GET /sandbox/:id` on reattach,
   * `POST /sandbox` including transient-5xx retries on provision) — a black
   * box from this side that rolls up Railway RPC, sidecar launch, and the
   * proxy's discovery exec. Sidecar probe cost is intentionally NOT here: the
   * probe is fire-and-forget and outlives `start()` by design, so its
   * duration lands on the `platform-workspace probe ok` line instead.
   */
  private _logStartComplete(sandboxId: string, startedAt: number, requestMs: number, mode: string): void {
    this.logger.info('platform-workspace start complete', {
      sandboxId,
      sessionId: this._client.sessionId,
      mode,
      totalMs: Date.now() - startedAt,
      requestMs,
    });
  }

  /**
   * Copy `response.instanceUrl` into the injected {@link SandboxAddressRegistry}
   * when both are present. Called from both {@link start} branches (fresh
   * provision + reattach) with the workspace-proxy response for this sandbox.
   *
   * The proxy discovers the IPv6 during `Sandbox.create()` and stores it in
   * `environment_sandboxes.instance_url`; both the create response and
   * `GET /sandbox/:id` echo the same field. The runtime does not do any
   * discovery of its own — it only mirrors the field into an in-process map
   * so {@link executeCommand} can `Map.get()` before every exec without an
   * HTTP round-trip.
   *
   * `null`/absent `instanceUrl` (proxy discovery failed, or an older proxy
   * that predates the field) evicts any stale registry address and leaves
   * executes on the lease path.
   */
  private _populateAddressFromResponse(json: CreateSandboxResponse): void {
    if (!this._addressRegistry) return;
    if (!json.instanceUrl) {
      // A later start() without an address must not keep probing the previous
      // sidecar or reuse a leftover registry URL. Invalidate any in-flight
      // probe, drop the remembered target, and evict the stale entry.
      this._probeGeneration++;
      this._probeTarget = null;
      this._transportReadyPromise = null;
      this._addressRegistry.delete(json.id);
      return;
    }
    // Clear any stale entry before probing. On reattach, the registry may have
    // the old sandbox's address; execs should fall back to lease until the new
    // probe succeeds rather than dialing the stale address.
    this._addressRegistry.delete(json.id);
    // Start the sidecar probe and expose it so executeCommand can await it.
    // Early execs wait for the probe (up to TRANSPORT_READY_WAIT_MS) rather
    // than all racing to the lease path independently.
    const generation = ++this._probeGeneration;
    // Remember the probe target so a later exec can restart the probe if this
    // one times out, instead of falling back to the lease path forever.
    this._probeTarget = { sandboxId: json.id, instanceUrl: json.instanceUrl };
    this._transportReadyPromise = this._probeSidecarThenRegister(json.id, json.instanceUrl, generation);
  }

  /**
   * Fire-and-forget probe that polls the sidecar's `/health` endpoint until
   * it responds, then populates the address registry. Runs detached from
   * `start()` so sandbox provision latency is unchanged; early execs simply
   * fall back to the lease path until the probe succeeds.
   *
   * If the sidecar never comes up within {@link SIDECAR_PROBE_TIMEOUT_MS},
   * the registry stays unpopulated, `_transportReadyPromise` is cleared,
   * and a later {@link _awaitTransportReady} call restarts the probe
   * instead of pinning this sandbox to the lease path.
   *
   * @param generation - The probe generation captured at call time. If this
   *   no longer matches `_probeGeneration` when the probe succeeds, the probe
   *   was superseded by a teardown or a new `start()`, so we skip the `set()`.
   */
  private async _probeSidecarThenRegister(sandboxId: string, instanceUrl: string, generation: number): Promise<void> {
    const probeStartedAt = Date.now();
    const deadline = probeStartedAt + SIDECAR_PROBE_TIMEOUT_MS;
    const fetchFn = this._privateNetFetch ?? fetch;
    let attempts = 0;
    while (Date.now() < deadline) {
      // Teardown or new start() superseded this probe — bail out early.
      if (generation !== this._probeGeneration) return;
      attempts++;
      try {
        const res = await fetchFn(`${instanceUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(1_000),
        });
        const ok = res.ok;
        // Release the response body so the connection returns to the pool.
        await res.body?.cancel().catch(() => {});
        if (ok) {
          // A ~1-attempt probe means the sidecar was ready when the proxy
          // returned; hundreds of ms means it was still booting — the exact
          // window that used to silently fall back to the lease path.
          this.logger.info('platform-workspace probe ok', {
            sandboxId,
            sessionId: this._client.sessionId,
            probeDurationMs: Date.now() - probeStartedAt,
            attempts,
          });
          // Sidecar is listening. Only populate if this probe is still current.
          if (generation === this._probeGeneration && this._sandboxId === sandboxId) {
            this._addressRegistry?.set(sandboxId, instanceUrl);
          }
          return;
        }
      } catch {
        // Connection refused / timeout — keep polling.
      }
      await new Promise(r => setTimeout(r, SIDECAR_PROBE_INTERVAL_MS));
    }
    // Sidecar never came up within this probe's window. Leave the registry
    // entry unset (execs go via lease) but clear the ready promise so a later
    // exec can restart the probe rather than pinning this sandbox to the
    // lease path for its lifetime.
    if (generation === this._probeGeneration && this._transportReadyPromise) {
      this._transportReadyPromise = null;
    }
    this.logger.warn('platform-workspace probe timed out', {
      sandboxId,
      sessionId: this._client.sessionId,
      timeoutMs: SIDECAR_PROBE_TIMEOUT_MS,
      attempts,
    });
  }

  /**
   * Wait for the transport to become ready (sidecar probe succeeds) or time
   * out. Concurrent callers all await the same probe promise, coalescing the
   * cold-start storm into a single warmup attempt.
   *
   * If no probe is in flight (no registry, or registry already populated),
   * this returns immediately. After the wait (success or timeout), callers
   * check the registry and proceed — either via private-net or lease. The
   * lease path is still coalesced via `_leaseInFlight`, so even if the probe
   * times out, we only mint one lease for all concurrent execs.
   */
  private async _awaitTransportReady(): Promise<void> {
    // Fast path: registry already has an entry, transport is warm.
    if (this._sandboxId && this._addressRegistry?.get(this._sandboxId)) {
      return;
    }
    // No probe in flight. If a previous probe timed out for the current
    // sandbox, restart it — the sidecar may just have been slow to boot, and
    // one exec paying a short wait beats every exec going via lease forever.
    if (!this._transportReadyPromise) {
      const target = this._probeTarget;
      if (!target || this._sandboxId !== target.sandboxId) return;
      const generation = ++this._probeGeneration;
      this._transportReadyPromise = this._probeSidecarThenRegister(target.sandboxId, target.instanceUrl, generation);
    }
    // Race the probe against a timeout. We don't want to block execs forever
    // if the sidecar is slow to boot — they can proceed via lease after a
    // short wait, and later execs will use private-net once the probe succeeds.
    await Promise.race([this._transportReadyPromise, new Promise<void>(r => setTimeout(r, TRANSPORT_READY_WAIT_MS))]);
  }

  /**
   * Stop the sandbox while **preserving its recovery checkpoint**.
   *
   * Semantic parity with `@mastra/railway` `RailwaySandbox.stop()`: the VM
   * is released but the on-provider checkpoint survives, so a subsequent
   * `start()` on a sandbox constructed with the same `id` can restore from
   * it. Any in-flight capture is awaited first so the preserved checkpoint
   * reflects the latest disk state we asked for.
   *
   * Corresponds to `DELETE /v1/:provider/projects/:pid/sandbox/:sandboxId` on
   * workspace-proxy, which by contract does not touch the checkpoint. Use
   * {@link destroy} when you want the checkpoint released too.
   */
  async stop(): Promise<void> {
    // Await any in-flight capture so the preserved checkpoint reflects the
    // latest capture the caller triggered. Never rethrow — a failing capture
    // must not block teardown; the proxy's safety-net refresh timer is a
    // fallback for the checkpoint state.
    if (this._captureInFlight) {
      await this._captureInFlight.catch(error => {
        this.logger.warn(`stop(): failed to flush in-flight capture before teardown:`, error);
      });
    }
    await this._teardownSandbox();
  }

  /**
   * Destroy the sandbox **and release its recovery checkpoint**.
   *
   * Semantic parity with `@mastra/railway` `RailwaySandbox.destroy()`:
   * cancels any in-flight capture (the checkpoint is about to be deleted
   * — no reason to burn a capture on state we're releasing), asks the
   * proxy to delete the checkpoint, then releases the VM. Both remote
   * operations are best-effort logged failures — a stray checkpoint or a
   * transient proxy error must not leave the caller with a half-torn-down
   * sandbox they can't safely retry.
   *
   * Railway requires a caller-supplied recovery `id` before it can have a
   * checkpoint to delete. On E2B the sandbox itself is the persistent thing
   * (idle sandboxes pause and resume in place), so destroy only kills the
   * VM; any snapshot a caller captured on purpose is the caller's to manage.
   */
  async destroy(): Promise<void> {
    if (!this._sandboxId) return;
    const destroyedSandboxId = this._sandboxId;

    // Drop the in-flight capture promise — we're about to delete the
    // checkpoint, so completing an in-flight capture is at best a wasted
    // round-trip and at worst races with the delete. Callers get whatever
    // resolution the pending capture already had; we don't rethrow.
    this._captureInFlight = null;

    if (this._hasRecoveryKey && this._client.sandboxProvider !== 'e2b') {
      // Body mirrors the POST /checkpoint shape (`{ id }`) so the proxy
      // can hash the same recovery key into the same checkpoint name.
      // Best-effort: a proxy 404/410 means the checkpoint is already
      // absent (idle GC, prior delete) and we can proceed with the VM
      // teardown; other failures are surfaced in logs but do not abort
      // — the VM DELETE below is the operation the caller most needs.
      try {
        await this._request(`/sandbox/${encodeURIComponent(destroyedSandboxId)}/checkpoint`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: this.id }),
        });
      } catch (error) {
        if (error instanceof PlatformApiError && (error.status === 404 || error.status === 410)) {
          this.logger.debug(`destroy(): checkpoint already absent upstream (status=${error.status})`);
        } else {
          this.logger.warn(`destroy(): failed to delete checkpoint upstream:`, error);
        }
      }
    }

    await this._teardownSandbox();
  }

  /**
   * Release the remote sandbox VM and clear the local state pointing at it.
   *
   * Shared body of {@link stop} and {@link destroy} — both funnel through
   * here after they've dealt with the checkpoint (preserve vs release).
   * The VM DELETE is safe to issue in either mode: the proxy's DELETE
   * route does not touch the checkpoint on its own, so `stop()` correctly
   * leaves the checkpoint intact and `destroy()` has already removed it
   * before this call.
   */
  private async _teardownSandbox(): Promise<void> {
    if (!this._sandboxId) return;
    const destroyedSandboxId = this._sandboxId;
    // Invalidate any in-flight probe so it doesn't re-populate the registry
    // after we've deleted the entry below. The probe checks this generation
    // before calling set(). Also drop the re-probe target so later execs
    // don't restart a probe against the deleted sandbox's address.
    this._probeGeneration++;
    this._probeTarget = null;
    this._transportReadyPromise = null;
    await this._request(`/sandbox/${encodeURIComponent(destroyedSandboxId)}`, { method: 'DELETE' });
    // Clear local state so a subsequent start() creates a fresh remote sandbox
    // instead of taking the reattach branch and pointing exec at a deleted resource.
    this._sandboxId = undefined;
    this._createdAt = null;
    // Drop the exec lease with the sandbox — the JWT is tied to the provider
    // instance id and would be rejected against a fresh one.
    this._lease = null;
    // Evict the sidecar address from the registry explicitly. Destroy
    // deallocates the IPv6, so any stale entry would be a dial-to-nowhere;
    // clearing here prevents a transport-failure round-trip on the next
    // exec against a reused instance. A subsequent start() (fresh provision
    // or reattach) will re-populate the entry from the workspace-proxy's
    // response.
    this._addressRegistry?.delete(destroyedSandboxId);
  }

  /** Persist the configured recovery checkpoint when available. */
  async snapshot(): Promise<void> {
    await this.captureCheckpoint();
  }

  /** Snapshots persist real checkpoints that can seed future sandboxes. */
  readonly supportsCheckpoints: boolean = true;

  /**
   * Capture the sandbox's checkpoint on demand, outside any refresh timer the
   * workspace-proxy owns internally.
   *
   * Intended for callers (e.g. a factory-side scheduler) that want to refresh
   * the recovery checkpoint at semantic moments — turn end, session-idle,
   * pre-teardown — rather than only just before the upstream's idle destroy.
   *
   * Mirrors the OSS `@mastra/railway` `RailwaySandbox.captureCheckpoint()`
   * shape so factory can call `sandbox.captureCheckpoint()` uniformly and
   * branch on `status`/`reason` without knowing which provider is underneath.
   * Both `captured` and `coalesced` carry the checkpoint name inline so the
   * caller can persist a session→checkpoint binding atomically with the
   * awaited capture.
   *
   * Skip semantics:
   *  - No caller-supplied `id`: returns `{ status: 'skipped', reason:
   *    'no-checkpoint-name-configured' }`. An auto-generated random id is
   *    never a meaningful recovery key (no future boot would look for a
   *    checkpoint under it), so capturing would silently produce dead data.
   *  - Not started (no `_sandboxId`): returns `{ status: 'skipped', reason:
   *    'sandbox-not-running' }` without a round-trip.
   *  - Upstream 410 (workspace-proxy or Railway reports the sandbox is
   *    already destroyed): returns the same `sandbox-not-running` skip so
   *    the discriminant matches the pre-flight case. Local state
   *    (`_sandboxId`, `_lease`, sidecar address) is cleared as a side
   *    effect so the next `start()` provisions fresh instead of reattaching
   *    to a dead id. The diagnostic distinction (pre-flight vs post-hoc)
   *    is preserved in log level: debug for the expected pre-flight skip,
   *    warn for the surprise upstream destroy.
   *
   * Concurrent callers on the same instance coalesce onto a single in-flight
   * `POST /checkpoint` so N simultaneous turn-end fires (e.g. several tabs)
   * do not each round-trip the proxy. Both the originator and joiners
   * receive `{ status: 'coalesced', ... }` for the joined result — the
   * outer contract does not distinguish who started the request, only that
   * one upstream capture was made.
   *
   * Never throws for expected outcomes. Transport failures (5xx, 4xx other
   * than 410) propagate as {@link PlatformApiError}; a 410 is normalized
   * to a skip as described above.
   */
  async captureCheckpoint(): Promise<CaptureCheckpointResult> {
    if (!this._hasRecoveryKey && this._client.sandboxProvider !== 'e2b') {
      this.logger.debug(
        `captureCheckpoint skipped: no recovery key configured for sandbox ${this._sandboxId ?? '(unstarted)'}`,
      );
      return { status: 'skipped', reason: 'no-checkpoint-name-configured' };
    }

    if (!this._sandboxId) {
      this.logger.debug(`captureCheckpoint skipped: sandbox not running (local pre-flight, id=${this.id})`);
      return { status: 'skipped', reason: 'sandbox-not-running' };
    }

    if (this._captureInFlight) {
      return this._captureInFlight;
    }

    const sandboxId = this._sandboxId;
    const capture = this._doCaptureCheckpoint(sandboxId).finally(() => {
      if (this._captureInFlight === capture) {
        this._captureInFlight = null;
      }
    });
    this._captureInFlight = capture;
    return capture;
  }

  /**
   * The single `POST /checkpoint` attempt behind {@link captureCheckpoint}.
   *
   * Split out so the coalescing wrapper can install a shared in-flight
   * promise without inlining the transport + response-mapping logic.
   * Joined callers observe `{ status: 'coalesced', ... }` — the initiator
   * sees the underlying `captured` / `coalesced` / `skipped` result the
   * proxy returned. Both are legitimate: the OSS mirror uses the same
   * "initiator sees the truth, joiners see coalesced" split.
   */
  private async _doCaptureCheckpoint(sandboxId: string): Promise<CaptureCheckpointResult> {
    let response: Response;
    try {
      response = await this._request(`/sandbox/${encodeURIComponent(sandboxId)}/checkpoint`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: this.id }),
      });
    } catch (error) {
      if (error instanceof PlatformApiError && error.status === 410) {
        this.logger.warn(`captureCheckpoint skipped: sandbox destroyed upstream (proxy 410, sandboxId=${sandboxId})`);
        this._clearDestroyedState(sandboxId);
        return { status: 'skipped', reason: 'sandbox-not-running' };
      }
      throw error;
    }
    const json = (await response.json()) as { checkpointName: string; status: 'captured' | 'coalesced' | 'skipped' };
    if (json.status === 'skipped') {
      // Proxy's own `skipped` means the upstream sandbox is already
      // destroyed — same actionable outcome as a 410, so normalize to
      // the same discriminant + clear local state.
      this.logger.warn(
        `captureCheckpoint skipped: sandbox destroyed upstream (proxy reported skipped, sandboxId=${sandboxId})`,
      );
      this._clearDestroyedState(sandboxId);
      return { status: 'skipped', reason: 'sandbox-not-running' };
    }
    return { status: json.status, checkpointName: json.checkpointName };
  }

  /**
   * Clear local state that would otherwise let the caller keep exec'ing
   * against a sandbox the upstream has already destroyed. Mirrors what
   * `destroy()` does minus the outbound DELETE — the sandbox is already
   * gone, so all that remains is to stop pointing at it.
   *
   * Also resets `status` to `'pending'` so a subsequent `_start()` on this
   * reused instance re-runs provisioning instead of short-circuiting on
   * the cached `'running'` state (see `MastraSandbox._start`).
   */
  private _clearDestroyedState(destroyedSandboxId: string): void {
    this._probeGeneration++;
    this._probeTarget = null;
    this._transportReadyPromise = null;
    this._sandboxId = undefined;
    this._createdAt = null;
    this._lease = null;
    this._addressRegistry?.delete(destroyedSandboxId);
    this.status = 'pending';
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
    // Nullish check so an explicit `timeout: 0` still overrides the instance
    // default. `_runDirectExec` omits `timeoutMs` from the exec payload when
    // the value is 0, which disables the client-side timer entirely.
    const effectiveTimeout = options?.timeout ?? this._timeout;

    // Merge the sandbox env under per-call env once, up front — every exec
    // transport below (private network, WebSocket lease, E2B lease) receives
    // these options, and none of them route through the process manager.
    const sandboxEnv = this.getEnv();
    const execCallOptions =
      Object.keys(sandboxEnv).length > 0 ? { ...options, env: { ...sandboxEnv, ...options?.env } } : options;

    // Wait for the transport to become ready before proceeding. During the
    // sidecar boot window (immediately after start()), concurrent execs all
    // await the same probe promise rather than each independently racing to
    // the lease path — this coalesces the cold-start storm into a single
    // warmup attempt. Once the probe resolves (or times out after
    // TRANSPORT_READY_WAIT_MS), we check the registry and proceed.
    await this._awaitTransportReady();

    // Preferred path: dial the in-sandbox sidecar over Railway's private
    // network (~16 ms p50). No GraphQL, no lease mint, no public tcp-proxy.
    // Available only when the in-process address registry has an entry for
    // this sandboxId — populated by start() from the workspace-proxy's
    // create/reattach response when the proxy discloses `instanceUrl`. On
    // any transport failure (connection refused, mid-stream drop, no exit
    // frame) we invalidate the registry entry and fall through to the lease
    // path — application-level failures (sidecar returns 5xx) still fall
    // back for this call but do NOT invalidate the entry. See
    // `.scratch/factory-deploy/issue-platform-sandbox-exec-via-private-network.md`.
    const instanceUrl = this._addressRegistry?.get(this._sandboxId);
    if (instanceUrl) {
      const privateNet = await this._tryExecViaPrivateNetwork(
        instanceUrl,
        fullCommand,
        effectiveTimeout,
        execCallOptions,
      );
      if (privateNet) {
        const privateExit = privateNet.exitCode ?? 124;
        return {
          success: privateExit === 0,
          exitCode: privateExit,
          stdout: privateNet.stdout,
          stderr: privateNet.stderr,
          timedOut: privateNet.timedOut,
          command: fullCommand,
          executionTimeMs: Date.now() - started,
        };
      }
      // Fall through — `_tryExecViaPrivateNetwork` already evicted the
      // registry entry if this was a transport failure.
    }

    // Fallback: WebSocket direct-exec via `/exec-lease`. `_runDirectExec`
    // handles single-shot transport retry and throws typed errors on
    // unrecoverable failure: `SandboxDestroyedError` when `/exec-lease`
    // returns 410 (fleet must reprovision), `SandboxExecTransportError`
    // when the WebSocket transport fails twice against a live sandbox,
    // `PlatformApiError` for other `/exec-lease` errors (404/500/501).
    // See ./direct-exec.ts and `docs/factory/direct-sandbox-connection.md`
    // in the Platform repo.
    const result = await this._runDirectExec(fullCommand, effectiveTimeout, execCallOptions);
    // `_runDirectExec` throws on transport failure (see its jsdoc), so a
    // `null` exitCode here can only mean `timedOut: true` — the sandbox
    // never got to send an exit frame because we cut the command short.
    // Use 124 for that (the conventional timeout exit code). We are NOT
    // coercing transport-failure nulls to fake exit codes — those throw.
    const exitCode = result.exitCode ?? 124;
    return {
      success: exitCode === 0,
      exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      command: fullCommand,
      executionTimeMs: Date.now() - started,
    };
  }

  /**
   * Run a single exec against the direct-exec transport, with one in-flight
   * retry on WebSocket transport failure (socket closed without an `exit`
   * frame and the exec did not time out). The retry mints a fresh lease
   * — the failure could be a stale JWT — and reopens a new WebSocket.
   *
   * Error taxonomy:
   * - **410 on `/exec-lease`** (either attempt) → the sandbox is gone.
   *   Nulls the cached `_lease` and `_sandboxId` and throws
   *   {@link SandboxDestroyedError}. Callers (typically `SandboxFleet`) must
   *   catch this, clear the stale binding, and reprovision + replay.
   * - **Persistent transport failure** (both WS attempts close without an
   *   `exit` frame against a live sandbox) → {@link SandboxExecTransportError}
   *   with WebSocket close diagnostics.
   * - **Other `PlatformApiError`s** (404/500/501) propagate directly.
   * - **Real command result** (exit code from Railway's exit frame, or
   *   `timedOut: true`) returns normally.
   *
   * Returns a result with a real `exitCode` OR `timedOut: true`. Never
   * returns `{ exitCode: null, timedOut: false }` — that case throws.
   */
  /**
   * Drop undefined values so the result matches the Record<string, string>
   * shape the exec transports expect (`ExecuteCommandOptions.env` is
   * NodeJS.ProcessEnv). The sandbox's own env is already merged in by
   * `executeCommand` before a transport sees these options. Returns undefined
   * when there is nothing to send.
   */
  private _execEnv(options: ExecuteCommandOptions | undefined): Record<string, string> | undefined {
    if (!options?.env) return undefined;
    const filtered = Object.fromEntries(
      Object.entries(options.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    return Object.keys(filtered).length > 0 ? filtered : undefined;
  }

  private async _runDirectExec(
    fullCommand: string,
    effectiveTimeout: number | undefined,
    options: ExecuteCommandOptions | undefined,
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
    const filteredEnv = this._execEnv(options);

    let lastResult: Awaited<ReturnType<typeof execViaLease>> | undefined;
    let lastLease: CachedExecLease | undefined;
    let attemptsMade = 0;
    // Two attempts: initial + one retry. On the second attempt we drop the
    // cached lease so we don't reuse a JWT that may itself be the cause of
    // the transport failure — but only if the cache still holds the same
    // lease we just failed against. A concurrent exec sharing this instance
    // may have already cached a fresh, unrelated lease in between, and we
    // must not discard that.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0 && lastLease && this._lease === lastLease) this._lease = null;
      let lease: CachedExecLease;
      try {
        lease = await this._ensureLease();
      } catch (error) {
        // 410 → sandbox has been destroyed. Clear all cached state so a
        // reused instance re-provisions cleanly, then hand off to the fleet
        // layer via a typed error. Other PlatformApiErrors (404/500/501)
        // propagate as-is — those are configuration or platform errors, not
        // a "reprovision me" signal.
        if (error instanceof PlatformApiError && error.status === 410) {
          this._lease = null;
          const priorSandboxId = this._sandboxId;
          this._sandboxId = undefined;
          // Reset lifecycle status too: the next `ensureRunning()` must re-run
          // the full start lifecycle (acquisition + `onStart` hook) so a
          // replacement VM is set up, not just leased.
          this.status = 'stopped';
          throw new SandboxDestroyedError(
            `Sandbox ${priorSandboxId ?? '(unknown)'} was destroyed; /exec-lease returned 410`,
            {
              ...(priorSandboxId && { sandboxId: priorSandboxId }),
              command: fullCommand,
              attempts: attempt + 1,
            },
          );
        }
        throw error;
      }
      lastLease = lease;
      attemptsMade = attempt + 1;
      const leaseCwd = options?.cwd ?? this.workingDirectory;
      const execOptions = {
        command: fullCommand,
        ...(leaseCwd !== undefined && { cwd: leaseCwd }),
        ...(filteredEnv !== undefined && { env: filteredEnv }),
        ...(effectiveTimeout != null && effectiveTimeout > 0 && { timeoutMs: effectiveTimeout }),
        ...(this._webSocketFactory && { webSocketFactory: this._webSocketFactory }),
      };
      const result =
        lease.provider === 'e2b'
          ? await this._e2bExecRunner(lease, execOptions)
          : await execViaLease(lease, execOptions);
      lastResult = result;
      // `null` exitCode with `timedOut: false` means the socket closed
      // without an exit frame — a transport failure (handshake stalled,
      // mid-stream drop, expired token). Any other outcome (real exit code
      // or timed-out) is a valid result and we return it.
      if (result.exitCode !== null || result.timedOut) return result;
    }

    // Both attempts failed at the transport layer against a live sandbox.
    // Surface a loud, typed error with close diagnostics so callers can
    // distinguish "your command failed" from "the sandbox transport is
    // broken."
    const result = lastResult!;
    const lease = lastLease!;
    // The lease from the failed second attempt is still cached; drop it so
    // the next `executeCommand` doesn't waste its first attempt on the same
    // implicated JWT before minting fresh. Identity-check first so a
    // concurrent exec that has already cached a fresh, unrelated lease
    // isn't collateral-damaged.
    if (this._lease === lease) this._lease = null;
    throw new SandboxExecTransportError(
      `Direct-exec transport failed for sandbox ${this._sandboxId ?? '(unknown)'} after ${attemptsMade} attempt(s)` +
        (result.closeCode !== undefined
          ? ` (close ${result.closeCode}${result.closeReason ? ` ${result.closeReason}` : ''})`
          : ''),
      {
        ...(this._sandboxId && { sandboxId: this._sandboxId }),
        command: fullCommand,
        attempts: attemptsMade,
        opened: result.opened ?? false,
        ...(result.closeCode !== undefined && { closeCode: result.closeCode }),
        ...(result.closeReason !== undefined && { closeReason: result.closeReason }),
        wsEndpoint: lease.wsEndpoint,
      },
    );
  }

  /**
   * Try to run the exec against the in-sandbox sidecar over Railway's private
   * network. Returns the result on success (including non-zero exit codes and
   * timeouts — those are real command results, not failures). Returns
   * `undefined` when the caller should fall back to the lease path:
   *
   * - Transport failure (connection refused, mid-stream drop, no `exit`
   *   frame). The registry entry is evicted so subsequent execs skip the
   *   private-net dial until the sidecar re-registers.
   * - Sidecar answered with a non-2xx HTTP status. Registry is left intact —
   *   the address is still valid; something else is wrong (bad request,
   *   sidecar bug). Only this specific exec falls back.
   */
  private async _tryExecViaPrivateNetwork(
    instanceUrl: string,
    fullCommand: string,
    effectiveTimeout: number | undefined,
    options: ExecuteCommandOptions | undefined,
  ): Promise<PrivateNetExecResult | undefined> {
    const filteredEnv = this._execEnv(options);

    const privateNetCwd = options?.cwd ?? this.workingDirectory;
    const execOptions: PrivateNetExecOptions = {
      command: fullCommand,
      ...(privateNetCwd !== undefined && { cwd: privateNetCwd }),
      ...(filteredEnv !== undefined && { env: filteredEnv }),
      ...(effectiveTimeout != null && effectiveTimeout > 0 && { timeoutMs: effectiveTimeout }),
      ...(this._privateNetFetch && { fetch: this._privateNetFetch }),
    };

    let result: PrivateNetExecResult;
    try {
      result = await execViaPrivateNetwork(instanceUrl, execOptions);
    } catch (error) {
      if (error instanceof PrivateNetExecHttpError) {
        // Application-level failure from a reachable sidecar. Fall back for
        // this call, but do NOT evict the registry entry — future calls
        // should still prefer the private-network path.
        return undefined;
      }
      // Anything else escaping is unexpected (e.g. options validation). Treat
      // it like a transport failure so we don't wedge the caller.
      this._invalidateAddress();
      return undefined;
    }

    // A timeout is always the caller's answer, never a lease-fallback trigger:
    // the sidecar may already be running the command, so re-executing on the
    // lease path would double-run non-idempotent work (rm, git push, DB
    // migrations) and return the second result instead of `timedOut: true`.
    // If we never opened the response (pre-headers abort), the address is
    // still evicted so subsequent execs skip a dial we already know is slow —
    // but the timed-out result itself flows back to the caller unchanged.
    if (result.timedOut) {
      if (!result.opened) this._invalidateAddress();
      return result;
    }

    // A completed exec (real exit code) is a valid result — hand it back even
    // if exitCode is non-zero. Only evict when the transport itself failed:
    // never opened, or opened without an exit frame. `opened=false` here
    // means connection refused (no timeout to disambiguate).
    const transportFailed = !result.opened || result.exitCode === null;
    if (transportFailed) {
      this._invalidateAddress();
      return undefined;
    }

    return result;
  }

  /**
   * Evict this sandbox's entry from the address registry after an observed
   * transport failure. The entry stays gone until the next start() re-reads
   * `instanceUrl` from a workspace-proxy response — until then, execs skip
   * the private-net dial and go straight to the lease path.
   */
  private _invalidateAddress(): void {
    if (this._sandboxId) this._addressRegistry?.delete(this._sandboxId);
  }

  /**
   * Return a cached exec lease, minting a fresh one when the cache is empty
   * or the JWT is within {@link LEASE_REFRESH_MARGIN_MS} of `expiresAt`.
   *
   * Callers are expected to be on the "sandbox is running" path; we don't
   * re-check `_sandboxId` here because `executeCommand` already gated on it.
   */
  private async _ensureLease(): Promise<CachedExecLease> {
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
      const response = await this._request(`/sandbox/${encodeURIComponent(sandboxId)}/exec-lease`, {
        method: 'POST',
      });
      const json = (await response.json()) as ExecLeaseResponse;
      const expiresAtMs = json.expiresAt ? Date.parse(json.expiresAt) : null;
      const lease: CachedExecLease = {
        provider: json.provider,
        sandboxId: json.sandboxId,
        providerResourceId: json.providerResourceId,
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
    // Skip the workspace-proxy round-trip when the address registry has an
    // entry for this sandbox — a live entry is proof that start() saw an
    // `instanceUrl` on the create/reattach response and that no exec since
    // has evicted it via a transport failure. Serving `getInfo()` from
    // local state here removes the per-poll `GET /sandbox/:id` hit that
    // otherwise triggers a Railway GraphQL call + `sandboxExec` awk on
    // `/proc/net/if_inet6` inside the proxy.
    //
    // Note: this does NOT probe the sidecar. If the sandbox has been
    // destroyed out-of-band the next exec will fail transport, evict the
    // registry entry, and a subsequent getInfo() will fall through to the
    // proxy below and observe the true status.
    if (this._addressRegistry?.get(this._sandboxId)) {
      return {
        id: this._sandboxId,
        name: this.name,
        provider: this.provider,
        status: this.status,
        createdAt: this._createdAt ?? new Date(),
        metadata: {
          sandboxId: this._sandboxId,
        },
      };
    }
    const response = await this._request(`/sandbox/${encodeURIComponent(this._sandboxId)}`);
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
