/**
 * Project sandbox fleet: provisioning, reattach, teardown, and budgeting.
 *
 * Server-hosted projects never run on the web host itself. Each project gets
 * its own isolated sandbox (a `WorkspaceSandbox`, e.g. a Railway VM) `clone()`d
 * from the machine the factory was configured with (`sandbox.machine` slot,
 * seeded into the runtime-config registry). This module owns everything about
 * that fleet — which provider is active, where checkouts live inside a sandbox,
 * the idle window, the per-replica budget, and the provision/reattach/teardown
 * lifecycle — but knows nothing about what runs inside a sandbox (git
 * materialization lives with its feature, e.g. `github/sandbox.ts`).
 *
 * Persistence of the provider's reattach id is delegated to the caller via
 * {@link SandboxBindingStore}, so the fleet stays storage-agnostic. Tests can
 * swap the low-level construction via {@link setSandboxFactory}.
 */

import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { getSeededSandbox } from '../runtime-config';

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
  executeCommand(command: string, args?: string[], options?: { timeout?: number }): Promise<SandboxCommandResult>;
  /** Tear down the underlying VM. Optional: providers without it are no-ops. */
  stop?(): Promise<void>;
}

/** Options for building (or reattaching) one sandbox. */
export interface SandboxCreateOptions {
  /** Reattach to this existing provider VM instead of provisioning a new one. */
  providerSandboxId?: string;
  /** Environment variables baked into the sandbox. */
  env?: Record<string, string>;
  /** Idle teardown window (minutes). The provider stops the VM after this idle period. */
  idleTimeoutMinutes?: number;
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

/**
 * Name of the active sandbox provider — the configured machine's `provider`
 * discriminator (`'railway'`, `'local'`, …), or `'none'` when the factory was
 * configured without a `sandbox` slot. Diagnostic only; feature gating goes
 * through {@link isSandboxEnabled}.
 */
export function getSandboxProvider(): string {
  return getSeededSandbox()?.machine.provider ?? 'none';
}

/**
 * True when a sandbox machine was configured. The factory validates the
 * machine implements `clone()` at boot, so a seeded runtime is usable —
 * sandbox-backed projects stay off only when the slot was omitted.
 */
export function isSandboxEnabled(): boolean {
  return getSeededSandbox() !== undefined;
}

/**
 * Compute the in-sandbox working directory for a repo: a nested
 * `<base>/<owner>/<name>` layout under the factory-resolved checkout base.
 * Nesting keeps same-name repos apart (`acme/api` vs `other/api`) — cloud
 * sandboxes are one-per-project so it's merely tidy there, but local
 * checkouts share one host root where it prevents collisions. Server-side
 * only; never derived from client input.
 */
export function computeSandboxWorkdir(repoFullName: string): string {
  const seeded = getSeededSandbox();
  if (!seeded) throw new Error('No sandbox configured');
  const [owner, name] = repoFullName.split('/', 2);
  return `${seeded.workdirBase}/${sanitizeSegment(owner || 'unknown')}/${sanitizeSegment(name || 'repo')}`;
}

/** Keep each path piece a single safe segment (no separators or traversal). */
function sanitizeSegment(segment: string): string {
  const cleaned = segment.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  return cleaned || 'repo';
}

/**
 * Idle teardown window for provisioned sandboxes, in minutes; defaults to 30.
 * Read back from the machine's own config when it exposes one
 * (Railway's `idleTimeoutMinutes`) — the knob lives on the sandbox, this
 * module only needs it to schedule GC and stamp sandbox clones. Advisory:
 * providers without idle GC ignore it, and a re-open detects a torn-down VM
 * and re-provisions cleanly.
 */
export function getSandboxIdleMinutes(): number {
  const machine = getSeededSandbox()?.machine as { idleTimeoutMinutes?: unknown } | undefined;
  const minutes = machine?.idleTimeoutMinutes;
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? minutes : 30;
}

/**
 * Per-replica cap on concurrently *provisioned* sandboxes. 0 means unlimited.
 * This is a lightweight per-process budget to keep a single replica from
 * exhausting provider quota — it is not a global, cross-replica scheduler
 * (that is a deferred follow-up).
 */
export function getMaxSandboxes(): number {
  return getSeededSandbox()?.maxSandboxes ?? 0;
}

/**
 * Count of sandboxes this replica has freshly provisioned and not yet torn
 * down. Reattaches to existing VMs do not count (they reuse an already-billed
 * sandbox). Used to enforce `getMaxSandboxes()`.
 */
let liveSandboxCount = 0;

/** Current live (freshly provisioned, not torn down) sandbox count. */
export function getLiveSandboxCount(): number {
  return liveSandboxCount;
}

/** For tests: reset the live-sandbox counter to a known state. */
export function __resetLiveSandboxCount(value = 0): void {
  liveSandboxCount = value;
}

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

/**
 * Adapt a cloned `WorkspaceSandbox` to the minimal surface this module needs.
 * Lifecycle goes through the `_`-prefixed wrappers when present (they add
 * status tracking and concurrency safety on `MastraSandbox` subclasses),
 * falling back to the plain methods for interface-only implementations.
 */
function toMaterializationSandbox(sandbox: WorkspaceSandbox): MaterializationSandbox {
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
    executeCommand: (command, args, options) => sandbox.executeCommand!(command, args, options),
    stop: async () => {
      await (lifecycle._stop ?? sandbox.stop)?.call(sandbox);
    },
  };
}

