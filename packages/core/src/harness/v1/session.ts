import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';

import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import { createSignal } from '../../agent/signals';
import type { ToolsInput } from '../../agent/types';
import { RequestContext } from '../../request-context';
import type {
  HarnessStorage,
  OperationAdmissionTombstone,
  PersistedAttachment,
  QueueAdmissionReceipt,
  QueuedItem,
  SessionRecord,
} from '../../storage/domains/harness';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import { convertStoredMessageToHarnessMessage } from '../_shared/message-conversion';
import type { StoredMessageRow } from '../_shared/message-conversion';
import {
  HarnessConfigError,
  HarnessAdmissionConflictError,
  HarnessOverrideConflictError,
  HarnessQueueFullError,
  HarnessSessionClosedError,
  HarnessValidationError,
} from './errors';
import { EventEmitter } from './events';
import type { HarnessEvent, HarnessEventListener, HarnessEventUnsubscribe, EmitInput } from './events';
import type { Harness } from './harness';
import type { HarnessMessage, HarnessMode } from './shared';
import type {
  AgentResult,
  AgentStream,
  AttachmentRef,
  ListMessagesOptions,
  MessageOptions,
  MessageOptionsDefault,
  MessageOptionsStream,
  MessageOptionsStructured,
  ModelAuthStatus,
  QueueAdmissionResult,
  QueueOptions,
  SessionInjectSystemReminderOptions,
  SessionInjectSystemReminderResult,
  SessionLifecycleState,
  SessionSignalOptions,
  SessionSignalResult,
  TokenUsage,
} from './types';

export interface SessionConstructorOptions {
  harness: Harness;
  storage: HarnessStorage;
  ownerId: string;
  record: SessionRecord;
  leaseExpiresAt: number;
  leaseTtlMs: number;
}

interface IdleWaiter {
  check: () => boolean;
  reject: (reason: unknown) => void;
  cleanup: () => void;
}

interface QueueWaiter {
  promise: Promise<AgentResult>;
  resolve: (result: AgentResult) => void;
  reject: (reason: unknown) => void;
}

type QueueAdmissionInternalResult = QueueAdmissionResult & {
  terminalResult?: AgentResult;
};

