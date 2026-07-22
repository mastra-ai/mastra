/**
 * Project sandbox fleet: provisioning, reattach, teardown, and budgeting.
 *
 * Server-hosted projects never run on the web host itself. Each project gets
 * its own isolated sandbox (a `WorkspaceSandbox`, e.g. a Railway VM) `clone()`d
 * from the machine the factory was configured with. This module owns everything
 * about that fleet — which provider is active, where checkouts live inside a
 * sandbox, the idle window, the per-replica budget, and the
 * provision/reattach/teardown lifecycle — but knows nothing about what runs
 * inside a sandbox (git materialization lives with its feature, e.g. the
 * GitHub integration's `sandbox.ts`).
 *
 * The fleet is constructed once at boot with the machine config (or none, when
 * sandboxes are disabled) and handed to consumers — no global registry.
 * Persistence of the provider's reattach id is delegated to the caller via
 * {@link SandboxBindingStore}, so the fleet stays storage-agnostic. Tests can
 * swap the low-level construction via {@link SandboxFleet.setFactory}.
 */

import path from 'node:path';

import type { WorkspaceSandbox } from '@mastra/core/workspace';

/** Minimal command result shape sandbox consumers depend on. */
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Minimal live-sandbox surface fleet consumers need: an id, a way to start it,
 * a way to learn the provider's reattach id, and command execution.
 */
export interface MaterializationSandbox {
  readonly id: string;
  start(): Promise<void>;
  getInfo(): Promise<{ metadata?: Record<string, unknown> }>;
  executeCommand(
    command: string,
    args?: string[],
    options?: { timeout?: number; env?: Record<string, string | undefined> },
  ): Promise<SandboxCommandResult>;
  /** Tear down the underlying VM. Optional: providers without it are no-ops. */
  stop?(): Promise<void>;
}

/** Options for building (or reattaching) one sandbox. */
export interface SandboxCreateOptions {
  /** Reattach to this existing provider VM instead of provisioning a new one. */
  providerSandboxId?: string;
  /** Environment variables baked into the sandbox. */
  env?: Record<string, string>;
  /** Provider working directory for this sandbox. */
  workingDirectory?: string;
  /** Idle teardown window (minutes). The provider stops the VM after this idle period. */
  idleTimeoutMinutes?: number;
  /** Provider checkpoint used to seed and preserve this sandbox's filesystem. */
  checkpointName?: string;
}

/**
 * A coarse-grained step of the sandbox-preparation flow, reported as it happens
 * so the UI can show the user what the server is doing instead of a static
 * "Preparing…" toast. `phase` is a stable machine token; `message` is
 * user-facing copy.
 */
export interface PrepareProgress {
  phase: 'reattaching' | 'provisioning' | 'preparing-workspace' | 'cloning' | 'pulling' | 'finalizing' | 'done';
  message: string;
}

/** Callback invoked with each preparation step. Best-effort; never throws. */
export type ProgressFn = (event: PrepareProgress) => void;

/** Invoke a progress callback without letting it break the actual work. */
export function reportProgress(onProgress: ProgressFn | undefined, event: PrepareProgress): void {
  if (!onProgress) return;
  try {
    onProgress(event);
  } catch {
    // Progress reporting must never break the actual work.
  }
}

/**
 * Factory that builds a (not-yet-started) sandbox. When `providerSandboxId` is
 * provided the sandbox should reattach to that existing VM instead of
 * provisioning a new one.
 */
export type SandboxFactory = (opts: SandboxCreateOptions) => MaterializationSandbox;

/** Raised when provisioning would exceed the per-replica sandbox budget. */
export class SandboxBudgetError extends Error {
  readonly code = 'sandbox-budget-exceeded' as const;
  constructor(readonly max: number) {
    super(
      `Sandbox budget exceeded: this server already has ${max} active sandbox(es), ` +
        `the configured per-replica maximum. Close an existing repository's sandbox and try again.`,
    );
    this.name = 'SandboxBudgetError';
  }
}

/** Optional knobs for provisioning/reattaching one sandbox. */
export interface EnsureSandboxOptions {
  /** Provider working directory for this sandbox. */
  workingDirectory?: string;
}

/**
 * Where a feature persists its sandbox binding. The fleet reads the stored
 * reattach id and writes updates through this seam so it stays agnostic of
 * the owning table (GitHub projects today, anything else tomorrow).
 */
