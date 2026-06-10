import { randomUUID } from 'node:crypto';

import { RequestContext } from '@internal/core/request-context';
import type { Agent, ToolsInput } from '../../agent';
import { createSignal } from '../../agent/signals';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory, StorageThreadType } from '../../memory';
import { toStandardSchema } from '../../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../../schema';
import type {
  HarnessPendingItemRecord,
  HarnessStorage,
  SessionRecord,
  SessionRecordUpdate,
} from '../../storage/domains/harness';
import type { DynamicArgument } from '../../types';
import type { Workspace } from '../../workspace';
import type { Skill as WorkspaceSkill, SkillMetadata as WorkspaceSkillMetadata } from '../../workspace/skills/types';
import { sessionCreatedPayload } from './events';
import type { EventEmitter } from './events';
import type { HarnessMode } from './mode';
import type { PermissionPolicy, ToolCategoryResolver } from './permissions.types';
import { buildHarnessRequestContext } from './request-context';
import type { HarnessRequestContext, HarnessRequestContextSource } from './request-context';
import type { CloneSessionOptions, SessionConfig, SessionSignalOptions } from './session.types';
import { HarnessSkillNotFoundError } from './skills.types';
import type { HarnessSkill, SkillSource } from './skills.types';
import type { ModelResolver, SubagentRegistryConfig } from './subagents.types';
import { buildHarnessBuiltInTools, buildSessionToolsets } from './tools';

export class Session<TState = {}> {
  /** Stable identity. Frozen at construction. */
  readonly #id: string;
  readonly #ownerId: string;
  readonly #resourceId: string;
  readonly #threadId: string;
  readonly #createdAt: Date;
  #lastActivityAt: Date;
  readonly #agent: Agent;
  readonly #storage: HarnessStorage;
  readonly #runtimeCompatibilityGeneration?: string | null;
  readonly #parentSessionId?: string;
  readonly #subagentDepth: number;
  readonly #source: HarnessRequestContextSource;
  #pending: HarnessPendingItemRecord[];
  /** Resolvers for tool boundaries blocked in {@link waitForPendingResponse}. */
  readonly #pendingResolvers = new Map<string, (response: Record<string, unknown>) => void>();
  #runStatus: 'idle' | 'starting' | 'running' | 'waiting' | 'resuming' = 'idle';
  #currentRunId: string | null = null;
  #currentTraceId: string | null = null;
  /**
   * Most recent live agent thread subscription created via
   * {@link subscribeToThreadStream}. The session owns subscription creation;
   * the consumer (display projection) drains `.stream` exactly once.
   */
  #threadSubscription: Awaited<ReturnType<Agent['subscribeToThread']>> | null = null;
  #abortController: AbortController | null = null;
  readonly #memory: MastraMemory | DynamicArgument<MastraMemory>;
  readonly #events: EventEmitter;
  readonly #stateSchemaInput?: PublicSchema<TState>;
  readonly #stateSchema?: StandardSchemaWithJSON<TState>;
  #state: TState;
  #stateUpdateQueue: Promise<void> = Promise.resolve();
  readonly #workspace?: DynamicArgument<Workspace | undefined>;
  #resolvedWorkspace?: Workspace;
  #workspaceResolved = false;
  readonly #resolveAgent?: (agentId: string) => Agent | Promise<Agent>;
  readonly #resolveMode?: (modeId: string) => HarnessMode | Promise<HarnessMode>;
  /**
   * Single-flight cache for workspace skill discovery (spec §4.6: concurrent
   * `listSkills`/`useSkill` calls must share the same in-flight promise so we
   * don't re-scan the workspace per call).
   */
  #workspaceSkillsPromise?: Promise<HarnessSkill[]>;
  readonly #subagents?: SubagentRegistryConfig;
  readonly #resolveModel?: ModelResolver;
  readonly #defaultPermissionPolicy: PermissionPolicy;
  readonly #toolCategoryResolver?: ToolCategoryResolver;
  // readonly parentSessionId?: string;
  // readonly subagentDepth: number;

  #modelId: string;
  #mode: HarnessMode;

