import { randomUUID } from 'node:crypto';

import type {
  AvailableModel,
  HarnessDisplayState,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMode as LegacyHarnessMode,
  HarnessSession,
  HarnessThread,
  ModelAuthStatus,
  PermissionPolicy,
  ToolCategory,
} from '@mastra/core/harness';
import { defaultDisplayState } from '@mastra/core/harness';
import { Harness as HarnessV1 } from '@mastra/core/harness/v1';
import type { HarnessEvent as HarnessV1Event, HarnessMessageContentPart, Session, ThreadRecord } from '@mastra/core/harness/v1';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';

import {
  MASTRACODE_RUNTIME_COMPATIBILITY_GENERATION,
  resolveDefaultModeId,
  toHarnessV1Agents,
  toHarnessV1AuthStatus,
  toHarnessV1Modes,
  toHarnessV1Subagents,
  toModelInfo,
} from './config.js';
import type { MastraCodeModelInfo, MastraCodeRuntimeConfig } from './config.js';
import { MastraCodeHarnessEventProjector } from './events.js';
import { emptyOMProgress, getOMModelState } from './observational-memory.js';

type SignalDeliveryAttributes = Record<string, string | number | boolean | null | undefined>;

type SignalInput =
  | {
      content: string | HarnessMessageContentPart[];
      ifActive?: { attributes?: SignalDeliveryAttributes };
      ifIdle?: { attributes?: SignalDeliveryAttributes };
    }
  | { type: string; contents: string | HarnessMessageContentPart[]; attributes?: Record<string, unknown>; metadata?: Record<string, unknown> };

interface SignalHandle {
  id: string;
  accepted: Promise<void>;
}

function normalizeMessageContent(input: SignalInput): string {
  if ('content' in input) {
    if (typeof input.content === 'string') return input.content;
    return input.content
      .map(part => (part.type === 'text' ? part.text : `[${part.type}]`))
      .join('\n');
  }

  const contents =
    typeof input.contents === 'string'
      ? input.contents
      : input.contents.map(part => (part.type === 'text' ? part.text : `[${part.type}]`)).join('\n');
  if (input.type === 'system-reminder') {
    const reminderType = typeof input.attributes?.type === 'string' ? ` type="${input.attributes.type}"` : '';
    return `<system-reminder${reminderType}>${contents}</system-reminder>`;
  }
  return contents;
}

function signalContents(input: SignalInput): string | HarnessMessageContentPart[] {
  return 'content' in input ? input.content : input.contents;
}

function messageContents(content: string, files?: unknown[]): string | HarnessMessageContentPart[] {
  if (!files?.length) return content;
  const parts: HarnessMessageContentPart[] = [
    { type: 'text', text: content },
    ...files.flatMap(file => {
      if (!file || typeof file !== 'object') return [];
      const value = file as Record<string, unknown>;
      const part: HarnessMessageContentPart = {
        type: 'file',
        ...(typeof value.data === 'string' ? { data: value.data } : {}),
        ...(typeof value.mimeType === 'string' ? { mediaType: value.mimeType } : {}),
        ...(typeof value.mediaType === 'string' ? { mediaType: value.mediaType } : {}),
      };
      return [part];
    }),
  ];
  return parts;
}

function toLegacyThread(thread: ThreadRecord): HarnessThread {
  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    metadata: thread.metadata,
  };
}

function toStoredThread(thread: {
  id: string;
  resourceId: string;
  title?: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}): HarnessThread {
  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title ?? undefined,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    metadata: thread.metadata,
  };
}

function providerFromModelId(modelId: string): string {
  return modelId.split('/')[0] ?? '';
}

function toSystemReminderAttributes(attributes?: Record<string, unknown>): Record<string, string | number | boolean | null | undefined> | undefined {
  if (!attributes) return undefined;
  const normalized: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function toHarnessMessage(message: any): HarnessMessage {
  const parts = Array.isArray(message?.content?.parts) ? message.content.parts : [];
  const signal = message?.content?.metadata?.signal;
  const systemReminder = message?.content?.metadata?.systemReminder;
  const content: HarnessMessage['content'] = [];

  if (systemReminder && typeof systemReminder === 'object') {
    content.push({
      type: 'system_reminder',
      reminderType: typeof systemReminder.type === 'string' ? systemReminder.type : 'system',
      contents: typeof systemReminder.message === 'string' ? systemReminder.message : '',
      metadata: systemReminder,
    } as never);
  } else if (signal?.type === 'system-reminder') {
    content.push({
      type: 'system_reminder',
      reminderType: typeof signal.attributes?.type === 'string' ? signal.attributes.type : 'system',
      contents: typeof signal.contents === 'string' ? signal.contents : normalizeMessageContent({ content: signal.contents ?? [] }),
      attributes: signal.attributes,
      metadata: signal.metadata,
    } as never);
  } else if (signal?.type === 'user-message') {
    content.push({
      type: 'text',
      text: typeof signal.contents === 'string' ? signal.contents : normalizeMessageContent({ content: signal.contents ?? [] }),
    });
  } else {
    for (const part of parts) {
      if (part?.type === 'text' && typeof part.text === 'string') {
        content.push({ type: 'text', text: part.text });
      } else if (part?.type === 'reasoning' && typeof part.reasoning === 'string') {
        content.push({ type: 'thinking', thinking: part.reasoning } as never);
      }
    }
  }

  if (content.length === 0 && typeof message?.content?.content === 'string' && message.content.content.length > 0) {
    content.push({ type: 'text', text: message.content.content });
  }

  return {
    id: String(message.id),
    role: message.role === 'signal' ? 'user' : message.role,
    content,
    createdAt: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt ?? Date.now()),
  };
}

