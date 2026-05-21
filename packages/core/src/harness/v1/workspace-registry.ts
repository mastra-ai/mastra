import { RequestContext } from '../../request-context';
import type { Workspace } from '../../workspace';
import type { HarnessWorkspaceConfig } from './config';
import { HarnessConfigError, HarnessWorkspaceInUseError, HarnessWorkspaceProvisioningError } from './errors';
import type { EventEmitter } from './events';
import { nonDurableProvider } from './workspace-provider';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

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

export class WorkspaceRegistry {
  private readonly _config?: HarnessWorkspaceConfig;
  private readonly _emit: EventEmitter;
  private readonly _shared: SharedEntry | undefined;
  private readonly _perResource = new Map<string, PerResourceEntry>();
  private readonly _perResourceResolving = new Map<string, Promise<PerResourceEntry>>();
  private readonly _perSession = new Map<string, PerSessionEntry>();
  private readonly _perSessionResolving = new Map<string, Promise<PerSessionEntry>>();
  private readonly _resolvedProvider?: WorkspaceProvider;

  constructor(opts: { config?: HarnessWorkspaceConfig; emitter: EventEmitter }) {
    this._config = opts.config;
    this._emit = opts.emitter;

    if (!this._config) return;

    if (this._config.kind === 'shared') {
      this._shared = { initialized: false };
      return;
    }

    if (this._config.kind === 'per-resource') {
      const raw = this._config.provider;
      this._resolvedProvider = typeof raw === 'function' ? nonDurableProvider(raw) : raw;
      return;
    }

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

  get kind(): HarnessWorkspaceConfig['kind'] | undefined {
    return this._config?.kind;
  }

  get providerId(): string | undefined {
    return this._resolvedProvider?.providerId;
  }

  get resumable(): boolean {
    return !!this._resolvedProvider?.resumable;
  }

  async acquireShared(): Promise<Workspace> {
    if (!this._shared || !this._config || this._config.kind !== 'shared') {
      throw new HarnessConfigError('workspace', 'no shared workspace configured');
    }
    if (this._shared.workspace) return this._shared.workspace;
    if (this._shared.resolving) return this._shared.resolving;

    const cfg = this._config;
    const resolve = async (): Promise<Workspace> => {
      const raw = cfg.workspace;
      let workspace: Workspace;
      if (typeof raw === 'function') {
        const requestContext = new RequestContext();
        this._emitStatus({ status: 'initializing' });
        workspace = await Promise.resolve(raw({ requestContext }));
      } else if (raw && typeof raw === 'object') {
        workspace = raw as Workspace;
      } else {
        throw new HarnessConfigError('workspace.workspace', 'unsupported shape (expected Workspace or factory)');
      }
      if (!this._shared!.initialized) {
        this._emitStatus({ status: 'initializing' });
        try {
          await this._initIfFresh(workspace);
        } catch (err) {
          await this._destroyWorkspace(workspace, undefined, undefined, { err });
          throw err;
        }
        this._shared!.initialized = true;
      }
      this._shared!.workspace = workspace;
      this._emitStatus({ status: 'ready' });
      return workspace;
    };

    this._shared.resolving = resolve();
    try {
      return await this._shared.resolving;
    } finally {
      this._shared.resolving = undefined;
    }
  }

  async destroyShared(): Promise<void> {
    if (!this._shared) return;
    if (this._shared.resolving) {
      try {
        await this._shared.resolving;
      } catch (err) {
        this._emitError({ err });
      }
    }
    if (!this._shared.workspace) {
      this._shared.initialized = false;
      return;
    }
    const workspace = this._shared.workspace;
    this._emitStatus({ status: 'destroying' });
    try {
      await workspace.destroy();
    } catch (err) {
      this._emitError({ err });
    }
    this._shared.workspace = undefined;
    this._shared.initialized = false;
    this._emitStatus({ status: 'destroyed' });
  }

  async acquirePerResource(opts: AcquirePerResourceOpts): Promise<Workspace> {
    this._assertKind('per-resource');
    const existing = this._perResource.get(opts.resourceId);
    if (existing) {
      existing.refCount += 1;
      return existing.workspace;
    }

    const resolving = this._perResourceResolving.get(opts.resourceId);
    if (resolving) {
      const entry = await resolving;
      entry.refCount += 1;
      return entry.workspace;
    }

    const provider = this._resolvedProvider!;
    const ctx: WorkspaceProviderContext = {
      resourceId: opts.resourceId,
      pushState: async () => undefined,
    };

    const createEntry = async (): Promise<PerResourceEntry> => {
      this._emitStatus({ resourceId: opts.resourceId, providerId: provider.providerId, status: 'initializing' });
      let workspace: Workspace;
      try {
        workspace = await provider.create(ctx);
      } catch (cause) {
        this._emitError({ resourceId: opts.resourceId, providerId: provider.providerId, err: cause });
        throw new HarnessWorkspaceProvisioningError(provider.providerId, cause, undefined, opts.resourceId);
      }
      try {
        await this._initIfFresh(workspace);
      } catch (cause) {
        await this._destroyWorkspace(workspace, provider, ctx, {
          resourceId: opts.resourceId,
          providerId: provider.providerId,
          err: cause,
        });
        throw new HarnessWorkspaceProvisioningError(provider.providerId, cause, undefined, opts.resourceId);
      }
      const entry = { workspace, refCount: 1, provider, ctx };
      this._perResource.set(opts.resourceId, entry);
      this._emitStatus({ resourceId: opts.resourceId, providerId: provider.providerId, status: 'ready' });
      return entry;
    };

    const pending = createEntry();
    this._perResourceResolving.set(opts.resourceId, pending);
    try {
      const entry = await pending;
      return entry.workspace;
    } finally {
      this._perResourceResolving.delete(opts.resourceId);
    }
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

  async acquirePerSession(opts: AcquirePerSessionOpts): Promise<Workspace> {
    this._assertKind('per-session');
    const existing = this._perSession.get(opts.sessionId);
    if (existing) {
      return existing.workspace;
    }
    const resolving = this._perSessionResolving.get(opts.sessionId);
    if (resolving) {
      const entry = await resolving;
      return entry.workspace;
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

    const createEntry = async (): Promise<PerSessionEntry> => {
      let workspace: Workspace;
      try {
        if (opts.storedProviderId === provider.providerId && opts.storedState !== undefined && provider.resume) {
          workspace = await provider.resume({ ...ctx, state: opts.storedState });
        } else {
          workspace = await provider.create(ctx);
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
      try {
        await this._initIfFresh(workspace);
      } catch (cause) {
        await this._destroyWorkspace(workspace, provider, ctx, {
          sessionId: opts.sessionId,
          resourceId: opts.resourceId,
          providerId: provider.providerId,
          err: cause,
        });
        throw new HarnessWorkspaceProvisioningError(provider.providerId, cause, opts.sessionId, opts.resourceId);
      }
      const entry = {
        workspace,
        provider,
        ctx,
        refCount: 1,
        resourceId: opts.resourceId,
      };
      this._perSession.set(opts.sessionId, entry);
      this._emitStatus({
        sessionId: opts.sessionId,
        resourceId: opts.resourceId,
        providerId: provider.providerId,
        status: 'ready',
      });
      return entry;
    };

    const pending = createEntry();
    this._perSessionResolving.set(opts.sessionId, pending);
    try {
      const entry = await pending;
      return entry.workspace;
    } finally {
      this._perSessionResolving.delete(opts.sessionId);
    }
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
    this._perSession.set(opts.childSessionId, parent);
    return parent.workspace;
  }

  async releasePerSession(opts: { sessionId: string }): Promise<void> {
    const entry = this._perSession.get(opts.sessionId);
    if (!entry) return;
    this._perSession.delete(opts.sessionId);
    entry.refCount = Math.max(0, entry.refCount - 1);
    if (entry.refCount > 0) return;

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

  async shutdown(): Promise<void> {
    const pendingResources = Array.from(this._perResourceResolving.entries());
    for (const [, pending] of pendingResources) {
      await pending.catch(() => undefined);
    }

    const pendingSessions = Array.from(this._perSessionResolving.entries());
    for (const [, pending] of pendingSessions) {
      await pending.catch(() => undefined);
    }

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

  private _assertKind(expected: HarnessWorkspaceConfig['kind']): void {
    if (this._config?.kind !== expected) {
      throw new HarnessConfigError(
        'workspace.kind',
        `expected "${expected}", got "${this._config?.kind ?? 'unconfigured'}"`,
      );
    }
  }

  private async _initIfFresh(workspace: Workspace): Promise<void> {
    if (workspace.status === 'ready' || workspace.status === 'initializing') return;
    try {
      await workspace.init();
    } catch (err) {
      this._emitError({ err });
      throw err;
    }
  }

  private async _destroyWorkspace(
    workspace: Workspace,
    provider: WorkspaceProvider | undefined,
    ctx: WorkspaceProviderContext | undefined,
    opts: { sessionId?: string; resourceId?: string; providerId?: string; err?: unknown } = {},
  ): Promise<void> {
    try {
      if (provider?.destroy && ctx) {
        await provider.destroy(workspace, ctx);
      } else {
        await workspace.destroy();
      }
    } catch (err) {
      this._emitError({
        sessionId: opts.sessionId,
        resourceId: opts.resourceId,
        providerId: opts.providerId ?? provider?.providerId,
        err,
      });
    }
    if (opts.err !== undefined) {
      this._emitError({ ...opts, err: opts.err });
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
        ...(opts.resourceId !== undefined ? { resourceId: opts.resourceId } : {}),
        ...(opts.providerId !== undefined ? { providerId: opts.providerId } : {}),
        status: opts.status,
      },
      opts.sessionId !== undefined ? { sessionId: opts.sessionId } : undefined,
    );
  }

  private _emitError(opts: { sessionId?: string; resourceId?: string; providerId?: string; err: unknown }): void {
    const err = opts.err instanceof Error ? opts.err : new Error(String(opts.err));
    this._emit.emit(
      {
        type: 'workspace_error',
        resourceId: opts.resourceId,
        providerId: opts.providerId,
        error: { name: err.name, message: err.message },
      },
      opts.sessionId !== undefined ? { sessionId: opts.sessionId } : undefined,
    );
  }
}
