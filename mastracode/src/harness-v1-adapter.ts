import { randomUUID } from 'node:crypto';

import { HarnessLegacy } from '@mastra/core/harness';
import type {
  AvailableModel,
  HarnessConfig,
  HarnessDisplayState,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMode,
  HarnessQuestionAnswer,
  HarnessThread,
  HeartbeatHandler,
  ModelAuthStatus,
  PermissionPolicy,
  PermissionRules,
  TokenUsage,
  ToolCategory,
} from '@mastra/core/harness';
import {
  createEmptyTokenUsage,
  defaultDisplayState,
  defaultOMProgressState,
  taskCompleteTool,
  taskUpdateTool,
} from '@mastra/core/harness';
import {
  Harness as HarnessV1,
  askUserTool,
  createSpawnSubagentTool,
  submitPlanTool,
  taskCheckTool,
  taskWriteTool,
} from '@mastra/core/harness/v1';
import type {
  HarnessEvent as HarnessV1Event,
  HarnessWorkspaceConfig,
  Session,
  SubagentDefinition,
} from '@mastra/core/harness/v1';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { z } from 'zod';

import { MC_TOOLS } from './tool-names.js';

type MastraCodeSignalContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'file'; data: string; mediaType: string; filename?: string }>;

type AgentLike = {
  id?: string;
  __setMemory?: (memory: unknown) => void;
  __setPubSub?: (pubsub: unknown) => void;
  __setWorkspace?: (workspace: unknown) => void;
  setBrowser?: (browser: unknown) => void;
  hasOwnMemory?: () => boolean;
  hasOwnPubSub?: () => boolean;
  hasOwnWorkspace?: () => boolean;
  hasOwnBrowser?: () => boolean;
};

type SignalLike = {
  id: string;
  type: string;
  accepted: Promise<{ accepted: true; runId: string }>;
};

type ThreadLock = NonNullable<HarnessConfig['threadLock']>;

function providerFromModelId(modelId: string): string {
  return modelId.split('/')[0] ?? '';
}

function modelNameFromModelId(modelId: string): string {
  return modelId.split('/').slice(1).join('/') || modelId;
}

function toLegacyThread(thread: {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}): HarnessThread {
  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title ?? '',
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    metadata: thread.metadata,
  };
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const rec = part as Record<string, unknown>;
        if (rec.type === 'text' && typeof rec.text === 'string') return rec.text;
        if (rec.type === 'file' && typeof rec.filename === 'string') return `[File: ${rec.filename}]`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function contentWithFiles(
  content: string,
  files?: Array<{ data: string; mediaType: string; filename?: string }>,
): MastraCodeSignalContent {
  if (!files?.length) return content;
  return [
    { type: 'text', text: content },
    ...files.map(file => {
      const isText = file.mediaType.startsWith('text/') || file.mediaType === 'application/json';
      if (isText) {
        let textContent = file.data;
        const base64Match = file.data.match(/^data:[^;]*;base64,(.*)$/);
        if (base64Match) {
          try {
            textContent = Buffer.from(base64Match[1]!, 'base64').toString('utf-8');
          } catch {
            // Fall through with raw data.
          }
        }
        const label = file.filename ? `[File: ${file.filename}]` : '[Attached file]';
        return { type: 'text' as const, text: `${label}\n\`\`\`\n${textContent}\n\`\`\`` };
      }
      return {
        type: 'file' as const,
        data: file.data,
        mediaType: file.mediaType,
        ...(file.filename ? { filename: file.filename } : {}),
      };
    }),
  ];
}

function addUsage(a: TokenUsage, b: Partial<TokenUsage>): TokenUsage {
  return {
    promptTokens: a.promptTokens + (b.promptTokens ?? 0),
    completionTokens: a.completionTokens + (b.completionTokens ?? 0),
    totalTokens: a.totalTokens + (b.totalTokens ?? 0),
    cachedInputTokens: (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0),
    cacheCreationInputTokens: (a.cacheCreationInputTokens ?? 0) + (b.cacheCreationInputTokens ?? 0),
    ...(a.reasoningTokens || b.reasoningTokens
      ? { reasoningTokens: (a.reasoningTokens ?? 0) + (b.reasoningTokens ?? 0) }
      : {}),
  };
}

export class MastraCodeHarnessV1<
  TState extends Record<string, unknown> = Record<string, unknown>,
