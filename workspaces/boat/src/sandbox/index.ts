/**
 * Boat Sandbox Provider
 *
 * A Boat sandbox implementation for Mastra workspaces. Provisions a cloud Linux
 * VM on Boat (4 vCPU / 8 GB by default, Docker, Node, Python, Go and Rust
 * preinstalled), runs commands in it through the Boat Public API, and archives
 * or deletes it on teardown.
 *
 * @see https://docs.boat.dev
 */

import { BoatApi, Configuration, waitUntilReady } from '@boatdev/sdk';
import type { CreateSandboxRequest, Sandbox as BoatSandboxResource } from '@boatdev/sdk';
import type { RequestContext } from '@mastra/core/di';
import { MastraSandbox, SandboxError, SandboxNotReadyError, validateSandboxFileMode } from '@mastra/core/workspace';
import type {
  InstructionsOption,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxCloneOptions,
  SandboxInfo,
  SandboxFileInput,
  SandboxNetworking,
  WriteFilesOptions,
} from '@mastra/core/workspace';

import { shellQuote } from '../utils/shell-quote';
import { LOG_PREFIX, redactUrl, withBoatErrors } from './errors';
import { BoatProcessManager } from './process-manager';

/** Boat's public API base, used when neither `baseUrl` nor `BOAT_BASE_URL` is set. */
export const DEFAULT_BOAT_BASE_URL = 'https://boat.dev/api/v1';

/** Boat's work directory, and therefore the default `cwd` for commands and relative file paths. */
export const BOAT_WORK_DIRECTORY = '/home/user';

/** How long `start()` waits for a fresh or resumed sandbox to report `ready`. */
const DEFAULT_READY_TIMEOUT_MS = 180_000;

/**
 * How long `fork()` waits for the source sandbox to have a completed snapshot.
 *
 * Boat takes them periodically rather than on request — a fresh sandbox gets its
 * first at roughly 75 seconds — so the window has to cover that with room spare.
 */
const DEFAULT_SNAPSHOT_WAIT_MS = 240_000;

/** How often `fork()` re-checks for that snapshot. */
const SNAPSHOT_POLL_INTERVAL_MS = 5_000;

/** Machine sizes Boat will provision. `small` bills at half rate, `large` at double, `xlarge` higher still. */
export type BoatMachineType = 'small' | 'default' | 'large' | 'xlarge';

/** Sandbox states Boat considers usable without a resume. */
const LIVE_STATES = new Set(['ready', 'idle', 'running', 'provisioning', 'provisioned', 'init', 'cloning']);
/** Sandbox states a resume can bring back. */
const RESUMABLE_STATES = new Set(['archived', 'archiving']);

/**
 * Boat error codes that mean the sandbox itself can no longer run the request,
 * so the fix is to re-acquire it. Taken from the status table in
 * https://docs.boat.dev/api/v1.
 *
 * Boat archives a sandbox on its own once the TTL expires — by default an hour
 * after it started, mid-work — so hitting one of these is routine for a
 * long-lived sandbox rather than exceptional.
 *
 * Deliberately a code allowlist rather than a status range. `409` also covers
 * `fork_failed`, `resume_failed`, `account_not_ready` and
 * `provider_not_configured`, which are prerequisite conflicts a new sandbox
 * would not fix; re-acquiring on those would burn a sandbox start against the
 * account's hourly budget and still fail. `429` rate limits are likewise never
 * a reason to start another sandbox.
 */
const SANDBOX_DEAD_CODES = new Set([
  'MACHINE_NOT_RUNNING',
  'NOT_FOUND',
  'SANDBOX_NOT_FOUND',
  'SANDBOX_ARCHIVED',
  'SANDBOX_NOT_RUNNING',
  'BOAT_NOT_FOUND',
  'BOAT_ARCHIVED',
  'BOAT_STARTING',
]);

/**
 * `404` always means the sandbox is gone, whatever code accompanies it — Boat
 * documents the remedy as "refresh local state; the sandbox no longer exists".
 */