export class MastraCodeHarnessRuntime<TState extends Record<string, unknown>> {
  readonly core: HarnessV1;
  readonly mastra: Mastra;

  private session?: Session;
  private resourceId: string;
  private readonly defaultResourceId: string;
  private readonly modes: LegacyHarnessMode<TState>[];
  private readonly defaultModeId: string;
  private currentModeId: string;
  private state: TState;
  private readonly listeners = new Set<HarnessEventListener>();
  private readonly projector: MastraCodeHarnessEventProjector;
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly heartbeatHandlers = new Map<string, NonNullable<MastraCodeRuntimeConfig<TState>['heartbeatHandlers']>[number]>();
  private currentWorkspace: Awaited<ReturnType<Session['getWorkspace']>> | undefined;
  private followUpCount = 0;
  private currentRunId: string | null = null;
  private currentTraceId: string | null = null;
  private stateUpdateQueue: Promise<void> = Promise.resolve();

  readonly actions = Object.freeze({
    list: (options?: unknown) => this.requireSession().actions.list(options as never),
    search: (query: string, options?: unknown) => this.requireSession().actions.search(query, options as never),
    refresh: () => this.requireSession().actions.refresh(),
  });

  readonly mcp = Object.freeze({
    listServers: () => this.requireSession().mcp.listServers(),
    getServer: (key: string) => this.requireSession().mcp.getServer(key),
    listTools: (key: string) => this.requireSession().mcp.listTools(key),
  });

  constructor(private readonly config: MastraCodeRuntimeConfig<TState>) {
    this.resourceId = config.resourceId;
    this.defaultResourceId = config.resourceId;
    this.modes = config.modes;
    this.defaultModeId = resolveDefaultModeId(config.modes);
    this.currentModeId = this.defaultModeId;
    this.state = { ...config.initialState };
    const harnessV1Agents = toHarnessV1Agents(config.agents, config.modes);

    this.mastra = new Mastra({
      agents: harnessV1Agents,
      storage: config.storage,
      observability: config.observability,
      workers: false,
    });

    this.core = new HarnessV1({
      mastra: this.mastra,
      runtimeCompatibilityGeneration: MASTRACODE_RUNTIME_COMPATIBILITY_GENERATION,
      modes: toHarnessV1Modes(config.modes, harnessV1Agents, this.defaultModeId, config.subagents),
      defaultModeId: this.defaultModeId,
      subagents: { maxDepth: 1, types: toHarnessV1Subagents(config.subagents) },
      toolCategoryResolver: config.toolCategoryResolver,
      models: [],
      modelAuthStatusResolver: modelId => this.resolveHarnessV1AuthStatus(modelId),
      workspace: config.workspace
        ? {
            kind: 'shared',
            workspace: ({ requestContext }) => config.workspace!({ requestContext, mastra: this.mastra }),
          }
        : undefined,
    });

    this.projector = new MastraCodeHarnessEventProjector(
      event => this.emit(event),
      () => this.getDisplayState(),
      async (threadId, resourceId) => {
        const thread = await this.core.threads.get({ threadId, resourceId });
        return thread ? toLegacyThread(thread) : undefined;
      },
    );

    this.core.subscribe(event => {
      void this.handleCoreEvent(event);
    });

    for (const handler of config.heartbeatHandlers ?? []) {
      this.registerHeartbeat(handler);
    }
  }

  getMastra(): Mastra {
    return this.mastra;
  }

  async init(): Promise<void> {
    await this.core.init();
    await this.selectOrCreateThread();
  }

  subscribe(listener: HarnessEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: HarnessEvent): void {
    for (const listener of this.listeners) {
      try {
        void listener(event);
      } catch (error) {
        console.error('MastraCode Harness event listener failed', error);
      }
    }
  }

  private async handleCoreEvent(event: HarnessV1Event): Promise<void> {
    if ('runId' in event && typeof event.runId === 'string') this.currentRunId = event.runId;
    if ('traceId' in event && typeof event.traceId === 'string') this.currentTraceId = event.traceId;
    this.currentTraceId = this.session?.getDisplayState().currentTraceId ?? this.currentTraceId;
    await this.projector.project(event);
  }