> extends HarnessLegacy<TState> {
  readonly v1: HarnessV1;

  private readonly configCompat: HarnessConfig<TState>;
  private readonly compatListeners: HarnessEventListener[] = [];
  private readonly displayListeners = new Set<(displayState: HarnessDisplayState) => void | Promise<void>>();
  private readonly compatV1ModesById = new Map<string, any>();
  private readonly compatModeAgentIds = new Map<string, string>();
  private readonly compatHeartbeatTimers = new Map<
    string,
    { timer: NodeJS.Timeout; shutdown?: () => void | Promise<void> }
  >();
  private readonly messageAccumulators = new Map<string, HarnessMessage>();
  private readonly compatStateSchema?: z.ZodType<TState>;
  private session?: Session;
  private sessionUnsubscribe?: () => void;
  private compatState: TState;
  private modeId: string;
  private compatResourceId: string;
  private compatDefaultResourceId: string;
  private compatCurrentThreadId: string | null = null;
  private compatTokenUsage: TokenUsage = createEmptyTokenUsage();
  private compatDisplayState: HarnessDisplayState = defaultDisplayState();
  private compatFollowUpQueue: Array<{ content: string; requestContext?: RequestContext }> = [];
  private compatWorkspace: Workspace | undefined;
  private compatBrowser: unknown;

  constructor(config: HarnessConfig<TState>) {
    super(config);
    this.configCompat = config;
    this.compatState = super.getState() as TState;
    this.compatStateSchema = config.stateSchema as z.ZodType<TState> | undefined;
    const defaultMode = config.modes.find(mode => mode.default) ?? config.modes[0];
    if (!defaultMode) throw new Error('MastraCodeHarnessV1 requires at least one mode');
    if (typeof this.compatState.currentModelId !== 'string' && defaultMode.defaultModelId) {
      this.compatState = { ...this.compatState, currentModelId: defaultMode.defaultModelId } as TState;
    }
    this.modeId = defaultMode.id;
    this.compatResourceId = config.resourceId ?? config.id;
    this.compatDefaultResourceId = this.compatResourceId;
    this.compatBrowser = config.browser && typeof config.browser !== 'function' ? config.browser : undefined;

    const { agents, modes } = this.buildV1Modes();
    const mastraApp = new Mastra({
      agents,
      ...(config.storage ? { storage: config.storage } : {}),
      ...(config.pubsub ? { pubsub: config.pubsub } : {}),
      ...(config.observability ? { observability: config.observability } : {}),
    } as never);
    this.v1 = new HarnessV1({
      mastra: mastraApp,
      modes,
      defaultModeId: this.modeId,
      subagents: this.buildV1Subagents(),
      defaultPermissionPolicy: 'ask',
      toolCategoryResolver: config.toolCategoryResolver,
      workspace: this.buildV1Workspace(),
      modelAuthStatusResolver: modelId => this.toV1AuthStatus(modelId),
    });
  }

  getMastra(): Mastra | undefined {
    try {
      return this.v1.mastra;
    } catch {
      return undefined;
    }
  }

  async init(): Promise<void> {
    await this.configCompat.storage?.init?.();
    this.compatStartHeartbeats();
  }

  listModes(): HarnessMode<TState>[] {
    return this.configCompat.modes;
  }

  getCurrentModeId(): string {
    return this.modeId;
  }

  getCurrentMode(): HarnessMode<TState> {
    const mode = this.configCompat.modes.find(item => item.id === this.modeId);
    if (!mode) throw new Error(`Mode not found: ${this.modeId}`);
    return mode;
  }

  getState(): Readonly<TState> {
    return { ...this.compatState };
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const next = { ...this.compatState, ...updates } as TState;
    this.compatState = this.compatStateSchema ? await this.compatStateSchema.parseAsync(next) : next;
    await this.session?.setState(this.compatState as Record<string, unknown>);
    this.compatEmit({
      type: 'state_changed',
      state: this.compatState,
      changedKeys: Object.keys(updates),
    } as HarnessEvent);
  }

  async switchMode({ modeId }: { modeId: string }): Promise<void> {
    const mode = this.configCompat.modes.find(item => item.id === modeId);
    if (!mode) throw new Error(`Mode not found: ${modeId}`);
    this.abort();
    const previousModeId = this.modeId;
    const currentModelId = this.getCurrentModelId();
    if (currentModelId) {
      await this.setThreadSetting({ key: `modeModelId_${this.modeId}`, value: currentModelId });
    }
    this.modeId = modeId;
    await this.session?.switchMode({ mode: modeId });
    await this.refreshRuntimeForCurrentMode();
    await this.setThreadSetting({ key: 'currentModeId', value: modeId });
    const modeModelId = await this.compatLoadModeModelId(modeId);
    if (modeModelId) {
      await this.setState({ currentModelId: modeModelId } as unknown as Partial<TState>);
      this.compatEmit({ type: 'model_changed', modelId: modeModelId } as HarnessEvent);
      await this.session?.models.switch({ model: modeModelId });
    }
    this.compatEmit({ type: 'mode_changed', modeId, previousModeId });
  }

  async switchModel({
    modelId,
    scope = 'thread',
    modeId,
  }: {
    modelId: string;
    scope?: 'global' | 'thread';
    modeId?: string;
  }): Promise<void> {
    const targetModeId = modeId ?? this.modeId;
    if (targetModeId === this.modeId) {
      await this.setState({ currentModelId: modelId } as unknown as Partial<TState>);
      await this.session?.models.switch({ model: modelId });
    }
    if (scope === 'thread') {
      await this.setThreadSetting({ key: `modeModelId_${targetModeId}`, value: modelId });
    }
    try {
      await Promise.resolve(this.configCompat.modelUseCountTracker?.(modelId));
    } catch (error) {
      console.error('Failed to persist model usage count', error);
    }
    this.compatEmit({ type: 'model_changed', modelId, scope, modeId: targetModeId } as HarnessEvent);
  }

  getCurrentModelId(): string {
    return typeof this.compatState.currentModelId === 'string' ? this.compatState.currentModelId : '';
  }

  hasModelSelected(): boolean {
    return this.getCurrentModelId() !== '';
  }

  getModelName(): string {
    return modelNameFromModelId(this.getCurrentModelId()) || 'unknown';
  }

  getFullModelId(): string {
    return this.getCurrentModelId();
  }

  async getCurrentModelAuthStatus(): Promise<ModelAuthStatus> {
    const modelId = this.getCurrentModelId();
    const model = (await this.listAvailableModels()).find(item => item.id === modelId);
    if (model?.hasApiKey) return { hasAuth: true };
    if (model) return { hasAuth: false, apiKeyEnvVar: model.apiKeyEnvVar };
    const provider = providerFromModelId(modelId);
    const checked = provider ? this.configCompat.modelAuthChecker?.(provider) : true;
    if (checked === true) return { hasAuth: true };
    return { hasAuth: false, apiKeyEnvVar: await this.compatGetProviderApiKeyEnvVar(provider) };
  }

  async listAvailableModels(): Promise<AvailableModel[]> {
    const registry = PROVIDER_REGISTRY as Record<string, { models?: string[]; apiKeyEnvVar?: string | string[] }>;
    const useCounts = this.configCompat.modelUseCountProvider?.() ?? {};
    const models = new Map<string, AvailableModel>();
    const upsert = (model: Omit<AvailableModel, 'useCount'>) => {
      if (!model.id) return;
      models.set(model.id, { ...model, useCount: useCounts[model.id] ?? 0 });
    };

    for (const [provider, providerConfig] of Object.entries(registry)) {
      const envVars = providerConfig.apiKeyEnvVar;
      const apiKeyEnvVar = Array.isArray(envVars) ? envVars[0] : envVars;
      const customAuth = this.configCompat.modelAuthChecker?.(provider);
      const hasApiKey = customAuth === true || Boolean(apiKeyEnvVar && process.env[apiKeyEnvVar]);
      for (const modelName of providerConfig.models ?? []) {
        upsert({
          id: `${provider}/${modelName}`,
          provider,
          modelName,
          hasApiKey,
          apiKeyEnvVar,
        });
      }
    }

    for (const model of (await Promise.resolve(this.configCompat.customModelCatalogProvider?.())) ?? []) {
      upsert(model);
    }

    return [...models.values()];
  }

  getCurrentThreadId(): string | null {
    return this.compatCurrentThreadId;
  }

  getResourceId(): string {
    return this.compatResourceId;
  }

  getDefaultResourceId(): string {
    return this.compatDefaultResourceId;
  }

  setResourceId({ resourceId }: { resourceId: string }): void {
    void this.releaseThreadLock(this.compatCurrentThreadId);
    this.sessionUnsubscribe?.();
    this.session = undefined;
    this.compatCurrentThreadId = null;
    this.compatResourceId = resourceId;
  }

  async getKnownResourceIds(): Promise<string[]> {
    const threads = await this.listThreads({ allResources: true });
    return [...new Set(threads.map(thread => thread.resourceId))].sort();
  }

  async selectOrCreateThread(): Promise<HarnessThread> {
    const threads = await this.listThreads();
    if (threads.length === 0) return this.createThread();
    const [thread] = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    await this.switchThread({ threadId: thread!.id });
    return thread!;
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    const modelId = this.getCurrentModelId() || this.getCurrentMode().defaultModelId || '';
    const metadata: Record<string, unknown> = {
      ...(modelId ? { currentModelId: modelId, [`modeModelId_${this.modeId}`]: modelId } : {}),
      currentModeId: this.modeId,
      ...(this.compatState.projectPath ? { projectPath: this.compatState.projectPath } : {}),
    };
    const previousThreadId = this.compatCurrentThreadId;
    const thread = toLegacyThread(
      await this.v1.threads.create({
        resourceId: this.compatResourceId,
        title: title ?? '',
        metadata,
      }),
    );
    await this.swapThreadLock(thread.id, previousThreadId);
    this.compatCurrentThreadId = thread.id;
    await this.bindSession(thread.id);
    this.compatTokenUsage = createEmptyTokenUsage();
    this.compatResetThreadDisplayState();
    this.compatEmit({ type: 'thread_created', thread });
    this.compatEmit({ type: 'thread_changed', threadId: thread.id, previousThreadId });
    return thread;
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    this.abort();
    const previousThreadId = this.compatCurrentThreadId;
    const thread = await this.v1.threads.get({ resourceId: this.compatResourceId, threadId });
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    await this.swapThreadLock(threadId, previousThreadId);
    this.compatCurrentThreadId = threadId;
    await this.bindSession(threadId);
    await this.compatLoadThreadMetadata(thread.metadata);
    this.compatResetThreadDisplayState();
    this.compatEmit({ type: 'thread_changed', threadId, previousThreadId });
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
    const sourceId = sourceThreadId ?? this.compatCurrentThreadId;
    if (!sourceId) throw new Error('No source thread to clone');
    const cloned = toLegacyThread(
      await this.v1.threads.clone({
        resourceId: resourceId ?? this.compatResourceId,
        threadId: sourceId,
        title,
      }),
    );
    await this.switchThread({ threadId: cloned.id });
    this.compatEmit({ type: 'thread_created', thread: cloned });
    return cloned;
  }

  async renameThread({ title }: { title: string }): Promise<void> {
    if (!this.compatCurrentThreadId) return;
    await this.v1.threads.rename({ resourceId: this.compatResourceId, threadId: this.compatCurrentThreadId, title });
  }

  async listThreads(options?: { allResources?: boolean; includeForkedSubagents?: boolean }): Promise<HarnessThread[]> {
    const resourceIds = options?.allResources ? await this.listResourceIdsFromStorage() : [this.compatResourceId];
    const threads: HarnessThread[] = [];
    for (const resourceId of resourceIds) {
      const result = await this.v1.threads.list({ resourceId, perPage: false });
      for (const thread of result.threads) {
        if (!options?.includeForkedSubagents && thread.metadata?.forkedSubagent === true) continue;
        threads.push(toLegacyThread(thread));
      }
    }
    return threads;
  }

  async setThreadSetting({ key, value }: { key: string; value: unknown }): Promise<void> {
    if (!this.compatCurrentThreadId) return;
    await this.v1.threads.setSettings({
      resourceId: this.compatResourceId,
      threadId: this.compatCurrentThreadId,
      patch: { [key]: value },
    });
  }

  sendSignal(
    input:
      | { content: unknown; requestContext?: RequestContext }
      | {
          type: string;
          contents?: unknown;
          attributes?: Record<string, string | number | boolean | null | undefined>;
          metadata?: Record<string, unknown>;
          requestContext?: RequestContext;
        },
  ): SignalLike {
    const id = randomUUID();
    const type = 'type' in input ? input.type : 'user-message';
    const content = 'content' in input ? input.content : input.contents;
    const requestContext = 'requestContext' in input ? input.requestContext : undefined;
    const accepted = Promise.resolve().then(async () => {
      const session = await this.ensureSession();
      await this.refreshRuntimeForCurrentMode(requestContext);
      const result =
        type === 'system-reminder'
          ? await session.injectSystemReminder(textFromContent(content), {
              ...('attributes' in input && input.attributes ? { attributes: input.attributes } : {}),
              ...('metadata' in input && input.metadata ? { metadata: input.metadata } : {}),
            })
          : await session.signal({
              content: content as never,
              ...('type' in input ? { type: input.type } : {}),
              ...('attributes' in input && input.attributes ? { attributes: input.attributes } : {}),
              ...('metadata' in input && input.metadata ? { metadata: input.metadata } : {}),
              requestContext,
            });
      return { accepted: true as const, runId: result.runId };
    });
    return { id, type, accepted };
  }

  async sendMessage({
    content,
    files,
    requestContext,
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
    requestContext?: RequestContext;
  }): Promise<void> {
    const session = await this.ensureSession();
    await this.refreshRuntimeForCurrentMode(requestContext);
    const result = await session.signal({
      content: contentWithFiles(content, files) as never,
      requestContext,
    });
    await result.result;
  }

  async listMessages(options?: { limit?: number }): Promise<HarnessMessage[]> {
    if (!this.compatCurrentThreadId) return [];
    return this.listMessagesForThread({ threadId: this.compatCurrentThreadId, limit: options?.limit });
  }

  async listMessagesForThread({ threadId, limit }: { threadId: string; limit?: number }): Promise<HarnessMessage[]> {
    const session =
      this.session?.threadId === threadId && this.session.resourceId === this.compatResourceId
        ? this.session
        : await this.v1.session({
            resourceId: this.compatResourceId,
            threadId,
            modeId: this.modeId,
            modelId: this.getCurrentModelId() || this.getCurrentMode().defaultModelId || 'unknown',
          });
    return session.listMessages({ limit });
  }

  async getFirstUserMessageForThread({ threadId }: { threadId: string }): Promise<HarnessMessage | null> {
    return (await this.getFirstUserMessagesForThreads({ threadIds: [threadId] })).get(threadId) ?? null;
  }

  async getFirstUserMessagesForThreads({ threadIds }: { threadIds: string[] }): Promise<Map<string, HarnessMessage>> {
    const out = new Map<string, HarnessMessage>();
    for (const threadId of threadIds) {
      const first = (await this.listMessagesForThread({ threadId })).find(message => message.role === 'user');
      if (first) out.set(threadId, first);
    }
    return out;
  }

  abort(): void {
    void this.session?.abort();
  }

  async steer({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    this.abort();
    this.compatFollowUpQueue = [];
    await this.sendMessage({ content, requestContext });
  }

  async followUp({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    if (this.isRunning()) {
      this.compatFollowUpQueue.push({ content, requestContext });
      this.compatEmit({ type: 'follow_up_queued', count: this.compatFollowUpQueue.length });
      return;
    }
    await this.sendMessage({ content, requestContext });
  }

  getFollowUpCount(): number {
    return this.compatFollowUpQueue.length;
  }

  isRunning(): boolean {
    return this.session?.isRunning() ?? false;
  }

  isCurrentThreadStreamActive(): boolean {
    return this.isRunning();
  }

  getCurrentRunId(): string | null {
    return this.session?.getDisplayState().currentRunId ?? null;
  }

  getCurrentTraceId(): string | null {
    return this.session?.getDisplayState().currentTraceId ?? null;
  }

  getDisplayState(): Readonly<HarnessDisplayState> {
    return this.compatDisplayState;
  }

  restoreDisplayTasks(tasks: any[]): void {
    this.compatDisplayState.previousTasks = [...this.compatDisplayState.tasks];
    this.compatDisplayState.tasks = [...tasks];
    this.compatDispatchDisplayStateChanged();
  }

  respondToToolApproval({ decision }: { decision: 'approve' | 'decline' | 'always_allow_category' }): void {
    const pending = this.compatDisplayState.pendingApproval;
    if (decision === 'always_allow_category' && pending) {
      const category = this.getToolCategory({ toolName: pending.toolName });
      if (category) void this.grantSessionCategory({ category });
    }
    void this.session?.respondToToolApproval({ approved: decision !== 'decline' }).catch(error => {
      this.compatEmit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
    });
  }

  async respondToToolSuspension({ resumeData }: { resumeData: unknown }): Promise<void> {
    await this.session?.respondToToolSuspension({ resumeData });
  }

  respondToQuestion({ questionId, answer }: { questionId: string; answer: HarnessQuestionAnswer }): void {
    void this.session?.respondToQuestion({ itemId: questionId, answer }).catch(error => {
      this.compatEmit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
    });
  }

  async respondToPlanApproval({
    response,
  }: {
    planId: string;
    response: { action: 'approved' | 'rejected'; feedback?: string };
  }): Promise<void> {
    await this.session?.respondToPlanApproval({
      approved: response.action === 'approved',
      revision: response.feedback,
      transitionToMode: response.action === 'approved' ? this.getDefaultModeId() : undefined,
    });
  }

  subscribe(listener: HarnessEventListener): () => void {
    this.compatListeners.push(listener);
    return () => {
      const index = this.compatListeners.indexOf(listener);
      if (index >= 0) this.compatListeners.splice(index, 1);
    };
  }

  subscribeDisplayState(listener: (displayState: HarnessDisplayState) => void | Promise<void>): () => void {
    this.displayListeners.add(listener);
    return () => this.displayListeners.delete(listener);
  }

  getTokenUsage(): TokenUsage {
    return { ...this.compatTokenUsage };
  }

  async loadOMProgress(): Promise<void> {
    this.compatEmit({ type: 'om_status', ...this.emptyOmStatusEvent() } as HarnessEvent);
  }

  getObserverModelId(): string | undefined {
    return this.compatState.observerModelId as string | undefined;
  }

  getReflectorModelId(): string | undefined {
    return this.compatState.reflectorModelId as string | undefined;
  }

  getObservationThreshold(): number | undefined {
    return this.compatState.observationThreshold as number | undefined;
  }

  getReflectionThreshold(): number | undefined {
    return this.compatState.reflectionThreshold as number | undefined;
  }

  getSubagentModelId({ agentType }: { agentType?: string } = {}): string | null {
    if (agentType && typeof this.compatState[`subagentModelId_${agentType}`] === 'string') {
      return this.compatState[`subagentModelId_${agentType}`] as string;
    }
    return typeof this.compatState.subagentModelId === 'string' ? this.compatState.subagentModelId : null;
  }

  async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }): Promise<void> {
    const key = agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
    await this.setState({ [key]: modelId } as Partial<TState>);
    await this.setThreadSetting({ key, value: modelId });
    await this.session?.models.setSubagent({ agentType: agentType ?? 'default', model: modelId });
    this.compatEmit({ type: 'subagent_model_changed', modelId, scope: 'thread', agentType } as HarnessEvent);
  }

  grantSessionCategory({ category }: { category: ToolCategory }): void {
    void this.session?.permissions.grantCategory({ category });
  }

  grantSessionTool({ toolName }: { toolName: string }): void {
    void this.session?.permissions.grantTool({ toolName });
  }

  getSessionGrants(): { categories: ToolCategory[]; tools: string[] } {
    const grants = this.session?.permissions.getGrants();
    return {
      categories: (grants?.categories ?? []) as ToolCategory[],
      tools: grants?.tools ?? [],
    };
  }

  getToolCategory({ toolName }: { toolName: string }): ToolCategory | null {
    return this.configCompat.toolCategoryResolver?.(toolName) ?? null;
  }

  setPermissionForCategory({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }): void {
    void this.session?.permissions.setPolicy({ category, policy });
    const rules = this.getPermissionRules();
    rules.categories[category] = policy;
    void this.setState({ permissionRules: rules } as unknown as Partial<TState>);
  }

  setPermissionForTool({ toolName, policy }: { toolName: string; policy: PermissionPolicy }): void {
    void this.session?.permissions.setPolicy({ toolName, policy });
    const rules = this.getPermissionRules();
    rules.tools[toolName] = policy;
    void this.setState({ permissionRules: rules } as unknown as Partial<TState>);
  }

  getPermissionRules(): PermissionRules {
    return (this.compatState.permissionRules as PermissionRules | undefined) ?? { categories: {}, tools: {} };
  }

  getWorkspace(): Workspace | undefined {
    return this.compatWorkspace;
  }

  async resolveWorkspace(): Promise<Workspace | undefined> {
    await this.refreshRuntimeForCurrentMode();
    this.compatWorkspace = await this.ensureSession().then(session => session.getWorkspace());
    return this.compatWorkspace;
  }

  hasWorkspace(): boolean {
    return Boolean(this.configCompat.workspace);
  }

  isWorkspaceReady(): boolean {
    return Boolean(this.compatWorkspace);
  }

  async destroyWorkspace(): Promise<void> {
    await this.compatWorkspace?.destroy?.();
    this.compatWorkspace = undefined;
  }

  setBrowser(browser: unknown): void {
    this.compatBrowser = browser;
    for (const mode of this.configCompat.modes) {
      const agent = typeof mode.agent === 'function' ? undefined : (mode.agent as AgentLike);
      if (agent && !agent.hasOwnBrowser?.()) agent.setBrowser?.(browser);
    }
  }

  registerHeartbeat(handler: HeartbeatHandler): void {
    void this.removeHeartbeat({ id: handler.id });
    const run = () =>
      void Promise.resolve(handler.handler()).catch(error => {
        this.compatEmit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      });
    if (handler.immediate !== false) run();
    const timer = setInterval(run, handler.intervalMs);
    timer.unref?.();
    this.compatHeartbeatTimers.set(handler.id, { timer, shutdown: handler.shutdown });
  }

  async removeHeartbeat({ id }: { id: string }): Promise<void> {
    const existing = this.compatHeartbeatTimers.get(id);
    if (!existing) return;
    clearInterval(existing.timer);
    await existing.shutdown?.();
    this.compatHeartbeatTimers.delete(id);
  }

  async stopHeartbeats(): Promise<void> {
    const entries = [...this.compatHeartbeatTimers.entries()];
    this.compatHeartbeatTimers.clear();
    await Promise.allSettled(
      entries.map(([, entry]) => {
        clearInterval(entry.timer);
        return entry.shutdown?.();
      }),
    );
  }

  async destroy(): Promise<void> {
    await this.stopHeartbeats();
    await this.session?.close().catch(() => undefined);
    await this.releaseThreadLock(this.compatCurrentThreadId);
    this.compatCurrentThreadId = null;
  }

  async getSession(): Promise<any> {
    return { threadId: this.compatCurrentThreadId, resourceId: this.compatResourceId, modeId: this.modeId };
  }

  private async ensureSession(): Promise<Session> {
    if (!this.compatCurrentThreadId) await this.createThread();
    return this.bindSession(this.compatCurrentThreadId!);
  }

  private async bindSession(threadId: string): Promise<Session> {
    if (this.session?.threadId === threadId && this.session.resourceId === this.compatResourceId) return this.session;
    this.sessionUnsubscribe?.();
    const modelId = this.getCurrentModelId() || this.getCurrentMode().defaultModelId || 'unknown';
    const session = await this.v1.session({
      resourceId: this.compatResourceId,
      threadId,
      modeId: this.modeId,
      modelId,
    });
    this.session = session;
    await session.setState(this.compatState).catch(() => undefined);
    this.sessionUnsubscribe = session.subscribe(event => {
      void this.handleV1Event(event);
    });
    return session;
  }

  private async swapThreadLock(nextThreadId: string, previousThreadId: string | null): Promise<void> {
    const lock = this.configCompat.threadLock as ThreadLock | undefined;
    if (!lock || nextThreadId === previousThreadId) return;
    try {
      await lock.acquire(nextThreadId);
    } catch (error) {
      if (previousThreadId) {
        await Promise.resolve(lock.acquire(previousThreadId)).catch(() => undefined);
      }
      throw error;
    }
    if (previousThreadId) {
      await Promise.resolve(lock.release(previousThreadId)).catch(() => undefined);
    }
  }

  private async releaseThreadLock(threadId: string | null): Promise<void> {
    if (!threadId) return;
    await Promise.resolve((this.configCompat.threadLock as ThreadLock | undefined)?.release(threadId)).catch(
      () => undefined,
    );
  }

  private buildV1Modes() {
    const agents: Record<string, any> = {};
    const modes: any[] = this.configCompat.modes.map(mode => {
      const agent = typeof mode.agent === 'function' ? mode.agent(this.compatState) : mode.agent;
      this.propagateAgent(agent as AgentLike);
      const agentId =
        typeof mode.agent === 'function'
          ? `mastracode-${mode.id}-agent`
          : ((agent as AgentLike).id ?? `mastracode-${mode.id}-agent`);
      agents[agentId] = agent;
      this.compatModeAgentIds.set(mode.id, agentId);
      const v1Mode = {
        id: mode.id,
        agentId,
        description: mode.name,
        additionalTools: this.buildModeAdditionalToolsSync(mode),
        ...(mode.id === 'plan' && this.configCompat.modes.some(item => item.id === 'build')
          ? { transitionsTo: 'build' }
          : {}),
        metadata: {
          name: mode.name,
          color: mode.color,
          defaultModelId: mode.defaultModelId,
        },
      };
      this.compatV1ModesById.set(mode.id, v1Mode);
      return v1Mode;
    });
    const defaultAgentId =
      modes.find(mode => mode.id === this.modeId)?.agentId ?? modes[0]?.agentId ?? this.getCurrentAgentId();
    for (const subagent of this.configCompat.subagents ?? []) {
      const modeId = this.subagentModeId(subagent.id);
      const v1Mode = {
        id: modeId,
        agentId: defaultAgentId,
        description: subagent.description,
        instructions: subagent.instructions as never,
        tools: this.buildSubagentTools(subagent),
        metadata: {
          name: subagent.name,
          subagentId: subagent.id,
          workspaceToolNames: Object.values(MC_TOOLS),
          ...(subagent.allowedWorkspaceTools ? { allowedWorkspaceTools: subagent.allowedWorkspaceTools } : {}),
          ...(subagent.defaultModelId ? { defaultModelId: subagent.defaultModelId } : {}),
        },
      };
      modes.push(v1Mode);
      this.compatV1ModesById.set(modeId, v1Mode);
    }
    return { agents, modes };
  }

  private buildModeAdditionalToolsSync(mode: HarnessMode<TState>): Record<string, unknown> {
    return this.buildModeAdditionalToolsFrom(mode, this.resolveStaticCompatTools());
  }

  private async buildModeAdditionalTools(
    mode: HarnessMode<TState>,
    requestContext?: RequestContext,
  ): Promise<Record<string, unknown>> {
    return this.buildModeAdditionalToolsFrom(mode, await this.resolveCompatTools(requestContext));
  }

  private buildModeAdditionalToolsFrom(
    mode: HarnessMode<TState>,
    resolvedHarnessTools: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    const tools: Record<string, unknown> = {
      ask_user: askUserTool,
      submit_plan: submitPlanTool,
      task_write: taskWriteTool,
      task_update: taskUpdateTool,
      task_complete: taskCompleteTool,
      task_check: taskCheckTool,
    };
    if (resolvedHarnessTools) Object.assign(tools, resolvedHarnessTools);
    const subagent = this.buildLegacySubagentAlias(mode);
    if (subagent) tools.subagent = subagent;
    for (const toolId of this.configCompat.disableBuiltinTools ?? []) {
      delete tools[toolId];
    }
    for (const [toolId, policy] of Object.entries(this.getPermissionRules().tools)) {
      if (policy === 'deny') delete tools[toolId];
    }
    return tools;
  }

  private resolveStaticCompatTools(): Record<string, unknown> | undefined {
    const tools = this.configCompat.tools;
    return tools && typeof tools !== 'function' ? { ...(tools as Record<string, unknown>) } : undefined;
  }

  private async resolveCompatTools(requestContext?: RequestContext): Promise<Record<string, unknown> | undefined> {
    const tools = this.configCompat.tools;
    if (!tools) return undefined;
    if (typeof tools !== 'function') return { ...(tools as Record<string, unknown>) };
    const context = this.buildCompatRequestContext(requestContext);
    const resolved = await tools({ requestContext: context, mastra: this.getMastra() } as never);
    return resolved ? { ...(resolved as Record<string, unknown>) } : undefined;
  }

  private buildLegacySubagentAlias(mode: HarnessMode<TState>) {
    if (!this.configCompat.subagents?.length) return undefined;
    return createTool({
      id: 'subagent',
      description:
        'Delegate a focused task to a specialized subagent. Accepts the legacy MastraCode subagent input shape and routes it through Harness v1 subagents.',
      inputSchema: z.object({
        agentType: z.enum(this.configCompat.subagents.map(subagent => subagent.id) as [string, ...string[]]),
        task: z.string(),
        modelId: z.string().optional(),
        forked: z.boolean().optional(),
      }),
      execute: async (input, context) => {
        const session = this.session;
        if (!session) {
          return { result: 'No active Harness v1 session is available for subagent delegation.', isError: true };
        }
        const spawn = createSpawnSubagentTool(session);
        if (!spawn?.execute) {
          return { result: 'No Harness v1 subagents are configured.', isError: true };
        }
        const configured = this.configCompat.subagents?.find(subagent => subagent.id === input.agentType);
        const modelOverride =
          input.forked === true
            ? this.getCurrentModelId() || mode.defaultModelId
            : (input.modelId ?? configured?.defaultModelId);
        return spawn.execute(
          {
            agentType: input.agentType,
            task:
              input.forked === true
                ? `${input.task}\n\nRun this as a forked MastraCode subagent task using the parent model context where available.`
                : input.task,
            ...(modelOverride ? { modelOverride } : {}),
          },
          context,
        );
      },
    });
  }

  private buildV1Subagents() {
    if (!this.configCompat.subagents?.length) return undefined;
    const types: Record<string, SubagentDefinition> = {};
    const defaultAgentId = this.getCurrentAgentId();
    for (const subagent of this.configCompat.subagents) {
      types[subagent.id] = {
        agentId: defaultAgentId,
        modeId: this.subagentModeId(subagent.id),
        description: subagent.description,
        defaultModelId: subagent.defaultModelId,
        workspace: subagent.forked ? 'fresh' : 'inherit',
      };
    }
    return { maxDepth: 1, types };
  }

  private subagentModeId(subagentId: string): string {
    return `__mastracode_subagent_${subagentId}`;
  }

  private getDefaultModeId(): string {
    return (this.configCompat.modes.find(mode => mode.default) ?? this.configCompat.modes[0] ?? this.getCurrentMode())
      .id;
  }

  private buildSubagentTools(
    subagent: NonNullable<HarnessConfig<TState>['subagents']>[number],
  ): Record<string, unknown> {
    const tools: Record<string, unknown> = { ...(subagent.tools ?? {}) };
    const harnessTools = this.configCompat.tools;
    if (subagent.allowedHarnessTools && harnessTools && typeof harnessTools !== 'function') {
      for (const toolId of subagent.allowedHarnessTools) {
        if (toolId in harnessTools && !(toolId in tools)) {
          tools[toolId] = harnessTools[toolId as keyof typeof harnessTools];
        }
      }
    }
    return tools;
  }

  private buildV1Workspace(): HarnessWorkspaceConfig | undefined {
    const workspace = this.configCompat.workspace;
    if (!workspace) return undefined;
    if (workspace instanceof Workspace) return { kind: 'shared', workspace };
    if (typeof workspace === 'function') {
      return {
        kind: 'per-resource',
        provider: async () => {
          const requestContext = this.buildCompatRequestContext();
          return workspace({ requestContext, mastra: this.getMastra() } as never) as Workspace | Promise<Workspace>;
        },
      };
    }
    return { kind: 'shared', workspace: new Workspace(workspace as never) };
  }

  private async refreshRuntimeForCurrentMode(requestContext?: RequestContext): Promise<void> {
    await this.refreshCurrentModeAgent();
    const mode = this.getCurrentMode();
    const v1Mode = this.compatV1ModesById.get(this.modeId);
    if (v1Mode) {
      v1Mode.additionalTools = await this.buildModeAdditionalTools(mode, requestContext);
    }
    await this.refreshWorkspaceForCurrentMode(requestContext);
  }

  private async refreshCurrentModeAgent(): Promise<void> {
    const mode = this.getCurrentMode();
    if (typeof mode.agent !== 'function') return;
    const agent = mode.agent(this.compatState);
    this.propagateAgent(agent as AgentLike);
    const agentId = this.compatModeAgentIds.get(mode.id) ?? `mastracode-${mode.id}-agent`;
    const mastra = this.getMastra();
    mastra?.removeAgent(agentId);
    mastra?.addAgent(agent as never, agentId);
  }

  private async refreshWorkspaceForCurrentMode(requestContext?: RequestContext): Promise<void> {
    const workspace = this.configCompat.workspace;
    if (typeof workspace !== 'function') return;
    const context = this.buildCompatRequestContext(requestContext);
    this.compatWorkspace = (await workspace({
      requestContext: context,
      mastra: this.getMastra(),
    } as never)) as Workspace | undefined;
  }

  private buildCompatRequestContext(base?: RequestContext): RequestContext {
    const entries = base ? Array.from(base.entries()) : [];
    const harnessSlot = {
      harnessId: this.configCompat.id,
      state: this.compatState,
      getState: () => this.compatState,
      setState: (updates: Partial<TState>) => this.setState(updates),
      updateState: async <TResult>(
        updater: (
          state: Readonly<TState>,
        ) =>
          | { updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }
          | Promise<{ updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }>,
      ): Promise<TResult> => {
        const mutation = await updater(this.compatState);
        if (mutation.updates) await this.setState(mutation.updates);
        for (const event of mutation.events ?? []) this.compatEmit(event);
        return mutation.result;
      },
      threadId: this.compatCurrentThreadId,
      resourceId: this.compatResourceId,
      modeId: this.modeId,
      getSubagentModelId: (params?: { agentType?: string }) => this.getSubagentModelId(params),
    };
    const idx = entries.findIndex(([key]) => key === 'harness');
    if (idx >= 0) entries[idx] = ['harness', harnessSlot];
    else entries.push(['harness', harnessSlot]);
    return new RequestContext(entries);
  }

  private getCurrentAgentId(): string {
    const mode = this.getCurrentMode();
    const agent = typeof mode.agent === 'function' ? mode.agent(this.compatState) : mode.agent;
    return (agent as AgentLike).id ?? `mastracode-${mode.id}-agent`;
  }

  private propagateAgent(agent: AgentLike): void {
    if (this.configCompat.memory && !agent.hasOwnMemory?.()) agent.__setMemory?.(this.configCompat.memory);
    if (this.configCompat.pubsub && !agent.hasOwnPubSub?.()) agent.__setPubSub?.(this.configCompat.pubsub);
    if (this.configCompat.workspace && !agent.hasOwnWorkspace?.()) agent.__setWorkspace?.(this.configCompat.workspace);
    if (this.compatBrowser && !agent.hasOwnBrowser?.()) agent.setBrowser?.(this.compatBrowser);
  }

  private async handleV1Event(event: HarnessV1Event): Promise<void> {
    switch (event.type) {
      case 'agent_start':
        this.compatDisplayState.isRunning = true;
        this.compatEmit({ type: 'agent_start' });
        break;
      case 'agent_end':
        this.compatDisplayState.isRunning = false;
        if (this.session) {
          const usage = this.session.getDisplayState().tokenUsage as TokenUsage;
          this.compatTokenUsage = {
            ...usage,
            totalTokens: usage.totalTokens || usage.promptTokens + usage.completionTokens,
          };
          this.compatDisplayState.tokenUsage = this.compatTokenUsage;
        }
        this.compatEmit({ type: 'agent_end', reason: event.reason });
        if (this.compatFollowUpQueue.length > 0) {
          const next = this.compatFollowUpQueue.shift()!;
          await this.sendMessage(next);
        }
        break;
      case 'message_start': {
        const message: HarnessMessage = {
          id: event.messageId,
          role: 'assistant',
          content: [{ type: 'text', text: '' }],
          createdAt: new Date(event.timestamp),
        };
        this.messageAccumulators.set(event.messageId, message);
        this.compatDisplayState.currentMessage = message;
        this.compatEmit({ type: 'message_start', message });
        break;
      }
      case 'message_update': {
        const message = this.messageAccumulators.get(event.messageId);
        if (!message) break;
        const text = message.content.find(part => part.type === 'text') as { type: 'text'; text: string } | undefined;
        if (text) text.text += event.delta;
        else message.content.push({ type: 'text', text: event.delta });
        this.compatDisplayState.currentMessage = message;
        this.compatEmit({ type: 'message_update', message });
        break;
      }
      case 'message_end': {
        const message = this.messageAccumulators.get(event.messageId);
        if (!message) break;
        this.compatDisplayState.currentMessage = null;
        this.messageAccumulators.delete(event.messageId);
        this.compatEmit({ type: 'message_end', message });
        break;
      }
      case 'tool_start':
        this.compatDisplayState.activeTools.set(event.toolCallId, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          startedAt: new Date(event.timestamp),
        } as never);
        this.compatEmit({
          type: 'tool_start',
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        });
        break;
      case 'tool_update':
        this.compatEmit({ type: 'tool_update', toolCallId: event.toolCallId, partialResult: event.partialResult });
        break;
      case 'tool_end':
        this.compatDisplayState.activeTools.delete(event.toolCallId);
        this.compatEmit({
          type: 'tool_end',
          toolCallId: event.toolCallId,
          result: event.result,
          isError: event.isError,
        });
        break;
      case 'tool_input_start':
      case 'tool_input_delta':
      case 'tool_input_end':
      case 'shell_output':
      case 'task_updated':
        this.forwardCompatibleEvent(event);
        break;
      case 'subagent_start':
        this.compatEmit({
          type: 'subagent_start',
          toolCallId: event.toolCallId,
          agentType: event.agentType,
          task: event.task,
          modelId: event.modelId,
          forked: false,
        } as HarnessEvent);
        break;
      case 'subagent_text_delta':
        this.compatEmit({
          type: 'subagent_text_delta',
          toolCallId: event.toolCallId,
          agentType: event.agentType,
          textDelta: event.delta,
        } as HarnessEvent);
        break;
      case 'subagent_tool_start':
        this.compatEmit({
          type: 'subagent_tool_start',
          toolCallId: event.toolCallId,
          agentType: event.agentType,
          subToolName: event.toolName,
        } as HarnessEvent);
        break;
      case 'subagent_tool_end':
        this.compatEmit({
          type: 'subagent_tool_end',
          toolCallId: event.toolCallId,
          agentType: event.agentType,
          subToolName: event.toolName,
          subToolResult: event.output,
          isError: event.isError,
        } as HarnessEvent);
        break;
      case 'subagent_end':
        this.compatEmit({
          type: 'subagent_end',
          toolCallId: event.toolCallId,
          agentType: event.agentType,
          result: event.output,
          isError: event.isError,
          durationMs: event.durationMs,
        } as HarnessEvent);
        break;
      case 'suspension_required':
        await this.handleSuspensionRequired(event);
        break;
      case 'mode_changed':
        this.modeId = event.modeId;
        this.compatEmit({ type: 'mode_changed', modeId: event.modeId, previousModeId: event.previousModeId });
        break;
      case 'model_changed':
        await this.setState({ currentModelId: event.modelId } as unknown as Partial<TState>);
        this.compatEmit({ type: 'model_changed', modelId: event.modelId });
        break;
      case 'state_changed':
        if (this.session) this.compatState = (await this.session.getState()) as TState;
        this.compatEmit({ type: 'state_changed', state: this.compatState, changedKeys: event.changedKeys });
        break;
      case 'thread_renamed':
      case 'thread_deleted':
      case 'workspace_status_changed':
      case 'workspace_error':
        this.forwardCompatibleEvent(event);
        break;
      default:
        break;
    }
    this.compatDispatchDisplayStateChanged();
  }

  private async handleSuspensionRequired(event: Extract<HarnessV1Event, { type: 'suspension_required' }>) {
    const pending = this.session?.getDisplayState().pending;
    if (!pending) return;
    const payload = pending.payload ?? {};
    if (event.kind === 'question' && event.toolName === 'request_access') {
      const input = payload.input as { path?: string; reason?: string } | undefined;
      this.compatEmit({
        type: 'sandbox_access_request',
        questionId: pending.itemId ?? pending.toolCallId,
        path: input?.path ?? '',
        reason: input?.reason ?? '',
      });
      return;
    }
    if (event.kind === 'question') {
      this.compatDisplayState.pendingQuestion = {
        questionId: pending.itemId ?? pending.toolCallId,
        question: payload.question ?? '',
        options: payload.options,
        selectionMode: payload.selectionMode,
      };
      this.compatEmit({
        type: 'ask_question',
        questionId: pending.itemId ?? pending.toolCallId,
        question: payload.question ?? '',
        options: payload.options,
        selectionMode: payload.selectionMode,
      });
      return;
    }
    if (event.kind === 'plan-approval') {
      this.compatDisplayState.pendingPlanApproval = {
        planId: pending.itemId ?? pending.toolCallId,
        title: payload.title,
        plan: payload.plan ?? '',
      };
      this.compatEmit({
        type: 'plan_approval_required',
        planId: pending.itemId ?? pending.toolCallId,
        title: payload.title ?? 'Plan',
        plan: payload.plan ?? '',
      });
      return;
    }
    if (event.kind === 'tool-suspension') {
      this.compatDisplayState.pendingSuspension = {
        toolCallId: pending.toolCallId,
        toolName: pending.toolName ?? '',
        args: payload.input,
        suspendPayload: payload.suspendData,
      };
      this.compatEmit({
        type: 'tool_suspended',
        toolCallId: pending.toolCallId,
        toolName: pending.toolName ?? '',
        args: payload.input,
        suspendPayload: payload.suspendData,
      });
      return;
    }
    this.compatDisplayState.pendingApproval = {
      toolCallId: pending.toolCallId,
      toolName: pending.toolName ?? '',
      args: payload.input,
    };
    this.compatEmit({
      type: 'tool_approval_required',
      toolCallId: pending.toolCallId,
      toolName: pending.toolName ?? '',
      args: payload.input,
    });
  }

  private forwardCompatibleEvent(event: HarnessV1Event): void {
    if (event.type === 'task_updated') {
      this.compatDisplayState.previousTasks = [...this.compatDisplayState.tasks];
      this.compatDisplayState.tasks = event.tasks as never;
    }
    this.compatEmit(event as unknown as HarnessEvent);
  }

  private compatEmit(event: HarnessEvent): void {
    this.updateDisplayStateFromEvent(event);
    for (const listener of [...this.compatListeners]) {
      void Promise.resolve(listener(event)).catch(() => undefined);
    }
  }

  private updateDisplayStateFromEvent(event: HarnessEvent): void {
    if (event.type === 'usage_update') this.compatDisplayState.tokenUsage = event.usage;
    if (event.type === 'agent_start') this.compatDisplayState.isRunning = true;
    if (event.type === 'agent_end') this.compatDisplayState.isRunning = false;
    if (event.type === 'thread_changed' || event.type === 'thread_created') this.compatResetThreadDisplayState();
  }

  private compatDispatchDisplayStateChanged(): void {
    for (const listener of [...this.displayListeners]) {
      void Promise.resolve(listener(this.compatDisplayState)).catch(() => undefined);
    }
  }

  private compatResetThreadDisplayState(): void {
    this.compatDisplayState = {
      ...defaultDisplayState(),
      tokenUsage: this.compatTokenUsage,
      omProgress: defaultOMProgressState(),
    };
  }

  private compatStartHeartbeats(): void {
    for (const handler of this.configCompat.heartbeatHandlers ?? []) {
      this.registerHeartbeat(handler);
    }
  }

  private async compatLoadThreadMetadata(metadata?: Record<string, unknown>): Promise<void> {
    const meta =
      metadata ??
      (this.compatCurrentThreadId
        ? (await this.v1.threads.get({ resourceId: this.compatResourceId, threadId: this.compatCurrentThreadId }))
            ?.metadata
        : undefined);
    if (!meta) return;
    const savedModeId = typeof meta.currentModeId === 'string' ? meta.currentModeId : undefined;
    if (savedModeId && this.configCompat.modes.some(mode => mode.id === savedModeId)) this.modeId = savedModeId;
    const modelId =
      (meta[`modeModelId_${this.modeId}`] as string | undefined) ??
      (meta.currentModelId as string | undefined) ??
      this.getCurrentMode().defaultModelId;
    const updates: Record<string, unknown> = {};
    if (modelId) updates.currentModelId = modelId;
    for (const key of ['observerModelId', 'reflectorModelId', 'observationThreshold', 'reflectionThreshold']) {
      if (meta[key] !== undefined) updates[key] = meta[key];
    }
    if (Object.keys(updates).length > 0) await this.setState(updates as unknown as Partial<TState>);
  }

  private async compatLoadModeModelId(modeId: string): Promise<string | null> {
    const thread = this.compatCurrentThreadId
      ? await this.v1.threads.get({ resourceId: this.compatResourceId, threadId: this.compatCurrentThreadId })
      : null;
    const stored = thread?.metadata?.[`modeModelId_${modeId}`];
    if (typeof stored === 'string') return stored;
    return this.configCompat.modes.find(mode => mode.id === modeId)?.defaultModelId ?? null;
  }

  private async listResourceIdsFromStorage(): Promise<string[]> {
    const storage = this.configCompat.storage as MastraCompositeStore | undefined;
    const memory = await storage?.getStore('memory');
    if (!memory) return [this.compatResourceId];
    const result = await memory.listThreads({ perPage: false });
    const ids = new Set(result.threads.map(thread => thread.resourceId));
    ids.add(this.compatResourceId);
    return [...ids];
  }

  private async toV1AuthStatus(modelId: string) {
    const provider = providerFromModelId(modelId);
    const checked = this.configCompat.modelAuthChecker?.(provider);
    if (checked === true) return 'authenticated';
    if (checked === false) return 'needs_auth';
    const envVar = await this.compatGetProviderApiKeyEnvVar(provider);
    return envVar && process.env[envVar] ? 'authenticated' : 'unknown';
  }

  private async compatGetProviderApiKeyEnvVar(provider: string): Promise<string | undefined> {
    const config = (PROVIDER_REGISTRY as Record<string, { apiKeyEnvVar?: string | string[] }>)[provider];
    const envVars = config?.apiKeyEnvVar;
    return Array.isArray(envVars) ? envVars[0] : envVars;
  }

  private emptyOmStatusEvent() {
    return {
      windows: {
        active: {
          messages: { tokens: 0, threshold: 30_000 },
          observations: { tokens: 0, threshold: 40_000 },
        },
        buffered: {
          observations: {
            status: 'idle' as const,
            chunks: 0,
            messageTokens: 0,
            projectedMessageRemoval: 0,
            observationTokens: 0,
          },
          reflection: {
            status: 'idle' as const,
            inputObservationTokens: 0,
            observationTokens: 0,
          },
        },
      },
      recordId: '',
      threadId: this.compatCurrentThreadId ?? '',
      stepNumber: 0,
      generationCount: 0,
    };
  }
}
