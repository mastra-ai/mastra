import { randomUUID } from 'node:crypto';
import type { z } from 'zod';

import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import { createSignal } from '../../agent/signals';
import type { ToolsInput } from '../../agent/types';
import { RequestContext } from '../../request-context';
import type { HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import { convertStoredMessageToHarnessMessage } from '../_shared/message-conversion';
import type { StoredMessageRow } from '../_shared/message-conversion';
import {
  HarnessConfigError,
  HarnessOverrideConflictError,
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
        this._emit({ type: 'agent_start' });
        const full = (await agent.generate(opts.content, {
          ...execOptions,
          structuredOutput: { schema: opts.output as never },
        } as never)) as FullOutput<unknown>;
        await this.recordTurnCompletion(full);
        this._emit({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
        return full.object;
      }

      const signalContents = await this.buildSignalContents(opts.content, opts.attachments ?? []);
      const signal = createSignal({ type: 'user-message', contents: signalContents });
      this._emit({ type: 'agent_start' });
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
        this._emit({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
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
      this._emit({ type: 'agent_start' });
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
      this._emit({ type: 'agent_start' });
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
        if (messageId) this._emit({ type: 'message_start', messageId });
        break;
      }
      case 'text-delta': {
        const messageId = stringField(payload, 'id') ?? stringField(payload, 'messageId');
        const delta = stringField(payload, 'text') ?? stringField(payload, 'delta');
        if (messageId && delta !== undefined) this._emit({ type: 'message_update', messageId, delta });
        break;
      }
      case 'text-end': {
        const messageId = stringField(payload, 'id') ?? stringField(payload, 'messageId');
        if (messageId) this._emit({ type: 'message_end', messageId });
        break;
      }
      case 'tool-call': {
        const toolCallId = stringField(payload, 'toolCallId');
        const toolName = stringField(payload, 'toolName');
        if (toolCallId && toolName) {
          this.activeToolNames.set(toolCallId, toolName);
          this._emit({ type: 'tool_start', toolCallId, toolName, args: payload.args });
        }
        break;
      }
      case 'tool-result':
      case 'tool-error': {
        const toolCallId = stringField(payload, 'toolCallId');
        if (toolCallId) {
          const isError = record.type === 'tool-error';
          this._emit({
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
        if (Array.isArray(data?.tasks)) this._emit({ type: 'task_updated', tasks: data.tasks as never });
        break;
      }
    }
  }

  private async finalizeStreamedTurn(output: MastraModelOutput<unknown>): Promise<void> {
    try {
      const full = (await output.getFullOutput()) as FullOutput<unknown>;
      await this.recordTurnCompletion(full);
      this._emit({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
    } catch {
      this._emit({ type: 'agent_end', reason: 'error', runId: output.runId });
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
      this._emit({ type: 'agent_end', reason: agentEndReason(full), runId: full.runId });
      return full as AgentResult;
    } catch (err) {
      this._emit({ type: 'agent_end', reason: 'error', runId: output.runId });
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