  async selectOrCreateThread(): Promise<HarnessThread> {
    const existing = await this.core.threads.list({
      resourceId: this.resourceId,
      perPage: false,
      orderBy: { column: 'updatedAt', direction: 'DESC' },
    });
    const projectPath = typeof this.state.projectPath === 'string' ? this.state.projectPath : undefined;
    const existingThread = projectPath
      ? existing.threads.find(thread => thread.metadata?.projectPath === projectPath)
      : existing.threads[0];
    const thread =
      existingThread ??
      (await this.core.threads.create({
        resourceId: this.resourceId,
        title: 'New thread',
        metadata: this.buildThreadMetadata(),
      }));
    await this.applyThreadMetadata(thread.metadata);
    this.session = await this.core.session({
      resourceId: this.resourceId,
      threadId: thread.id,
      modeId: this.currentModeId,
      modelId: this.resolveModeModel(this.currentModeId),
    });
    await this.ensureSessionState();
    await this.resolveWorkspace().catch(() => undefined);
    return toLegacyThread(thread);
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    const thread = await this.core.threads.create({
      resourceId: this.resourceId,
      title: title ?? 'New thread',
      metadata: this.buildThreadMetadata(),
    });
    await this.applyThreadMetadata(thread.metadata);
    this.session = await this.core.session({
      resourceId: this.resourceId,
      threadId: thread.id,
      modeId: this.currentModeId,
      modelId: this.resolveModeModel(this.currentModeId),
    });
    await this.ensureSessionState();
    await this.resolveWorkspace().catch(() => undefined);
    const legacy = toLegacyThread(thread);
    this.emit({ type: 'thread_created', thread: legacy } as unknown as HarnessEvent);
    return legacy;
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    const previousThreadId = this.session?.threadId ?? null;
    const thread = await this.core.threads.get({ resourceId: this.resourceId, threadId });
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    await this.applyThreadMetadata(thread.metadata);
    this.session = await this.core.session({
      resourceId: this.resourceId,
      threadId,
      modeId: this.currentModeId,
      modelId: this.resolveModeModel(this.currentModeId),
    });
    await this.ensureSessionState();
    await this.resolveWorkspace().catch(() => undefined);
    this.emit({ type: 'thread_changed', threadId, previousThreadId } as unknown as HarnessEvent);
  }

  async cloneThread({
    threadId,
    sourceThreadId,
    title,
    resourceId,
  }: {
    threadId?: string;
    sourceThreadId?: string;
    title?: string;
    resourceId?: string;
  } = {}): Promise<HarnessThread> {
    const sourceId = sourceThreadId ?? threadId ?? this.requireSession().threadId;
    const cloned = await this.core.threads.clone({
      resourceId: resourceId ?? this.resourceId,
      threadId: sourceId,
      title,
    });
    if (cloned.resourceId !== this.resourceId) {
      this.resourceId = cloned.resourceId;
    }
    await this.switchThread({ threadId: cloned.id });
    const legacy = toLegacyThread(cloned);
    this.emit({ type: 'thread_created', thread: legacy } as unknown as HarnessEvent);
    return legacy;
  }

  async renameThread({ title }: { title: string }): Promise<void> {
    const session = this.requireSession();
    await this.core.threads.rename({ resourceId: this.resourceId, threadId: session.threadId, title });
  }