export interface SandboxBindingStore {
  /** Stored provider reattach id from a previous provisioning, if any. */
  readonly sandboxId: string | null;
  /** Provider checkpoint used to seed and preserve this sandbox's filesystem. */
  readonly checkpointName?: string;
  /** Persist a freshly provisioned provider id, or clear a stale one with `null`. */
  setSandboxId(id: string | null): Promise<void>;
  /** Clear all stored sandbox state (reattach id + materialization mark) on teardown. */
  clear(): Promise<void>;
}

/**
 * Adapt a cloned `WorkspaceSandbox` to the minimal surface this module needs.
 * Lifecycle goes through the `_`-prefixed wrappers when present (they add
 * status tracking and concurrency safety on `MastraSandbox` subclasses),
 * falling back to the plain methods for interface-only implementations.
 */
function toMaterializationSandbox(
  sandbox: WorkspaceSandbox,
  environment: Record<string, string> = {},
): MaterializationSandbox {
  if (typeof sandbox.executeCommand !== 'function') {
    throw new Error(
      `Sandbox provider '${sandbox.provider}' does not implement executeCommand() — cannot materialize repos.`,
    );
  }
  const lifecycle = sandbox as { _start?(): Promise<void>; _stop?(): Promise<void> };
  return {
    id: sandbox.id,
    start: async () => {
      await (lifecycle._start ?? sandbox.start)?.call(sandbox);
    },
    getInfo: async () => (await sandbox.getInfo?.()) ?? {},
    executeCommand: (command, args, options) =>
      sandbox.executeCommand!(command, args, {
        ...options,
        env: { ...environment, ...options?.env },
      }),
    stop: async () => {
      await (lifecycle._stop ?? sandbox.stop)?.call(sandbox);
    },
  };
}

/**
 * The provider's reattach id for a started sandbox. For Railway this is the
 * underlying `railwaySandboxId` in `getInfo().metadata`. Providers without a
 * provider-native id (e.g. local) reattach by construction id, so fall back
 * to the sandbox's own logical id.
 */
async function readProviderSandboxId(sandbox: MaterializationSandbox): Promise<string | undefined> {
  const info = await sandbox.getInfo();
  const id = info.metadata?.railwaySandboxId ?? info.metadata?.sandboxId;
  return typeof id === 'string' ? id : sandbox.id;
}

/** Keep each path piece a single safe segment (no separators or traversal). */
function sanitizeSegment(segment: string): string {
  const cleaned = segment.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  return cleaned || 'repo';
}

/** Resolve a workdir under `root`, refusing any path that escapes the configured root. */
export function resolveContainedLocalWorkdir(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (resolved !== resolvedRoot && resolved.startsWith(`${resolvedRoot}${path.sep}`)) return resolved;
  throw new Error(`Refusing to use local sandbox path outside configured root: ${resolved}`);
}

/**
 * Factory-resolved sandbox runtime the fleet is constructed with: the machine
 * projects clone their per-project sandboxes from, plus the knobs the factory
 * resolved around it.
 */
export interface SandboxFleetConfig {
  /**
   * Template machine (validated by the factory to implement `clone()`).
   * Never started — acts purely as the credential/default holder that
   * per-project sandboxes are cloned from.
   */
  machine: WorkspaceSandbox;
  /** In-sandbox base directory repos check out under (no trailing slash). */
  workdirBase: string;
  /** Per-replica cap on concurrently provisioned sandboxes. 0 = unlimited. */
  maxSandboxes?: number;
}

/**
 * The sandbox fleet for one deployment. Constructed once at boot — with a
 * config when a sandbox machine was configured, or without one when sandboxes
 * are disabled (every provisioning entry point then throws and
 * {@link enabled} reports `false` so features stay off).
 */
export class SandboxFleet {
  readonly #config: SandboxFleetConfig | undefined;
  #factory: SandboxFactory | undefined;
  #liveCount = 0;

  constructor(config?: SandboxFleetConfig) {
    this.#config = config;
  }

  /**
   * True when a sandbox machine was configured. The factory validates the
   * machine implements `clone()` at boot, so a configured fleet is usable —
   * sandbox-backed projects stay off only when the slot was omitted.
   */
  get enabled(): boolean {
    return this.#config !== undefined;
  }

  /**
   * Name of the active sandbox provider — the configured machine's `provider`
   * discriminator (`'railway'`, `'local'`, …), or `'none'` when the fleet was
   * constructed without a config. Diagnostic only; feature gating goes
   * through {@link enabled}.
   */
  get provider(): string {
    return this.#config?.machine.provider ?? 'none';
  }

