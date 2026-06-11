import { randomUUID } from 'node:crypto';
import type { Agent, AgentSignal, SendAgentSignalOptions } from '@mastra/core/agent';
import type {
  AvailableModel,
  CustomModelCatalogProvider,
  HarnessDisplayState,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMessageContent,
  HarnessMode as HarnessModeLegacy,
  HarnessThread,
  ModelAuthChecker,
  ModelAuthStatus,
  ModelUseCountProvider,
  ModelUseCountTracker,
} from '@mastra/core/harness';
import type { Session, HarnessMode, Harness, PermissionPolicy, PermissionRules, ToolCategory } from '@mastra/core/harness/v1';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraMemory, StorageThreadType } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';

export type HarnessCompatMode = HarnessMode;

type CloneSessionOptions = {
  sessionId?: string;
  threadId?: string;
  resourceId?: string;
  parentSessionId?: string;
  origin?: 'top-level' | 'subagent-tool';
  modeId?: string;
  modelId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

type SessionStateFields = {
  currentModelId?: string;
  modeId?: string;
  subagentModelId?: string;
  subagentModelIds?: Record<string, string>;
};

type HarnessCompatRuntimeState = SessionStateFields & {
  observerModelId?: string;
  reflectorModelId?: string;
  observationThreshold?: number;
  reflectionThreshold?: number;
  permissionRules?: PermissionRules;
};

type WorkspaceResolver = (args?: { requestContext?: unknown; mastra?: Mastra }) => unknown | Promise<unknown>;
type MemoryResolver = (args: any) => MastraMemory | Promise<MastraMemory>;

export type HarnessCompatConfig<TState = {}> = {
  id?: string;
  resourceId: string;
  mastra: Mastra;
  memory: MastraMemory | MemoryResolver;
  modes: HarnessCompatMode[];
  defaultModeId: string;
  initialState?: Partial<TState>;
  defaultAgent?: Agent;
  workspace?: unknown | WorkspaceResolver;
  browser?: unknown;
  modelAuthChecker?: ModelAuthChecker;
  modelUseCountProvider?: ModelUseCountProvider;
  modelUseCountTracker?: ModelUseCountTracker;
  customModelCatalogProvider?: CustomModelCatalogProvider;
};

type StreamSubscription = {
  stream: AsyncIterable<unknown>;
  unsubscribe?: () => void | Promise<void>;
};

type SendSignalResult = {
  id: string;
  type: string;
  accepted: Promise<{ accepted: true; runId: string }>;
};

type ThreadScopedSignalOptions<OUTPUT = unknown> = Extract<
  SendAgentSignalOptions<OUTPUT>,
  { resourceId: string; threadId: string }
>;

type NormalizedSignal = {
  id: string;
  type: string;
  signal: AgentSignal;
  options: Pick<ThreadScopedSignalOptions, 'ifActive' | 'ifIdle' | 'runId'>;
};

type StreamMessageState = {
  textContentById: Map<string, number>;
  thinkingContentById: Map<string, number>;
};

export function v1ModeToLegacy<TState = {}>(mode: HarnessMode, agent: Agent): HarnessModeLegacy<TState> {
  const meta = mode.metadata ?? {};
  return {
    id: mode.id,
    name: typeof meta.name === 'string' ? meta.name : mode.description,
    default: meta.default === true,
    defaultModelId: mode.defaultModelId,
    color: typeof meta.color === 'string' ? meta.color : undefined,
    agent,
  };
}

function createEmptyDisplayState(): HarnessDisplayState {
  return {
    isRunning: false,
    currentMessage: null,
    queuedFollowUps: 0,
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      cacheCreationInputTokens: 0,
    },
    activeTools: new Map(),
    toolInputBuffers: new Map(),
    pendingApproval: null,
    pendingSuspension: null,
    pendingQuestion: null,
    pendingPlanApproval: null,
    activeSubagents: new Map(),
    omProgress: {
      status: 'idle',
      pendingTokens: 0,
      threshold: 30000,
      thresholdPercent: 0,
      observationTokens: 0,
      reflectionThreshold: 40000,
      reflectionThresholdPercent: 0,
      buffered: {
        observations: {
          status: 'idle',
          chunks: 0,
          messageTokens: 0,
          projectedMessageRemoval: 0,
          observationTokens: 0,
        },
        reflection: {
          status: 'idle',
          inputObservationTokens: 0,
          observationTokens: 0,
        },
      },
      generationCount: 0,
      stepNumber: 0,
      preReflectionTokens: 0,
      postReflectionTokens: 0,
      postObservationMessages: 0,
      lastReflectionRecordId: undefined,
    },
    bufferingMessages: false,
    bufferingObservations: false,
    modifiedFiles: new Map(),
    tasks: [],
    previousTasks: [],
  } as HarnessDisplayState;
}

function toDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback;
}

function getMessageText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const record = message as Record<string, unknown>;
  const content = record.content ?? record.contents;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const c = content as Record<string, unknown>;
    if (typeof c.content === 'string') return c.content;
    if (Array.isArray(c.parts)) return getMessageText({ content: c.parts });
  }
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          return typeof p.text === 'string' ? p.text : '';
        }
        return '';
      })
      .join('');
  }
  return '';
}

function toHarnessMessage(message: unknown): HarnessMessage | undefined {
  if (!message || typeof message !== 'object') return undefined;
  const record = message as Record<string, unknown>;
  const role = record.role;
  if (role !== 'user' && role !== 'assistant' && role !== 'system') return undefined;

  const text = getMessageText(message);
  const content: HarnessMessageContent[] = text ? [{ type: 'text', text }] : [];
  return {
    id: typeof record.id === 'string' ? record.id : randomUUID(),
    role,
    content,
    createdAt: toDate(record.createdAt),
    attributes:
      record.attributes && typeof record.attributes === 'object'
        ? (record.attributes as HarnessMessage['attributes'])
        : undefined,
  };
}

function getChunkPayload(chunk: unknown): Record<string, unknown> | undefined {
  if (!chunk || typeof chunk !== 'object') return undefined;
  const record = chunk as Record<string, unknown>;
  return record.payload && typeof record.payload === 'object' ? (record.payload as Record<string, unknown>) : record;
}

function extractTextDelta(chunk: unknown): string | undefined {
  if (typeof chunk === 'string') return chunk;
  if (!chunk || typeof chunk !== 'object') return undefined;
  const c = chunk as Record<string, unknown>;
  if (c.type !== 'text-delta') return undefined;
  const payload = getChunkPayload(chunk);
  const text = payload?.text ?? payload?.textDelta ?? payload?.delta ?? c.text ?? c.textDelta ?? c.delta;
  return typeof text === 'string' ? text : undefined;
}