  async listThreads(options?: { allResources?: boolean; includeForkedSubagents?: boolean }): Promise<HarnessThread[]> {
    if (options?.allResources) {
      const memory = await this.getMemoryStorage();
      const result = await memory.listThreads({
        filter: undefined,
        perPage: false,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });
      return result.threads
        .filter((thread: any) => options.includeForkedSubagents || thread.metadata?.forkedSubagent !== true)
        .map(toStoredThread);
    }

    const result = await this.core.threads.list({ resourceId: this.resourceId, perPage: false });
    return result.threads
      .filter(thread => options?.includeForkedSubagents || thread.metadata?.forkedSubagent !== true)
      .map(toLegacyThread)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async setThreadSetting({ key, value }: { key: string; value: unknown }): Promise<void> {
    const session = this.requireSession();
    await this.core.threads.setSettings({
      resourceId: this.resourceId,
      threadId: session.threadId,
      patch: { [key]: value },
    });
  }

  getCurrentThreadId(): string | null {
    return this.session?.threadId ?? null;
  }

  getResourceId(): string {
    return this.resourceId;
  }

  setResourceId({ resourceId }: { resourceId: string }): void {
    this.resourceId = resourceId;
    this.session = undefined;
    this.currentWorkspace = undefined;
  }

  getDefaultResourceId(): string {
    return this.defaultResourceId;
  }

  async getKnownResourceIds(): Promise<string[]> {
    const ids = new Set((await this.listThreads({ allResources: true, includeForkedSubagents: true })).map(thread => thread.resourceId));
    ids.add(this.defaultResourceId);
    ids.add(this.resourceId);
    return [...ids].sort();
  }

  getState(): Readonly<TState> {
    return this.state;
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const nextUpdate = this.stateUpdateQueue.then(async () => {
      this.state = { ...this.state, ...updates };
      if (this.session) {
        await this.session.setState(this.state);
      }
      this.emit({ type: 'state_changed', state: this.state, changedKeys: Object.keys(updates) } as unknown as HarnessEvent);
    });
    this.stateUpdateQueue = nextUpdate.catch(error => {
      console.error('MastraCode Harness state update failed', error);
    });
    return nextUpdate;
  }

  listModes(): LegacyHarnessMode<TState>[] {
    return this.modes;
  }

  getCurrentModeId(): string {
    return this.currentModeId;
  }

  getCurrentMode(): LegacyHarnessMode<TState> {
    const mode = this.modes.find(entry => entry.id === this.currentModeId);
    if (mode) return mode;
    const fallback = this.modes[0];
    if (!fallback) {
      throw new Error('No modes configured for MastraCode Harness runtime');
    }
    return fallback;
  }

  async switchMode({ modeId }: { modeId: string }): Promise<void> {
    const previousModeId = this.currentModeId;
    const currentModelId = this.getCurrentModelId();
    if (currentModelId) {
      await this.setThreadSetting({ key: `modeModelId_${this.currentModeId}`, value: currentModelId });
    }
    this.currentModeId = modeId;
    const session = this.requireSession();
    await session.switchMode({ mode: modeId });
    await this.setThreadSetting({ key: 'currentModeId', value: modeId });
    await this.switchModel({ modelId: await this.loadModeModelId(modeId), modeId });
    this.emit({ type: 'mode_changed', modeId, previousModeId } as unknown as HarnessEvent);
  }

  getCurrentModelId(): string {
    return typeof this.state.currentModelId === 'string' ? this.state.currentModelId : '';
  }

  getModelName(): string {
    const modelId = this.getCurrentModelId();
    return modelId.split('/').pop() || modelId || 'unknown';
  }

  getFullModelId(): string {
    return this.getCurrentModelId();
  }

  hasModelSelected(): boolean {
    return this.getCurrentModelId().length > 0;
  }

  async switchModel({ modelId, scope = 'thread', modeId }: { modelId: string; scope?: 'global' | 'thread'; modeId?: string }): Promise<void> {
    const targetModeId = modeId ?? this.currentModeId;
    if (targetModeId === this.currentModeId) {
      await this.setState({ currentModelId: modelId } as unknown as Partial<TState>);
      await this.requireSession().models.switch({ model: modelId });
    }
    if (scope === 'thread') {
      await this.setThreadSetting({ key: `modeModelId_${targetModeId}`, value: modelId });
    }
    await Promise.resolve(this.config.modelUseCountTracker?.(modelId)).catch(error => {
      console.error('Failed to persist model usage count', error);
    });
    this.emit({ type: 'model_changed', modelId, scope, modeId: targetModeId } as unknown as HarnessEvent);
  }

  async listAvailableModels(): Promise<AvailableModel[]> {
    const registry = PROVIDER_REGISTRY as Record<string, { models?: string[]; name?: string; apiKeyEnvVar?: string | string[] }>;
    const useCounts = this.config.modelUseCountProvider?.() ?? {};
    const modelsById = new Map<string, AvailableModel>();
    const upsert = (model: Omit<AvailableModel, 'useCount'>) => {
      if (!model.id || !model.provider || !model.modelName) return;
      modelsById.set(model.id, { ...model, useCount: useCounts[model.id] ?? 0 });
    };

    for (const [provider, providerConfig] of Object.entries(registry)) {
      const envVars = providerConfig.apiKeyEnvVar;
      const apiKeyEnvVar = Array.isArray(envVars) ? envVars[0] : envVars;
      let hasApiKey = apiKeyEnvVar ? Boolean(process.env[apiKeyEnvVar]) : false;
      const customAuth = this.config.modelAuthChecker?.(provider);
      if (customAuth === true) hasApiKey = true;
      if (customAuth === false) hasApiKey = false;
      for (const modelName of providerConfig.models ?? []) {
        upsert({ id: `${provider}/${modelName}`, provider, modelName, hasApiKey, apiKeyEnvVar });
      }
    }

    for (const customModel of (await Promise.resolve(this.config.customModelCatalogProvider?.()).catch(() => [])) ?? []) {
      upsert(customModel);
    }

    return [...modelsById.values()];
  }

  async getCurrentModelAuthStatus(): Promise<ModelAuthStatus> {
    const modelId = this.getCurrentModelId();
    const model = (await this.listAvailableModels()).find(entry => entry.id === modelId);
    if (model) return model.hasApiKey ? { hasAuth: true } : { hasAuth: false, apiKeyEnvVar: model.apiKeyEnvVar };
    const provider = providerFromModelId(modelId);
    const customAuth = provider ? this.config.modelAuthChecker?.(provider) : true;
    if (customAuth === true || customAuth === undefined) return { hasAuth: true };
    return { hasAuth: false };
  }

  getSubagentModelId({ agentType }: { agentType?: string } = {}): string | null {
    if (!agentType) return (this.state.subagentModelId as string | undefined) ?? null;
    return (this.state[`subagentModelId_${agentType}`] as string | undefined) ?? this.requireSession().models.getSubagent({ agentType });
  }

  async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }): Promise<void> {
    const key = agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
    if (agentType) {
      await this.requireSession().models.setSubagent({ agentType, model: modelId });
    }
    await this.setState({ [key]: modelId } as unknown as Partial<TState>);
    await this.setThreadSetting({ key, value: modelId });
    this.emit({ type: 'subagent_model_changed', modelId, scope: 'thread', agentType } as unknown as HarnessEvent);
  }

  getObserverModelId(): string | undefined {
    return getOMModelState(this.state).observerModelId;
  }

  getReflectorModelId(): string | undefined {
    return getOMModelState(this.state).reflectorModelId;
  }

  getObservationThreshold(): number | undefined {
    return getOMModelState(this.state).observationThreshold;
  }

  getReflectionThreshold(): number | undefined {
    return getOMModelState(this.state).reflectionThreshold;
  }

  async switchObserverModel({ modelId }: { modelId: string }): Promise<void> {
    await this.setState({ observerModelId: modelId } as unknown as Partial<TState>);
    await this.setThreadSetting({ key: 'observerModelId', value: modelId });
    this.emit({ type: 'om_model_changed', role: 'observer', modelId } as unknown as HarnessEvent);
  }

  async switchReflectorModel({ modelId }: { modelId: string }): Promise<void> {
    await this.setState({ reflectorModelId: modelId } as unknown as Partial<TState>);
    await this.setThreadSetting({ key: 'reflectorModelId', value: modelId });
    this.emit({ type: 'om_model_changed', role: 'reflector', modelId } as unknown as HarnessEvent);
  }

  setPermissionForCategory({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }): void {
    void this.requireSession()
      .permissions.setPolicy({ category, policy })
      .catch(error => this.emitError(error));
  }

  setPermissionForTool({ toolName, policy }: { toolName: string; policy: PermissionPolicy }): void {
    void this.requireSession()
      .permissions.setPolicy({ toolName, policy })
      .catch(error => this.emitError(error));
  }

  grantSessionCategory({ category }: { category: ToolCategory }): void {
    void this.requireSession()
      .permissions.grantCategory({ category })
      .catch(error => this.emitError(error));
  }

  grantSessionTool({ toolName }: { toolName: string }): void {
    void this.requireSession()
      .permissions.grantTool({ toolName })
      .catch(error => this.emitError(error));
  }

  getSessionGrants() {
    return this.requireSession().permissions.getGrants();
  }

  getPermissionRules() {
    return this.requireSession().permissions.getRules();
  }

  getToolCategory({ toolName }: { toolName: string }): ToolCategory | null {
    return this.config.toolCategoryResolver?.(toolName) ?? null;
  }

  sendSignal(input: SignalInput): SignalHandle {
    const session = this.requireSession();
    if ('type' in input && input.type === 'system-reminder') {
      const handle: SignalHandle = { id: `signal-${randomUUID()}`, accepted: Promise.resolve() };
      handle.accepted = session
        .injectSystemReminder(normalizeMessageContent({ content: input.contents }), {
          attributes: toSystemReminderAttributes(input.attributes),
          metadata: input.metadata,
        })
        .then(result => {
          handle.id = result.id;
        });
      return handle;
    }

    const handle: SignalHandle = { id: `signal-${randomUUID()}`, accepted: Promise.resolve() };
    handle.accepted = session.signal({
      content: signalContents(input) as never,
      signalId: handle.id,
      ...('content' in input && input.ifActive ? { ifActive: input.ifActive } : {}),
      ...('content' in input && input.ifIdle ? { ifIdle: input.ifIdle } : {}),
    } as never).then(result => {
      handle.id = result.id;
    });
    return handle;
  }

  async sendMessage({ content, files, admissionId }: { content: string; files?: unknown[]; admissionId?: string }): Promise<void> {
    const session = this.requireSession();
    await this.ensureSessionState();
    await session.message({ content: messageContents(content, files), ...(admissionId ? { admissionId } : {}) } as never);
  }

  async listMessages(options?: { limit?: number }): Promise<HarnessMessage[]> {
    return this.requireSession().listMessages(options);
  }

  async listMessagesForThread({ threadId, limit }: { threadId: string; limit?: number }): Promise<HarnessMessage[]> {
    const memory = await this.getMemoryStorage();
    if (limit) {
      const result = await memory.listMessages({
        threadId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages.map(toHarnessMessage).reverse();
    }
    const result = await memory.listMessages({ threadId, perPage: false });
    return result.messages.map(toHarnessMessage);
  }

  async getFirstUserMessagesForThreads({ threadIds }: { threadIds: string[] }): Promise<Map<string, HarnessMessage>> {
    if (threadIds.length === 0) return new Map();
    const memory = await this.getMemoryStorage();
    const result = await memory.listMessages({
      threadId: threadIds,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    const messages = new Map<string, HarnessMessage>();
    for (const message of result.messages) {
      if (message.role !== 'user' && message.role !== 'signal') continue;
      if (!message.threadId || messages.has(message.threadId)) continue;
      messages.set(message.threadId, toHarnessMessage(message));
      if (messages.size === threadIds.length) break;
    }
    return messages;
  }

  async getFirstUserMessageForThread({ threadId }: { threadId: string }): Promise<HarnessMessage | null> {
    return (await this.getFirstUserMessagesForThreads({ threadIds: [threadId] })).get(threadId) ?? null;
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
    const threadId = this.getCurrentThreadId();
    if (!threadId) return null;
    const memory = await this.getMemoryStorage();
    const dbMessage = {
      id: randomUUID(),
      role,
      threadId,
      resourceId: this.resourceId,
      createdAt: new Date(),
      content: {
        format: 2 as const,
        parts: [],
        content: '',
        metadata: {
          systemReminder: {
            type: reminderType,
            message,
            ...metadata,
          },
        },
      },
    };
    const result = await memory.saveMessages({ messages: [dbMessage] });
    return toHarnessMessage(result.messages[0] ?? dbMessage);
  }

  abort(): void {
    this.session?.abort({ reason: 'aborted' });
  }

  async steer({ content }: { content: string; requestContext?: RequestContext }): Promise<void> {
    this.abort();
    this.followUpCount = 0;
    await this.sendMessage({ content });
  }

  async followUp({ content }: { content: string; requestContext?: RequestContext }): Promise<void> {
    if (!this.isRunning()) {
      await this.sendMessage({ content });
      return;
    }
    this.followUpCount++;
    this.emit({ type: 'follow_up_queued', count: this.followUpCount } as unknown as HarnessEvent);
    void this.requireSession()
      .queue({ content } as never)
      .catch(error => this.emitError(error))
      .finally(() => {
        this.followUpCount = Math.max(0, this.followUpCount - 1);
      });
  }

  isRunning(): boolean {
    return this.session?.isRunning() ?? false;
  }

  isCurrentThreadStreamActive(): boolean {
    return this.isRunning();
  }

  getFollowUpCount(): number {
    return this.followUpCount;
  }

  getCurrentRunId(): string | null {
    return this.currentRunId;
  }

  getCurrentTraceId(): string | null {
    return this.currentTraceId;
  }

  getDisplayState(): Readonly<HarnessDisplayState> {
    const sessionState = this.session?.getDisplayState();
    return {
      ...defaultDisplayState,
      ...emptyOMProgress(),
      ...(sessionState ?? {}),
      isRunning: this.isRunning(),
      currentModelId: this.getCurrentModelId(),
      currentModeId: this.currentModeId,
      currentThreadId: this.getCurrentThreadId(),
      resourceId: this.resourceId,
      state: this.state,
    } as unknown as HarnessDisplayState;
  }

  async loadOMProgress(): Promise<void> {
    const threadId = this.getCurrentThreadId();
    if (!threadId) return;

    try {
      const memory = await this.getMemoryStorage();
      const record = await memory.getObservationalMemory?.(threadId, this.resourceId);
      if (!record) return;

      const config = record.config as
        | {
            observationThreshold?: number | { min: number; max: number };
            reflectionThreshold?: number | { min: number; max: number };
          }
        | undefined;
      const threshold = (value: number | { min: number; max: number } | undefined, fallback: number) =>
        typeof value === 'number' ? value : (value?.max ?? fallback);

      let messageTokens = record.pendingMessageTokens ?? 0;
      let observationTokens = record.observationTokenCount ?? 0;
      let observationThreshold = threshold(config?.observationThreshold, this.getObservationThreshold() ?? 30_000);
      let reflectionThreshold = threshold(config?.reflectionThreshold, this.getReflectionThreshold() ?? 40_000);
      let bufferedObs = emptyOMProgress().buffered!.observations;
      let bufferedRef = emptyOMProgress().buffered!.reflection;
      let generationCount = 0;
      let stepNumber = 0;

      const messages = await memory.listMessages({
        threadId,
        perPage: 70,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      for (const message of messages.messages) {
        if (message.role !== 'assistant') continue;
        const parts = Array.isArray(message.content?.parts) ? message.content.parts : [];
        const status = [...parts].reverse().find((part: any) => part?.type === 'data-om-status' && part.data?.windows) as
          | { data?: any }
          | undefined;
        if (!status?.data?.windows) continue;
        const windows = status.data.windows;
        messageTokens = windows.active?.messages?.tokens ?? messageTokens;
        observationTokens = windows.active?.observations?.tokens ?? observationTokens;
        observationThreshold = windows.active?.messages?.threshold ?? observationThreshold;
        reflectionThreshold = windows.active?.observations?.threshold ?? reflectionThreshold;
        bufferedObs = { ...bufferedObs, ...(windows.buffered?.observations ?? {}) };
        bufferedRef = { ...bufferedRef, ...(windows.buffered?.reflection ?? {}) };
        generationCount = status.data.generationCount ?? generationCount;
        stepNumber = status.data.stepNumber ?? stepNumber;
        break;
      }

      this.emit({
        type: 'om_status',
        windows: {
          active: {
            messages: { tokens: messageTokens, threshold: observationThreshold },
            observations: { tokens: observationTokens, threshold: reflectionThreshold },
          },
          buffered: { observations: bufferedObs, reflection: bufferedRef },
        },
        recordId: record.id ?? '',
        threadId,
        stepNumber,
        generationCount,
      } as unknown as HarnessEvent);
    } catch {
      // OM is optional; missing storage support should not break startup.
    }

    this.emit({ type: 'display_state_changed', displayState: this.getDisplayState() } as unknown as HarnessEvent);
  }

  async getObservationalMemoryRecord(): Promise<unknown | null> {
    const threadId = this.getCurrentThreadId();
    if (!threadId) return null;
    try {
      const memory = await this.getMemoryStorage();
      return (await memory.getObservationalMemory?.(threadId, this.resourceId)) ?? null;
    } catch {
      return null;
    }
  }

  respondToQuestion({ answer }: { questionId?: string; answer: unknown }): void {
    void this.requireSession().respondToQuestion({ answer }).catch(error => this.emitError(error));
  }

  respondToToolApproval({ decision, approved, reason }: { decision?: 'approve' | 'decline' | 'deny' | 'always_allow_category'; approved?: boolean; reason?: string }): void {
    if (decision === 'always_allow_category') {
      const pending = this.requireSession().getDisplayState().pending as { toolName?: string } | undefined;
      const category = pending?.toolName ? this.getToolCategory({ toolName: pending.toolName }) : null;
      if (category) {
        this.grantSessionCategory({ category });
      }
    }
    void this.requireSession()
      .respondToToolApproval({ approved: approved ?? (decision === 'approve' || decision === 'always_allow_category'), reason })
      .catch(error => this.emitError(error));
  }

  async respondToPlanApproval({ response, approved, revision }: { planId?: string; response?: { action?: string; feedback?: string }; approved?: boolean; revision?: string }): Promise<void> {
    const accepted = approved ?? response?.action !== 'rejected';
    await this.requireSession().respondToPlanApproval({
      approved: accepted,
      revision: revision ?? response?.feedback,
    });
  }

  getWorkspace() {
    return this.currentWorkspace;
  }

  async destroyWorkspace(): Promise<void> {
    const workspace = this.currentWorkspace as { destroy?: () => Promise<void> | void } | undefined;
    if (!workspace?.destroy) {
      this.currentWorkspace = undefined;
      return;
    }
    try {
      this.emit({ type: 'workspace_status_changed', status: 'destroying' } as unknown as HarnessEvent);
      await workspace.destroy();
      this.emit({ type: 'workspace_status_changed', status: 'destroyed' } as unknown as HarnessEvent);
    } finally {
      this.currentWorkspace = undefined;
    }
  }

  getResolvedObserverModel(): unknown {
    const modelId = this.getObserverModelId();
    return modelId && this.config.resolveModel ? this.config.resolveModel(modelId) : undefined;
  }

  getResolvedReflectorModel(): unknown {
    const modelId = this.getReflectorModelId();
    return modelId && this.config.resolveModel ? this.config.resolveModel(modelId) : undefined;
  }

  async getResolvedMemory() {
    if (!this.config.memory) return null;
    if (typeof this.config.memory !== 'function') return this.config.memory;
    const requestContext = new RequestContext([
      [
        'harness',
        {
          harnessId: 'mastra-code',
          threadId: this.getCurrentThreadId(),
          resourceId: this.resourceId,
          modeId: this.currentModeId,
          state: this.state,
          getState: () => this.state,
        },
      ],
    ]) as RequestContext<unknown>;
    return this.config.memory({ requestContext, mastra: this.mastra });
  }

  async resolveWorkspace() {
    this.currentWorkspace = await this.session?.getWorkspace();
    return this.currentWorkspace;
  }

  hasWorkspace(): boolean {
    return Boolean(this.config.workspace);
  }

  isWorkspaceReady(): boolean {
    return Boolean(this.config.workspace);
  }

  setBrowser(_browser: unknown): void {
    this.emit({ type: 'info', message: 'Browser runtime is configured through MastraCode state under Harness v1.' } as unknown as HarnessEvent);
  }

  registerHeartbeat(handler: NonNullable<MastraCodeRuntimeConfig<TState>['heartbeatHandlers']>[number]): void {
    if (this.heartbeatTimers.has(handler.id)) return;
    this.heartbeatHandlers.set(handler.id, handler);
    const run = () => {
      void Promise.resolve(handler.handler()).catch(error => console.error(`Heartbeat ${handler.id} failed`, error));
    };
    if (handler.immediate !== false) run();
    this.heartbeatTimers.set(handler.id, setInterval(run, handler.intervalMs));
  }

  async removeHeartbeat({ id }: { id: string }): Promise<void> {
    const timer = this.heartbeatTimers.get(id);
    if (timer) clearInterval(timer);
    this.heartbeatTimers.delete(id);
    const handler = this.heartbeatHandlers.get(id);
    this.heartbeatHandlers.delete(id);
    await Promise.resolve(handler?.shutdown?.());
  }

  async stopHeartbeats(): Promise<void> {
    await Promise.all([...this.heartbeatHandlers.keys()].map(id => this.removeHeartbeat({ id })));
  }

  async destroy(): Promise<void> {
    await this.destroyWorkspace();
    await this.stopHeartbeats();
    await this.core.shutdown();
  }

  async getSession(): Promise<HarnessSession> {
    return {
      currentThreadId: this.getCurrentThreadId(),
      currentModeId: this.currentModeId,
      threads: await this.listThreads(),
    };
  }

  private requireSession(): Session {
    if (!this.session) {
      throw new Error('MastraCode Harness session has not been initialized');
    }
    return this.session;
  }

  private resolveModeModel(modeId: string): string {
    const mode = this.modes.find(entry => entry.id === modeId) ?? this.modes[0];
    return mode?.defaultModelId ?? this.getCurrentModelId();
  }

  private buildThreadMetadata(): Record<string, unknown> | undefined {
    const metadata: Record<string, unknown> = {};
    const modelId = this.getCurrentModelId() || this.resolveModeModel(this.currentModeId);
    if (modelId) {
      metadata.currentModelId = modelId;
      metadata[`modeModelId_${this.currentModeId}`] = modelId;
    }
    metadata.currentModeId = this.currentModeId;

    const projectPath = this.state.projectPath;
    if (typeof projectPath === 'string' && projectPath.length > 0) {
      metadata.projectPath = projectPath;
    }
    for (const key of [
      'observerModelId',
      'reflectorModelId',
      'observationThreshold',
      'reflectionThreshold',
      'subagentModelId',
      'cavemanObservations',
    ]) {
      if (this.state[key] !== undefined) metadata[key] = this.state[key];
    }
    for (const [key, value] of Object.entries(this.state)) {
      if (key.startsWith('subagentModelId_') && value !== undefined) {
        metadata[key] = value;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private async applyThreadMetadata(metadata?: Record<string, unknown>): Promise<void> {
    if (!metadata) {
      await this.applyModeModelFallback();
      return;
    }

    const updates: Record<string, unknown> = {};
    const savedModeId = typeof metadata.currentModeId === 'string' ? metadata.currentModeId : undefined;
    if (savedModeId && this.modes.some(mode => mode.id === savedModeId)) {
      this.currentModeId = savedModeId;
    }

    const modeModelKey = `modeModelId_${this.currentModeId}`;
    if (typeof metadata[modeModelKey] === 'string') {
      updates.currentModelId = metadata[modeModelKey];
    } else if (typeof metadata.currentModelId === 'string') {
      updates.currentModelId = metadata.currentModelId;
    } else {
      const fallback = this.resolveModeModel(this.currentModeId);
      if (fallback) updates.currentModelId = fallback;
    }

    for (const key of ['observerModelId', 'reflectorModelId', 'observationThreshold', 'reflectionThreshold', 'subagentModelId']) {
      if (metadata[key] !== undefined) updates[key] = metadata[key];
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (key.startsWith('subagentModelId_') && typeof value === 'string') {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.setState(updates as Partial<TState>);
    }
  }

  private async applyModeModelFallback(): Promise<void> {
    const fallback = this.resolveModeModel(this.currentModeId);
    if (fallback) {
      await this.setState({ currentModelId: fallback } as unknown as Partial<TState>);
    }
  }

  private async loadModeModelId(modeId: string): Promise<string> {
    const session = this.requireSession();
    const thread = await this.core.threads.get({ resourceId: this.resourceId, threadId: session.threadId });
    const stored = thread?.metadata?.[`modeModelId_${modeId}`];
    return typeof stored === 'string' ? stored : this.resolveModeModel(modeId);
  }

  private async getMemoryStorage() {
    const memory = await this.config.storage.getStore('memory');
    if (!memory) {
      throw new Error('Memory storage is not configured for MastraCode Harness v1 runtime');
    }
    return memory;
  }

  private async ensureSessionState(): Promise<void> {
    const session = this.requireSession();
    const selectedModel = this.getCurrentModelId() || session.models.current() || this.resolveModeModel(this.currentModeId);
    this.state = { ...this.state, currentModelId: selectedModel };
    await session.models.switch({ model: selectedModel });
    await session.setState(this.state);
  }

  private async resolveHarnessV1AuthStatus(modelId: string) {
    const model = (await this.listAvailableModels()).find(entry => entry.id === modelId);
    if (model) return toHarnessV1AuthStatus(model.hasApiKey);
    const provider = providerFromModelId(modelId);
    return toHarnessV1AuthStatus(provider ? this.config.modelAuthChecker?.(provider) : undefined);
  }

  async refreshModelCatalog(): Promise<MastraCodeModelInfo[]> {
    return (await this.listAvailableModels()).map(toModelInfo);
  }

  private emitError(error: unknown): void {
    this.emit({
      type: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
      message: error instanceof Error ? error.message : String(error),
    } as unknown as HarnessEvent);
  }
}