  /**
   * Idle teardown window for provisioned sandboxes, in minutes; defaults to 30.
   * Read back from the machine's own config when it exposes one
   * (Railway's `idleTimeoutMinutes`) — the knob lives on the sandbox, the
   * fleet only needs it to schedule GC and stamp sandbox clones. Advisory:
   * providers without idle GC ignore it, and a re-open detects a torn-down VM
   * and re-provisions cleanly.
   */
  get idleMinutes(): number {
    const machine = this.#config?.machine as { idleTimeoutMinutes?: unknown } | undefined;
    const minutes = machine?.idleTimeoutMinutes;
    return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
  }

  /**
   * Per-replica cap on concurrently *provisioned* sandboxes. 0 means unlimited.
   * This is a lightweight per-process budget to keep a single replica from
   * exhausting provider quota — it is not a global, cross-replica scheduler
   * (that is a deferred follow-up).
   */
  get maxSandboxes(): number {
    return this.#config?.maxSandboxes ?? 0;
  }

  /**
   * Count of sandboxes this fleet has freshly provisioned and not yet torn
   * down. Reattaches to existing VMs do not count (they reuse an already-billed
   * sandbox). Used to enforce {@link maxSandboxes}.
   */
  get liveCount(): number {
    return this.#liveCount;
  }

  /** For tests: reset the live-sandbox counter to a known state. */
  __resetLiveCount(value = 0): void {
    this.#liveCount = value;
  }

  /** Override the sandbox factory (tests). */
  setFactory(factory: SandboxFactory): void {
    this.#factory = factory;
  }

  /** Reset to the default machine-cloning factory. */
  resetFactory(): void {
    this.#factory = undefined;
  }

  /**
   * Compute the in-sandbox working directory for a repo: a nested
   * `<base>/<owner>/<name>` layout under the factory-resolved checkout base.
   * Nesting keeps same-name repos apart (`acme/api` vs `other/api`) — cloud
   * sandboxes are one-per-project so it's merely tidy there, but local
   * checkouts share one host root where it prevents collisions. Server-side
   * only; never derived from client input.
   */
  computeWorkdir(repoFullName: string): string {
    if (!this.#config) throw new Error('No sandbox configured');
    const [owner, name] = repoFullName.split('/', 2);
    return `${this.#config.workdirBase}/${sanitizeSegment(owner || 'unknown')}/${sanitizeSegment(name || 'repo')}`;
  }

  /**
   * Compute the host working directory for a local GitHub session checkout.
   * This is server-derived only: repo pieces are sanitized and the trusted
   * session id is kept as a single path segment under the configured local root.
   */
  computeLocalSessionWorkdir(repoFullName: string, sessionId: string): string {
    if (!this.#config) throw new Error('No sandbox configured');
    if (this.#config.machine.provider !== 'local') {
      throw new Error('Local session workdirs require the local sandbox provider');
    }

    const localRoot = (this.#config.machine as { workingDirectory?: unknown }).workingDirectory;
    if (typeof localRoot !== 'string' || localRoot.length === 0) {
      throw new Error('Local sandbox working directory is not configured');
    }

    const [owner, name] = repoFullName.split('/', 2);
    return resolveContainedLocalWorkdir(
      localRoot,
      'github-sessions',
      sanitizeSegment(owner || 'unknown'),
      sanitizeSegment(name || 'repo'),
      sanitizeSegment(sessionId),
    );
  }

  /**
   * Build a (not-yet-started) sandbox: the test-provided factory when set,
   * otherwise a per-project clone of the configured machine. The stored id is
   * passed both as the logical `id` (providers that reattach by construction
   * id, e.g. local) and as the provider-native `sandboxId` hint (Railway) so
   * reattach works across the provider matrix.
   */
  #build(opts: SandboxCreateOptions): MaterializationSandbox {
    if (this.#factory) return this.#factory(opts);
    if (!this.#config) throw new Error('No sandbox configured');
    const clone = this.#config.machine.clone!({
      ...(opts.providerSandboxId ? { id: opts.providerSandboxId, sandboxId: opts.providerSandboxId } : {}),
      ...(opts.env ? { env: opts.env } : {}),
      ...(opts.workingDirectory ? { workingDirectory: opts.workingDirectory } : {}),
      ...(opts.idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes: opts.idleTimeoutMinutes } : {}),
      ...(opts.checkpointName ? { checkpointName: opts.checkpointName } : {}),
    });
    return toMaterializationSandbox(clone, opts.env);
  }

  /**
   * Provision a new sandbox (persisting its provider id on first open) or
   * reattach to the stored one. Returns a started, live sandbox.
   */
  async ensureSandbox(store: SandboxBindingStore, onProgress?: ProgressFn): Promise<MaterializationSandbox>;
  async ensureSandbox(
    store: SandboxBindingStore,
    env?: Record<string, string>,
    onProgress?: ProgressFn,
    options?: EnsureSandboxOptions,
  ): Promise<MaterializationSandbox>;
  async ensureSandbox(
    store: SandboxBindingStore,
    envOrProgress?: Record<string, string> | ProgressFn,
    progressOrOptions?: ProgressFn | EnsureSandboxOptions,
    maybeOptions: EnsureSandboxOptions = {},
  ): Promise<MaterializationSandbox> {
    const env = typeof envOrProgress === 'function' ? undefined : envOrProgress;
    const onProgress =
      typeof envOrProgress === 'function' ? envOrProgress : (progressOrOptions as ProgressFn | undefined);
    const options =
      typeof envOrProgress === 'function'
        ? ((progressOrOptions as EnsureSandboxOptions | undefined) ?? {})
        : maybeOptions;
    const idleTimeoutMinutes = this.idleMinutes;
    const checkpointName = store.checkpointName;

    // Reattach path: if we have a stored sandbox id, try to reattach. The VM may
    // have been torn down by the provider's idle GC (or otherwise died), in which
    // case `start()` fails. Recover by clearing the stale id and provisioning a
    // fresh sandbox so the next open succeeds instead of being permanently wedged.
    if (store.sandboxId) {
      reportProgress(onProgress, { phase: 'reattaching', message: 'Reconnecting to your sandbox…' });
      const reattached = this.#build({
        providerSandboxId: store.sandboxId,
        idleTimeoutMinutes,
        ...(checkpointName ? { checkpointName } : {}),
        ...(env ? { env } : {}),
        ...(options.workingDirectory ? { workingDirectory: options.workingDirectory } : {}),
      });
      try {
        await reattached.start();
        return reattached;
      } catch {
        await store.setSandboxId(null);
        // fall through to fresh provision below
      }
    }

