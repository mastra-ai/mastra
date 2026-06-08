import { randomUUID } from 'node:crypto';

import { RequestContext } from '@internal/core/request-context';
import type { Agent, AgentMessageInput, QueueAgentMessageOptions, SendAgentMessageOptions, ToolsInput } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraModelGatewayInterface } from '../../llm';
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
import type {
  CloneSessionOptions,
  SessionConfig,
  SessionMessageOptions,
  SessionQueueMessageResult,
  SessionSendMessageResult,
  SessionSubscribeToThreadOptions,
  SessionThreadSubscription,
} from './session.types';
import { HarnessSkillNotFoundError } from './skills.types';
import type { HarnessSkill, SkillSource } from './skills.types';
import type { SubagentRegistryConfig } from './subagents.types';
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
  #runStatus: 'idle' | 'starting' | 'running' | 'waiting' | 'resuming' = 'idle';
  #currentRunId: string | null = null;
  #currentTraceId: string | null = null;
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
  readonly #gateways: Array<MastraModelGatewayInterface>;
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
    this.#defaultPermissionPolicy = config.defaultPermissionPolicy ?? 'ask';
    this.#toolCategoryResolver = config.toolCategoryResolver;
    this.#agent = config.agent;
    this.#gateways = config.gateways;
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
    return this.#getActiveThreadRunId() ?? this.#currentRunId;
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
    return { ...record };
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
      gateways: this.#gateways,
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

  async subscribeToThread<OUTPUT = unknown>(
    options: SessionSubscribeToThreadOptions = {},
  ): Promise<SessionThreadSubscription<OUTPUT>> {
    const agent = await this.#resolveSessionAgent();

    return agent.subscribeToThread<OUTPUT>({
      ...options,
      resourceId: this.#resourceId,
      threadId: this.#threadId,
    });
  }

  async sendMessage<OUTPUT = unknown>({ messages, ...options }: SessionMessageOptions<OUTPUT>): Promise<SessionSendMessageResult> {
    const agent = await this.#resolveSessionAgent();
    const target = await this.#buildMessageTarget(agent, options);
    const result = agent.sendMessage<OUTPUT>(this.#toAgentMessageInput(messages), target);
    void this.#persistSession({});
    return result;
  }

  async queueMessage<OUTPUT = unknown>({ messages, ...options }: SessionMessageOptions<OUTPUT>): Promise<SessionQueueMessageResult> {
    const agent = await this.#resolveSessionAgent();
    const target = await this.#buildMessageTarget(agent, options);
    const result = agent.queueMessage<OUTPUT>(this.#toAgentMessageInput(messages), target);
    void this.#persistSession({});
    return result;
  }

  async #resolveSessionAgent(): Promise<Agent> {
    return this.#agent;
  }

  async #buildMessageTarget<OUTPUT>(
    agent: Agent,
    options: Omit<SessionMessageOptions<OUTPUT>, 'messages'>,
  ): Promise<SendAgentMessageOptions<OUTPUT> & QueueAgentMessageOptions<OUTPUT>> {
    const { ifActive, ifIdle, runId, ...executionOptions } = options;
    const requestContext = await this.#buildRequestContext();
    const agentTools = await agent.listTools({ requestContext });
    const tools = buildSessionToolsets({
      agentTools,
      modeOverrides: this.#getToolOverrides(),
      builtInTools: buildHarnessBuiltInTools(this),
    });
    const harnessToolNames = Object.keys(tools);
    const userStreamOptions = ifIdle?.streamOptions ?? {};
    const requestedActiveTools = userStreamOptions.activeTools ?? executionOptions.activeTools;

    const target = {
      runId,
      resourceId: this.#resourceId,
      threadId: this.#threadId,
      ifActive,
      ifIdle: {
        ...ifIdle,
        behavior: ifIdle?.behavior ?? 'wake',
        streamOptions: {
          ...executionOptions,
          ...userStreamOptions,
          requestContext,
          toolsets: { harness: tools },
          activeTools: requestedActiveTools
            ? [...new Set([...requestedActiveTools, ...harnessToolNames])]
            : harnessToolNames,
        },
      },
    };

    return target as unknown as SendAgentMessageOptions<OUTPUT> & QueueAgentMessageOptions<OUTPUT>;
  }

  #toAgentMessageInput(messages: SessionMessageOptions['messages']): AgentMessageInput {
    if (typeof messages === 'string') {
      return messages;
    }

    if (Array.isArray(messages)) {
      if (messages.every(part => this.#isSignalPart(part))) {
        return messages as AgentMessageInput;
      }

      const text = messages.map(message => this.#extractMessageText(message)).filter(Boolean).join('\n');
      if (text) {
        return text;
      }
    }

    if (messages && typeof messages === 'object' && 'contents' in messages) {
      return messages as AgentMessageInput;
    }

    const text = this.#extractMessageText(messages);
    if (text) {
      return text;
    }

    throw new Error('Harness session messages must be convertible to an agent message signal');
  }

  #isSignalPart(part: unknown): boolean {
    return (
      !!part &&
      typeof part === 'object' &&
      'type' in part &&
      ((part as { type?: unknown }).type === 'text' || (part as { type?: unknown }).type === 'file')
    );
  }

  #extractMessageText(message: unknown): string | undefined {
    if (typeof message === 'string') {
      return message;
    }

    if (!message || typeof message !== 'object') {
      return undefined;
    }

    if ('text' in message && typeof (message as { text?: unknown }).text === 'string') {
      return (message as { text: string }).text;
    }

    if ('content' in message) {
      return this.#extractContentText((message as { content?: unknown }).content);
    }

    if ('parts' in message) {
      return this.#extractContentText((message as { parts?: unknown }).parts);
    }

    return undefined;
  }

  #extractContentText(content: unknown): string | undefined {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const text = content.map(part => this.#extractMessageText(part)).filter(Boolean).join('\n');
      return text || undefined;
    }

    if (content && typeof content === 'object' && 'parts' in content) {
      return this.#extractContentText((content as { parts?: unknown }).parts);
    }

    return undefined;
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
      !!this.#getActiveThreadRunId() ||
      this.#runStatus === 'starting' ||
      this.#runStatus === 'running' ||
      this.#runStatus === 'waiting' ||
      this.#runStatus === 'resuming';
    return hasActiveRun || this.#pending.some(item => item.status === 'pending');
  }

  #getActiveThreadRunId(): string | null {
    return this.#agent?.getActiveThreadRunId?.({ resourceId: this.#resourceId, threadId: this.#threadId }) ?? null;
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

  async #buildRequestContext(): Promise<RequestContext> {
    const overlay = buildHarnessRequestContext({ harnessContext: this.#createHarnessContext() });
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