const SANDBOX_GONE_STATUS = 404;

/** Options for {@link BoatSandbox.fork}. */
export interface BoatForkOptions extends SandboxCloneOptions {
  /**
   * How long to wait for the source sandbox to have a completed snapshot, in
   * milliseconds. Defaults to four minutes, which covers the roughly 75 seconds
   * a freshly created sandbox takes to get its first.
   */
  snapshotTimeoutMs?: number;
}

/** What `find()` hands to `connect()`: the sandbox Boat already has for this id. */
interface BoatStartHandle {
  sandbox: BoatSandboxResource;
  /** Whether the sandbox has to be resumed before it can run anything. */
  needsResume: boolean;
}

// =============================================================================
// Boat Sandbox Options
// =============================================================================

/** Boat sandbox provider configuration. */
export interface BoatSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Unique identifier for this sandbox instance. */
  id?: string;
  /** Boat API key. Falls back to the `BOAT_API_KEY` env var. */
  apiKey?: string;
  /** Boat API base URL. Falls back to `BOAT_BASE_URL`, then Boat's public API. */
  baseUrl?: string;
  /**
   * Reattach to an existing Boat sandbox by its Boat id (`bx_…`) instead of
   * creating a new one. An archived sandbox is resumed on `start()`.
   */
  sandboxId?: string;
  /**
   * Machine size. `small` consumes machine time at half rate, `large` at twice
   * the default and `xlarge` more again. Defaults to Boat's `default`.
   */
  machineType?: BoatMachineType;
  /**
   * Seconds before Boat automatically archives the sandbox. Defaults to Boat's
   * own auto-stop (1 hour). Pass `null` to disable auto-stop entirely — that
   * needs a payment method on the account and is refused on the free trial.
   */
  ttlSeconds?: number | null;
  /**
   * Environment variables for the sandbox. Injected at creation on top of the
   * account environment's variables, and applied to every command so they
   * survive a resume onto a fresh VM.
   */
  env?: Record<string, string>;
  /**
   * Create the sandbox with none of the account's secrets attached. Use this for
   * sandboxes handed to your own end users. A fork of a no-env sandbox is always
   * no-env.
   */
  noEnv?: boolean;
  /** Name of the Boat environment (repositories, secrets, credentials) to attach. */
  environment?: string;
  /** Script run in the background once at creation. Max 64KB, UTF-8. */
  setupScript?: string;
  /** Organization wallet to bill this sandbox to. */
  org?: string;
  /**
   * Named Boat snapshot this sandbox saves to on `snapshot()` and boots from on
   * `start()`. This is the checkpoint mechanism: without it `snapshot()` does
   * nothing, because Boat's automatic stop-time snapshots are not addressable by name.
   */
  checkpointName?: string;
  /**
   * Named snapshot used to seed a brand-new sandbox when `checkpointName` has
   * nothing saved yet. Boot-only — `snapshot()` keeps writing to `checkpointName`.
   */
  seedCheckpointName?: string;
  /**
   * Default command timeout in milliseconds, applied to commands that don't set
   * their own. When omitted, commands run until they exit.
   */
  timeout?: number;
  /**
   * Expose hosted ports without Boat's `_token` query parameter.
   *
   * Defaults to `false`, matching Boat: a fresh hosted port is token-gated, and
   * `getPortUrl()` returns a URL that carries the token. Set this when the
   * preview URL has to be openable by anyone who receives it.
   */
  publicPorts?: boolean;
  /** Custom fetch implementation, primarily for advanced networking setup and tests. */
  fetch?: typeof globalThis.fetch;
  /**
   * Custom instructions that override the default `getInstructions()` output.
   *
   * - `string` — replaces the defaults; pass `''` to suppress instructions.
   * - `(opts) => string` — receives the defaults and the request context.
   */
  instructions?: InstructionsOption;
}

// =============================================================================
// Boat Sandbox Implementation
// =============================================================================

