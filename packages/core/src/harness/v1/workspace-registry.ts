/**
 * Harness v1 — workspace registry.
 *
 * Internal book-keeping for the three ownership models from §2.7. Owns the
 * lifecycle (create / resume / destroy), the refcounts for shared workspaces
 * (`per-resource`, and the `inherit` subagent flow under `per-session`), and
 * the `pushState` plumbing that persists provider state into the session
 * record.
 *
 * Not exported — `Harness` and `Session` reach in directly. Consumers go
 * through `harness.getWorkspace()`, `harness.destroyResourceWorkspace()`,
 * and `session.getWorkspace()`.
 */

import { RequestContext } from '../../request-context';
import type { Workspace } from '../../workspace';

import { HarnessConfigError, HarnessWorkspaceInUseError, HarnessWorkspaceProvisioningError } from './errors';
import type { EventEmitter } from './events';
import type { HarnessWorkspaceConfig } from './types';
import { nonDurableProvider } from './workspace-provider';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

// ---------------------------------------------------------------------------
// Internal entry shapes.
// ---------------------------------------------------------------------------

interface SharedEntry {
  workspace?: Workspace;
  resolving?: Promise<Workspace>;
  initialized: boolean;
}

interface PerResourceEntry {
  workspace: Workspace;
  refCount: number;
  provider: WorkspaceProvider;
  ctx: WorkspaceProviderContext;
}

interface PerSessionEntry {
  workspace: Workspace;
  provider: WorkspaceProvider;
  ctx: WorkspaceProviderContext;
  refCount: number;
  resourceId: string;
}

// ---------------------------------------------------------------------------
// Acquire / release inputs.
// ---------------------------------------------------------------------------

export interface AcquirePerResourceOpts {
  resourceId: string;
}

export interface AcquirePerSessionOpts {
  resourceId: string;
  sessionId: string;
  parentSessionId?: string;
  storedProviderId?: string;
  storedState?: unknown;
  onStateUpdate: (state: unknown) => Promise<void>;
}

export interface InheritPerSessionOpts {
  parentSessionId: string;
  childSessionId: string;
  resourceId: string;
}

// ---------------------------------------------------------------------------
// Registry.
// ---------------------------------------------------------------------------

export class WorkspaceRegistry {
  private readonly _config?: HarnessWorkspaceConfig;
  private readonly _emit: EventEmitter;
  private readonly _shared: SharedEntry | undefined;
  private readonly _perResource = new Map<string, PerResourceEntry>();
  private readonly _perSession = new Map<string, PerSessionEntry>();
  private readonly _resolvedProvider?: WorkspaceProvider;

  constructor(opts: { config?: HarnessWorkspaceConfig; emitter: EventEmitter }) {
    this._config = opts.config;
    this._emit = opts.emitter;

    if (!this._config) {
      return;
    }

    if (this._config.kind === 'shared') {
      this._shared = { initialized: false };
      return;
    }

    // per-resource / per-session: resolve the provider once.
    if (this._config.kind === 'per-resource') {
      const raw = this._config.provider;
      this._resolvedProvider = typeof raw === 'function' ? nonDurableProvider(raw) : raw;
      return;
    }

    // per-session: require full provider with resumable: true.
    const provider = this._config.provider;
    if (typeof (provider as WorkspaceProvider)?.providerId !== 'string') {
      throw new HarnessConfigError(
        'workspace.provider',
        'kind: "per-session" requires a WorkspaceProvider (bare factories are not durable)',
      );
    }
    if (!provider.resumable) {
      throw new HarnessConfigError(
        'workspace.provider',
        `workspace provider "${provider.providerId}" is not resumable; only kind: "shared" is supported`,
      );
    }
    if (typeof provider.resume !== 'function') {
      throw new HarnessConfigError(
        'workspace.provider',
        `workspace provider "${provider.providerId}" declares resumable: true but is missing the resume() method`,
      );
    }
    this._resolvedProvider = provider;
  }

  // -------------------------------------------------------------------------
  // Introspection.
  // -------------------------------------------------------------------------

  get kind(): HarnessWorkspaceConfig['kind'] | undefined {
    return this._config?.kind;
  }

  get providerId(): string | undefined {
    return this._resolvedProvider?.providerId;
  }

  /** `true` when the configured provider declares `resumable: true`. */
  get resumable(): boolean {
    return !!this._resolvedProvider?.resumable;
  }

  // -------------------------------------------------------------------------
  // Shared.
  // -------------------------------------------------------------------------