/**
 * Default factory: clone a per-project sibling from the machine the
 * factory was configured with. Resolved per call so seeding order doesn't
 * matter at import time. The stored id is passed both as the logical `id`
 * (providers that reattach by construction id, e.g. local) and as the
 * provider-native `sandboxId` hint (Railway) so reattach works across the
 * provider matrix.
 */
const defaultFactory: SandboxFactory = opts => {
  const seeded = getSeededSandbox();
  if (!seeded) throw new Error('No sandbox configured');
  const clone = seeded.machine.clone!({
    ...(opts.providerSandboxId ? { id: opts.providerSandboxId, sandboxId: opts.providerSandboxId } : {}),
    ...(opts.env ? { env: opts.env } : {}),
    ...(opts.idleTimeoutMinutes !== undefined ? { idleTimeoutMinutes: opts.idleTimeoutMinutes } : {}),
  });
  return toMaterializationSandbox(clone);
};

let sandboxFactory: SandboxFactory = defaultFactory;

/** Override the sandbox factory (tests). */
export function setSandboxFactory(factory: SandboxFactory): void {
  sandboxFactory = factory;
}

/** Reset to the default provider-delegating factory. */
export function resetSandboxFactory(): void {
  sandboxFactory = defaultFactory;
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

/**
 * Where a feature persists its sandbox binding. The fleet reads the stored
 * reattach id and writes updates through this seam so it stays agnostic of
 * the owning table (GitHub projects today, anything else tomorrow).
 */
export interface SandboxBindingStore {
  /** Stored provider reattach id from a previous provisioning, if any. */
  readonly sandboxId: string | null;
  /** Persist a freshly provisioned provider id, or clear a stale one with `null`. */
  setSandboxId(id: string | null): Promise<void>;
  /** Clear all stored sandbox state (reattach id + materialization mark) on teardown. */
  clear(): Promise<void>;
}

/**
 * Provision a new sandbox (persisting its provider id on first open) or
 * reattach to the stored one. Returns a started, live sandbox.
 */
export async function ensureSandbox(
  store: SandboxBindingStore,
  onProgress?: ProgressFn,
): Promise<MaterializationSandbox> {
  const idleTimeoutMinutes = getSandboxIdleMinutes();

  // Reattach path: if we have a stored sandbox id, try to reattach. The VM may
  // have been torn down by the provider's idle GC (or otherwise died), in which
  // case `start()` fails. Recover by clearing the stale id and provisioning a
  // fresh sandbox so the next open succeeds instead of being permanently wedged.
  if (store.sandboxId) {
    reportProgress(onProgress, { phase: 'reattaching', message: 'Reconnecting to your sandbox…' });
    const reattached = sandboxFactory({ providerSandboxId: store.sandboxId, idleTimeoutMinutes });
    try {
      await reattached.start();
      return reattached;
    } catch {
      await store.setSandboxId(null);
      // fall through to fresh provision below
    }
  }

  // Fresh provision: enforce the per-replica budget before spending quota.
  const max = getMaxSandboxes();
  if (max > 0 && liveSandboxCount >= max) {
    throw new SandboxBudgetError(max);
  }

  reportProgress(onProgress, { phase: 'provisioning', message: 'Provisioning a new sandbox…' });
  const sandbox = sandboxFactory({ idleTimeoutMinutes });
  await sandbox.start();
  liveSandboxCount += 1;

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
export async function teardownSandbox(store: SandboxBindingStore, sandbox?: MaterializationSandbox): Promise<void> {
  if (sandbox?.stop) {
    try {
      await sandbox.stop();
    } catch {
      // Best-effort: the VM may already be gone (idle GC). Still clear the binding.
    }
  }
  if (store.sandboxId) {
    if (liveSandboxCount > 0) liveSandboxCount -= 1;
    await store.clear();
  }
}

/**
 * Reattach to an already-provisioned sandbox by its provider id and start it.
 * Used by the workspace seam when opening a project that was already
 * materialized (sandbox id + workdir carried on controller state), so no DB
 * round-trip is needed.
 */
export async function reattachSandbox(providerSandboxId: string): Promise<MaterializationSandbox> {
  const sandbox = sandboxFactory({ providerSandboxId, idleTimeoutMinutes: getSandboxIdleMinutes() });
  await sandbox.start();
  return sandbox;
}