/**
 * Boat sandbox provider for Mastra workspaces.
 *
 * Features:
 * - Cloud Linux VM provisioned on demand, archived (not destroyed) on `stop()`
 * - Command execution with streaming output, timeouts, abort and background processes
 * - Public HTTPS preview URLs for ports inside the sandbox
 * - Named snapshots as checkpoints, and forking a sandbox from its latest snapshot
 * - Reattaching to an existing sandbox by Boat id
 *
 * @example Basic usage
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { BoatSandbox } from '@mastra/boat';
 *
 * const sandbox = new BoatSandbox({
 *   // apiKey read from BOAT_API_KEY
 *   machineType: 'large',
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * const result = await workspace.executeCode('console.log("Hello!")');
 * ```
 *
 * @example A sandbox handed to an end user, with a preview URL
 * ```typescript
 * const sandbox = new BoatSandbox({ noEnv: true, ttlSeconds: null });
 * await sandbox._start();
 * await sandbox.processes.spawn('npm run dev -- --host 0.0.0.0 --port 3000');
 * const url = await sandbox.networking.getPortUrl(3000);
 * ```
 */
export class BoatSandbox extends MastraSandbox<BoatStartHandle> {
  readonly id: string;
  readonly name = 'BoatSandbox';
  readonly provider = 'boat';
  status: ProviderStatus = 'pending';

  declare readonly processes: BoatProcessManager;

  /** Boat saves named snapshots, so checkpoints are real here. */
  readonly supportsCheckpoints: boolean = true;

  /**
   * Register a public HTTPS route for a port and return its URL.
   *
   * Boat's hosted URLs are stable per sandbox and port, and asking again returns
   * the same one, so this is safe to call repeatedly. The service inside the
   * sandbox must bind `0.0.0.0` — a server on `localhost` is unreachable from
   * the route, which terminates outside the application process.
   *
   * The returned URL carries an access token unless the sandbox was constructed
   * with `publicPorts: true`. Treat it as a secret.
   */
  readonly networking: SandboxNetworking = {
    getPortUrl: async (port: number): Promise<string | null> => {
      if (this.status !== 'running' || !this._sandboxId) return null;

      const response = await withBoatErrors('host port', () =>
        this._api.hostPort({
          sandboxId: this._sandboxId!,
          hostPortRequest: { port, ...(this._publicPorts && { _public: true }) },
        }),
      );

      if (!response.url) return null;
      this.logger.debug('Hosted Boat port', { sandbox: this.id, port, url: redactUrl(response.url) });
      return response.url;
    },
  };

  private readonly _api: BoatApi;
  private _sandbox: BoatSandboxResource | null = null;
  private _sandboxId?: string;
  private _createdAt: Date | null = null;
  /** The named snapshot this sandbox actually booted from, when it booted from one. */
  private _restoredCheckpointName?: string;
  /** Guards `retryOnDead` so a retry that also fails cannot recurse. */
  private _isRetrying = false;

  private readonly _apiKey?: string;
  private readonly _baseUrl: string;
  private readonly _machineType?: BoatMachineType;
  private readonly _ttlSeconds?: number | null;
  private readonly _env: Record<string, string>;
  private readonly _noEnv?: boolean;
  private readonly _environment?: string;
  private readonly _setupScript?: string;
  private readonly _org?: string;
  private readonly _checkpointName?: string;
  private readonly _seedCheckpointName?: string;
  private readonly _timeout?: number;
  private readonly _publicPorts: boolean;
  private readonly _fetch?: typeof globalThis.fetch;
  private readonly _instructionsOverride?: InstructionsOption;