  async acquireShared(): Promise<Workspace> {
    if (!this._shared || !this._config || this._config.kind !== 'shared') {
      throw new HarnessConfigError('workspace', 'no shared workspace configured');
    }
    if (this._shared.workspace) {
      return this._shared.workspace;
    }
    if (this._shared.resolving) {
      return this._shared.resolving;
    }

    const cfg = this._config;
    const resolve = async (): Promise<Workspace> => {
      const raw = cfg.workspace;
      let ws: Workspace;
      if (typeof raw === 'function') {
        const requestContext = new RequestContext();
        this._emitStatus({ status: 'initializing' });
        ws = await Promise.resolve(raw({ requestContext }));
      } else if (raw && typeof raw === 'object') {
        ws = raw as Workspace;
      } else {
        throw new HarnessConfigError('workspace.workspace', 'unsupported shape (expected Workspace or factory)');
      }
      if (!this._shared!.initialized) {
        this._emitStatus({ status: 'initializing' });
        await ws.init();
        this._shared!.initialized = true;
      }
      this._shared!.workspace = ws;
      this._emitStatus({ status: 'ready' });
      return ws;
    };

    this._shared.resolving = resolve();
    try {
      return await this._shared.resolving;
    } finally {
      this._shared.resolving = undefined;
    }
  }

  async destroyShared(): Promise<void> {
    if (!this._shared || !this._shared.workspace) return;
    const ws = this._shared.workspace;
    this._emitStatus({ status: 'destroying' });
    try {
      await ws.destroy();
    } catch (err) {
      this._emitError({ err });
    }
    this._shared.workspace = undefined;
    this._shared.initialized = false;
    this._emitStatus({ status: 'destroyed' });
  }

  // -------------------------------------------------------------------------
  // Per-resource.
  // -------------------------------------------------------------------------

  async acquirePerResource(opts: AcquirePerResourceOpts): Promise<Workspace> {
    this._assertKind('per-resource');
    const existing = this._perResource.get(opts.resourceId);
    if (existing) {
      existing.refCount += 1;
      return existing.workspace;
    }

    const provider = this._resolvedProvider!;
    const ctx: WorkspaceProviderContext = {
      resourceId: opts.resourceId,
      pushState: async () => {
        /* per-resource workspaces are not persisted per session */
      },
    };

    this._emitStatus({ resourceId: opts.resourceId, providerId: provider.providerId, status: 'initializing' });
    let ws: Workspace;
    try {
      ws = await provider.create(ctx);
    } catch (cause) {
      this._emitError({ resourceId: opts.resourceId, providerId: provider.providerId, err: cause });
      throw new HarnessWorkspaceProvisioningError(provider.providerId, cause, undefined, opts.resourceId);
    }
    await this._initIfFresh(ws);
    this._perResource.set(opts.resourceId, { workspace: ws, refCount: 1, provider, ctx });
    this._emitStatus({ resourceId: opts.resourceId, providerId: provider.providerId, status: 'ready' });
    return ws;
  }

  async releasePerResource(opts: { resourceId: string }): Promise<void> {
    const entry = this._perResource.get(opts.resourceId);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    if (entry.refCount > 0) return;
    await this._destroyPerResourceEntry(opts.resourceId, entry);
  }

  async destroyResourceWorkspace(opts: { resourceId: string }): Promise<void> {
    this._assertKind('per-resource');
    const entry = this._perResource.get(opts.resourceId);
    if (!entry) return;
    if (entry.refCount > 0) {
      throw new HarnessWorkspaceInUseError(opts.resourceId, entry.refCount);
    }
    await this._destroyPerResourceEntry(opts.resourceId, entry);
  }

  private async _destroyPerResourceEntry(resourceId: string, entry: PerResourceEntry): Promise<void> {
    this._emitStatus({ resourceId, providerId: entry.provider.providerId, status: 'destroying' });
    try {
      if (entry.provider.destroy) {
        await entry.provider.destroy(entry.workspace, entry.ctx);
      } else {
        await entry.workspace.destroy();
      }
    } catch (err) {
      this._emitError({ resourceId, providerId: entry.provider.providerId, err });
    }
    this._perResource.delete(resourceId);
    this._emitStatus({ resourceId, providerId: entry.provider.providerId, status: 'destroyed' });
  }

  // -------------------------------------------------------------------------
  // Per-session.
  // -------------------------------------------------------------------------

  async acquirePerSession(opts: AcquirePerSessionOpts): Promise<Workspace> {
    this._assertKind('per-session');
    const existing = this._perSession.get(opts.sessionId);
    if (existing) {
      existing.refCount += 1;
      return existing.workspace;
    }
    const provider = this._resolvedProvider!;
    const ctx: WorkspaceProviderContext = {
      resourceId: opts.resourceId,
      sessionId: opts.sessionId,
      parentSessionId: opts.parentSessionId,
      pushState: opts.onStateUpdate,
    };

    this._emitStatus({
      sessionId: opts.sessionId,
      resourceId: opts.resourceId,
      providerId: provider.providerId,
      status: 'initializing',
    });

    let ws: Workspace;
    try {
      if (opts.storedProviderId && opts.storedState !== undefined && provider.resume) {
        ws = await provider.resume({ ...ctx, state: opts.storedState });
      } else {
        ws = await provider.create(ctx);
      }
    } catch (cause) {
      this._emitError({
        sessionId: opts.sessionId,
        resourceId: opts.resourceId,
        providerId: provider.providerId,
        err: cause,
      });
      throw new HarnessWorkspaceProvisioningError(provider.providerId, cause, opts.sessionId, opts.resourceId);
    }
    await this._initIfFresh(ws);
    this._perSession.set(opts.sessionId, {
      workspace: ws,
      provider,
      ctx,
      refCount: 1,
      resourceId: opts.resourceId,
    });
    this._emitStatus({
      sessionId: opts.sessionId,
      resourceId: opts.resourceId,
      providerId: provider.providerId,
      status: 'ready',
    });
    return ws;
  }