  constructor(config: SessionConfig<TState>) {
    this.#id = config.id;
    this.#ownerId = config.ownerId;
    this.#resourceId = config.resourceId;
    this.#threadId = config.threadId;
    this.#mode = config.mode;
    this.#modelId = config.model;
    this.#createdAt = config.createdAt;
    this.#lastActivityAt = config.lastActivityAt;
    this.#storage = config.storage;
    this.#runtimeCompatibilityGeneration = config.runtimeCompatibilityGeneration;
    this.#parentSessionId = config.record?.parentSessionId;
    this.#subagentDepth = config.record?.subagentDepth ?? 0;
    this.#source = config.record?.source
      ? { type: config.record.source.type, parentSessionId: config.record.source.parentSessionId }
      : { type: config.record?.origin ?? 'top-level', parentSessionId: config.record?.parentSessionId };
    this.#pending = (config.pending ?? config.record?.pending ?? []).map(item => ({ ...item }));
    this.#memory = config.memory;
    this.#events = config.events;
    this.#stateSchemaInput = config.stateSchema;
    this.#stateSchema = config.stateSchema ? toStandardSchema(config.stateSchema) : undefined;
    this.#resolveAgent = config.resolveAgent;
    this.#resolveMode = config.resolveMode;
    this.#state = {
      ...this.#getSchemaDefaults(),
      ...config.initialState,
      ...(config.record?.state as Partial<TState> | undefined),
    } as TState;
    this.#workspace = config.workspace;
    this.#subagents = config.subagents;
    this.#resolveModel = config.resolveModel;
    this.#defaultPermissionPolicy = config.defaultPermissionPolicy ?? 'ask';
    this.#toolCategoryResolver = config.toolCategoryResolver;
    this.#agent = config.agent;
  }

  get id(): string {
    return this.#id;
  }

  get ownerId(): string {
    return this.#ownerId;
  }

  get resourceId(): string {
    return this.#resourceId;
  }

  get threadId(): string {
    return this.#threadId;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get lastActivityAt(): Date {
    return this.#lastActivityAt;
  }

  get parentSessionId(): string | undefined {
    return this.#parentSessionId;
  }

  get subagentDepth(): number {
    return this.#subagentDepth;
  }

  isBusy(): boolean {
    return this.#isBusySnapshot();
  }

  async waitForIdle(opts: { timeout?: number } = {}): Promise<void> {
    const timeout = opts.timeout ?? 30_000;
    const startedAt = Date.now();

    while (this.#isBusySnapshot()) {
      if (Date.now() - startedAt >= timeout) {
        throw new Error(`Harness session "${this.#id}" did not become idle within ${timeout}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }

  getQueueDepth(): number {
    return this.#pending.filter(item => item.status === 'pending').length;
  }

  getCurrentRunId(): string | null {
    return this.#currentRunId;
  }

  getCurrentTraceId(): string | null {
    return this.#currentTraceId;
  }

  listPendingItems(): HarnessPendingItemRecord[] {
    return this.#pending.map(item => ({ ...item }));
  }

  async spawnSubagentSession(opts: { agentType: string; prompt: string; modelId?: string; forked?: boolean }): Promise<
    | {
        isError: false;
        subagentSessionId: string;
        threadId: string;
        resourceId: string;
        agentType: string;
        depth: number;
      }
    | {
        isError: true;
        code: 'harness.subagent_depth_exceeded';
        message: string;
        details: { maxDepth: number; attemptedDepth: number };
      }
  > {
    const maxDepth = this.#subagents?.maxDepth ?? 1;
    const attemptedDepth = this.#subagentDepth + 1;
    if (attemptedDepth > maxDepth) {
      return {
        isError: true,
        code: 'harness.subagent_depth_exceeded',
        message: `Harness subagent depth ${attemptedDepth} exceeds the configured maximum of ${maxDepth}`,
        details: { maxDepth, attemptedDepth },
      };
    }

    const definition = this.#subagents?.types?.[opts.agentType];
    if (!definition) {
      throw new Error(`Harness subagent type "${opts.agentType}" was not found`);
    }

    if (!this.#resolveAgent) {
      throw new Error('Harness subagent spawn requires an agent resolver');
    }
    await this.#resolveAgent(definition.agentId);

    const modelId = opts.modelId ?? definition.defaultModelId ?? this.#modelId;
    if (!this.#resolveModel) {
      throw new Error('Harness subagent spawn requires a resolveModel function');
    }
    await this.#resolveModel(modelId);

    const now = new Date();
    const record: SessionRecord = {
      id: `sess-${randomUUID()}`,
      ownerId: this.#ownerId,
      resourceId: this.#resourceId,
      threadId: `thread-${randomUUID()}`,
      parentSessionId: this.#id,
      origin: 'subagent-tool',
      source: { type: 'subagent-tool', parentSessionId: this.#id },
      subagentDepth: attemptedDepth,
      runtimeCompatibilityGeneration: this.#runtimeCompatibilityGeneration,
      modeId: this.#mode.id,
      modelId,
      metadata: {
        agentType: opts.agentType,
        agentId: definition.agentId,
        prompt: opts.prompt,
        forked: opts.forked ?? definition.forked ?? false,
      },
      state: this.getState() as Record<string, unknown>,
      pending: [],
      createdAt: now,
      lastActivityAt: now,
    };

    await this.#storage.saveSession(record);
    this.#events.emit({ type: 'session_created', ...sessionCreatedPayload(record) }, { sessionId: record.id });
    this.#events.emit({
      type: 'subagent_start',
      subagentSessionId: record.id,
      payload: { agentType: opts.agentType, parentSessionId: this.#id, depth: attemptedDepth },
    });

    return {
      isError: false,
      subagentSessionId: record.id,
      threadId: record.threadId,
      resourceId: record.resourceId,
      agentType: opts.agentType,
      depth: attemptedDepth,
    };
  }

  async registerPendingItem(
    item: Omit<HarnessPendingItemRecord, 'sessionId' | 'createdAt' | 'updatedAt'> & {
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Promise<HarnessPendingItemRecord> {
    const now = new Date();
    const record: HarnessPendingItemRecord = {
      ...item,
      sessionId: this.#id,
      runtimeCompatibilityGeneration: item.runtimeCompatibilityGeneration ?? this.#runtimeCompatibilityGeneration,
      createdAt: item.createdAt ?? now,
      updatedAt: item.updatedAt ?? now,
    };
    this.#pending = [...this.#pending, record];
    await this.#storage.appendPendingItem(this.#id, record);
    await this.#reloadRecordProjection();
    this.#events.emit({ type: 'pending_item_registered', item: { ...record } });
    return { ...record };
  }

  /**
   * Wait until a registered pending item receives its response via the
   * matching `respondTo*` method. Used by blocking human-in-the-loop tool
   * boundaries (e.g. `submit_plan` pauses the run until the user approves or
   * rejects the plan). Rejects with an AbortError if `abortSignal` fires
   * first (run aborted while waiting).
   */
  waitForPendingResponse(
    pendingItemId: string,
    opts: { abortSignal?: AbortSignal } = {},
  ): Promise<Record<string, unknown>> {
    const item = this.#pending.find(item => item.id === pendingItemId);
    if (!item) {
      return Promise.reject(new Error(`Harness pending item "${pendingItemId}" was not found on session "${this.#id}"`));
    }
    if (item.status !== 'pending') {
      return Promise.resolve({ ...(item.response ?? {}) });
    }

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const signal = opts.abortSignal;
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const onAbort = () => {
        this.#pendingResolvers.delete(pendingItemId);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.#pendingResolvers.set(pendingItemId, response => {
        signal?.removeEventListener('abort', onAbort);
        resolve(response);
      });
    });
  }

  async updatePendingItem(
    pendingItemId: string,
    updates: Partial<Omit<HarnessPendingItemRecord, 'id' | 'sessionId' | 'createdAt'>>,
  ): Promise<HarnessPendingItemRecord> {
    await this.#storage.updatePendingItem(this.#id, pendingItemId, updates);
    await this.#reloadRecordProjection();
    const item = this.#pending.find(item => item.id === pendingItemId);
    if (!item) {
      throw new Error(`Harness pending item "${pendingItemId}" was not found on session "${this.#id}"`);
    }
    return { ...item };
  }

  async removePendingItem(pendingItemId: string): Promise<void> {
    await this.#storage.removePendingItem(this.#id, pendingItemId);
    await this.#reloadRecordProjection();
  }

  async respondToToolApproval(
    pendingItemId: string,
    response: Record<string, unknown>,
  ): Promise<HarnessPendingItemRecord> {
    return this.#respondToPendingItem(pendingItemId, 'tool-approval', response);
  }

  async respondToToolSuspension(
    pendingItemId: string,
    response: Record<string, unknown>,
  ): Promise<HarnessPendingItemRecord> {
    return this.#respondToPendingItem(pendingItemId, 'tool-suspension', response);
  }

  async respondToQuestion(pendingItemId: string, response: Record<string, unknown>): Promise<HarnessPendingItemRecord> {
    return this.#respondToPendingItem(pendingItemId, 'question', response);
  }

  async respondToPlanApproval(
    pendingItemId: string,
    response: Record<string, unknown>,
  ): Promise<HarnessPendingItemRecord> {
    return this.#respondToPendingItem(pendingItemId, 'plan-approval', response);
  }

  async clone(opts: CloneSessionOptions = {}): Promise<Session<TState>> {
    const result = await (
      await this.#resolveMemory()
    ).cloneThread({
      sourceThreadId: this.#threadId,
      newThreadId: opts.threadId,
      resourceId: opts.resourceId ?? this.#resourceId,
      title: opts.title,
      metadata: opts.metadata,
      options: opts.messageLimit !== undefined ? { messageLimit: opts.messageLimit } : undefined,
    });

    const cloneId = opts.sessionId ?? randomUUID();
    const clone = new Session<TState>({
      id: cloneId,
      ownerId: this.#ownerId,
      threadId: result.thread.id,
      resourceId: result.thread.resourceId,
      mode: opts.mode ?? this.#mode,
      model: opts.modelId ?? this.#modelId,
      createdAt: result.thread.createdAt,
      lastActivityAt: result.thread.updatedAt,
      agent: this.#agent,
      memory: this.#memory,
      storage: this.#storage,
      events: this.#events.scoped({ sessionId: cloneId }),
      stateSchema: this.#stateSchemaInput,
      initialState: this.getState() as Partial<TState>,
      workspace: this.#workspace,
      subagents: this.#subagents,
      resolveAgent: this.#resolveAgent,
      resolveMode: this.#resolveMode,
      resolveModel: this.#resolveModel,
      defaultPermissionPolicy: this.#defaultPermissionPolicy,
      toolCategoryResolver: this.#toolCategoryResolver,
    });

    this.#events.emit({
      type: 'thread_cloned',
      threadId: clone.threadId,
      resourceId: clone.resourceId,
      sourceThreadId: this.#threadId,
      title: opts.title,
    });

    return clone;
  }

  async getThread(): Promise<StorageThreadType | null> {
    return (await this.#resolveMemory()).getThreadById({ threadId: this.#threadId });
  }

  async getMessages(): Promise<MastraDBMessage[]> {
    const result = await (
      await this.#resolveMemory()
    ).recall({ threadId: this.#threadId, resourceId: this.#resourceId });
    return result.messages;
  }

  async saveMessages(
    messages: MastraDBMessage[],
  ): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
    return (await this.#resolveMemory()).saveMessages({ messages });
  }

  getState(): Readonly<TState> {
    return Object.freeze({ ...(this.#state as Record<string, unknown>) }) as Readonly<TState>;
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const run = this.#stateUpdateQueue.then(() => this.#applyStateUpdates(updates));
    this.#stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async updateState<TResult>(
    updater: (
      state: Readonly<TState>,
    ) =>
      | { updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }>,
  ): Promise<TResult> {
    const run = this.#stateUpdateQueue.then(async () => {
      const update = await updater(this.getState());
      if (update.updates && Object.keys(update.updates).length > 0) {
        await this.#applyStateUpdates(update.updates);
      }
      for (const event of update.events ?? []) {
        this.#events.emit(event);
      }
      return update.result;
    });

    this.#stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  getModelId(): string {
    return this.#modelId;
  }

  setModelId(modelId: string) {
    const previousModelId = this.#modelId;
    this.#modelId = modelId;
    if (modelId !== previousModelId) {
      void this.#persistSession({ modelId });
      this.#events.emit({ type: 'model_changed', modelId, previousModelId });
    }
  }

  getMode(): HarnessMode {
    return this.#mode;
  }

  #getToolOverrides(): { tools?: ToolsInput; additionalTools?: ToolsInput } {
    return { tools: this.#mode.tools, additionalTools: this.#mode.additionalTools };
  }

  async signal({ messages, ...options }: SessionSignalOptions): Promise<unknown> {
    if (!this.#resolveAgent) {
      throw new Error('Harness session cannot signal because no agent resolver is configured');
    }

    const agent = this.#agent;
    const runId = options.runId ?? randomUUID();
    this.#markRunning(runId);

    try {
      const requestContext = await this.#buildRequestContext();
      const agentTools = await agent.listTools({ requestContext });
      const tools = buildSessionToolsets({
        agentTools,
        modeOverrides: this.#getToolOverrides(),
        builtInTools: buildHarnessBuiltInTools(this),
      });
      const model = this.#resolveModel ? await this.#resolveModel(this.#modelId) : undefined;
      const result = await agent.generate(messages, {
        ...options,
        runId,
        requestContext,
        ...(model ? { model } : {}),
        toolsets: { harness: tools },
        activeTools: options.activeTools
          ? [...new Set([...options.activeTools, ...Object.keys(tools)])]
          : Object.keys(tools),
      });
      this.#markIdle();
      return result;
    } catch (error) {
      this.#markIdle();
      throw error;
    }
  }

  /**
   * Streaming variant of {@link signal}. Composes the same toolsets, mode
   * overrides, model, and request context as `signal()`, but invokes
   * `agent.stream()` so callers can consume the live `fullStream` of chunks.
   *
   * Run status is marked `running` before the stream starts and returns to
   * `idle` once the underlying stream settles (success or error). Callers are
   * responsible for draining the returned stream.
   */
  async signalStream({ messages, ...options }: SessionSignalOptions): Promise<unknown> {
    if (!this.#resolveAgent) {
      throw new Error('Harness session cannot signal because no agent resolver is configured');
    }

    const agent = this.#agent;
    const runId = options.runId ?? randomUUID();
    this.#markRunning(runId);

    try {
      const requestContext = await this.#buildRequestContext();
      const agentTools = await agent.listTools({ requestContext });
      const tools = buildSessionToolsets({
        agentTools,
        modeOverrides: this.#getToolOverrides(),
        builtInTools: buildHarnessBuiltInTools(this),
      });
      const model = this.#resolveModel ? await this.#resolveModel(this.#modelId) : undefined;
      // Mirror the legacy execution contract: when the session is in "yolo"
      // mode, tools execute without an approval gate; otherwise tool calls
      // require approval (surfaced as pending items). Per-call `options` may
      // override.
      const isYolo = (this.#state as { yolo?: unknown }).yolo === true;
      const output = (await agent.stream(messages, {
        // Multi-step tool round-trips by default so the agent can call a tool,
        // observe its result, and continue — matching the legacy execution
        // path. Per-call `options` may override.
        maxSteps: 1000,
        savePerStep: false,
        requireToolApproval: !isYolo,
        ...options,
        runId,
        requestContext,
        // Bind execution to the session's durable thread so streamed messages
        // persist and reload (thread history parity with the legacy path).
        memory: { thread: this.#threadId, resource: this.#resourceId },
        ...(model ? { model } : {}),
        toolsets: { harness: tools },
        activeTools: options.activeTools
          ? [...new Set([...options.activeTools, ...Object.keys(tools)])]
          : Object.keys(tools),
      })) as { fullStream: AsyncIterable<unknown> };

      // Mark the run idle when the caller finishes draining `fullStream`. We
      // deliberately avoid reading `output.finishReason` here: touching it
      // eagerly consumes the underlying stream into a buffer, which collapses
      // incremental chunk timing (e.g. live tool-input deltas) for the
      // consumer. Instead, wrap the stream so idle is marked once iteration
      // completes, preserving the agent's natural streaming cadence.
      const markIdle = () => this.#markIdle();
      const originalStream = output.fullStream;
      const wrappedStream = (async function* () {
        try {
          for await (const chunk of originalStream) {
            yield chunk;
          }
        } finally {
          markIdle();
        }
      })();

      // Preserve the original output object (and its lazy getters like
      // `finishReason`/`text`) while substituting the idle-tracking stream.
      return new Proxy(output as object, {
        get(target, prop, receiver) {
          if (prop === 'fullStream') return wrappedStream;
          return Reflect.get(target, prop, receiver);
        },
      });
    } catch (error) {
      this.#markIdle();
      throw error;
    }
  }

  /**
   * Dispatch a run through the agent's live thread-stream runtime
   * (`agent.sendSignal` over the thread PubSub topic) rather than the buffered
   * `agent.stream()` form used by {@link signalStream}.
   *
   * The session composes the run — v1 toolsets (including session-owned task
   * tools), harness request context, mode/model resolution, and yolo-aware
   * approval gating — but does NOT subscribe to or consume the thread stream
   * itself. Exactly one consumer must project the thread's chunk stream into
   * display events; during the HarnessCompat era that is the legacy harness's
   * existing agent-thread subscription. Creating a second consumer here would
   * double-emit every display event (e.g. each `tool_input_delta` appended
   * twice corrupts the partial-args JSON buffer and breaks live rendering).
   */
  async signalThread({
    content,
    requestContext: requestContextInput,
    ifActive,
    ifIdle,
  }: {
    content: string;
    requestContext?: RequestContext;
    ifActive?: { attributes?: Record<string, unknown> };
    ifIdle?: { attributes?: Record<string, unknown> };
  }): Promise<{ accepted: boolean; runId: string | null }> {
    if (!this.#resolveAgent) {
      throw new Error('Harness session cannot signal because no agent resolver is configured');
    }

    const agent = this.#agent;
    const signal = createSignal({ type: 'user', tagName: 'user', contents: content });
    const streamOptions = await this.#buildThreadStreamOptions(requestContextInput);

    const result = agent.sendSignal(signal, {
      resourceId: this.#resourceId,
      threadId: this.#threadId,
      ifActive,
      ifIdle: { ...ifIdle, streamOptions },
    } as Parameters<Agent['sendSignal']>[1]);

    return { accepted: true, runId: result.runId ?? null };
  }

  /**
   * Create a live subscription to this session's thread stream. The session
   * owns subscription creation; the caller is the single consumer responsible
   * for draining `.stream` (projecting chunks into display events) and for
   * `unsubscribe()`/`abort()` lifecycle. Always returns a fresh subscription —
   * idempotency/cleanup across thread switches is the consumer's concern.
   */
  async subscribeToThreadStream(): Promise<Awaited<ReturnType<Agent['subscribeToThread']>>> {
    const subscription = await this.#agent.subscribeToThread({
      resourceId: this.#resourceId,
      threadId: this.#threadId,
    });
    this.#threadSubscription = subscription;
    return subscription;
  }

  /** The most recent thread-stream subscription created by this session, if any. */
  get threadSubscription(): Awaited<ReturnType<Agent['subscribeToThread']>> | null {
    return this.#threadSubscription;
  }

  /** Build the per-run stream options for {@link signalThread}, mirroring the
   * legacy harness contract (composed harness toolsets, request context,
   * multi-step round-trips, yolo-aware approval gating, abort signal). */
  async #buildThreadStreamOptions(requestContextInput?: RequestContext): Promise<Record<string, unknown>> {
    this.#abortController ??= new AbortController();
    const requestContext = await this.#buildRequestContext(requestContextInput);
    const agentTools = await this.#agent.listTools({ requestContext });
    const tools = buildSessionToolsets({
      agentTools,
      modeOverrides: this.#getToolOverrides(),
      builtInTools: buildHarnessBuiltInTools(this),
    });
    const model = this.#resolveModel ? await this.#resolveModel(this.#modelId) : undefined;
    const isYolo = (this.#state as { yolo?: unknown }).yolo === true;
    return {
      memory: { thread: this.#threadId, resource: this.#resourceId },
      abortSignal: this.#abortController.signal,
      requestContext,
      maxSteps: 1000,
      savePerStep: false,
      requireToolApproval: !isYolo,
      modelSettings: { temperature: 1 },
      ...(model ? { model } : {}),
      toolsets: { harness: tools },
    };
  }

  setMode(mode: HarnessMode) {
    const previousModeId = this.#mode.id;
    this.#mode = mode;
    if (mode.id !== previousModeId) {
      void this.#persistSession({ modeId: mode.id });
      this.#events.emit({ type: 'mode_changed', modeId: mode.id, previousModeId });
    }
  }

  /**
   * Returns the workspace skill catalog. Workspace discovery is async on first
   * call and cached for the lifetime of the session (use `refreshSkills` to
   * invalidate).
   */
  async listSkills(): Promise<HarnessSkill[]> {
    return this.#loadWorkspaceSkillMetadata();
  }

  /**
   * Look up a single skill by name. Returns `null` when no skill matches;
   * use `useSkill` when a missing skill should be a hard error.
   */
  async getSkill(name: string): Promise<HarnessSkill | null> {
    const workspace = await this.#getResolvedWorkspace();
    if (!workspace?.skills) return null;

    // Use the cached metadata list before materialising a full skill so
    // concurrent discovery stays single-flight.
    const workspaceSkills = await this.#loadWorkspaceSkillMetadata();
    if (!workspaceSkills.some(skill => skill.name === name)) return null;

    const skill = await workspace.skills.get(name);
    return skill ? this.#toHarnessSkill(skill) : null;
  }

  /**
   * Activate a skill by name and return the canonical skill instructions string.
   *
   * Throws `HarnessSkillNotFoundError` when the skill cannot be resolved.
   */
  async useSkill(name: string): Promise<string> {
    const skill = await this.getSkill(name);
    if (!skill) {
      throw new HarnessSkillNotFoundError({
        name,
        searchedSources: this.#searchedSources(),
      });
    }

    return skill.instructions;
  }

  /**
   * Invalidate the workspace skill discovery cache. The next `listSkills` or
   * `useSkill` call will re-query the workspace.
   */
  refreshSkills(): void {
    this.#workspaceSkillsPromise = undefined;
  }

  #toHarnessSkill(skill: WorkspaceSkill | WorkspaceSkillMetadata): HarnessSkill {
    const metadata = this.#plainMetadata(skill.metadata);
    const category = typeof metadata?.category === 'string' ? metadata.category : undefined;
    const filePath = skill.path;
    if (!filePath) {
      throw new Error(`Workspace skill "${skill.name}" is missing a file path`);
    }
    return {
      name: skill.name,
      description: skill.description,
      instructions: 'instructions' in skill ? skill.instructions : '',
      filePath,
      ...(category ? { category } : {}),
      ...(metadata ? { metadata } : {}),
    };
  }

  #plainMetadata(metadata: Record<string, unknown> | undefined): HarnessSkill['metadata'] | undefined {
    if (!metadata) return undefined;
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (key === 'args') continue;
      if (this.#isJsonSerializable(value)) copy[key] = value;
    }
    return Object.keys(copy).length > 0 ? (copy as HarnessSkill['metadata']) : undefined;
  }

  #isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  #isJsonSerializable(value: unknown): boolean {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(item => this.#isJsonSerializable(item));
    if (this.#isPlainObject(value))
      return Object.values(value).every(item => item !== undefined && this.#isJsonSerializable(item));
    return false;
  }

  #searchedSources(): SkillSource[] {
    return this.#workspace !== undefined ? ['workspace'] : [];
  }

  async #loadWorkspaceSkillMetadata(): Promise<HarnessSkill[]> {
    if (!this.#workspaceSkillsPromise) {
      this.#workspaceSkillsPromise = this.#discoverWorkspaceSkillMetadata().catch(err => {
        // Reset on failure so a later call can retry instead of poisoning the
        // cache. Re-throw to surface the original error to the current caller.
        this.#workspaceSkillsPromise = undefined;
        throw err;
      });
    }
    return this.#workspaceSkillsPromise;
  }

  async #discoverWorkspaceSkillMetadata(): Promise<HarnessSkill[]> {
    const workspace = await this.#getResolvedWorkspace();
    const skillsApi = workspace?.skills;
    if (!skillsApi) return [];
    const skillMetadata = await skillsApi.list();
    const skills = await Promise.all(
      skillMetadata.map(async metadata => (await skillsApi.get(metadata.name)) ?? metadata),
    );
    return skills.map(skill => this.#toHarnessSkill(skill));
  }

  async #getResolvedWorkspace(requestContext?: RequestContext): Promise<Workspace | undefined> {
    const workspace = this.#workspace;
    if (!workspace) return undefined;
    if (typeof workspace !== 'function') return workspace;
    if (this.#workspaceResolved) return this.#resolvedWorkspace;

    const resolved = await workspace({ requestContext: requestContext ?? new RequestContext() });
    this.#resolvedWorkspace = resolved;
    this.#workspaceResolved = true;
    return resolved;
  }

  async #applyStateUpdates(updates: Partial<TState>): Promise<void> {
    const changedKeys = Object.keys(updates);
    const newState = { ...(this.#state as Record<string, unknown>), ...(updates as Record<string, unknown>) };

    if (this.#stateSchema) {
      const result = await this.#stateSchema['~standard'].validate(newState);
      if (result.issues) {
        const messages = result.issues.map((issue: { message?: string }) => issue.message).join('; ');
        throw new Error(`Invalid state update: ${messages}`);
      }
      this.#state = result.value as TState;
    } else {
      this.#state = newState as TState;
    }

    await this.#persistSession({ state: this.#state as Record<string, unknown> });

    this.#events.emit({
      type: 'state_changed',
      state: this.#state as Record<string, unknown>,
      changedKeys,
    });
  }

  #isBusySnapshot(): boolean {
    const hasActiveRun =
      this.#runStatus === 'starting' ||
      this.#runStatus === 'running' ||
      this.#runStatus === 'waiting' ||
      this.#runStatus === 'resuming';
    return hasActiveRun || this.#pending.some(item => item.status === 'pending');
  }

  #markRunning(runId: string, traceId: string | null = null): void {
    this.#runStatus = 'running';
    this.#currentRunId = runId;
    this.#currentTraceId = traceId;
  }

  #markIdle(): void {
    this.#runStatus = 'idle';
    this.#currentRunId = null;
    this.#currentTraceId = null;
  }

  async #persistSession(updates: SessionRecordUpdate): Promise<void> {
    this.#lastActivityAt = updates.lastActivityAt ?? new Date();
    await this.#storage.updateSession(this.#id, {
      ...updates,
      lastActivityAt: this.#lastActivityAt,
    });
  }

  async #respondToPendingItem(
    pendingItemId: string,
    expectedKind: HarnessPendingItemRecord['kind'],
    response: Record<string, unknown>,
  ): Promise<HarnessPendingItemRecord> {
    const item = this.#pending.find(item => item.id === pendingItemId);
    if (!item) {
      throw new Error(`Harness pending item "${pendingItemId}" was not found on session "${this.#id}"`);
    }
    if (item.kind !== expectedKind) {
      throw new Error(`Harness pending item "${pendingItemId}" is kind "${item.kind}", not "${expectedKind}"`);
    }
    if (item.status !== 'pending') {
      throw new Error(`Harness pending item "${pendingItemId}" is already ${item.status}`);
    }
    if (item.runtimeCompatibilityGeneration !== this.#runtimeCompatibilityGeneration) {
      throw new Error('harness.runtime_dependency_drifted');
    }

    const resumeResult = await this.#resumePendingBoundary(item, response);
    const recordedResponse = resumeResult === undefined ? response : { ...response, resumeResult };

    await this.#storage.updatePendingItem(this.#id, pendingItemId, { status: 'responded', response: recordedResponse });
    await this.#reloadRecordProjection();

    // Release any tool boundary blocked in waitForPendingResponse AFTER the
    // response is durably recorded, so the resumed run observes consistent
    // pending-item state.
    const resolveBoundary = this.#pendingResolvers.get(pendingItemId);
    if (resolveBoundary) {
      this.#pendingResolvers.delete(pendingItemId);
      resolveBoundary({ ...recordedResponse });
    }

    const updated = this.#pending.find(item => item.id === pendingItemId);
    if (!updated) {
      throw new Error(`Harness pending item "${pendingItemId}" was not found on session "${this.#id}"`);
    }
    return { ...updated };
  }

  async #resumePendingBoundary(
    item: HarnessPendingItemRecord,
    response: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    const payload = item.payload;
    if (!this.#isPlainObject(payload)) return undefined;

    if (item.kind === 'tool-approval') {
      const approved = response.approved;
      const runId = typeof payload.runId === 'string' ? payload.runId : item.runId;
      const toolCallId = typeof payload.toolCallId === 'string' ? payload.toolCallId : undefined;
      const agent =
        typeof payload.agentId === 'string' && this.#resolveAgent
          ? await this.#resolveAgent(payload.agentId)
          : this.#agent;
      if (typeof approved !== 'boolean' || !runId || !this.#resolveAgent) return undefined;

      const result = approved
        ? await agent.approveToolCallGenerate({ runId, toolCallId, requestContext: await this.#buildRequestContext() })
        : await agent.declineToolCallGenerate({ runId, toolCallId, requestContext: await this.#buildRequestContext() });
      return this.#isJsonSerializable(result) ? (result as Record<string, unknown>) : { resumed: true };
    }

    if (item.kind === 'plan-approval' && response.approved === true) {
      const transitionModeId = typeof payload.transitionModeId === 'string' ? payload.transitionModeId : undefined;
      if (transitionModeId && transitionModeId !== this.#mode.id && this.#resolveMode) {
        const mode = await this.#resolveMode(transitionModeId);
        this.setMode(mode);
        return { transitionModeId, modeChanged: true };
      }
    }

    return undefined;
  }

  async #reloadRecordProjection(): Promise<void> {
    const record = await this.#storage.loadSession(this.#id);
    if (!record) {
      throw new Error(`Harness session "${this.#id}" was not found`);
    }
    this.#lastActivityAt = record.lastActivityAt;
    this.#pending = (record.pending ?? []).map(item => ({ ...item }));
  }

  #getSchemaDefaults(): Partial<TState> {
    if (!this.#stateSchema) return {};

    const defaults: Record<string, unknown> = {};

    try {
      const jsonSchema = this.#stateSchema['~standard'].jsonSchema.output({ target: 'draft-07' }) as {
        properties?: Record<string, { default?: unknown }>;
      };
      for (const [key, prop] of Object.entries(jsonSchema.properties ?? {})) {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        }
      }
    } catch {
      // Schema doesn't support JSON Schema extraction.
    }

    return defaults as Partial<TState>;
  }

  async #buildRequestContext(input?: RequestContext): Promise<RequestContext> {
    const overlay = buildHarnessRequestContext({
      harnessContext: this.#createHarnessContext(),
      ...(input ? { base: input } : {}),
    });
    await this.#getResolvedWorkspace(overlay);

    return overlay;
  }

  #createHarnessContext(): HarnessRequestContext<TState> {
    return {
      harnessId: this.#ownerId,
      sessionId: this.#id,
      ownerId: this.#ownerId,
      resourceId: this.#resourceId,
      threadId: this.#threadId,
      modeId: this.#mode.id,
      modelId: this.#modelId,
      parentSessionId: this.#parentSessionId,
      subagentDepth: this.#subagentDepth,
      source: this.#source,
      getState: () => this.getState(),
    };
  }

  async #resolveMemory(): Promise<MastraMemory> {
    const mem = this.#memory;
    if (!mem) {
      throw new Error('Memory is not configured on this Harness');
    }
    if (typeof mem !== 'function') {
      return mem;
    }
    const requestContext = await this.#buildRequestContext();
    const resolved = await mem({ requestContext });
    if (!resolved) {
      throw new Error('Dynamic memory factory returned empty value');
    }
    return resolved;
  }
}
