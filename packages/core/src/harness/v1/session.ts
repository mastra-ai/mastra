import type { HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import { HarnessSessionClosedError, HarnessValidationError } from './errors';
import { EventEmitter } from './events';
import type { HarnessEvent, HarnessEventListener, HarnessEventUnsubscribe, EmitInput } from './events';
import type { Harness } from './harness';
import type { HarnessMode } from './shared';
import type { ModelAuthStatus, SessionLifecycleState } from './types';

export interface SessionConstructorOptions {
  harness: Harness;
  storage: HarnessStorage;
  ownerId: string;
  record: SessionRecord;
  leaseExpiresAt: number;
  leaseTtlMs: number;
}

export class Session {
  private readonly harness: Harness;
  private readonly storage: HarnessStorage;
  private readonly ownerId: string;
  private readonly leaseTtlMs: number;
  private record: SessionRecord;
  private readonly emitter: EventEmitter;
  private lifecycle: SessionLifecycleState = 'live';
  private leaseRenewTimer?: ReturnType<typeof setTimeout>;
  private flushChain: Promise<void> = Promise.resolve();

  constructor(opts: SessionConstructorOptions) {
    this.harness = opts.harness;
    this.storage = opts.storage;
    this.ownerId = opts.ownerId;
    this.leaseTtlMs = opts.leaseTtlMs;
    this.record = {
      ...opts.record,
      ownerId: opts.ownerId,
      leaseExpiresAt: opts.leaseExpiresAt,
    };
    this.emitter = new EventEmitter({ sessionId: opts.record.id });
    this.scheduleLeaseRenewal();
  }

  get id(): string {
    return this.record.id;
  }

  get resourceId(): string {
    return this.record.resourceId;
  }

  get threadId(): string {
    return this.record.threadId;
  }

  get parentSessionId(): string | undefined {
    return this.record.parentSessionId;
  }

  get modeId(): string {
    return this.record.modeId;
  }

  get modelId(): string {
    return this.record.modelId;
  }

  get lastActivityAt(): number {
    return this.record.lastActivityAt;
  }

  get lifecycleState(): SessionLifecycleState {
    return this.lifecycle;
  }

  get isClosed(): boolean {
    return this.lifecycle !== 'live';
  }

  get _internalRecordVersion(): number {
    return this.record.version;
  }

  getRecord(): Readonly<SessionRecord> {
    return this.record;
  }

  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this.emitter.subscribe(listener);
  }

  async close(): Promise<void> {
    await this.harness._closeSession(this);
  }

  _emit(event: EmitInput): HarnessEvent {
    return this.emitter.emit(event);
  }

  getCurrentMode(): HarnessMode {
    this.assertLive('getCurrentMode()');
    return this.harness._getMode(this.record.modeId);
  }

  async switchMode(opts: { mode: string }): Promise<void> {
    this.assertLive('switchMode()');
    this.harness._getMode(opts.mode);
    const previousModeId = this.record.modeId;
    if (previousModeId === opts.mode) return;

    await this.flushUpdate(prev => ({ ...prev, modeId: opts.mode }));
    this.emitter.emit({ type: 'mode_changed', modeId: opts.mode, previousModeId });
  }

  readonly models = Object.freeze({
    current: (): string => this.modelsCurrent(),
    hasSelected: (): boolean => this.modelsHasSelected(),
    currentAuthStatus: (): Promise<ModelAuthStatus> => this.modelsCurrentAuthStatus(),
    switch: (opts: { model: string }): Promise<void> => this.modelsSwitch(opts),
    setSubagent: (opts: { agentType: string; model: string }): Promise<void> => this.modelsSetSubagent(opts),
    getSubagent: (opts: { agentType: string }): string | null => this.modelsGetSubagent(opts),
  });

  async getState<TState = unknown>(): Promise<TState> {
    this.assertLive('getState()');
    return (this.record.state ?? {}) as TState;
  }

  setState<TState = unknown>(updates: Partial<TState>): Promise<void>;
  setState<TState = unknown>(updater: (prev: TState) => TState): Promise<void>;
  async setState<TState = unknown>(updatesOrUpdater: Partial<TState> | ((prev: TState) => TState)): Promise<void> {
    this.assertLive('setState()');
    let changedKeys: string[] = [];
    await this.flushUpdate(prev => {
      const current = (prev.state ?? {}) as TState;
      const next =
        typeof updatesOrUpdater === 'function'
          ? (updatesOrUpdater as (prev: TState) => TState)(current)
          : ({ ...(current as object), ...(updatesOrUpdater as object) } as TState);
      changedKeys = diffStateKeys(current, next);
      return { ...prev, state: next };
    });
    if (changedKeys.length > 0) {
      this.emitter.emit({ type: 'state_changed', changedKeys });
    }
  }

  _markClosed(record: SessionRecord): void {
    this.clearLeaseRenewal();
    this.record = record;
    this.lifecycle = 'closed';
  }

  _markEvicted(): void {
    this.clearLeaseRenewal();
    this.lifecycle = 'evicted';
  }

  _markWorkspaceLost(): void {
    // Workspace APIs land in a later slice. The registry records the state
    // here so future workspace calls can surface HarnessWorkspaceLostError.
  }

  async _kickQueueDrain(): Promise<void> {
    // Queue draining lands with the Session operations slice. Keeping this
    // no-op preserves the fork's hydration hook without starting work early.
  }

  /** @internal retained for future lease renewal/flush slices. */
  _internalStorage(): HarnessStorage {
    return this.storage;
  }

  /** @internal retained for future lease renewal/flush slices. */
  _internalOwnerId(): string {
    return this.ownerId;
  }

  private scheduleLeaseRenewal(): void {
    if (this.lifecycle !== 'live') return;
    this.clearLeaseRenewal();

    const leaseExpiresAt = this.record.leaseExpiresAt ?? Date.now() + this.leaseTtlMs;
    const msUntilExpiry = leaseExpiresAt - Date.now();
    const halfTtl = Math.max(1, Math.floor(this.leaseTtlMs / 2));
    const delay = Math.max(1, Math.min(halfTtl, msUntilExpiry > 1 ? msUntilExpiry - 1 : 1));

    this.leaseRenewTimer = setTimeout(() => {
      void this.renewLease();
    }, delay);
    this.leaseRenewTimer.unref?.();
  }

  private clearLeaseRenewal(): void {
    if (!this.leaseRenewTimer) return;
    clearTimeout(this.leaseRenewTimer);
    this.leaseRenewTimer = undefined;
  }

  private async renewLease(): Promise<void> {
    if (this.lifecycle !== 'live') return;

    try {
      const lease = await this.storage.renewSessionLease({
        sessionId: this.id,
        ownerId: this.ownerId,
        ttlMs: this.leaseTtlMs,
      });
      this.record = {
        ...this.record,
        ownerId: this.ownerId,
        leaseExpiresAt: lease.expiresAt,
        version: Math.max(this.record.version, lease.version),
      };
      this.scheduleLeaseRenewal();
    } catch {
      await this.harness._evictSession(this, 'lease_lost');
    }
  }

  private modelsCurrent(): string {
    this.assertLive('models.current()');
    return this.record.modelId;
  }

  private modelsHasSelected(): boolean {
    this.assertLive('models.hasSelected()');
    if (this.record.modelId && this.record.modelId.length > 0) return true;
    if (Object.keys(this.record.subagentModelOverrides ?? {}).length > 0) return true;
    return false;
  }

  private async modelsCurrentAuthStatus(): Promise<ModelAuthStatus> {
    this.assertLive('models.currentAuthStatus()');
    const modelId = this.record.modelId;
    if (!modelId) return 'unknown';
    const entry = await this.harness.models.get(modelId);
    if (!entry) return 'unknown';
    return this.harness.models.getAuthStatus(modelId);
  }

  private async modelsSwitch(opts: { model: string }): Promise<void> {
    this.assertLive('models.switch()');
    assertModelId('models.switch', opts.model);
    const previousModelId = this.record.modelId;
    if (previousModelId === opts.model) return;

    await this.flushUpdate(prev => ({ ...prev, modelId: opts.model }));
    this.emitter.emit({ type: 'model_changed', modelId: opts.model, previousModelId });
  }

  private async modelsSetSubagent(opts: { agentType: string; model: string }): Promise<void> {
    this.assertLive('models.setSubagent()');
    assertAgentType('models.setSubagent', opts.agentType);
    assertModelId('models.setSubagent', opts.model);
    const previousModelId = this.record.subagentModelOverrides?.[opts.agentType] ?? null;
    if (previousModelId === opts.model) return;

    await this.flushUpdate(prev => ({
      ...prev,
      subagentModelOverrides: {
        ...(prev.subagentModelOverrides ?? {}),
        [opts.agentType]: opts.model,
      },
    }));
    this.emitter.emit({
      type: 'model_override_set',
      agentType: opts.agentType,
      modelId: opts.model,
      previousModelId,
    });
  }

  private modelsGetSubagent(opts: { agentType: string }): string | null {
    this.assertLive('models.getSubagent()');
    assertAgentType('models.getSubagent', opts.agentType);
    return this.record.subagentModelOverrides?.[opts.agentType] ?? null;
  }

  private flushUpdate(update: (prev: SessionRecord) => SessionRecord): Promise<void> {
    const run = async (): Promise<void> => {
      const next: SessionRecord = {
        ...update(this.record),
        lastActivityAt: Date.now(),
      };
      const saved = await this.storage.saveSession(next, {
        ownerId: this.ownerId,
        ifVersion: this.record.version,
      });
      this.record = { ...next, version: saved.version };
    };
    const next = this.flushChain.then(run, run);
    this.flushChain = next.catch(() => {});
    return next;
  }

  private assertLive(method: string): void {
    if (this.lifecycle !== 'live') {
      throw new HarnessSessionClosedError(this.id);
    }
    void method;
  }
}

function assertAgentType(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'agentType must be a non-empty string');
  }
}

function assertModelId(method: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessValidationError(method, 'model must be a non-empty string');
  }
}

function diffStateKeys(prev: unknown, next: unknown): string[] {
  if (!isRecord(prev) || !isRecord(next)) return Object.is(prev, next) ? [] : ['*'];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  return [...keys].filter(key => !Object.is(prev[key], next[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