  inheritPerSession(opts: InheritPerSessionOpts): Workspace {
    this._assertKind('per-session');
    const parent = this._perSession.get(opts.parentSessionId);
    if (!parent) {
      throw new HarnessConfigError(
        'workspace.subagent.inherit',
        `parent session "${opts.parentSessionId}" has no workspace to inherit`,
      );
    }
    parent.refCount += 1;
    // Map child id to the same entry so `releasePerSession(childId)` decrements
    // the parent's refcount.
    this._perSession.set(opts.childSessionId, parent);
    return parent.workspace;
  }

  async releasePerSession(opts: { sessionId: string }): Promise<void> {
    const entry = this._perSession.get(opts.sessionId);
    if (!entry) return;
    this._perSession.delete(opts.sessionId);
    entry.refCount = Math.max(0, entry.refCount - 1);
    if (entry.refCount > 0) return;
    // No more references to this physical workspace — tear down.
    this._emitStatus({
      sessionId: opts.sessionId,
      resourceId: entry.resourceId,
      providerId: entry.provider.providerId,
      status: 'destroying',
    });
    try {
      if (entry.provider.destroy) {
        await entry.provider.destroy(entry.workspace, entry.ctx);
      } else {
        await entry.workspace.destroy();
      }
    } catch (err) {
      this._emitError({
        sessionId: opts.sessionId,
        resourceId: entry.resourceId,
        providerId: entry.provider.providerId,
        err,
      });
    }
    this._emitStatus({
      sessionId: opts.sessionId,
      resourceId: entry.resourceId,
      providerId: entry.provider.providerId,
      status: 'destroyed',
    });
  }

  // -------------------------------------------------------------------------
  // Shutdown.
  // -------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    // Iterate over unique per-session entries (multiple ids can point to the
    // same physical entry under `inherit`). De-dup via Set on object identity.
    const seenSessionEntries = new Set<PerSessionEntry>();
    for (const [sessionId, entry] of this._perSession.entries()) {
      if (seenSessionEntries.has(entry)) continue;
      seenSessionEntries.add(entry);
      try {
        if (entry.provider.destroy) {
          await entry.provider.destroy(entry.workspace, entry.ctx);
        } else {
          await entry.workspace.destroy();
        }
      } catch (err) {
        this._emitError({
          sessionId,
          resourceId: entry.resourceId,
          providerId: entry.provider.providerId,
          err,
        });
      }
    }
    this._perSession.clear();

    for (const [resourceId, entry] of this._perResource.entries()) {
      try {
        if (entry.provider.destroy) {
          await entry.provider.destroy(entry.workspace, entry.ctx);
        } else {
          await entry.workspace.destroy();
        }
      } catch (err) {
        this._emitError({ resourceId, providerId: entry.provider.providerId, err });
      }
    }
    this._perResource.clear();

    await this.destroyShared();
  }

  // -------------------------------------------------------------------------
  // Helpers.
  // -------------------------------------------------------------------------

  private _assertKind(expected: HarnessWorkspaceConfig['kind']): void {
    if (this._config?.kind !== expected) {
      throw new HarnessConfigError(
        'workspace.kind',
        `expected "${expected}", got "${this._config?.kind ?? 'unconfigured'}"`,
      );
    }
  }

  private async _initIfFresh(ws: Workspace): Promise<void> {
    // Providers may or may not have called init() themselves. Guard against
    // double-init by checking the workspace's status — only `not-initialized`
    // (default) and `error` should trigger a fresh init pass.
    if (ws.status === 'ready' || ws.status === 'initializing') return;
    try {
      await ws.init();
    } catch (err) {
      this._emitError({ err });
      throw err;
    }
  }

  private _emitStatus(opts: {
    sessionId?: string;
    resourceId?: string;
    providerId?: string;
    status: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'lost' | 'error';
  }): void {
    this._emit.emit(
      {
        type: 'workspace_status_changed',
        resourceId: opts.resourceId,
        providerId: opts.providerId,
        status: opts.status,
      },
      opts.sessionId !== undefined ? { sessionId: opts.sessionId } : undefined,
    );
  }

  private _emitError(opts: { sessionId?: string; resourceId?: string; providerId?: string; err: unknown }): void {
    const e = opts.err instanceof Error ? opts.err : new Error(String(opts.err));
    this._emit.emit(
      {
        type: 'workspace_error',
        resourceId: opts.resourceId,
        providerId: opts.providerId,
        error: { name: e.name, message: e.message },
      },
      opts.sessionId !== undefined ? { sessionId: opts.sessionId } : undefined,
    );
  }
}