function getStringField(record: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function getBooleanField(record: Record<string, unknown> | undefined, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function getChunkType(chunk: unknown): string | undefined {
  return chunk && typeof chunk === 'object' && typeof (chunk as Record<string, unknown>).type === 'string'
    ? ((chunk as Record<string, unknown>).type as string)
    : undefined;
}

function isTerminalChunk(chunk: unknown): boolean {
  const type = getChunkType(chunk);
  return type === 'finish' || type === 'error' || type === 'abort' || type === 'tool-call-suspended';
}

function getSignalId(signal: unknown): string {
  if (signal && typeof signal === 'object') {
    const id = (signal as Record<string, unknown>).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return randomUUID();
}

function getSignalType(signal: unknown): string {
  if (signal && typeof signal === 'object') {
    const type = (signal as Record<string, unknown>).type;
    if (type === 'user-message') return 'user';
    if (type === 'system-reminder') return 'reactive';
    if (typeof type === 'string' && type.length > 0) return type;
  }
  return 'user';
}

function normalizeSignal(signalInput: unknown): NormalizedSignal {
  const id = getSignalId(signalInput);

  if (!signalInput || typeof signalInput !== 'object' || Array.isArray(signalInput)) {
    const signal: AgentSignal = {
      id,
      type: 'user-message',
      contents: typeof signalInput === 'string' ? signalInput : String(signalInput ?? ''),
    };
    return { id, type: getSignalType(signal), signal, options: {} };
  }

  const {
    ifActive,
    ifIdle,
    runId,
    content,
    ...signalFields
  } = signalInput as Record<string, unknown> & Pick<ThreadScopedSignalOptions, 'ifActive' | 'ifIdle' | 'runId'>;
  const type = typeof signalFields.type === 'string' && signalFields.type.length > 0 ? signalFields.type : 'user-message';
  const contents = 'contents' in signalFields ? signalFields.contents : content;
  const signal = {
    ...signalFields,
    id,
    type,
    contents: contents ?? '',
  } as AgentSignal;

  return {
    id,
    type: getSignalType(signal),
    signal,
    options: { ifActive, ifIdle, runId },
  };
}

function errorFromValue(value: unknown): Error | undefined {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  if (!value || typeof value !== 'object') return undefined;

  const message = (value as Record<string, unknown>).message;
  return typeof message === 'string' ? new Error(message) : undefined;
}

function extractStreamError(chunk: unknown): Error {
  if (!chunk || typeof chunk !== 'object') return new Error('Stream failed');

  const record = chunk as Record<string, unknown>;
  const payload = record.payload && typeof record.payload === 'object' ? (record.payload as Record<string, unknown>) : undefined;

  return (
    errorFromValue(record.error) ??
    errorFromValue(record.message) ??
    errorFromValue(payload?.error) ??
    errorFromValue(payload?.message) ??
    new Error('Stream failed')
  );
}

function providerFromModelId(modelId: string): string {
  return modelId.includes('/') ? modelId.slice(0, modelId.indexOf('/')) : modelId;
}

function modelNameFromModelId(modelId: string): string {
  return modelId.includes('/') ? modelId.slice(modelId.indexOf('/') + 1) : modelId;
}

export class HarnessCompat<TState = {}> {
  readonly id: string;
  #session?: Session<TState>;
  #harnessV1: Harness<HarnessCompatMode[], TState>;
  #config: HarnessCompatConfig<TState>;
  #listeners = new Set<HarnessEventListener>();
  #state: Partial<TState> & SessionStateFields;
  #resourceId: string;
  #currentThreadId: string | null = null;
  #displayState = createEmptyDisplayState();
  #pendingQuestions = new Map<string, (answer: any) => void>();
  #pendingPlanApprovals = new Map<string, (result: { action: 'approved' | 'rejected'; feedback?: string }) => void>();
  #resolvedWorkspace?: unknown;
  #workspaceResolved = false;

  constructor(config: HarnessCompatConfig<TState>, harnessV1: Harness<HarnessCompatMode[], TState>) {
    this.id = config.id ?? 'mastra-code-v1-local';
    this.#config = config;
    this.#harnessV1 = harnessV1;
    this.#resourceId = config.resourceId;
    this.#state = { ...(config.initialState as Partial<TState>), modeId: config.defaultModeId } as Partial<TState> &
      SessionStateFields;

    this.#harnessV1.subscribe(event => {
      if (event.type === 'mode_changed' && 'modeId' in event) {
        this.#state.modeId = event.modeId;
        this.#emit({
          ...(event as unknown as Record<string, unknown>),
          type: 'mode_changed',
          modeId: event.modeId,
          previousModeId: event.previousModeId ?? '',
        } as HarnessEvent);
        return;
      }
      if (event.type === 'model_changed' && 'modelId' in event) {
        this.#state.currentModelId = event.modelId;
        this.#emit({
          ...(event as unknown as Record<string, unknown>),
          type: 'model_changed',
          modelId: event.modelId,
          scope: 'thread',
        } as HarnessEvent);
        return;
      }
      if (event.type === 'task_updated' && 'tasks' in event) {
        const nextTasks = (event as { tasks?: unknown }).tasks;
        this.#displayState.previousTasks = [...this.#displayState.tasks];
        this.#displayState.tasks = (Array.isArray(nextTasks) ? nextTasks : []) as HarnessDisplayState['tasks'];
      }
      this.#emit(event as unknown as HarnessEvent);
    });
  }

  async init(): Promise<void> {}

  async shutdown(): Promise<void> {
    await this.#harnessV1.shutdown();
  }

  stopHeartbeats(): void {}

  subscribe(listener: HarnessEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(event: HarnessEvent): void {
    if (event.type === 'display_state_changed') {
      this.#displayState = event.displayState;
    }
    for (const listener of this.#listeners) {
      void listener(event);
    }
  }

  #emitDisplayState(): void {
    this.#emit({ type: 'display_state_changed', displayState: this.getDisplayState() });
  }

  getMastra(): Mastra {
    return this.#config.mastra;
  }

  getState(): Readonly<TState> {
    const sessionState = this.#session?.getState() ?? {};
    return {
      ...this.#state,
      ...sessionState,
      currentModelId: this.#session?.getModelId() ?? this.#state.currentModelId,
      modeId: this.#session?.getMode().id ?? this.#state.modeId,
    } as Readonly<TState>;
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const { currentModelId, modeId, ...stateUpdates } = updates as Partial<TState> & SessionStateFields;

    if (typeof currentModelId === 'string') {
      await this.switchModel({ modelId: currentModelId });
    }
    if (typeof modeId === 'string' && modeId !== this.getCurrentModeId()) {
      await this.switchMode({ modeId });
    }

    if (Object.keys(stateUpdates).length > 0) {
      this.#state = { ...this.#state, ...(stateUpdates as Partial<TState>) };
      if (this.#session) {
        await this.#session.setState(stateUpdates as Partial<TState>);
      }
      this.#emit({
        type: 'state_changed',
        state: this.getState() as Record<string, unknown>,
        changedKeys: Object.keys(stateUpdates),
      });
    }
  }

  getSubagentModelId({ agentType }: { agentType?: string } = {}): string | null {
    const state = this.getState() as SessionStateFields;
    if (agentType && state.subagentModelIds?.[agentType]) return state.subagentModelIds[agentType];
    return state.subagentModelId ?? null;
  }

  async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }): Promise<void> {
    const state = this.getState() as SessionStateFields;
    const subagentModelIds = { ...(state.subagentModelIds ?? {}) };
    if (agentType) subagentModelIds[agentType] = modelId;
    await this.setState({
      subagentModelId: agentType ? state.subagentModelId : modelId,
      subagentModelIds,
    } as unknown as Partial<TState>);
    this.#emit({ type: 'subagent_model_changed', modelId, scope: 'thread', agentType });
  }

  getCurrentThreadId(): string | null {
    return this.#currentThreadId;
  }

  getResourceId(): string {
    return this.#resourceId;
  }

  getDefaultResourceId(): string {
    return this.#config.resourceId;
  }

  async setResourceId({ resourceId }: { resourceId: string }): Promise<void> {
    this.#resourceId = resourceId;
    this.#session = undefined;
    this.#currentThreadId = null;
    this.#emit({ type: 'thread_changed', threadId: '', previousThreadId: null });
  }

  _setCurrentResourceId(resourceId: string): void {
    this.#resourceId = resourceId;
  }

  _setCurrentThreadId(threadId: string | null): void {
    const previousThreadId = this.#currentThreadId;
    this.#currentThreadId = threadId;
    if (threadId) this.#emit({ type: 'thread_changed', threadId, previousThreadId });
  }

  async getResolvedMemory(): Promise<MastraMemory> {
    return this.#resolveMemory();
  }

  async getKnownResourceIds(): Promise<string[]> {
    const threads = await this.listThreads({ allResources: true, includeForkedSubagents: true });
    const ids = new Set(threads.map(thread => thread.resourceId).filter(Boolean));
    return [...ids].sort();
  }

  async #resolveMemory(): Promise<MastraMemory> {
    const requestContext = new RequestContext([['harness', this.#createHarnessContext()]]);
    const memory = this.#config.memory;
    return typeof memory === 'function' ? await memory({ mastra: this.#config.mastra, requestContext }) : memory;
  }

  async _addThread(thread: HarnessThread): Promise<void> {
    const memory = await this.#resolveMemory();
    await memory.createThread({
      threadId: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      metadata: thread.metadata,
    });
  }

  async createThread({
    title,
    resourceId,
    metadata,
  }: { title?: string; resourceId?: string; metadata?: Record<string, unknown> } = {}): Promise<HarnessThread> {
    const threadId = randomUUID();
    const threadResourceId = resourceId ?? this.#resourceId;
    const memory = await this.#resolveMemory();
    const thread = await memory.createThread({
      threadId,
      resourceId: threadResourceId,
      title,
      metadata,
    });

    const modeId = this.#state.modeId ?? this.getCurrentModeId();
    const modelId = this.getCurrentModelId();
    this.#session = await this.#harnessV1.session({ threadId: thread.id, resourceId: thread.resourceId, modeId, modelId });
    this.#currentThreadId = thread.id;

    const harnessThread = this.#toHarnessThread(thread, this.#session);
    this.#emit({ type: 'thread_created', thread: harnessThread });
    return harnessThread;
  }

  async switchThread({ threadId, resourceId }: { threadId: string; resourceId?: string }): Promise<void> {
    const previousThreadId = this.#currentThreadId;
    const currentModeId = this.#state.modeId ?? this.getCurrentModeId();
    const currentModelId = (this.getState() as SessionStateFields).currentModelId;
    this.#session = await this.#harnessV1.session({
      threadId,
      resourceId: resourceId ?? this.#resourceId,
      modeId: currentModeId,
      modelId: currentModelId,
    });
    this.#currentThreadId = threadId;
    this.#resourceId = this.#session.resourceId;

    if (typeof currentModelId === 'string' && currentModelId.length > 0) {
      this.#session.setModelId(currentModelId);
    }

    this.#emit({ type: 'thread_changed', threadId, previousThreadId });
  }

  async listThreads(options?: { allResources?: boolean; includeForkedSubagents?: boolean }): Promise<HarnessThread[]> {
    const [sessions, memory] = await Promise.all([this.#harnessV1.listSessions(), this.#resolveMemory()]);
    const memoryResult = await memory.listThreads({
      perPage: false,
      filter: options?.allResources ? undefined : { resourceId: this.#resourceId },
    } as any);

    const byKey = new Map<string, HarnessThread>();
    for (const thread of memoryResult.threads ?? []) {
      if (!options?.includeForkedSubagents && (thread.metadata as Record<string, unknown> | undefined)?.forkedSubagent === true) {
        continue;
      }
      byKey.set(`${thread.resourceId}:${thread.id}`, this.#toHarnessThread(thread));
    }

    for (const session of sessions) {
      if (!options?.allResources && session.resourceId !== this.#resourceId) continue;
      if (!options?.includeForkedSubagents && session.origin === 'subagent-tool') continue;
      const key = `${session.resourceId}:${session.threadId}`;
      const existing = byKey.get(key);
      byKey.set(key, {
        id: session.threadId,
        resourceId: session.resourceId,
        title: existing?.title ?? session.title,
        createdAt: existing?.createdAt ?? session.createdAt,
        updatedAt: session.lastActivityAt ?? existing?.updatedAt ?? session.createdAt,
        metadata: {
          ...(existing?.metadata ?? {}),
          ...(session.metadata ?? {}),
          sessionId: session.id,
          modeId: session.modeId,
          modelId: session.modelId,
          parentSessionId: session.parentSessionId,
          origin: session.origin,
        },
      });
    }

    return [...byKey.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async selectOrCreateThread(): Promise<HarnessThread> {
    const threads = await this.listThreads();
    if (threads.length === 0) return this.createThread();

    const mostRecent = threads[0]!;
    await this.switchThread({ threadId: mostRecent.id, resourceId: mostRecent.resourceId });
    return mostRecent;
  }

  async switchCurrentThread(threadId: string): Promise<void> {
    await this.switchThread({ threadId });
  }

  async renameThread({ title }: { title: string }): Promise<void> {
    if (!this.#currentThreadId) return;
    const memory = await this.#resolveMemory();
    const thread = await memory.getThreadById({ threadId: this.#currentThreadId });
    if (!thread) return;
    await memory.saveThread({
      thread: { ...thread, title, updatedAt: new Date() },
    });
  }

  async cloneSession(opts: CloneSessionOptions = {}): Promise<Session<TState>> {
    if (!this.#session) throw new Error('No active session to clone');
    return this.#harnessV1.cloneSession(this.#session, opts);
  }

  async cloneThread({
    sourceThreadId,
    title,
    resourceId,
  }: {
    sourceThreadId?: string;
    title?: string;
    resourceId?: string;
  } = {}): Promise<HarnessThread> {
    const sourceId = sourceThreadId ?? this.getCurrentThreadId();
    if (!sourceId) throw new Error('No source thread to clone');

    const sourceResourceId = resourceId ?? this.#resourceId;
    const sourceSession =
      this.#session?.threadId === sourceId && this.#session.resourceId === sourceResourceId
        ? this.#session
        : await this.#harnessV1.session({ threadId: sourceId, resourceId: sourceResourceId });

    this.#session = await this.#harnessV1.cloneSession(sourceSession, { title });
    this.#currentThreadId = this.#session.threadId;
    this.#resourceId = this.#session.resourceId;

    const thread = await this.#session.getThread();
    if (!thread) throw new Error('Failed to load cloned thread');

    const harnessThread = this.#toHarnessThread(thread, this.#session);
    this.#emit({ type: 'thread_created', thread: harnessThread });
    this.#emit({ type: 'thread_changed', threadId: harnessThread.id, previousThreadId: sourceId });
    return harnessThread;
  }

  #toHarnessThread(thread: StorageThreadType, session?: Session<TState>): HarnessThread {
    return {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: {
        ...(thread.metadata ?? {}),
        ...(session
          ? {
              sessionId: session.id,
              modeId: session.getMode().id,
              modelId: session.getModelId(),
            }
          : {}),
      },
    };
  }

  getCurrentMode(): HarnessModeLegacy<TState> {
    const mode =
      this.#session?.getMode() ?? this.#harnessV1.getMode(this.#config.defaultModeId) ?? this.#config.modes[0];
    if (!mode) throw new Error('No modes configured');
    return v1ModeToLegacy(mode, this.#agentForMode(mode));
  }

  getCurrentModeId(): string {
    return this.#session?.getMode().id ?? this.#state.modeId ?? this.#config.defaultModeId;
  }

  listModes(): HarnessModeLegacy<TState>[] {
    return this.#harnessV1.listModes().map(mode => v1ModeToLegacy(mode, this.#agentForMode(mode)));
  }

  #agentForMode(_mode: HarnessMode): Agent {
    if (this.#config.defaultAgent) return this.#config.defaultAgent;
    throw new Error('Harness V1 requires a defaultAgent to resolve mode agents');
  }

  async switchMode({ modeId }: { modeId: string }): Promise<void> {
    const previousModeId = this.getCurrentModeId();
    const mode = this.#harnessV1.getMode(modeId);
    if (!mode) throw new Error(`Mode not found: ${modeId}`);

    if (!this.#session) {
      const threadId = this.#currentThreadId ?? randomUUID();
      this.#session = await this.#harnessV1.session({ threadId, resourceId: this.#resourceId, modeId });
      this.#currentThreadId = threadId;
    }

    this.#session.setMode(mode);
    this.#state.modeId = modeId;
    this.#emit({ type: 'mode_changed', modeId, previousModeId });
  }

  async switchModel({ modelId }: { modelId: string }): Promise<void> {
    const previous = this.#session?.getModelId() ?? this.#state.currentModelId;
    this.#state.currentModelId = modelId;
    if (this.#session) this.#session.setModelId(modelId);
    this.#config.modelUseCountTracker?.(modelId);
    if (modelId !== previous) this.#emit({ type: 'model_changed', modelId, scope: 'thread' });
  }

  getCurrentModelId(): string {
    return this.#session?.getModelId() ?? this.#state.currentModelId ?? this.getCurrentMode().defaultModelId ?? '';
  }

  getFullModelId(): string {
    return this.getCurrentModelId();
  }

  hasModelSelected(): boolean {
    return this.getCurrentModelId().length > 0;
  }

  getObserverModelId(): string | undefined {
    return (this.getState() as HarnessCompatRuntimeState).observerModelId;
  }

  getReflectorModelId(): string | undefined {
    return (this.getState() as HarnessCompatRuntimeState).reflectorModelId;
  }

  getObservationThreshold(): number {
    return (this.getState() as HarnessCompatRuntimeState).observationThreshold ?? 30000;
  }

  getReflectionThreshold(): number {
    return (this.getState() as HarnessCompatRuntimeState).reflectionThreshold ?? 40000;
  }

  async switchObserverModel(modelId: string): Promise<void> {
    await this.setState({ observerModelId: modelId } as unknown as Partial<TState>);
  }

  async switchReflectorModel(modelId: string): Promise<void> {
    await this.setState({ reflectorModelId: modelId } as unknown as Partial<TState>);
  }

  async listAvailableModels(): Promise<AvailableModel[]> {
    const useCounts = this.#config.modelUseCountProvider?.() ?? {};
    const ids = new Set<string>();
    for (const mode of this.#harnessV1.listModes()) ids.add(mode.defaultModelId);
    if (this.getFullModelId()) ids.add(this.getFullModelId());

    const models: AvailableModel[] = [...ids].map(id => {
      const provider = providerFromModelId(id);
      return {
        id,
        provider,
        modelName: modelNameFromModelId(id),
        hasApiKey:
          this.#config.modelAuthChecker?.(provider) ??
          Boolean(process.env[`${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`]),
        useCount: useCounts[id] ?? 0,
      };
    });

    const custom = (await this.#config.customModelCatalogProvider?.()) ?? [];
    for (const model of custom) {
      models.push({ ...model, useCount: useCounts[model.id] ?? 0 });
    }

    return models.sort((a, b) => b.useCount - a.useCount || a.id.localeCompare(b.id));
  }

  getDisplayState(): HarnessDisplayState {
    return {
      ...this.#displayState,
      activeTools: new Map(this.#displayState.activeTools),
      toolInputBuffers: new Map(this.#displayState.toolInputBuffers),
      activeSubagents: new Map(this.#displayState.activeSubagents),
      modifiedFiles: new Map(this.#displayState.modifiedFiles),
      tasks: [...this.#displayState.tasks],
      previousTasks: [...this.#displayState.previousTasks],
    };
  }

  isRunning(): boolean {
    return this.#displayState.isRunning;
  }

  isCurrentThreadStreamActive(): boolean {
    return Boolean(this.#session?.getCurrentRunId());
  }

  getCurrentRunId(): string | null {
    return this.#session?.getCurrentRunId() ?? null;
  }

  getCurrentTraceId(): string | null {
    return this.#session?.getCurrentTraceId() ?? null;
  }

  getFollowUpCount(): number {
    return this.#displayState.queuedFollowUps;
  }

  async listMessages({ limit }: { limit?: number } = {}): Promise<HarnessMessage[]> {
    const messages = (await this.#session?.getMessages()) ?? [];
    const converted = messages
      .map(toHarnessMessage)
      .filter((message): message is HarnessMessage => message !== undefined);
    return typeof limit === 'number' && limit > 0 ? converted.slice(-limit) : converted;
  }

  async saveSystemReminderMessage({
    message,
    reminderType,
    role = 'user',
    metadata,
  }: {
    message: string;
    reminderType: string;
    role?: 'user' | 'assistant' | 'system';
    metadata?: Record<string, unknown>;
  }): Promise<HarnessMessage | null> {
    if (!this.#currentThreadId) return null;
    const memory = await this.#resolveMemory();
    const createdAt = new Date();
    const dbMessage = {
      id: randomUUID(),
      role,
      threadId: this.#currentThreadId,
      resourceId: this.#resourceId,
      createdAt,
      content: {
        format: 2 as const,
        parts: [],
        content: '',
        metadata: {
          systemReminder: { type: reminderType, message, ...metadata },
        },
      },
    };
    await memory.saveMessages({ messages: [dbMessage as any] });
    return {
      id: dbMessage.id,
      role,
      createdAt,
      content: [{ type: 'system_reminder', reminderType, message }],
    } as HarnessMessage;
  }

  async getFirstUserMessagesForThreads({ threadIds }: { threadIds?: string[] } = {}): Promise<Map<string, HarnessMessage>> {
    const ids = threadIds ?? (this.#currentThreadId ? [this.#currentThreadId] : []);
    const firstMessages = new Map<string, HarnessMessage>();
    for (const threadId of ids) {
      const session =
        this.#session?.threadId === threadId
          ? this.#session
          : await this.#harnessV1.session({ threadId, resourceId: this.#resourceId });
      const messages = await session.getMessages();
      const first = messages.find(message => message.role === 'user');
      const converted = toHarnessMessage(first);
      if (converted) firstMessages.set(threadId, converted);
    }
    return firstMessages;
  }

  async session(opts: Parameters<Harness<HarnessCompatMode[], TState>['session']>[0]): Promise<Session<TState>> {
    this.#session = await this.#harnessV1.session(opts);
    this.#resourceId = this.#session.resourceId;
    this.#currentThreadId = this.#session.threadId;
    this.#state.currentModelId = this.#session.getModelId();
    this.#state.modeId = this.#session.getMode().id;
    return this.#session;
  }

  getSessionGrants(): { categories: ToolCategory[]; tools: string[] } {
    const grants = this.#session?.listSessionGrants() ?? [];
    return {
      categories: grants.map(grant => grant.category).filter((category): category is ToolCategory => Boolean(category)),
      tools: grants.map(grant => grant.toolName).filter((toolName): toolName is string => Boolean(toolName)),
    };
  }

  getPermissionRules(): { categories: Record<string, PermissionPolicy>; tools: Record<string, PermissionPolicy> } {
    const rules = (this.getState() as HarnessCompatRuntimeState).permissionRules;
    return {
      categories: Object.fromEntries(
        Object.entries(rules?.categories ?? {}).map(([key, rule]) => [
          key,
          typeof rule === 'string' ? rule : rule.policy,
        ]),
      ),
      tools: Object.fromEntries(
        Object.entries(rules?.tools ?? {}).map(([key, rule]) => [key, typeof rule === 'string' ? rule : rule.policy]),
      ),
    };
  }

  async setPermissionForCategory(category: ToolCategory, policy: PermissionPolicy): Promise<void> {
    const current = this.getPermissionRules();
    await this.setState({
      permissionRules: {
        categories: { ...current.categories, [category]: policy },
        tools: current.tools,
      },
    } as unknown as Partial<TState>);
  }

  async setPermissionForTool(toolName: string, policy: PermissionPolicy): Promise<void> {
    const current = this.getPermissionRules();
    await this.setState({
      permissionRules: {
        categories: current.categories,
        tools: { ...current.tools, [toolName]: policy },
      },
    } as unknown as Partial<TState>);
  }

  abort(): void {
    this.#displayState = { ...this.#displayState, isRunning: false, currentMessage: null };
    this.#emit({ type: 'agent_end', reason: 'aborted' });
    this.#emitDisplayState();
  }

  async sendMessage(text: string | { text?: string; content?: string }, _opts?: unknown): Promise<void> {
    const content = typeof text === 'string' ? text : (text.text ?? text.content ?? '');
    const session = await this.#ensureSession();
    const subscription = (await session.subscribeToThread()) as StreamSubscription;

    this.#startStreamRun();

    try {
      await session.queueMessage({ messages: content });
    } catch (error) {
      await this.#failStreamStart(subscription, error);
      throw error;
    }

    await this.#consumeSignalSubscription(subscription);
  }

  sendSignal(signalInput: unknown): SendSignalResult {
    const { id, type, signal, options } = normalizeSignal(signalInput);
    const accepted = (async () => {
      const session = await this.#ensureSession();

      this.#emitReactiveSignalMessage(signal);

      if (this.isCurrentThreadStreamActive()) {
        const result = await session.sendMessage({ messages: signal as any, ...options });
        return { accepted: true as const, runId: result.runId };
      }

      const subscription = (await session.subscribeToThread()) as StreamSubscription;
      this.#startStreamRun();

      let streamOwned = false;
      try {
        const result = await session.sendMessage({ messages: signal as any, ...options });
        streamOwned = true;
        await this.#consumeSignalSubscription(subscription, { rejectOnTerminalError: true });
        return { accepted: true as const, runId: result.runId };
      } catch (error) {
        if (!streamOwned) {
          await this.#failStreamStart(subscription, error);
        }
        throw error;
      }
    })();

    return { id, type, accepted };
  }

  async sendNotificationSignal(signal: unknown): Promise<void> {
    await this.sendSignal(signal).accepted;
  }

  #startStreamRun(): void {
    this.#displayState = { ...this.#displayState, isRunning: true };
    this.#emit({ type: 'agent_start' });
    this.#emitDisplayState();
  }

  /**
   * v0 renders reactive `system-reminder` signals inline by surfacing a user
   * message that carries a `system_reminder` content part. The v1 session
   * sendMessage path doesn't synthesize that part, so we emit the renderable
   * message here to keep TUI parity (used by plan-approval and goal handoffs).
   */
  #emitReactiveSignalMessage(signal: unknown): void {
    if (!signal || typeof signal !== 'object') return;
    const record = signal as Record<string, unknown>;
    if (record.type !== 'system-reminder') return;
    const message = typeof record.contents === 'string' ? record.contents : String(record.contents ?? '');
    if (!message) return;
    const reminderType =
      typeof record.reminderType === 'string'
        ? record.reminderType
        : typeof (record.attributes as Record<string, unknown> | undefined)?.type === 'string'
          ? ((record.attributes as Record<string, unknown>).type as string)
          : 'system-reminder';
    this.#emit({
      type: 'message_update',
      message: {
        id: typeof record.id === 'string' ? record.id : randomUUID(),
        role: 'assistant',
        createdAt: new Date(),
        content: [{ type: 'system_reminder', reminderType, message } as any],
      } as HarnessMessage,
    });
  }

  async #failStreamStart(subscription: StreamSubscription, error: unknown): Promise<void> {
    this.#emit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
    this.#emit({ type: 'agent_end', reason: 'error' });
    this.#displayState = { ...this.#displayState, isRunning: false, currentMessage: null };
    await subscription.unsubscribe?.();
    this.#emitDisplayState();
  }

  async #consumeSignalSubscription(
    subscription: StreamSubscription,
    options: { rejectOnTerminalError?: boolean } = {},
  ): Promise<void> {
    const assistantMessage: HarnessMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: [],
      createdAt: new Date(),
    };
    let started = false;
    let terminalChunk: unknown;
    let rejection: unknown;
    const streamState: StreamMessageState = {
      textContentById: new Map(),
      thinkingContentById: new Map(),
    };

    try {
      for await (const chunk of subscription.stream) {
        if (this.#handleStreamChunk(chunk, assistantMessage, started, streamState)) {
          started = true;
        }
        if (isTerminalChunk(chunk)) {
          terminalChunk = chunk;
          break;
        }
      }

      const terminalType = getChunkType(terminalChunk);
      if (terminalType === 'error') {
        const streamError = extractStreamError(terminalChunk);
        this.#emit({ type: 'error', error: streamError });
        if (options.rejectOnTerminalError) rejection = streamError;
      }
      if (started) this.#emit({ type: 'message_end', message: assistantMessage });

      this.#emit({
        type: 'agent_end',
        reason:
          terminalType === 'error'
            ? 'error'
            : terminalType === 'abort'
              ? 'aborted'
              : terminalType === 'tool-call-suspended'
                ? 'suspended'
                : 'complete',
      });
    } catch (error) {
      rejection = error;
      this.#emit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      this.#emit({ type: 'agent_end', reason: 'error' });
    } finally {
      this.#displayState = { ...this.#displayState, isRunning: false, currentMessage: null };
      await subscription.unsubscribe?.();
      this.#emitDisplayState();
    }

    if (rejection) throw rejection;
  }

  #handleStreamChunk(
    chunk: unknown,
    assistantMessage: HarnessMessage,
    started: boolean,
    streamState: StreamMessageState,
  ): boolean {
    if (!chunk || typeof chunk !== 'object') {
      const textDelta = extractTextDelta(chunk);
      if (!textDelta) return started;
      assistantMessage.content.push({ type: 'text', text: textDelta });
      this.#displayState = { ...this.#displayState, currentMessage: assistantMessage };
      this.#emit({ type: started ? 'message_update' : 'message_start', message: assistantMessage });
      this.#emitDisplayState();
      return true;
    }

    const record = chunk as Record<string, unknown>;
    const payload = getChunkPayload(chunk);
    const type = record.type;
    const chunkId = getStringField(payload, 'id', 'textId') ?? getStringField(record, 'id', 'textId');
    const toolCallId = getStringField(payload, 'toolCallId', 'id') ?? getStringField(record, 'toolCallId', 'id');
    const toolName = getStringField(payload, 'toolName', 'name') ?? getStringField(record, 'toolName', 'name') ?? 'tool';

    if (type === 'text-start') {
      const text = getStringField(payload, 'text') ?? getStringField(record, 'text') ?? '';
      const index = assistantMessage.content.push({ type: 'text', text }) - 1;
      if (chunkId) streamState.textContentById.set(chunkId, index);
      this.#displayState = { ...this.#displayState, currentMessage: assistantMessage };
      this.#emit({ type: started ? 'message_update' : 'message_start', message: assistantMessage });
      this.#emitDisplayState();
      return true;
    }

    const textDelta = extractTextDelta(chunk);
    if (typeof textDelta === 'string' && textDelta.length > 0) {
      const textIndex = chunkId ? streamState.textContentById.get(chunkId) : undefined;
      const textContent = typeof textIndex === 'number' ? assistantMessage.content[textIndex] : undefined;
      if (textContent?.type === 'text') {
        textContent.text += textDelta;
      } else {
        const last = assistantMessage.content[assistantMessage.content.length - 1];
        if (last?.type === 'text') {
          last.text += textDelta;
        } else {
          const index = assistantMessage.content.push({ type: 'text', text: textDelta }) - 1;
          if (chunkId) streamState.textContentById.set(chunkId, index);
        }
      }
      this.#displayState = { ...this.#displayState, currentMessage: assistantMessage };
      this.#emit({ type: started ? 'message_update' : 'message_start', message: assistantMessage });
      this.#emitDisplayState();
      return true;
    }

    if (type === 'reasoning-start') {
      const thinking = getStringField(payload, 'text', 'thinking') ?? getStringField(record, 'text', 'thinking') ?? '';
      const index = assistantMessage.content.push({ type: 'thinking', thinking }) - 1;
      if (chunkId) streamState.thinkingContentById.set(chunkId, index);
      this.#displayState = { ...this.#displayState, currentMessage: assistantMessage };
      this.#emit({ type: 'message_update', message: assistantMessage });
      this.#emitDisplayState();
      return true;
    }

    if (type === 'reasoning-delta') {
      const thinkingDelta =
        getStringField(payload, 'textDelta', 'delta', 'text', 'thinking') ??
        getStringField(record, 'textDelta', 'delta', 'text', 'thinking');
      if (!thinkingDelta) return started;
      const thinkingIndex = chunkId ? streamState.thinkingContentById.get(chunkId) : undefined;
      const thinkingContent = typeof thinkingIndex === 'number' ? assistantMessage.content[thinkingIndex] : undefined;
      if (thinkingContent?.type === 'thinking') {
        thinkingContent.thinking += thinkingDelta;
      } else {
        const index = assistantMessage.content.push({ type: 'thinking', thinking: thinkingDelta }) - 1;
        if (chunkId) streamState.thinkingContentById.set(chunkId, index);
      }
      this.#displayState = { ...this.#displayState, currentMessage: assistantMessage };
      this.#emit({ type: 'message_update', message: assistantMessage });
      this.#emitDisplayState();
      return true;
    }

    if (type === 'tool-call-input-streaming-start' && toolCallId) {
      this.#displayState.toolInputBuffers.set(toolCallId, { text: '', toolName });
      const existing = this.#displayState.activeTools.get(toolCallId);
      if (existing) {
        existing.status = 'streaming_input';
      } else {
        this.#displayState.activeTools.set(toolCallId, { name: toolName, args: {}, status: 'streaming_input' });
      }
      this.#emit({ type: 'tool_input_start', toolCallId, toolName });
      this.#emitDisplayState();
      return started;
    }

    if (type === 'tool-call-delta' && toolCallId) {
      const argsTextDelta =
        getStringField(payload, 'argsTextDelta', 'inputTextDelta', 'textDelta', 'delta') ??
        getStringField(record, 'argsTextDelta', 'inputTextDelta', 'textDelta', 'delta') ??
        '';
      const buffer = this.#displayState.toolInputBuffers.get(toolCallId);
      if (buffer) buffer.text += argsTextDelta;
      this.#emit({ type: 'tool_input_delta', toolCallId, toolName, argsTextDelta });
      this.#emitDisplayState();
      return started;
    }

    if (type === 'tool-call-input-streaming-end' && toolCallId) {
      this.#displayState.toolInputBuffers.delete(toolCallId);
      this.#emit({ type: 'tool_input_end', toolCallId });
      this.#emitDisplayState();
      return started;
    }

    if (type === 'tool-call' && toolCallId) {
      const args = payload?.args ?? payload?.input ?? record.args ?? record.input ?? {};
      assistantMessage.content.push({ type: 'tool_call', id: toolCallId, name: toolName, args });
      const existingTool = this.#displayState.activeTools.get(toolCallId);
      if (existingTool) {
        existingTool.name = toolName;
        existingTool.args = args as Record<string, unknown>;
        existingTool.status = 'running';
      } else {
        this.#displayState.activeTools.set(toolCallId, {
          name: toolName,
          args: args as Record<string, unknown>,
          status: 'running',
        });
      }
      this.#displayState = { ...this.#displayState, currentMessage: assistantMessage };
      this.#emit({ type: 'tool_start', toolCallId, toolName, args });
      this.#emit({ type: 'message_update', message: assistantMessage });
      this.#emitDisplayState();
      return true;
    }

    if ((type === 'tool-result' || type === 'tool-call-result') && toolCallId) {
      const result = payload?.result ?? payload?.output ?? record.result ?? record.output;
      const isError = getBooleanField(payload, 'isError') ?? getBooleanField(record, 'isError') ?? false;
      assistantMessage.content.push({ type: 'tool_result', id: toolCallId, name: toolName, result, isError });
      const endedTool = this.#displayState.activeTools.get(toolCallId);
      if (endedTool) {
        endedTool.status = isError ? 'error' : 'completed';
        endedTool.result = result;
        endedTool.isError = isError;
      }
      this.#displayState = { ...this.#displayState, currentMessage: assistantMessage };
      this.#emit({ type: 'tool_end', toolCallId, result, isError });
      this.#emit({ type: 'message_update', message: assistantMessage });
      this.#emitDisplayState();
      return true;
    }

    if (type === 'tool-error' && toolCallId) {
      const result = payload?.error ?? record.error;
      this.#emit({ type: 'tool_end', toolCallId, result, isError: true });
      this.#emitDisplayState();
      return started;
    }

    if (type === 'tool-call-suspended' && toolCallId) {
      this.#emit({
        type: 'tool_suspended',
        toolCallId,
        toolName,
        args: payload?.args ?? record.args,
        suspendPayload: payload?.suspendPayload ?? record.suspendPayload,
        resumeSchema: getStringField(payload, 'resumeSchema') ?? getStringField(record, 'resumeSchema'),
      });
      this.#emitDisplayState();
      return started;
    }

    if (type === 'data-sandbox-stdout' || type === 'data-sandbox-stderr') {
      const data = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : payload;
      const output = getStringField(data, 'output') ?? getStringField(payload, 'output') ?? '';
      const sandboxToolCallId = getStringField(data, 'toolCallId') ?? toolCallId;
      if (sandboxToolCallId && output) {
        this.#emit({
          type: 'shell_output',
          toolCallId: sandboxToolCallId,
          output,
          stream: type === 'data-sandbox-stdout' ? 'stdout' : 'stderr',
        });
        this.#emitDisplayState();
      }
      return started;
    }

    return started;
  }

  registerQuestion({ questionId, resolve }: { questionId: string; resolve: (answer: any) => void }): void {
    this.#pendingQuestions.set(questionId, resolve);
  }

  registerPlanApproval({
    planId,
    resolve,
  }: {
    planId: string;
    resolve: (result: { action: 'approved' | 'rejected'; feedback?: string }) => void;
  }): void {
    this.#pendingPlanApprovals.set(planId, resolve);
  }

  async respondToQuestion(
    input: { questionId: string; answer: unknown } | string,
    response?: Record<string, unknown> | string,
  ): Promise<void> {
    const questionId = typeof input === 'string' ? input : input.questionId;
    const answer = typeof input === 'string' ? response : input.answer;
    const resolve = this.#pendingQuestions.get(questionId);
    if (resolve) {
      this.#pendingQuestions.delete(questionId);
      resolve(answer);
      return;
    }
    if (this.#session?.resolveQuestion(questionId, (Array.isArray(answer) ? answer : String(answer ?? '')) as any)) {
      return;
    }
    if (!this.#session) throw new Error('No active session to respond to question');
    await this.#session.respondToQuestion(
      questionId,
      typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>) : { answer },
    );
  }

  async respondToPlanApproval({
    planId,
    response,
  }: {
    planId: string;
    response: { action: 'approved' | 'rejected'; feedback?: string };
  }): Promise<void> {
    const resolve = this.#pendingPlanApprovals.get(planId);
    if (resolve) {
      this.#pendingPlanApprovals.delete(planId);
      resolve(response);
      return;
    }
    this.#session?.resolvePlanApproval(planId, response);
  }

  async respondToToolApproval(
    input: { decision: string; toolCallId?: string } | string,
    approvedOrResponse?: boolean | Record<string, unknown>,
  ): Promise<void> {
    if (!this.#session) throw new Error('No active session to respond to tool approval');
    const toolCallId =
      typeof input === 'string'
        ? input
        : (input.toolCallId ?? String(this.#displayState.pendingApproval?.toolCallId ?? ''));
    if (!toolCallId) return;
    const decision = typeof input === 'string' ? approvedOrResponse : input.decision;
    if (typeof decision === 'boolean') {
      await this.#session.approveToolCall(toolCallId, decision ? 'allow' : 'deny');
      return;
    }
    if (decision && typeof decision === 'object') {
      await this.#session.respondToToolApproval(toolCallId, decision);
      return;
    }
    await this.#session.approveToolCall(
      toolCallId,
      decision === 'approve' || decision === 'always_allow_category' ? 'allow' : 'deny',
    );
  }

  async setThreadSetting(setting: string | { key: string; value: unknown }, value?: unknown): Promise<void> {
    const key = typeof setting === 'string' ? setting : setting.key;
    const settingValue = typeof setting === 'string' ? value : setting.value;
    if (!this.#currentThreadId) return;
    const memory = await this.#resolveMemory();
    const thread = await memory.getThreadById({ threadId: this.#currentThreadId });
    if (!thread) return;
    await memory.saveThread({
      thread: {
        ...thread,
        metadata: { ...(thread.metadata ?? {}), [key]: settingValue },
      },
    });
  }

  setBrowser(_browser: unknown): void {}

  async useSkill(name: string, _opts?: { args?: Record<string, unknown> }): Promise<string> {
    if (!this.#session) throw new Error('No active session to use skill');
    return this.#session.useSkill(name);
  }

  hasWorkspace(): boolean {
    return this.#config.workspace !== undefined;
  }

  getWorkspace(): any {
    return this.#resolvedWorkspace;
  }

  async resolveWorkspace(): Promise<unknown> {
    if (this.#workspaceResolved) return this.#resolvedWorkspace;
    const workspace = this.#config.workspace;
    if (typeof workspace === 'function') {
      // Build a request context with harness state so dynamic workspace
      // factories (e.g. getDynamicWorkspace) can read projectPath, configDir,
      // etc. from the harness context — matching the legacy harness behavior.
      const requestContext = new RequestContext();
      const harnessContext = {
        harnessId: this.id,
        state: this.getState(),
        getState: () => this.getState(),
        setState: (updates: Partial<TState>) => this.setState(updates),
        threadId: this.#currentThreadId ?? undefined,
        resourceId: this.#resourceId,
        modeId: this.getCurrentModeId(),
      };
      requestContext.set('harness', harnessContext);
      this.#resolvedWorkspace = await workspace({ requestContext, mastra: this.#config.mastra });
    } else {
      this.#resolvedWorkspace = workspace;
    }
    this.#workspaceResolved = true;
    return this.#resolvedWorkspace;
  }

  async loadOMProgress() {}

  /**
   * Check if the current model's provider has authentication configured.
   * Uses the provider registry's `apiKeyEnvVar` and the optional `modelAuthChecker` hook.
   */
  async getCurrentModelAuthStatus(): Promise<ModelAuthStatus> {
    const modelId = this.getCurrentModelId();
    if (!modelId) return { hasAuth: true };

    try {
      const availableModels = await this.listAvailableModels();
      const currentModel = availableModels.find(model => model.id === modelId);
      if (currentModel) {
        if (currentModel.hasApiKey) {
          return { hasAuth: true };
        }
        return { hasAuth: false, apiKeyEnvVar: currentModel.apiKeyEnvVar };
      }
    } catch {
      // Ignore catalog lookup errors and fall through to provider-based checks.
    }

    const provider = modelId.split('/')[0];
    if (!provider) return { hasAuth: true };

    try {
      const registry = PROVIDER_REGISTRY as Record<string, { apiKeyEnvVar?: string | string[] }>;
      const providerConfig = registry[provider];
      const envVars = providerConfig?.apiKeyEnvVar;
      const apiKeyEnvVar = Array.isArray(envVars) ? envVars[0] : envVars;
      if (apiKeyEnvVar && process.env[apiKeyEnvVar]) {
        return { hasAuth: true };
      }
      return { hasAuth: false, apiKeyEnvVar: apiKeyEnvVar || undefined };
    } catch {
      return { hasAuth: true };
    }
  }

  async #ensureSession(): Promise<Session<TState>> {
    if (this.#session) return this.#session;
    const threadId = this.#currentThreadId ?? randomUUID();
    this.#session = await this.#harnessV1.session({ threadId, resourceId: this.#resourceId });
    this.#currentThreadId = threadId;
    return this.#session;
  }

  #createHarnessContext() {
    return {
      harnessId: this.id,
      sessionId: this.#session?.id,
      ownerId: this.#session?.ownerId,
      resourceId: this.#session?.resourceId,
      threadId: this.#session?.threadId,
      modeId: this.#session?.getMode()?.id,
      modelId: this.#session?.getModelId(),
      getState: () => this.getState(),
      harness: this,
    } as const;
  }
}