    // Fresh provision: enforce the per-replica budget before spending quota.
    const max = this.maxSandboxes;
    if (max > 0 && this.#liveCount >= max) {
      throw new SandboxBudgetError(max);
    }

    reportProgress(onProgress, { phase: 'provisioning', message: 'Provisioning a new sandbox…' });
    const sandbox = this.#build({
      idleTimeoutMinutes,
      ...(checkpointName ? { checkpointName } : {}),
      ...(env ? { env } : {}),
      ...(options.workingDirectory ? { workingDirectory: options.workingDirectory } : {}),
    });
    await sandbox.start();
    this.#liveCount += 1;

    const providerSandboxId = await readProviderSandboxId(sandbox);
    if (providerSandboxId) {
      await store.setSandboxId(providerSandboxId);
    }

    return sandbox;
  }

  /**
   * Tear down a sandbox binding: stop the live VM (best-effort) and clear the
   * persisted state through the binding store so the next open re-provisions
   * cleanly. Decrements the per-replica live-sandbox counter.
   *
   * @param store   the binding to tear down
   * @param sandbox an already-reattached live sandbox to stop, when available
   */
  async teardownSandbox(store: SandboxBindingStore, sandbox?: MaterializationSandbox): Promise<void> {
    if (sandbox?.stop) {
      try {
        await sandbox.stop();
      } catch {
        // Best-effort: the VM may already be gone (idle GC). Still clear the binding.
      }
    }
    if (store.sandboxId) {
      if (this.#liveCount > 0) this.#liveCount -= 1;
      await store.clear();
    }
  }

  /**
   * Reattach to an already-provisioned sandbox by its provider id and start it.
   * Used by the workspace seam when opening a project that was already
   * materialized (sandbox id + workdir carried on controller state), so no DB
   * round-trip is needed.
   */
  async reattachSandbox(
    providerSandboxId: string,
    options: EnsureSandboxOptions = {},
  ): Promise<MaterializationSandbox> {
    const sandbox = this.#build({
      providerSandboxId,
      idleTimeoutMinutes: this.idleMinutes,
      ...(options.workingDirectory ? { workingDirectory: options.workingDirectory } : {}),
    });
    await sandbox.start();
    return sandbox;
  }
}