const QUEUE_DUPLICATE_WAIT_TIMEOUT_MS = 30_000;
const QUEUE_DUPLICATE_WAIT_INTERVAL_MS = 100;

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
  private currentTurnAbortController?: AbortController;
  private currentQueuedItemId?: string;
  private currentRunId?: string;
  private currentTraceId?: string;
  private draining = false;
  private readonly idleWaiters = new Set<IdleWaiter>();
  private readonly activeToolNames = new Map<string, string>();
  private readonly queueWaiters = new Map<string, QueueWaiter>();

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

  get createdAt(): number {
    return this.record.createdAt;
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

  private emitTurnEvent(event: EmitInput): HarnessEvent {
    if (this.currentQueuedItemId !== undefined && (event as { queuedItemId?: string }).queuedItemId === undefined) {
      return this.emitter.emit({ ...event, queuedItemId: this.currentQueuedItemId } as EmitInput);
    }
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

  isRunning(): boolean {
    return this.currentTurnAbortController !== undefined;
  }

  isBusy(): boolean {
    if (this.currentTurnAbortController !== undefined) return true;
    if (this.draining) return true;
    if (this.currentQueuedItemId !== undefined) return true;
    if ((this.record.pendingQueue?.length ?? 0) > 0) return true;
    if (this.record.pendingResume !== undefined) return true;
    return false;
  }

  getQueueDepth(): number {
    return this.record.pendingQueue?.length ?? 0;
  }

  getTokenUsage(): TokenUsage {
    return { ...this.record.tokenUsage };
  }

  getCurrentRunId(): string | null {
    return this.currentRunId ?? null;
  }

  getCurrentTraceId(): string | null {
    return this.currentTraceId ?? null;
  }

  async message(opts: MessageOptionsDefault): Promise<AgentResult>;
  async message(opts: MessageOptionsStream): Promise<AgentStream>;
  async message<S extends z.ZodTypeAny>(opts: MessageOptionsStructured<S>): Promise<z.infer<S>>;
  async message(opts: MessageOptions): Promise<AgentResult | AgentStream | unknown> {
    this.assertLive('message()');
    this.assertCanStartTurn('message()');

    if (typeof opts.content !== 'string' || opts.content.length === 0) {
      throw new HarnessValidationError('message().content', 'content must be a non-empty string');
    }
    if (opts.stream === true && opts.output !== undefined) {
      throw new HarnessConfigError('message()', '`stream: true` and `output` are mutually exclusive');
    }
    if (opts.output !== undefined && opts.sync !== true) {
      throw new HarnessConfigError('message()', 'structured `output` requires `sync: true`');
    }

    const effectiveModeId = opts.mode ?? this.record.modeId;
    const effectiveModelId = opts.model ?? this.record.modelId;
    const mode = this.harness._getMode(effectiveModeId);
    const agent = this.harness.getAgentForMode(effectiveModeId);
    const toolsets = this.buildToolsets(mode, opts.additionalTools);
    const turnAbortController = this.beginTurn(opts.abortSignal);

    try {
      const requestContext = this.buildRequestContext({
        modeId: effectiveModeId,
        abortSignal: turnAbortController.signal,
      });
      const execOptions: AgentExecutionOptionsBase<unknown> = {
        memory: { thread: this.threadId, resource: this.resourceId },
        abortSignal: turnAbortController.signal,
        requestContext,
        ...(effectiveModelId ? { model: effectiveModelId as never } : {}),
        ...(toolsets ? { toolsets } : {}),
        ...(mode.instructions ? { instructions: mode.instructions } : {}),
      };

      if (opts.output !== undefined && opts.sync === true) {
        this.emitTurnEvent({ type: 'agent_start' });
        const full = (await agent.generate(opts.content, {
          ...execOptions,
          structuredOutput: { schema: opts.output as never },
        } as never)) as FullOutput<unknown>;
        await this.recordTurnCompletion(full);
        this.emitTurnEvent({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
        return full.object;
      }

      const signalContents = await this.buildSignalContents(opts.content, opts.attachments ?? []);
      const signal = createSignal({ type: 'user-message', contents: signalContents });
      this.emitTurnEvent({ type: 'agent_start' });
      const output = (await agent.stream(signal, execOptions as never)) as MastraModelOutput<unknown>;
      this.currentRunId = output.runId;

      if (opts.stream === true) {
        void this.finalizeStreamedTurn(output).finally(() => this.endTurn(turnAbortController));
        return output as AgentStream;
      }

      const streamDrain = this.consumeAgentStream(output);
      void streamDrain.catch(() => undefined);
      try {
        const full = (await output.getFullOutput()) as FullOutput<unknown>;
        await streamDrain;
        await this.recordTurnCompletion(full);
        this.emitTurnEvent({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
        return full as AgentResult;
      } finally {
        this.endTurn(turnAbortController);
      }
    } catch (err) {
      this.endTurn(turnAbortController);
      throw err;
    }
  }

  async signal(opts: SessionSignalOptions): Promise<SessionSignalResult> {
    this.assertLive('signal()');
    this.assertCanStartTurn('signal()');
    if (typeof opts.content !== 'string' || opts.content.length === 0) {
      throw new HarnessValidationError('signal().content', 'content must be a non-empty string');
    }

    const effectiveModeId = opts.mode ?? this.record.modeId;
    const mode = this.harness._getMode(effectiveModeId);
    const agent = this.harness.getAgentForMode(effectiveModeId);
    const turnAbortController = this.beginTurn(opts.abortSignal);

    try {
      const execOptions = this.buildExecutionOptions({
        mode,
        modeId: effectiveModeId,
        modelId: this.record.modelId,
        abortSignal: turnAbortController.signal,
        additionalTools: opts.additionalTools,
      });
      const signal = createSignal({ type: 'user-message', contents: opts.content });
      this.emitTurnEvent({ type: 'agent_start' });
      const output = (await agent.stream(signal, execOptions as never)) as MastraModelOutput<unknown>;
      this.currentRunId = output.runId;
      const result = this.finishSignalResultTurn(output, turnAbortController);
      void result.catch(() => undefined);
      return {
        id: signal.id,
        runId: output.runId,
        willInterleave: false,
        accepted: true,
        signal,
        result,
      };
    } catch (err) {
      this.endTurn(turnAbortController);
      throw err;
    }
  }

  async injectSystemReminder(
    content: string,
    opts?: SessionInjectSystemReminderOptions,
  ): Promise<SessionInjectSystemReminderResult> {
    this.assertLive('injectSystemReminder()');
    this.assertCanStartTurn('injectSystemReminder()');
    if (typeof content !== 'string' || content.length === 0) {
      throw new HarnessValidationError('injectSystemReminder().content', 'content must be a non-empty string');
    }

    const mode = this.harness._getMode(this.record.modeId);
    const agent = this.harness.getAgentForMode(this.record.modeId);
    const turnAbortController = this.beginTurn(undefined);

    try {
      const execOptions = this.buildExecutionOptions({
        mode,
        modeId: this.record.modeId,
        modelId: this.record.modelId,
        abortSignal: turnAbortController.signal,
      });
      const signal = createSignal({
        type: 'system-reminder',
        contents: content,
        ...(opts?.attributes ? { attributes: opts.attributes } : {}),
        ...(opts?.metadata ? { metadata: opts.metadata } : {}),
      });
      this.emitTurnEvent({ type: 'agent_start' });
      const output = (await agent.stream(signal, execOptions as never)) as MastraModelOutput<unknown>;
      this.currentRunId = output.runId;
      const result = this.finishSignalResultTurn(output, turnAbortController);
      void result.catch(() => undefined);
      return {
        id: signal.id,
        runId: output.runId,
        willInterleave: false,
        accepted: true,
        signal,
      };
    } catch (err) {
      this.endTurn(turnAbortController);
      throw err;
    }
  }

  async queue(opts: QueueOptions): Promise<AgentResult> {
    this.assertLive('queue()');
    const admission = await this.admitQueueInternal(opts, 'queue()');
    if (admission.terminalResult !== undefined) return admission.terminalResult;
    if (
      admission.duplicate &&
      !this.queueWaiters.has(admission.queuedItemId) &&
      !(this.record.pendingQueue ?? []).some(item => item.id === admission.queuedItemId)
    ) {
      return this.waitForDuplicateQueueResult(admission.queuedItemId);
    }
    const waiter = this.getOrCreateQueueWaiter(admission.queuedItemId);
    void this._kickQueueDrain();
    return waiter.promise;
  }

  async admitQueue(opts: QueueOptions): Promise<QueueAdmissionResult> {
    this.assertLive('admitQueue()');
    if (typeof opts.admissionId !== 'string' || opts.admissionId.length === 0) {
      throw new HarnessValidationError('admitQueue().admissionId', 'admissionId must be a non-empty string');
    }
    const admission = await this.admitQueueInternal(opts, 'admitQueue()');
    void this._kickQueueDrain();
    return admission;
  }

  waitForIdle(opts?: { timeoutMs?: number }): Promise<void> {
    this.assertLive('waitForIdle()');
    if (!this.isBusy()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiter: IdleWaiter = {
        check: () => {
          if (!this.isBusy()) {
            cleanup();
            resolve();
            return true;
          }
          return false;
        },
        reject,
        cleanup: () => {},
      };
      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        this.idleWaiters.delete(waiter);
      };
      waiter.cleanup = cleanup;
      this.idleWaiters.add(waiter);
      if (opts?.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          cleanup();
          reject(new HarnessValidationError('waitForIdle()', `session did not become idle within ${opts.timeoutMs}ms`));
        }, opts.timeoutMs);
      }
    });
  }

  async listMessages(opts?: ListMessagesOptions): Promise<HarnessMessage[]> {
    this.assertLive('listMessages()');
    const limit = opts?.limit;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(limit))) {
      throw new HarnessValidationError('limit', `\`limit\` must be a non-negative integer; received ${String(limit)}`);
    }
    if (limit === 0) return [];

    const memory = await this.harness._internalTryGetMemoryStorage();
    if (!memory) return [];

    if (limit !== undefined) {
      const result = await memory.listMessages({
        threadId: this.threadId,
        resourceId: this.resourceId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages
        .slice()
        .reverse()
        .map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
    }

    const result = await memory.listMessages({ threadId: this.threadId, resourceId: this.resourceId, perPage: false });
    return result.messages.map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
  }

  _markClosed(record: SessionRecord): void {
    this.clearLeaseRenewal();
    this.record = record;
    this.lifecycle = 'closed';
    this.rejectIdleWaiters(new HarnessSessionClosedError(this.id));
  }

  _markEvicted(): void {
    this.clearLeaseRenewal();
    this.lifecycle = 'evicted';
    this.rejectIdleWaiters(new HarnessSessionClosedError(this.id));
  }

  _markWorkspaceLost(): void {
    // Workspace APIs land in a later slice. The registry records the state
    // here so future workspace calls can surface HarnessWorkspaceLostError.
  }

  async _kickQueueDrain(): Promise<void> {
    await this.maybeDrainQueue();
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
      this.notifyMaybeIdle();
    };
    const next = this.flushChain.then(run, run);
    this.flushChain = next.catch(() => {});
    return next;
  }

  private notifyMaybeIdle(): void {
    if (this.idleWaiters.size === 0) return;
    if (this.isBusy()) return;
    const waiters = Array.from(this.idleWaiters);
    for (const waiter of waiters) waiter.check();
  }

  private rejectIdleWaiters(reason: unknown): void {
    if (this.idleWaiters.size === 0) return;
    const waiters = Array.from(this.idleWaiters);
    this.idleWaiters.clear();
    for (const waiter of waiters) {
      waiter.cleanup();
      waiter.reject(reason);
    }
  }

  private assertLive(method: string): void {
    if (this.lifecycle !== 'live') {
      throw new HarnessSessionClosedError(this.id);
    }
    void method;
  }

  private assertCanStartTurn(method: string): void {
    if (!this.isRunning()) return;
    throw new HarnessOverrideConflictError(
      this.id,
      'mode',
      `${method} cannot start while another message turn is active`,
    );
  }

  private beginTurn(callerSignal: AbortSignal | undefined): AbortController {
    const controller = new AbortController();
    this.currentTurnAbortController = controller;
    this.currentRunId = undefined;
    this.currentTraceId = undefined;
    this.activeToolNames.clear();

    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort((callerSignal as { reason?: unknown }).reason ?? 'aborted');
      } else {
        callerSignal.addEventListener(
          'abort',
          () => controller.abort((callerSignal as { reason?: unknown }).reason ?? 'aborted'),
          { once: true },
        );
      }
    }

    return controller;
  }

  private endTurn(controller: AbortController): void {
    if (this.currentTurnAbortController === controller) {
      this.currentTurnAbortController = undefined;
      this.currentQueuedItemId = undefined;
      this.activeToolNames.clear();
      this.notifyMaybeIdle();
      if ((this.record.pendingQueue?.length ?? 0) > 0) {
        void this._kickQueueDrain();
      }
    }
  }

  private buildRequestContext(opts: { modeId: string; abortSignal: AbortSignal }): RequestContext {
    const session = this;
    const stateSnapshot = cloneJsonLike((this.record.state ?? {}) as unknown);
    const requestContext = new RequestContext();
    requestContext.set('harness', {
      harnessId: this.harness.ownerId,
      sessionId: this.id,
      requestId: `req-${randomUUID()}`,
      threadId: this.threadId,
      resourceId: this.resourceId,
      modeId: opts.modeId,
      state: stateSnapshot,
      getState: () => cloneJsonLike((session.record.state ?? {}) as unknown),
      setState: (updatesOrUpdater: unknown) =>
        session.setState(updatesOrUpdater as Partial<unknown> | ((prev: unknown) => unknown)),
      abortSignal: opts.abortSignal,
      registerQuestion: () => {
        throw new HarnessConfigError('requestContext.registerQuestion', 'pending question support is not enabled yet');
      },
      registerPlanApproval: () => {
        throw new HarnessConfigError(
          'requestContext.registerPlanApproval',
          'pending plan approval support is not enabled yet',
        );
      },
      subagentDepth: this.record.subagentDepth ?? 0,
      source: (this.record.subagentDepth ?? 0) > 0 ? 'subagent' : 'parent',
      parentSessionId: this.record.parentSessionId,
      getSubagentModel: (params?: { agentType?: string }) =>
        params?.agentType ? (this.record.subagentModelOverrides?.[params.agentType] ?? null) : null,
      useSkill: async () => {
        throw new HarnessConfigError('requestContext.useSkill', 'skill execution support is not enabled yet');
      },
    });
    return requestContext;
  }

  private buildToolsets(mode: HarnessMode, callAdditional?: ToolsInput): Record<string, ToolsInput> | undefined {
    const toolsets: Record<string, ToolsInput> = {};
    if (mode.tools) toolsets[`mode:${mode.id}`] = mode.tools;
    if (mode.additionalTools) toolsets[`mode:${mode.id}:add`] = mode.additionalTools;
    if (callAdditional) toolsets['call:additional'] = callAdditional;
    return Object.keys(toolsets).length === 0 ? undefined : toolsets;
  }

  private buildExecutionOptions(opts: {
    mode: HarnessMode;
    modeId: string;
    modelId?: string;
    abortSignal: AbortSignal;
    additionalTools?: ToolsInput;
  }): AgentExecutionOptionsBase<unknown> {
    const toolsets = this.buildToolsets(opts.mode, opts.additionalTools);
    return {
      memory: { thread: this.threadId, resource: this.resourceId },
      abortSignal: opts.abortSignal,
      requestContext: this.buildRequestContext({ modeId: opts.modeId, abortSignal: opts.abortSignal }),
      ...(opts.modelId ? { model: opts.modelId as never } : {}),
      ...(toolsets ? { toolsets } : {}),
      ...(opts.mode.instructions ? { instructions: opts.mode.instructions } : {}),
    };
  }

  private async buildSignalContents(content: string, attachments: AttachmentRef[]) {
    if (attachments.length === 0) return content;

    const parts: Array<
      { type: 'text'; text: string } | { type: 'file'; data: Uint8Array; mediaType: string; filename?: string }
    > = [{ type: 'text', text: content }];
    for (let i = 0; i < attachments.length; i += 1) {
      const attachment = attachments[i]!;
      if (!attachment.attachmentId) {
        throw new HarnessValidationError(`message().attachments[${i}].attachmentId`, 'attachmentId is required');
      }
      if (attachment.ownerSessionId !== undefined && attachment.ownerSessionId !== this.id) {
        throw new HarnessValidationError(
          `message().attachments[${i}].ownerSessionId`,
          'attachment must belong to this session',
        );
      }
      const loaded = await this.storage.loadAttachment({
        sessionId: attachment.ownerSessionId ?? this.id,
        attachmentId: attachment.attachmentId,
      });
      if (!loaded) {
        throw new HarnessValidationError(`message().attachments[${i}].attachmentId`, 'attachment was not found');
      }
      if (attachment.bytes !== undefined && attachment.bytes !== loaded.bytes) {
        throw new HarnessValidationError(
          `message().attachments[${i}].bytes`,
          'attachment byte count does not match storage',
        );
      }
      if (attachment.sha256 !== undefined && attachment.sha256 !== loaded.sha256) {
        throw new HarnessValidationError(
          `message().attachments[${i}].sha256`,
          'attachment digest does not match storage',
        );
      }
      parts.push({
        type: 'file',
        data: loaded.data,
        mediaType: loaded.mimeType,
        filename: loaded.name,
      });
    }
    return parts;
  }

  private async consumeAgentStream(output: MastraModelOutput<unknown>): Promise<void> {
    for await (const chunk of output.fullStream as AsyncIterable<unknown>) {
      this.emitChunkEvent(chunk);
    }
  }

  private emitChunkEvent(chunk: unknown): void {
    if (!chunk || typeof chunk !== 'object') return;
    const record = chunk as Record<string, unknown>;
    const payload = (record.payload && typeof record.payload === 'object' ? record.payload : record) as Record<
      string,
      unknown
    >;

    if (typeof record.runId === 'string') this.currentRunId = record.runId;

    switch (record.type) {
      case 'text-start': {
        const messageId = stringField(payload, 'id') ?? stringField(payload, 'messageId');
        if (messageId) this.emitTurnEvent({ type: 'message_start', messageId });
        break;
      }
      case 'text-delta': {
        const messageId = stringField(payload, 'id') ?? stringField(payload, 'messageId');
        const delta = stringField(payload, 'text') ?? stringField(payload, 'delta');
        if (messageId && delta !== undefined) this.emitTurnEvent({ type: 'message_update', messageId, delta });
        break;
      }
      case 'text-end': {
        const messageId = stringField(payload, 'id') ?? stringField(payload, 'messageId');
        if (messageId) this.emitTurnEvent({ type: 'message_end', messageId });
        break;
      }
      case 'tool-call': {
        const toolCallId = stringField(payload, 'toolCallId');
        const toolName = stringField(payload, 'toolName');
        if (toolCallId && toolName) {
          this.activeToolNames.set(toolCallId, toolName);
          this.emitTurnEvent({ type: 'tool_start', toolCallId, toolName, args: payload.args });
        }
        break;
      }
      case 'tool-result':
      case 'tool-error': {
        const toolCallId = stringField(payload, 'toolCallId');
        if (toolCallId) {
          const isError = record.type === 'tool-error';
          this.emitTurnEvent({
            type: 'tool_end',
            toolCallId,
            result: isError ? projectErrorLike(payload.error) : payload.result,
            isError,
          });
        }
        break;
      }
      case 'data-task-updated': {
        const data = (record.data && typeof record.data === 'object' ? record.data : undefined) as
          | { tasks?: unknown }
          | undefined;
        if (Array.isArray(data?.tasks)) this.emitTurnEvent({ type: 'task_updated', tasks: data.tasks as never });
        break;
      }
    }
  }

  private async finalizeStreamedTurn(output: MastraModelOutput<unknown>): Promise<void> {
    try {
      const full = (await output.getFullOutput()) as FullOutput<unknown>;
      await this.recordTurnCompletion(full);
      this.emitTurnEvent({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
    } catch {
      this.emitTurnEvent({ type: 'agent_end', reason: 'error', runId: output.runId });
    }
  }

  private async finishSignalResultTurn(
    output: MastraModelOutput<unknown>,
    controller: AbortController,
  ): Promise<AgentResult> {
    const streamDrain = this.consumeAgentStream(output);
    void streamDrain.catch(() => undefined);
    try {
      const full = (await output.getFullOutput()) as FullOutput<unknown>;
      await streamDrain;
      await this.recordTurnCompletion(full);
      this.emitTurnEvent({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
      return full as AgentResult;
    } catch (err) {
      this.emitTurnEvent({ type: 'agent_end', reason: 'error', runId: output.runId });
      throw err;
    } finally {
      this.endTurn(controller);
    }
  }

  private async recordTurnCompletion(full: FullOutput<unknown>): Promise<void> {
    if (full.runId) this.currentRunId = full.runId;
    if (typeof (full as { traceId?: unknown }).traceId === 'string') {
      this.currentTraceId = (full as { traceId: string }).traceId;
    }
    const usage = extractUsage(full);
    await this.flushUpdate(prev => ({
      ...prev,
      tokenUsage: {
        promptTokens: prev.tokenUsage.promptTokens + usage.promptTokens,
        completionTokens: prev.tokenUsage.completionTokens + usage.completionTokens,
        totalTokens: prev.tokenUsage.totalTokens + usage.totalTokens,
      },
    }));
  }

  private async admitQueueInternal(
    opts: QueueOptions,
    methodName: 'queue()' | 'admitQueue()',
  ): Promise<QueueAdmissionInternalResult> {
    if (typeof opts.content !== 'string' || opts.content.length === 0) {
      throw new HarnessValidationError(`${methodName}.content`, 'content must be a non-empty string');
    }
    const effectiveModeId = opts.mode ?? this.record.modeId;
    this.harness._getMode(effectiveModeId);
    const attachments = await this.resolveQueueAttachments(`${methodName}.attachments`, opts.attachments ?? []);
    const admissionId = opts.admissionId ?? `queue-${randomUUID()}`;
    const admissionHash = computeQueueAdmissionHash({
      content: opts.content,
      mode: opts.mode,
      model: opts.model,
      yolo: opts.yolo,
      attachments,
    });

    if (opts.admissionId !== undefined) {
      const duplicate = await this.resolveQueueAdmissionDuplicate({
        admissionId,
        admissionHash,
      });
      if (duplicate) {
        const queuedItemId = duplicate.queuedItemId;
        if (!queuedItemId) {
          throw new HarnessValidationError(`${methodName}.admissionId`, 'duplicate queue evidence is missing item id');
        }
        if (methodName === 'queue()') {
          const terminal = this.queueTerminalResultFromEvidence(duplicate);
          if (terminal.status === 'completed') {
            return { accepted: true, queuedItemId, duplicate: true, terminalResult: terminal.result };
          }
          if (terminal.status === 'failed') throw terminal.error;
        }
        return { accepted: true, queuedItemId, duplicate: true };
      }
    }

    const now = Date.now();
    const queuedItem: QueuedItem = {
      id: `q-${randomUUID()}`,
      admissionId,
      admissionHash,
      enqueuedAt: now,
      content: opts.content,
      attachments,
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.yolo !== undefined ? { yolo: opts.yolo } : {}),
      source: 'user',
    };
    const receipt: QueueAdmissionReceipt = {
      admissionId,
      admissionHash,
      queuedItemId: queuedItem.id,
      modeId: effectiveModeId,
      runtimeDependencies: {
        modeId: effectiveModeId,
        modelId: opts.model ?? this.record.modelId,
      },
      status: 'queued',
      attempts: 0,
      enqueuedAt: now,
      updatedAt: now,
    };

    let duplicateDuringFlush: QueueAdmissionReceipt | undefined;
    await this.flushUpdate(prev => {
      for (const existing of Object.values(prev.queueAdmissionReceipts ?? {})) {
        if (existing.admissionId !== admissionId) continue;
        if (existing.admissionHash !== admissionHash) {
          throw new HarnessAdmissionConflictError(this.id, admissionId, existing.admissionHash, admissionHash);
        }
        duplicateDuringFlush = existing;
        return prev;
      }
      const pendingQueue = prev.pendingQueue ?? [];
      if (pendingQueue.length >= this.harness._internalMaxQueueDepth) {
        throw new HarnessQueueFullError(this.id, this.harness._internalMaxQueueDepth);
      }
      return {
        ...prev,
        pendingQueue: [...pendingQueue, queuedItem],
        queueAdmissionReceipts: {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItem.id]: receipt,
        },
      };
    });
    if (duplicateDuringFlush) {
      return { accepted: true, queuedItemId: duplicateDuringFlush.queuedItemId, duplicate: true };
    }

    return { accepted: true, queuedItemId: queuedItem.id, duplicate: false };
  }

  private async resolveQueueAdmissionDuplicate(opts: {
    admissionId: string;
    admissionHash: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | undefined> {
    const resolved = await this.storage.resolveOperationAdmissionEvidence({
      sessionId: this.id,
      resourceId: this.resourceId,
      threadId: this.threadId,
      kind: 'queue',
      admissionId: opts.admissionId,
      attemptedAdmissionHash: opts.admissionHash,
    });
    if (resolved.status === 'none') return undefined;
    if (resolved.status === 'conflict') {
      throw new HarnessAdmissionConflictError(
        this.id,
        opts.admissionId,
        resolved.storedAdmissionHash ?? 'unknown',
        opts.admissionHash,
      );
    }
    return resolved.evidence as QueueAdmissionReceipt | OperationAdmissionTombstone | undefined;
  }

  private queueTerminalResultFromEvidence(
    evidence: QueueAdmissionReceipt | OperationAdmissionTombstone,
  ): { status: 'completed'; result: AgentResult } | { status: 'failed'; error: Error } | { status: 'pending' } {
    if ('kind' in evidence)
      return { status: 'failed', error: new HarnessValidationError('queue()', 'queue result expired') };
    if (evidence.status === 'completed' && evidence.result !== undefined) {
      return { status: 'completed', result: evidence.result as AgentResult };
    }
    if (evidence.status === 'failed' || evidence.status === 'admission_failed' || evidence.status === 'dead') {
      return {
        status: 'failed',
        error: new HarnessValidationError('queue()', evidence.error?.message ?? 'queued turn failed'),
      };
    }
    return { status: 'pending' };
  }

  private getOrCreateQueueWaiter(queuedItemId: string): QueueWaiter {
    const existing = this.queueWaiters.get(queuedItemId);
    if (existing) return existing;
    let resolve!: (result: AgentResult) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<AgentResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const waiter = { promise, resolve, reject };
    this.queueWaiters.set(queuedItemId, waiter);
    return waiter;
  }

  private async waitForDuplicateQueueResult(queuedItemId: string): Promise<AgentResult> {
    const deadline = Date.now() + QUEUE_DUPLICATE_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const evidence = await this.storage.loadQueueResultEvidence({
        sessionId: this.id,
        resourceId: this.resourceId,
        queuedItemId,
      });
      if (evidence) {
        const terminal = this.queueTerminalResultFromEvidence(evidence);
        if (terminal.status === 'completed') return terminal.result;
        if (terminal.status === 'failed') throw terminal.error;
      }
      await delay(Math.min(QUEUE_DUPLICATE_WAIT_INTERVAL_MS, Math.max(0, deadline - Date.now())));
    }
    throw new HarnessValidationError('queue().admissionId', 'duplicate queue result was not available before timeout');
  }

  private async maybeDrainQueue(): Promise<void> {
    if (this.draining || this.currentTurnAbortController !== undefined) return;
    if (this.lifecycle !== 'live') return;
    this.draining = true;
    try {
      while (this.lifecycle === 'live' && this.currentTurnAbortController === undefined) {
        const item = this.record.pendingQueue?.[0];
        if (!item) break;
        this.currentQueuedItemId = item.id;
        await this.updateQueueAdmissionReceipt(item.id, (receipt, now) => ({
          ...receipt,
          status: receipt.status === 'queued' ? 'admitting' : receipt.status,
          attempts: receipt.attempts + 1,
          admittingAt: receipt.admittingAt ?? now,
          updatedAt: now,
        }));
        this.emitter.emit({ type: 'queue_item_started', queuedItemId: item.id });

        try {
          const result = (await this.message({
            content: item.content,
            ...(item.mode !== undefined ? { mode: item.mode } : {}),
            ...(item.model !== undefined ? { model: item.model } : {}),
            attachments: item.attachments.map(queuedAttachmentToRef),
          })) as AgentResult;
          await this.completeQueuedItem(item, result);
        } catch (err) {
          await this.failQueuedItem(item, err);
        } finally {
          if (this.currentQueuedItemId === item.id) this.currentQueuedItemId = undefined;
        }
      }
    } finally {
      this.draining = false;
      this.notifyMaybeIdle();
    }
  }

  private async completeQueuedItem(item: QueuedItem, result: AgentResult): Promise<void> {
    await this.flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[item.id];
      const now = Date.now();
      const nextReceipts = { ...(prev.queueAdmissionReceipts ?? {}) };
      if (receipt) {
        nextReceipts[item.id] = {
          ...receipt,
          status: 'completed',
          runId: result.runId,
          result,
          postRunFinalizedAt: now,
          completedAt: now,
          updatedAt: now,
        };
      }
      return {
        ...prev,
        pendingQueue: (prev.pendingQueue ?? []).filter(queued => queued.id !== item.id),
        queueAdmissionReceipts: nextReceipts,
      };
    });
    const waiter = this.queueWaiters.get(item.id);
    if (waiter) {
      this.queueWaiters.delete(item.id);
      waiter.resolve(result);
    }
  }

  private async failQueuedItem(item: QueuedItem, reason: unknown): Promise<void> {
    const error = toPublicQueueError(reason);
    await this.flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[item.id];
      const now = Date.now();
      const nextReceipts = { ...(prev.queueAdmissionReceipts ?? {}) };
      if (receipt) {
        nextReceipts[item.id] = {
          ...receipt,
          status: 'failed',
          error,
          failedAt: now,
          updatedAt: now,
        };
      }
      return {
        ...prev,
        pendingQueue: (prev.pendingQueue ?? []).filter(queued => queued.id !== item.id),
        queueAdmissionReceipts: nextReceipts,
      };
    });
    const waiter = this.queueWaiters.get(item.id);
    if (waiter) {
      this.queueWaiters.delete(item.id);
      waiter.reject(reason);
    }
  }

  private async updateQueueAdmissionReceipt(
    queuedItemId: string,
    update: (receipt: QueueAdmissionReceipt, now: number) => QueueAdmissionReceipt,
  ): Promise<void> {
    await this.flushUpdate(prev => {
      const receipt = prev.queueAdmissionReceipts?.[queuedItemId];
      if (!receipt) return prev;
      return {
        ...prev,
        queueAdmissionReceipts: {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]: update(receipt, Date.now()),
        },
      };
    });
  }

  private async resolveQueueAttachments(field: string, attachments: AttachmentRef[]): Promise<PersistedAttachment[]> {
    const persisted: PersistedAttachment[] = [];
    for (let i = 0; i < attachments.length; i += 1) {
      const attachment = attachments[i]!;
      if (!attachment.attachmentId) {
        throw new HarnessValidationError(`${field}[${i}].attachmentId`, 'attachmentId is required');
      }
      if (attachment.ownerSessionId !== undefined && attachment.ownerSessionId !== this.id) {
        throw new HarnessValidationError(`${field}[${i}].ownerSessionId`, 'attachment must belong to this session');
      }
      const record = await this.storage.getAttachmentRecord({
        sessionId: attachment.ownerSessionId ?? this.id,
        attachmentId: attachment.attachmentId,
      });
      if (!record) {
        throw new HarnessValidationError(`${field}[${i}].attachmentId`, 'attachment was not found');
      }
      if (attachment.bytes !== undefined && attachment.bytes !== record.bytes) {
        throw new HarnessValidationError(`${field}[${i}].bytes`, 'attachment byte count does not match storage');
      }
      if (attachment.sha256 !== undefined && attachment.sha256 !== record.sha256) {
        throw new HarnessValidationError(`${field}[${i}].sha256`, 'attachment digest does not match storage');
      }
      persisted.push({
        kind: 'ref',
        attachmentId: record.attachmentId,
        name: record.name,
        mimeType: record.mimeType,
      });
    }
    return persisted;
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

function agentEndReason(full: FullOutput<unknown>): 'complete' | 'aborted' | 'error' | 'suspended' {
  if (full.finishReason === 'suspended') return 'suspended';
  if (full.finishReason === 'aborted') return 'aborted';
  if (full.finishReason === 'error' || full.error) return 'error';
  return 'complete';
}

function extractUsage(full: FullOutput<unknown>): TokenUsage {
  const raw = (full as { totalUsage?: unknown; usage?: unknown }).totalUsage ?? (full as { usage?: unknown }).usage;
  if (!raw || typeof raw !== 'object') return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const usage = raw as Record<string, unknown>;
  const promptTokens = numberField(usage, 'inputTokens') ?? numberField(usage, 'promptTokens') ?? 0;
  const completionTokens = numberField(usage, 'outputTokens') ?? numberField(usage, 'completionTokens') ?? 0;
  const totalTokens = numberField(usage, 'totalTokens') ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function projectErrorLike(value: unknown): { name: string; message: string } | unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  return value;
}

function queuedAttachmentToRef(attachment: PersistedAttachment): AttachmentRef {
  if (attachment.kind === 'url') {
    throw new HarnessValidationError('queue().attachments', 'queued URL attachments are not supported yet');
  }
  return {
    attachmentId: attachment.attachmentId,
    resourceId: '',
    name: attachment.name,
    mimeType: attachment.mimeType,
  };
}

function computeQueueAdmissionHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function toPublicQueueError(reason: unknown): { code: string; message: string } {
  if (reason instanceof Error) return { code: reason.name, message: reason.message };
  return { code: 'Error', message: String(reason) };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cloneJsonLike<T>(value: T): T {
  if (value === undefined) return value;
  return structuredClone(value);
}

function diffStateKeys(prev: unknown, next: unknown): string[] {
  if (!isRecord(prev) || !isRecord(next)) return Object.is(prev, next) ? [] : ['*'];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  return [...keys].filter(key => !Object.is(prev[key], next[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