  constructor(options: BoatSandboxOptions = {}) {
    super({
      ...options,
      name: 'BoatSandbox',
      // Boat resolves a relative `cwd` against its work directory, but the
      // workspace contract treats `workingDirectory` as a real path that shows
      // up in `pwd`, so default to the absolute one.
      workingDirectory: options.workingDirectory ?? BOAT_WORK_DIRECTORY,
      processes: new BoatProcessManager(),
    });

    this.id = options.id ?? `boat-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._apiKey = options.apiKey ?? process.env.BOAT_API_KEY;
    this._baseUrl = options.baseUrl ?? process.env.BOAT_BASE_URL ?? DEFAULT_BOAT_BASE_URL;
    this._sandboxId = options.sandboxId;
    this._machineType = options.machineType;
    this._ttlSeconds = options.ttlSeconds;
    this._env = options.env ?? {};
    this._noEnv = options.noEnv;
    this._environment = options.environment;
    this._setupScript = options.setupScript;
    this._org = options.org;
    this._checkpointName = options.checkpointName;
    this._seedCheckpointName = options.seedCheckpointName;
    this._timeout = options.timeout;
    this._publicPorts = options.publicPorts ?? false;
    this._fetch = options.fetch;
    this._instructionsOverride = options.instructions;

    this._api = new BoatApi(
      new Configuration({
        basePath: this._baseUrl,
        ...(this._apiKey !== undefined && { accessToken: this._apiKey }),
        ...(this._fetch !== undefined && { fetchApi: this._fetch }),
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /**
   * The underlying Boat API client, for calls this provider doesn't wrap
   * (prompts, events, desktop streaming, webhooks).
   */
  get boat(): BoatApi {
    return this._api;
  }

  /**
   * Boat's own id for the running sandbox (`bx_…`).
   *
   * @throws {SandboxNotReadyError} when the sandbox has not been started.
   */
  get boatSandboxId(): string {
    if (!this._sandboxId) throw new SandboxNotReadyError(this.id);
    return this._sandboxId;
  }

  /** The Boat sandbox resource as of the last API response, or `null` before `start()`. */
  get resource(): BoatSandboxResource | null {
    return this._sandbox;
  }

  /** Default command timeout in milliseconds, when one is configured. */
  get defaultTimeout(): number | undefined {
    return this._timeout;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle — acquisition primitives
  //
  // The base class orchestrates find → connect → create and derives the start
  // outcome from which branch ran, so none of these manage status or coalescing.
  // ---------------------------------------------------------------------------

  /**
   * Look for a Boat sandbox to reuse.
   *
   * Only an explicitly configured `sandboxId` (or one this instance started
   * earlier) is a candidate — Boat has no way to look a sandbox up by a caller's
   * own id, so there is nothing else to search. A sandbox Boat has forgotten, or
   * one in `error`, yields `undefined` so the base class provisions a fresh one.
   */
  protected override async find(): Promise<BoatStartHandle | undefined> {
    if (!this._sandboxId) return undefined;

    let sandbox: BoatSandboxResource;
    try {
      const response = await this._api.get({ sandboxId: this._sandboxId });
      sandbox = response.sandbox;
    } catch (error) {
      this.logger.debug('Configured Boat sandbox could not be fetched; provisioning a new one', {
        sandbox: this.id,
        boatSandboxId: this._sandboxId,
        error,
      });
      return undefined;
    }

    if (LIVE_STATES.has(sandbox.state)) return { sandbox, needsResume: false };
    if (RESUMABLE_STATES.has(sandbox.state)) return { sandbox, needsResume: true };

    this.logger.debug('Configured Boat sandbox is unusable; provisioning a new one', {
      sandbox: this.id,
      boatSandboxId: this._sandboxId,
      state: sandbox.state,
    });
    return undefined;
  }

  /** Adopt the sandbox {@link find} located, resuming it first when it was archived. */
  protected override async connect(handle: BoatStartHandle): Promise<void> {
    const sandboxId = handle.sandbox.id;

    if (handle.needsResume) {
      await withBoatErrors('resume', () =>
        this._api.resume({
          sandboxId,
          resumeRequest: {
            ...(this._machineType !== undefined && { type: this._machineType }),
            ...(this._ttlSeconds !== undefined && { ttlSeconds: this._ttlSeconds }),
            ...(Object.keys(this._env).length > 0 && { env: this._env }),
            ...(this._environment !== undefined && { environment: this._environment }),
            ...(this._noEnv !== undefined && { noEnv: this._noEnv }),
          },
        }),
      );
    }

    await this._adopt(sandboxId);
  }

  /** Provision a fresh Boat sandbox, seeded from a named snapshot when one is configured. */
  protected override async create(): Promise<void> {
    const from = await this._resolveBootSnapshot();

    const request: CreateSandboxRequest = {
      ...(this._machineType !== undefined && { type: this._machineType }),
      // `ttlSeconds` is deliberately only sent when configured: omitting it
      // leaves Boat's own auto-stop in place, while sending `null` disables it
      // and is refused outright on trial accounts.
      ...(this._ttlSeconds !== undefined && { ttlSeconds: this._ttlSeconds }),
      ...(Object.keys(this._env).length > 0 && { env: this._env }),
      ...(this._environment !== undefined && { environment: this._environment }),
      ...(this._noEnv !== undefined && { noEnv: this._noEnv }),
      ...(this._setupScript !== undefined && { setupScript: this._setupScript }),
      ...(this._org !== undefined && { org: this._org }),
      ...(from !== undefined && { from }),
    };

    const created = await withBoatErrors('create', () => this._api.create({ createSandboxRequest: request }));
    this._restoredCheckpointName = from;
    await this._adopt(created.sandbox.id);
  }

  /**
   * Pick the named snapshot a fresh sandbox should boot from.
   *
   * `checkpointName` wins when it exists; `seedCheckpointName` is the fallback
   * for the first boot, before anything has been saved. A name that doesn't
   * resolve is skipped rather than failing the start — a missing checkpoint
   * means "nothing saved yet", which is the normal first run.
   */
  private async _resolveBootSnapshot(): Promise<string | undefined> {
    for (const name of [this._checkpointName, this._seedCheckpointName]) {
      if (!name) continue;
      try {
        await this._api.getNamedSnapshot({ name });
        return name;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  /** Wait for a sandbox to be ready and record it as this instance's live sandbox. */
  private async _adopt(sandboxId: string): Promise<void> {
    this._sandboxId = sandboxId;
    const sandbox = await withBoatErrors('waiting for sandbox to become ready', () =>
      waitUntilReady(this._api, sandboxId, { timeoutMs: DEFAULT_READY_TIMEOUT_MS }),
    );
    this._sandbox = sandbox;
    this._createdAt = sandbox.createdAt ?? new Date();

    if (sandbox.setupStatus === 'failed') {
      this.logger.warn('Boat sandbox setup script failed', {
        sandbox: this.id,
        boatSandboxId: sandboxId,
        setupError: sandbox.setupError,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle — teardown
  // ---------------------------------------------------------------------------

  /**
   * Archive the sandbox.
   *
   * Boat snapshots the disk first, so a stopped sandbox can be resumed with its
   * filesystem intact — which is why the Boat id is kept, letting the next
   * `start()` reconnect instead of provisioning.
   */
  async stop(): Promise<void> {
    if (!this._sandboxId) return;
    await withBoatErrors('stop', () => this._api.stop({ sandboxId: this._sandboxId! }));
    this._sandbox = null;
  }

  /**
   * Permanently delete the sandbox and every snapshot only it uses.
   *
   * This is not reversible: use `stop()` to keep the data. Snapshot data that a
   * fork, a resume, or a named snapshot still reads is retained by Boat.
   */
  async destroy(): Promise<void> {
    if (!this._sandboxId) return;
    const sandboxId = this._sandboxId;
    try {
      // Boat requires the target id echoed back as a confirmation header before
      // it will permanently delete anything.
      await this._api.deleteSandbox({ sandboxId, xAsciiConfirmDelete: sandboxId });
    } catch (error) {
      // Teardown is best-effort: a sandbox Boat already reaped is the expected
      // case once auto-stop has run, and must not fail a workspace shutdown.
      this.logger.warn('Failed to delete Boat sandbox', { sandbox: this.id, boatSandboxId: sandboxId, error });
    } finally {
      this._sandbox = null;
      this._sandboxId = undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Checkpoints
  // ---------------------------------------------------------------------------

  /**
   * Save the sandbox's current filesystem to the configured named snapshot.
   *
   * No-ops without a `checkpointName`, because Boat's automatic stop-time
   * snapshots have no name to boot from later. Saving is asynchronous on Boat's
   * side — this returns once the save is accepted.
   */
  async snapshot(): Promise<void> {
    if (!this._checkpointName || !this._sandboxId) return;
    await withBoatErrors('save named snapshot', () =>
      this._api.saveNamedSnapshot({
        namedSnapshotSaveRequest: { sandboxId: this._sandboxId!, name: this._checkpointName! },
      }),
    );
  }

  /**
   * Create an independent Boat sandbox from this one's latest snapshot.
   *
   * Blocks until that snapshot exists. Boat refuses to fork a sandbox it has no
   * completed snapshot of, and takes them on its own schedule rather than on
   * request, so a sandbox forked soon after creation waits out its first one —
   * about 75 seconds. Waiting beats surfacing a `fork_failed` the caller can do
   * nothing about except retry.
   *
   * The source sandbox is never modified. A fork does not inherit auto-stop, so
   * this passes the configured `ttlSeconds` through rather than letting the copy
   * silently fall back to one hour.
   *
   * @param options - Clone overrides for the copy, plus `snapshotTimeoutMs` to
   *   change how long to wait for that snapshot.
   * @returns a started {@link BoatSandbox} bound to the forked Boat sandbox.
   * @throws {SandboxError} with code `TIMEOUT` if no snapshot completes in time.
   */
  async fork(options: BoatForkOptions = {}): Promise<BoatSandbox> {
    await this._waitForSnapshot(options.snapshotTimeoutMs);

    const forked = await withBoatErrors('fork', () =>
      this._api.fork({
        sandboxId: this.boatSandboxId,
        forkRequest: {
          ...(this._machineType !== undefined && { type: this._machineType }),
          ...(this._ttlSeconds !== undefined && { ttlSeconds: this._ttlSeconds }),
          ...(options.env ? { env: options.env } : Object.keys(this._env).length > 0 ? { env: this._env } : {}),
          ...(this._noEnv !== undefined && { noEnv: this._noEnv }),
        },
      }),
    );

    const forkedId = forked.sandbox?.id ?? forked.id;
    if (!forkedId) {
      throw new SandboxError(`${LOG_PREFIX} fork did not return a sandbox id`, 'EXECUTION_FAILED');
    }

    const clone = this.clone({ ...options, sandboxId: forkedId });
    await clone._start();
    return clone;
  }

  /**
   * Wait until Boat has a completed snapshot of this sandbox.
   *
   * `snapshotAvailable` is the flag Boat gates forking on; `lastSnapshotStatus`
   * only says whether one is in flight, so it is reported on timeout rather than
   * waited on.
   */
  private async _waitForSnapshot(timeoutMs: number = DEFAULT_SNAPSHOT_WAIT_MS): Promise<void> {
    const sandboxId = this.boatSandboxId;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const { sandbox } = await withBoatErrors('read sandbox', () => this._api.get({ sandboxId }));
      this._sandbox = sandbox;
      if (sandbox.snapshotAvailable) return;

      if (Date.now() >= deadline) {
        throw new SandboxError(
          `${LOG_PREFIX} cannot fork '${sandboxId}': Boat had no completed snapshot after ${Math.round(timeoutMs / 1000)}s. Snapshots are taken periodically, and again when a sandbox stops.`,
          'TIMEOUT',
          { sandboxId, lastSnapshotStatus: sandbox.lastSnapshotStatus },
        );
      }

      this.logger.debug('Waiting for a completed Boat snapshot before forking', {
        sandbox: this.id,
        boatSandboxId: sandboxId,
        lastSnapshotStatus: sandbox.lastSnapshotStatus,
      });
      await new Promise(resolve => setTimeout(resolve, SNAPSHOT_POLL_INTERVAL_MS));
    }
  }

  /**
   * Build an independent sibling sandbox that inherits this one's configuration.
   *
   * Performs no I/O — the clone provisions (or, with `sandboxId`, reattaches) on
   * its own `start()`.
   */
  clone(options: SandboxCloneOptions = {}): BoatSandbox {
    return new BoatSandbox({
      ...(options.id !== undefined && { id: options.id }),
      ...(options.sandboxId !== undefined && { sandboxId: options.sandboxId }),
      ...(this._apiKey !== undefined && { apiKey: this._apiKey }),
      baseUrl: this._baseUrl,
      ...(this._machineType !== undefined && { machineType: this._machineType }),
      ...(this._ttlSeconds !== undefined && { ttlSeconds: this._ttlSeconds }),
      env: options.env ?? this._env,
      ...(this._noEnv !== undefined && { noEnv: this._noEnv }),
      ...(this._environment !== undefined && { environment: this._environment }),
      ...(this._setupScript !== undefined && { setupScript: this._setupScript }),
      ...(this._org !== undefined && { org: this._org }),
      ...((options.checkpointName ?? this._checkpointName)
        ? { checkpointName: options.checkpointName ?? this._checkpointName }
        : {}),
      ...((options.seedCheckpointName ?? this._seedCheckpointName)
        ? { seedCheckpointName: options.seedCheckpointName ?? this._seedCheckpointName }
        : {}),
      ...(this._timeout !== undefined && { timeout: this._timeout }),
      publicPorts: this._publicPorts,
      ...(this._fetch !== undefined && { fetch: this._fetch }),
      ...(options.workingDirectory !== undefined && { workingDirectory: options.workingDirectory }),
      ...(this._instructionsOverride !== undefined && { instructions: this._instructionsOverride }),
    });
  }

  // ---------------------------------------------------------------------------
  // File upload
  // ---------------------------------------------------------------------------

  /**
   * Write files into the sandbox filesystem.
   *
   * Boat writes one file per request with no permission field, so files go up
   * concurrently (bounded, to stay under its rate limits) and any requested
   * modes are applied afterwards in a single `chmod` command. Paths must
   * canonicalize under `/home/user` or `/tmp`; anything else is rejected by Boat.
   *
   * Not atomic: a failure part-way leaves the files already written in place,
   * and the caller owns the cleanup.
   */
  async writeFiles(files: SandboxFileInput[], options?: WriteFilesOptions): Promise<void> {
    if (files.length === 0) return;
    for (const file of files) {
      if (file.mode !== undefined) validateSandboxFileMode(file.mode);
    }

    await this.ensureRunning();
    const sandboxId = this.boatSandboxId;

    const CONCURRENCY = 8;
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      if (options?.abortSignal?.aborted) {
        throw new SandboxError(`${LOG_PREFIX} writeFiles aborted`, 'ABORTED');
      }

      const batch = files.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(file => {
          const isBuffer = Buffer.isBuffer(file.content);
          return withBoatErrors(`write ${file.path}`, () =>
            this._api.writeFile({
              sandboxId,
              fileWriteRequest: {
                path: file.path,
                content: isBuffer ? (file.content as Buffer).toString('base64') : (file.content as string),
                encoding: isBuffer ? 'base64' : 'utf8',
              },
            }),
          );
        }),
      );
    }

    const withModes = files.filter(file => file.mode !== undefined);
    if (withModes.length === 0) return;

    const chmods = withModes
      .map(file => `chmod ${file.mode!.toString(8).padStart(3, '0')} ${shellQuote(file.path)}`)
      .join(' && ');
    const result = await withBoatErrors('apply file modes', () =>
      this._api.command({ sandboxId, commandRequest: { command: chmods, timeoutSeconds: 30 } }),
    );

    if (result.type === 'command.finished' && result.exitCode !== 0) {
      throw new SandboxError(`${LOG_PREFIX} failed to apply file modes: ${result.stderr}`, 'EXECUTION_FAILED', {
        exitCode: result.exitCode,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Retry on Dead
  // ---------------------------------------------------------------------------

  /** Whether this error means the sandbox is gone or not currently usable. */
  private isSandboxDeadError(error: unknown): boolean {
    if (!(error instanceof SandboxError)) return false;
    if (SANDBOX_DEAD_CODES.has(error.code)) return true;
    return error.details?.status === SANDBOX_GONE_STATUS;
  }

  /**
   * Drop the stale sandbox reference so the next start re-acquires one.
   *
   * The Boat id is deliberately kept: Boat archives rather than deletes, so
   * `find()` resumes this same sandbox with its filesystem intact, and falls
   * through to provisioning only when Boat has genuinely forgotten it.
   */
  private handleSandboxGone(): void {
    this._sandbox = null;

    // Anything mounted belonged to the VM that just went away.
    if (this.mounts) {
      for (const [path, entry] of this.mounts.entries) {
        if (entry.state === 'mounted' || entry.state === 'mounting') {
          this.mounts.set(path, { state: 'pending' });
        }
      }
    }

    this.status = 'stopped';
  }

  /**
   * Run a function, re-acquiring the sandbox and retrying once if it turns out
   * to be dead. Used by {@link BoatProcessManager} so a sandbox Boat archived
   * out from under a long-running session recovers transparently.
   */
  async retryOnDead<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.isSandboxDeadError(error) && !this._isRetrying) {
        this.handleSandboxGone();
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
  // Info & instructions
  // ---------------------------------------------------------------------------

  async getInfo(): Promise<SandboxInfo> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      ...(this._sandbox?.archiveAfter ? { timeoutAt: this._sandbox.archiveAfter } : {}),
      ...(this._sandbox?.vcpu !== undefined || this._sandbox?.memoryGB !== undefined
        ? {
            resources: {
              ...(this._sandbox.vcpu !== undefined && { cpuCores: this._sandbox.vcpu }),
              ...(this._sandbox.memoryGB !== undefined && { memoryMB: this._sandbox.memoryGB * 1024 }),
            },
          }
        : {}),
      metadata: {
        ...(this._sandboxId && { boatSandboxId: this._sandboxId }),
        ...(this._sandbox && {
          state: this._sandbox.state,
          machineType: this._sandbox.type,
          snapshotAvailable: this._sandbox.snapshotAvailable,
          ...(this._sandbox.subdomain && { subdomain: this._sandbox.subdomain }),
        }),
        ...(this._restoredCheckpointName && { restoredCheckpointName: this._restoredCheckpointName }),
      },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = this._buildDefaultInstructions();

    if (typeof this._instructionsOverride === 'string') return this._instructionsOverride;
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({ defaultInstructions, requestContext: opts?.requestContext });
    }
    return defaultInstructions;
  }

  private _buildDefaultInstructions(): string {
    const parts: string[] = [
      'Boat cloud sandbox: an isolated Linux VM with outbound internet access, Docker, Node, Python, Go and Rust preinstalled.',
      `Commands run in ${this.workingDirectory ?? BOAT_WORK_DIRECTORY}; writes are limited to that directory and /tmp.`,
    ];

    parts.push(
      this._timeout !== undefined
        ? `Default command timeout: ${Math.ceil(this._timeout / 1000)}s.`
        : 'Commands run until they exit unless a timeout is set.',
    );

    if (this._ttlSeconds === null) {
      parts.push('Auto-stop is disabled; the sandbox runs until it is stopped.');
    } else if (this._ttlSeconds !== undefined) {
      parts.push(
        `The sandbox is archived automatically ${Math.round(this._ttlSeconds / 60)} minute(s) after starting.`,
      );
    } else {
      parts.push('The sandbox is archived automatically one hour after starting.');
    }

    parts.push(
      'To expose an HTTP service, bind it to 0.0.0.0 and ask for its public URL — a server on localhost is not reachable from outside.',
    );

    return parts.join(' ');
  }
}
