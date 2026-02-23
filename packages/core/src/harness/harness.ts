import type { z } from 'zod';

import type { Agent } from '../agent';
import type { ToolsInput, ToolsetsInput } from '../agent/types';
import type { StorageThreadType } from '../memory/types';
import { RequestContext } from '../request-context';
import type { MemoryStorage } from '../storage/domains/memory/base';
import type { ObservationalMemoryRecord } from '../storage/types';
import { Workspace } from '../workspace/workspace';
import type { WorkspaceConfig } from '../workspace/workspace';

import { askUserTool, createSubagentTool, submitPlanTool, taskCheckTool, taskWriteTool } from './tools';
import type {
  AvailableModel,
  HeartbeatHandler,
  HarnessConfig,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMessageContent,
  HarnessMode,
  HarnessRequestContext,
  HarnessSession,
  HarnessStateSchema,
  HarnessThread,
  ModelAuthStatus,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from './types';

/**
 * The Harness orchestrates multiple agent modes, shared state, memory, and storage.
 * It's the core abstraction that a TUI (or other UI) controls.
 *
 * @example
 * ```ts
 * const harness = new Harness({
 *   id: "my-coding-agent",
 *   storage: new LibSQLStore({ url: "file:./data.db" }),
 *   stateSchema: z.object({
 *     currentModelId: z.string().optional(),
 *   }),
 *   modes: [
 *     { id: "plan", name: "Plan", default: true, agent: planAgent },
 *     { id: "build", name: "Build", agent: buildAgent },
 *   ],
 * })
 *
 * harness.subscribe((event) => {
 *   if (event.type === "message_update") renderMessage(event.message)
 * })
 *
 * await harness.init()
 * await harness.sendMessage({ content: "Hello!" })
 * ```
 */
export class Harness<TState extends HarnessStateSchema = HarnessStateSchema> {
  readonly id: string;

  private config: HarnessConfig<TState>;
  private state: z.infer<TState>;
  private currentModeId: string;
  private currentThreadId: string | null = null;
  private resourceId: string;
  private listeners: HarnessEventListener[] = [];
  private abortController: AbortController | null = null;
  private abortRequested: boolean = false;
  private currentRunId: string | null = null;
  private currentOperationId: number = 0;
  private followUpQueue: string[] = [];
  private pendingApprovalResolve: ((decision: 'approve' | 'decline') => void) | null = null;
  private pendingApprovalToolName: string | null = null;
  private pendingQuestions = new Map<string, (answer: string) => void>();
  private pendingPlanApprovals = new Map<
    string,
    (result: { action: 'approved' | 'rejected'; feedback?: string }) => void
  >();
  private workspace: Workspace | undefined = undefined;
  private workspaceFn:
    | ((ctx: { requestContext: RequestContext }) => Promise<Workspace | undefined> | Workspace | undefined)
    | undefined = undefined;
  private workspaceInitialized = false;
  private heartbeatTimers = new Map<string, { timer: NodeJS.Timeout; shutdown?: () => void | Promise<void> }>();
  private tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  private sessionGrantedCategories = new Set<string>();
  private sessionGrantedTools = new Set<string>();

  constructor(config: HarnessConfig<TState>) {
    this.id = config.id;
    this.config = config;
    this.resourceId = config.resourceId ?? config.id;

    // Initialize state from schema defaults + initial state
    this.state = {
      ...this.getSchemaDefaults(),
      ...config.initialState,
    } as z.infer<TState>;

    // Find default mode
    const defaultMode = config.modes.find(m => m.default) ?? config.modes[0];
    if (!defaultMode) {
      throw new Error('Harness requires at least one agent mode');
    }
    this.currentModeId = defaultMode.id;

    // Store workspace: pre-built instance, dynamic factory, or config (constructed in init())
    if (config.workspace instanceof Workspace) {
      this.workspace = config.workspace;
    } else if (typeof config.workspace === 'function') {
      this.workspaceFn = config.workspace;
    }

    // Seed model from mode default if not set
    const currentModel = (this.state as any).currentModelId;
    if (!currentModel && defaultMode.defaultModelId) {
      void this.setState({ currentModelId: defaultMode.defaultModelId } as Partial<z.infer<TState>>);
    }
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * Initialize the harness — loads storage and workspace.
   * Must be called before using the harness.
   */
  async init(): Promise<void> {
    if (this.config.storage) {
      await this.config.storage.init();
    }

    // Initialize workspace if configured (skip for dynamic factory — resolved per-request)
    if (this.config.workspace && !this.workspaceInitialized && !this.workspaceFn) {
      try {
        if (!this.workspace) {
          this.workspace = new Workspace(this.config.workspace as WorkspaceConfig);
        }

        this.emit({ type: 'workspace_status_changed', status: 'initializing' });
        await this.workspace.init();
        this.workspaceInitialized = true;

        this.emit({ type: 'workspace_status_changed', status: 'ready' });
        this.emit({
          type: 'workspace_ready',
          workspaceId: this.workspace.id,
          workspaceName: this.workspace.name,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.workspace = undefined;
        this.workspaceInitialized = false;

        this.emit({ type: 'workspace_status_changed', status: 'error', error: err });
        this.emit({ type: 'workspace_error', error: err });
      }
    }

    // Propagate harness-level memory and workspace to mode agents (after workspace init)
    const workspaceForAgents = this.workspaceFn ?? this.workspace;
    for (const mode of this.config.modes) {
      const agent = typeof mode.agent === 'function' ? null : mode.agent;
      if (!agent) continue;

      if (this.config.memory && !agent.hasOwnMemory()) {
        agent.__setMemory(this.config.memory);
      }
      if (workspaceForAgents && !agent.hasOwnWorkspace()) {
        agent.__setWorkspace(workspaceForAgents);
      }
    }

    this.startHeartbeats();
  }

  /**
   * Select the most recent thread, or create one if none exist.
   */
  async selectOrCreateThread(): Promise<HarnessThread> {
    const threads = await this.listThreads();

    if (threads.length === 0) {
      return await this.createThread();
    }

    const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const mostRecent = sortedThreads[0]!;
    this.config.threadLock?.acquire(mostRecent.id);
    this.currentThreadId = mostRecent.id;
    await this.loadThreadMetadata();

    return mostRecent;
  }

  private async getMemoryStorage(): Promise<MemoryStorage> {
    if (!this.config.storage) {
      throw new Error('Storage is not configured on this Harness');
    }
    const memoryStorage = await this.config.storage.getStore('memory');
    if (!memoryStorage) {
      throw new Error('Storage does not have a memory domain configured');
    }
    return memoryStorage;
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Get current harness state (read-only snapshot).
   */
  getState(): Readonly<z.infer<TState>> {
    return { ...this.state };
  }

  /**
   * Update harness state. Validates against schema if provided.
   * Emits state_changed event.
   */
  async setState(updates: Partial<z.infer<TState>>): Promise<void> {
    const changedKeys = Object.keys(updates);
    const newState = { ...this.state, ...updates };

    if (this.config.stateSchema) {
      const result = this.config.stateSchema.safeParse(newState);
      if (!result.success) {
        throw new Error(`Invalid state update: ${result.error.message}`);
      }
      this.state = result.data as z.infer<TState>;
    } else {
      this.state = newState as z.infer<TState>;
    }

    this.emit({ type: 'state_changed', state: this.state, changedKeys });
  }

  private getSchemaDefaults(): Partial<z.infer<TState>> {
    if (!this.config.stateSchema) return {};

    const shape = this.config.stateSchema.shape;
    const defaults: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(shape)) {
      try {
        const result = (field as any).safeParse(undefined);
        if (result.success && result.data !== undefined) {
          defaults[key] = result.data;
        }
      } catch {
        // field has no default or doesn't support safeParse — skip
      }
    }

    return defaults as Partial<z.infer<TState>>;
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  listModes(): HarnessMode<TState>[] {
    return this.config.modes;
  }

  getCurrentModeId(): string {
    return this.currentModeId;
  }

  getCurrentMode(): HarnessMode<TState> {
    const mode = this.config.modes.find(m => m.id === this.currentModeId);
    if (!mode) {
      throw new Error(`Mode not found: ${this.currentModeId}`);
    }
    return mode;
  }

  /**
   * Switch to a different mode.
   * Aborts any in-progress generation and switches to the mode's default model.
   */
  async switchMode({ modeId }: { modeId: string }): Promise<void> {
    const mode = this.config.modes.find(m => m.id === modeId);
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    this.abort();

    // Save current model to the outgoing mode before switching
    const currentModelId = this.getCurrentModelId();
    if (currentModelId) {
      await this.setThreadSetting({ key: `modeModelId_${this.currentModeId}`, value: currentModelId });
    }

    const previousModeId = this.currentModeId;
    this.currentModeId = modeId;

    await this.setThreadSetting({ key: 'currentModeId', value: modeId });

    // Load the incoming mode's model
    const modeModelId = await this.loadModeModelId(modeId);
    if (modeModelId) {
      void this.setState({ currentModelId: modeModelId } as Partial<z.infer<TState>>);
      this.emit({ type: 'model_changed', modelId: modeModelId } as HarnessEvent);
    }

    this.emit({ type: 'mode_changed', modeId, previousModeId });
  }

  /**
   * Load the stored model ID for a specific mode.
   * Falls back to: thread metadata -> mode's defaultModelId -> current model.
   */
  private async loadModeModelId(modeId: string): Promise<string | null> {
    if (this.currentThreadId && this.config.storage) {
      try {
        const memoryStorage = await this.getMemoryStorage();
        const thread = await memoryStorage.getThreadById({ threadId: this.currentThreadId });
        const meta = thread?.metadata as Record<string, unknown> | undefined;
        const stored = meta?.[`modeModelId_${modeId}`] as string | undefined;
        if (stored) return stored;
      } catch {
        // Fall through to defaults
      }
    }

    const mode = this.config.modes.find(m => m.id === modeId);
    if (mode?.defaultModelId) return mode.defaultModelId;

    return null;
  }

  /**
   * Get the agent for the current mode.
   */
  private getCurrentAgent(): Agent {
    const mode = this.getCurrentMode();
    if (typeof mode.agent === 'function') {
      return mode.agent(this.state);
    }
    return mode.agent;
  }

  /**
   * Get a short display name from the current model ID.
   */
  getModelName(): string {
    const modelId = this.getCurrentModelId();
    if (!modelId || modelId === 'unknown') return modelId || 'unknown';
    const parts = modelId.split('/');
    return parts[parts.length - 1] || modelId;
  }

  /**
   * Get the full model ID (e.g., "anthropic/claude-sonnet-4").
   */
  getFullModelId(): string {
    return this.getCurrentModelId();
  }

  /**
   * Switch to a different model at runtime.
   */
  async switchModel({
    modelId,
    scope = 'thread',
    modeId,
  }: {
    modelId: string;
    scope?: 'global' | 'thread';
    modeId?: string;
  }): Promise<void> {
    const targetModeId = modeId ?? this.currentModeId;

    if (targetModeId === this.currentModeId) {
      void this.setState({ currentModelId: modelId } as Partial<z.infer<TState>>);
    }

    if (scope === 'thread') {
      await this.setThreadSetting({ key: `modeModelId_${targetModeId}`, value: modelId });
    }

    this.emit({ type: 'model_changed', modelId, scope, modeId: targetModeId } as HarnessEvent);
  }

  getCurrentModelId(): string {
    const state = this.getState() as { currentModelId?: string };
    return state.currentModelId ?? '';
  }

  hasModelSelected(): boolean {
    return this.getCurrentModelId() !== '';
  }

  /**
   * Check if the current model's provider has authentication configured.
   * Uses the provider registry's `apiKeyEnvVar` and the optional `modelAuthChecker` hook.
   */
  async getCurrentModelAuthStatus(): Promise<ModelAuthStatus> {
    const modelId = this.getCurrentModelId();
    const provider = modelId.split('/')[0];
    if (!provider) return { hasAuth: true };

    if (this.config.modelAuthChecker) {
      const result = this.config.modelAuthChecker(provider);
      if (result === true) return { hasAuth: true };
      if (result === false) {
        const apiKeyEnvVar = await this.getProviderApiKeyEnvVar(provider);
        return { hasAuth: false, apiKeyEnvVar };
      }
    }

    try {
      const { PROVIDER_REGISTRY } = await import('../llm/model/provider-registry.js');
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

  /**
   * Get all available models from the provider registry with auth status.
   * Uses the optional `modelAuthChecker` and `modelUseCountProvider` hooks.
   */
  async listAvailableModels(): Promise<AvailableModel[]> {
    try {
      const { PROVIDER_REGISTRY } = await import('../llm/model/provider-registry.js');

      if (!PROVIDER_REGISTRY) return [];

      const registry = PROVIDER_REGISTRY as Record<
        string,
        { models?: string[]; name?: string; apiKeyEnvVar?: string | string[] }
      >;
      const providers = Object.keys(registry);
      const useCounts = this.config.modelUseCountProvider?.() ?? {};
      const models: AvailableModel[] = [];

      for (const provider of providers) {
        const providerConfig = registry[provider];
        const envVars = providerConfig?.apiKeyEnvVar;
        const apiKeyEnvVar = Array.isArray(envVars) ? envVars[0] : envVars;
        const hasEnvKey = apiKeyEnvVar ? !!process.env[apiKeyEnvVar] : false;

        let hasApiKey = hasEnvKey;
        if (!hasApiKey && this.config.modelAuthChecker) {
          const customAuth = this.config.modelAuthChecker(provider);
          if (customAuth === true) hasApiKey = true;
        }

        if (providerConfig?.models && Array.isArray(providerConfig.models)) {
          for (const modelName of providerConfig.models) {
            const id = `${provider}/${modelName}`;
            models.push({
              id,
              provider,
              modelName,
              hasApiKey,
              apiKeyEnvVar: apiKeyEnvVar || undefined,
              useCount: useCounts[id] ?? 0,
            });
          }
        }
      }

      return models;
    } catch (error) {
      console.warn('Failed to load available models:', error);
      return [];
    }
  }

  private async getProviderApiKeyEnvVar(provider: string): Promise<string | undefined> {
    try {
      const { PROVIDER_REGISTRY } = await import('../llm/model/provider-registry.js');
      const registry = PROVIDER_REGISTRY as Record<string, { apiKeyEnvVar?: string | string[] }>;
      const envVars = registry[provider]?.apiKeyEnvVar;
      return Array.isArray(envVars) ? envVars[0] : envVars;
    } catch {
      return undefined;
    }
  }

  // ===========================================================================
  // Thread Management
  // ===========================================================================

  getCurrentThreadId(): string | null {
    return this.currentThreadId;
  }

  getResourceId(): string {
    return this.resourceId;
  }

  setResourceId({ resourceId }: { resourceId: string }): void {
    this.resourceId = resourceId;
    this.currentThreadId = null;
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    const now = new Date();
    const thread: HarnessThread = {
      id: this.generateId(),
      resourceId: this.resourceId,
      title: title || 'New Thread',
      createdAt: now,
      updatedAt: now,
    };

    const currentStateModel = (this.state as any).currentModelId;
    const currentMode = this.getCurrentMode();
    const modelId = currentStateModel || currentMode.defaultModelId;

    const metadata: Record<string, unknown> = {};
    if (modelId) {
      metadata.currentModelId = modelId;
      metadata[`modeModelId_${this.currentModeId}`] = modelId;
    }

    // Auto-tag with projectPath from state so threads are scoped to the working directory
    const projectPath = (this.state as any).projectPath;
    if (projectPath) {
      metadata.projectPath = projectPath;
    }

    if (this.config.storage) {
      const memoryStorage = await this.getMemoryStorage();
      await memoryStorage.saveThread({
        thread: {
          id: thread.id,
          resourceId: thread.resourceId,
          title: thread.title!,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        },
      });
    }

    // Acquire lock on new thread before releasing old one.
    // If acquire fails, attempt to re-acquire the old lock before rethrowing.
    const oldThreadId = this.currentThreadId;
    if (this.config.threadLock) {
      try {
        this.config.threadLock.acquire(thread.id);
      } catch (err) {
        if (oldThreadId) {
          try {
            this.config.threadLock.acquire(oldThreadId);
          } catch {
            // Best-effort re-acquire; original error is more important
          }
        }
        throw err;
      }
      if (oldThreadId) {
        this.config.threadLock.release(oldThreadId);
      }
    }

    this.currentThreadId = thread.id;

    if (modelId && !currentStateModel) {
      void this.setState({ currentModelId: modelId } as Partial<z.infer<TState>>);
    }

    this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this.emit({ type: 'thread_created', thread });

    return thread;
  }

  async renameThread({ title }: { title: string }): Promise<void> {
    if (!this.currentThreadId || !this.config.storage) return;

    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId: this.currentThreadId });
    if (thread) {
      await memoryStorage.saveThread({
        thread: { ...thread, title, updatedAt: new Date() },
      });
    }
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    this.abort();

    if (this.config.storage) {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }
    }

    // Acquire lock on new thread before releasing old one
    this.config.threadLock?.acquire(threadId);

    const previousThreadId = this.currentThreadId;
    if (previousThreadId) {
      this.config.threadLock?.release(previousThreadId);
    }
    this.currentThreadId = threadId;

    await this.loadThreadMetadata();

    this.emit({ type: 'thread_changed', threadId, previousThreadId });
  }

  async listThreads(options?: { allResources?: boolean }): Promise<HarnessThread[]> {
    if (!this.config.storage) return [];

    const memoryStorage = await this.getMemoryStorage();
    const filter: { resourceId?: string } | undefined = options?.allResources
      ? undefined
      : { resourceId: this.resourceId };

    const result = await memoryStorage.listThreads({ filter });

    return result.threads.map((thread: StorageThreadType) => ({
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: thread.metadata,
    }));
  }

  async setThreadSetting({ key, value }: { key: string; value: unknown }): Promise<void> {
    if (!this.currentThreadId || !this.config.storage) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId: this.currentThreadId });
      if (thread) {
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: { ...thread.metadata, [key]: value },
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Settings persistence is not critical
    }
  }

  private async deleteThreadSetting({ key }: { key: string }): Promise<void> {
    if (!this.currentThreadId || !this.config.storage) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId: this.currentThreadId });
      if (thread && thread.metadata) {
        const metadata = { ...thread.metadata };
        delete metadata[key];
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Settings removal is not critical
    }
  }

  private async loadThreadMetadata(): Promise<void> {
    if (!this.currentThreadId || !this.config.storage) {
      this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      return;
    }

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId: this.currentThreadId });

      // Load token usage
      const savedUsage = thread?.metadata?.tokenUsage as typeof this.tokenUsage | undefined;
      if (savedUsage) {
        this.tokenUsage = {
          promptTokens: savedUsage.promptTokens ?? 0,
          completionTokens: savedUsage.completionTokens ?? 0,
          totalTokens: savedUsage.totalTokens ?? 0,
        };
      } else {
        this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      }

      const meta = thread?.metadata as Record<string, unknown> | undefined;
      const updates: Record<string, unknown> = {};

      // Load model ID: per-mode first, then global
      const modeModelKey = `modeModelId_${this.currentModeId}`;
      if (meta?.[modeModelKey]) {
        updates.currentModelId = meta[modeModelKey];
      } else if (meta?.currentModelId) {
        updates.currentModelId = meta.currentModelId;
      }

      // Restore mode
      if (meta?.currentModeId) {
        const savedModeId = meta.currentModeId as string;
        const modeExists = this.config.modes.some(m => m.id === savedModeId);
        if (modeExists && savedModeId !== this.currentModeId) {
          this.currentModeId = savedModeId;
          const restoredModeModelKey = `modeModelId_${savedModeId}`;
          if (meta[restoredModeModelKey]) {
            updates.currentModelId = meta[restoredModeModelKey];
          }
          this.emit({
            type: 'mode_changed',
            modeId: savedModeId,
            previousModeId: this.config.modes.find(m => m.default)?.id || this.config.modes[0]!.id,
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        void this.setState(updates as Partial<z.infer<TState>>);
      }
    } catch {
      this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }
  }

  // ===========================================================================
  // Observational Memory
  // ===========================================================================

  /**
   * Load observational memory progress for the current thread.
   * Reads the OM record and recent messages to reconstruct status,
   * then emits an `om_status` event for the UI.
   */
  async loadOMProgress(): Promise<void> {
    if (!this.currentThreadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const record = await memoryStorage.getObservationalMemory(this.currentThreadId, this.resourceId);

      if (!record) return;

      const config = record.config as
        | {
            observationThreshold?: number | { min: number; max: number };
            reflectionThreshold?: number | { min: number; max: number };
          }
        | undefined;

      const getThreshold = (val: number | { min: number; max: number } | undefined, fallback: number): number => {
        if (!val) return fallback;
        if (typeof val === 'number') return val;
        return val.max;
      };

      let observationThreshold = getThreshold(config?.observationThreshold, 30_000);
      let reflectionThreshold = getThreshold(config?.reflectionThreshold, 40_000);

      let messageTokens = record.pendingMessageTokens ?? 0;
      let observationTokens = record.observationTokenCount ?? 0;
      let bufferedObs = {
        status: 'idle' as 'idle' | 'running' | 'complete',
        chunks: 0,
        messageTokens: 0,
        projectedMessageRemoval: 0,
        observationTokens: 0,
      };
      let bufferedRef = {
        status: 'idle' as 'idle' | 'running' | 'complete',
        inputObservationTokens: 0,
        observationTokens: 0,
      };
      let generationCount = 0;
      let stepNumber = 0;

      const messagesResult = await memoryStorage.listMessages({
        threadId: this.currentThreadId,
        perPage: 70,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      const messages = messagesResult.messages;
      let foundStatus = false;
      for (const msg of messages) {
        if (msg.role !== 'assistant') continue;
        const content = msg.content as { parts?: Array<{ type?: string; data?: Record<string, unknown> }> } | string;
        if (typeof content === 'string' || !content?.parts) continue;

        for (let i = content.parts.length - 1; i >= 0; i--) {
          const part = content.parts[i] as { type?: string; data?: Record<string, unknown> };
          if (part.type === 'data-om-status' && part.data?.windows) {
            const w = part.data.windows as Record<string, Record<string, Record<string, unknown>>>;
            messageTokens = (w.active?.messages?.tokens as number) ?? messageTokens;
            observationTokens = (w.active?.observations?.tokens as number) ?? observationTokens;
            const msgThresh = w.active?.messages?.threshold as number | undefined;
            const obsThresh = w.active?.observations?.threshold as number | undefined;
            if (msgThresh) observationThreshold = msgThresh;
            if (obsThresh) reflectionThreshold = obsThresh;
            const bo = w.buffered?.observations as Record<string, unknown> | undefined;
            if (bo) {
              bufferedObs = {
                status: (bo.status as 'idle' | 'running' | 'complete') ?? 'idle',
                chunks: (bo.chunks as number) ?? 0,
                messageTokens: (bo.messageTokens as number) ?? 0,
                projectedMessageRemoval: (bo.projectedMessageRemoval as number) ?? 0,
                observationTokens: (bo.observationTokens as number) ?? 0,
              };
            }
            const br = w.buffered?.reflection as Record<string, unknown> | undefined;
            if (br) {
              bufferedRef = {
                status: (br.status as 'idle' | 'running' | 'complete') ?? 'idle',
                inputObservationTokens: (br.inputObservationTokens as number) ?? 0,
                observationTokens: (br.observationTokens as number) ?? 0,
              };
            }
            generationCount = (part.data.generationCount as number) ?? 0;
            stepNumber = (part.data.stepNumber as number) ?? 0;
            foundStatus = true;
            break;
          }
        }
        if (foundStatus) break;
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
        threadId: this.currentThreadId,
        stepNumber,
        generationCount,
      });
    } catch {
      // OM not available or not initialized — that's fine
    }
  }

  async getObservationalMemoryRecord(): Promise<ObservationalMemoryRecord | null> {
    if (!this.currentThreadId) return null;

    try {
      const memoryStorage = await this.getMemoryStorage();
      return await memoryStorage.getObservationalMemory(this.currentThreadId, this.resourceId);
    } catch {
      return null;
    }
  }

  /**
   * Returns the observer model ID from state, falling back to omConfig defaults.
   */
  getObserverModelId(): string | undefined {
    return (this.state as any).observerModelId ?? this.config.omConfig?.defaultObserverModelId;
  }

  /**
   * Returns the reflector model ID from state, falling back to omConfig defaults.
   */
  getReflectorModelId(): string | undefined {
    return (this.state as any).reflectorModelId ?? this.config.omConfig?.defaultReflectorModelId;
  }

  /**
   * Returns the observation threshold from state, falling back to omConfig defaults.
   */
  getObservationThreshold(): number | undefined {
    return (this.state as any).observationThreshold ?? this.config.omConfig?.defaultObservationThreshold;
  }

  /**
   * Returns the reflection threshold from state, falling back to omConfig defaults.
   */
  getReflectionThreshold(): number | undefined {
    return (this.state as any).reflectionThreshold ?? this.config.omConfig?.defaultReflectionThreshold;
  }

  /**
   * Resolves the observer model ID to a language model instance via `resolveModel`.
   */
  getResolvedObserverModel() {
    const modelId = this.getObserverModelId();
    if (!modelId || !this.config.resolveModel) return undefined;
    return this.config.resolveModel(modelId);
  }

  /**
   * Resolves the reflector model ID to a language model instance via `resolveModel`.
   */
  getResolvedReflectorModel() {
    const modelId = this.getReflectorModelId();
    if (!modelId || !this.config.resolveModel) return undefined;
    return this.config.resolveModel(modelId);
  }

  /**
   * Switch the Observer model.
   */
  async switchObserverModel({ modelId }: { modelId: string }): Promise<void> {
    void this.setState({ observerModelId: modelId } as Partial<z.infer<TState>>);
    await this.setThreadSetting({ key: 'observerModelId', value: modelId });
    this.emit({ type: 'om_model_changed', role: 'observer', modelId } as HarnessEvent);
  }

  /**
   * Switch the Reflector model.
   */
  async switchReflectorModel({ modelId }: { modelId: string }): Promise<void> {
    void this.setState({ reflectorModelId: modelId } as Partial<z.infer<TState>>);
    await this.setThreadSetting({ key: 'reflectorModelId', value: modelId });
    this.emit({ type: 'om_model_changed', role: 'reflector', modelId } as HarnessEvent);
  }

  // ===========================================================================
  // Subagent Model Management
  // ===========================================================================

  getSubagentModelId({ agentType }: { agentType?: string } = {}): string | null {
    const state = this.state as Record<string, unknown>;
    if (agentType) {
      const perType = state[`subagentModelId_${agentType}`];
      if (typeof perType === 'string') return perType;
    }
    const global = state.subagentModelId;
    return typeof global === 'string' ? global : null;
  }

  async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }): Promise<void> {
    const key = agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
    void this.setState({ [key]: modelId } as Partial<z.infer<TState>>);
    await this.setThreadSetting({ key, value: modelId });
    this.emit({ type: 'subagent_model_changed', modelId, scope: 'thread', agentType } as HarnessEvent);
  }

  // ===========================================================================
  // Permissions
  // ===========================================================================

  grantSessionCategory({ category }: { category: ToolCategory }): void {
    this.sessionGrantedCategories.add(category);
  }

  grantSessionTool({ toolName }: { toolName: string }): void {
    this.sessionGrantedTools.add(toolName);
  }

  getSessionGrants(): { categories: ToolCategory[]; tools: string[] } {
    return {
      categories: [...this.sessionGrantedCategories] as ToolCategory[],
      tools: [...this.sessionGrantedTools],
    };
  }

  getToolCategory({ toolName }: { toolName: string }): ToolCategory | null {
    return this.config.toolCategoryResolver?.(toolName) ?? null;
  }

  setPermissionForCategory({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }): void {
    const rules = this.getPermissionRules();
    rules.categories[category] = policy;
    void this.setState({ permissionRules: rules } as Partial<z.infer<TState>>);
  }

  setPermissionForTool({ toolName, policy }: { toolName: string; policy: PermissionPolicy }): void {
    const rules = this.getPermissionRules();
    rules.tools[toolName] = policy;
    void this.setState({ permissionRules: rules } as Partial<z.infer<TState>>);
  }

  getPermissionRules(): PermissionRules {
    const state = this.state as Record<string, unknown>;
    const rules = state.permissionRules as PermissionRules | undefined;
    return rules ?? { categories: {}, tools: {} };
  }

  /**
   * Resolve whether a tool call should be auto-approved, denied, or asked.
   * Resolution chain: yolo → per-tool policy → session tool grant →
   * session category grant → category policy → "ask"
   */
  private resolveToolApproval(toolName: string): PermissionPolicy {
    const state = this.state as Record<string, unknown>;
    if (state.yolo === true) return 'allow';

    const rules = this.getPermissionRules();

    const toolPolicy = rules.tools[toolName];
    if (toolPolicy) return toolPolicy;

    if (this.sessionGrantedTools.has(toolName)) return 'allow';

    const category = this.getToolCategory({ toolName });
    if (category) {
      if (this.sessionGrantedCategories.has(category)) return 'allow';
      const categoryPolicy = rules.categories[category];
      if (categoryPolicy) return categoryPolicy;
    }

    return 'ask';
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  /**
   * Send a message to the current agent.
   * Streams the response and emits events.
   */
  async sendMessage({
    content,
    images,
  }: {
    content: string;
    images?: Array<{ data: string; mimeType: string }>;
  }): Promise<void> {
    if (!this.currentThreadId) {
      const thread = await this.createThread();
      this.currentThreadId = thread.id;
    }

    const operationId = ++this.currentOperationId;
    this.abortController = new AbortController();
    const agent = this.getCurrentAgent();

    this.emit({ type: 'agent_start' });

    try {
      const requestContext = await this.buildRequestContext();

      const isYolo = (this.state as Record<string, unknown>).yolo === true;

      const streamOptions: Record<string, unknown> = {
        memory: { thread: this.currentThreadId, resource: this.resourceId },
        abortSignal: this.abortController.signal,
        requestContext,
        maxSteps: 1000,
        requireToolApproval: !isYolo,
        modelSettings: { temperature: 1 },
      };

      streamOptions.toolsets = await this.buildToolsets(requestContext);

      let messageInput: string | Record<string, unknown> = content;
      if (images?.length) {
        messageInput = {
          role: 'user',
          content: [
            { type: 'text', text: content },
            ...images.map((img: { data: string; mimeType: string }) => ({
              type: 'file',
              data: img.data,
              mediaType: img.mimeType,
            })),
          ],
        };
      }

      const response = await agent.stream(messageInput as any, streamOptions as any);
      await this.processStream(response);

      if (this.currentOperationId === operationId) {
        const reason = this.abortRequested ? 'aborted' : 'complete';
        this.emit({ type: 'agent_end', reason });
      }
    } catch (error) {
      if (this.currentOperationId !== operationId) return;

      if (error instanceof Error && error.name === 'AbortError') {
        this.emit({ type: 'agent_end', reason: 'aborted' });
      } else if (error instanceof Error && error.message.match(/^Tool .+ not found$/)) {
        const badTool = error.message.replace('Tool ', '').replace(' not found', '');
        this.emit({
          type: 'error',
          error: new Error(`Unknown tool "${badTool}".`),
          retryable: true,
        });
        this.followUpQueue.push(
          `[System] Your previous tool call used "${badTool}" which is not a valid tool. Please retry with the correct tool name.`,
        );
        this.emit({ type: 'agent_end', reason: 'error' });
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit({ type: 'error', error: err });
        this.emit({ type: 'agent_end', reason: 'error' });
      }
    } finally {
      if (this.currentOperationId === operationId) {
        this.abortController = null;
        this.abortRequested = false;
      }

      if (this.currentOperationId === operationId && this.followUpQueue.length > 0) {
        const next = this.followUpQueue.shift()!;
        await this.sendMessage({ content: next });
      }
    }
  }

  async listMessages(options?: { limit?: number }): Promise<HarnessMessage[]> {
    if (!this.currentThreadId) return [];
    return this.listMessagesForThread({ threadId: this.currentThreadId, limit: options?.limit });
  }

  async listMessagesForThread({ threadId, limit }: { threadId: string; limit?: number }): Promise<HarnessMessage[]> {
    if (!this.config.storage) return [];

    const memoryStorage = await this.getMemoryStorage();

    if (limit) {
      const result = await memoryStorage.listMessages({
        threadId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages.map(msg => this.convertToHarnessMessage(msg)).reverse();
    }

    const result = await memoryStorage.listMessages({ threadId, perPage: false });
    return result.messages.map(msg => this.convertToHarnessMessage(msg));
  }

  async getFirstUserMessageForThread({ threadId }: { threadId: string }): Promise<HarnessMessage | null> {
    if (!this.config.storage) return null;

    const memoryStorage = await this.getMemoryStorage();
    const result = await memoryStorage.listMessages({
      threadId,
      perPage: 5,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    const userMsg = result.messages.find(m => m.role === 'user');
    return userMsg ? this.convertToHarnessMessage(userMsg) : null;
  }

  private convertToHarnessMessage(msg: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    createdAt: Date;
    content: {
      parts: Array<{
        type: string;
        text?: string;
        reasoning?: string;
        toolCallId?: string;
        toolName?: string;
        args?: unknown;
        result?: unknown;
        isError?: boolean;
        toolInvocation?: {
          state: string;
          toolCallId: string;
          toolName: string;
          args?: unknown;
          result?: unknown;
          isError?: boolean;
        };
        [key: string]: unknown;
      }>;
    };
  }): HarnessMessage {
    const content: HarnessMessageContent[] = [];

    for (const part of msg.content.parts) {
      switch (part.type) {
        case 'text':
          if (part.text) {
            content.push({ type: 'text', text: part.text });
          }
          break;
        case 'reasoning':
          if (part.reasoning) {
            content.push({ type: 'thinking', thinking: part.reasoning });
          }
          break;
        case 'tool-invocation':
          if (part.toolInvocation) {
            const inv = part.toolInvocation;
            content.push({ type: 'tool_call', id: inv.toolCallId, name: inv.toolName, args: inv.args });
            if (inv.state === 'result' && inv.result !== undefined) {
              content.push({
                type: 'tool_result',
                id: inv.toolCallId,
                name: inv.toolName,
                result: inv.result,
                isError: inv.isError ?? false,
              });
            }
          } else if (part.toolCallId && part.toolName) {
            content.push({ type: 'tool_call', id: part.toolCallId, name: part.toolName, args: part.args });
          }
          break;
        case 'tool-call':
          if (part.toolCallId && part.toolName) {
            content.push({ type: 'tool_call', id: part.toolCallId, name: part.toolName, args: part.args });
          }
          break;
        case 'tool-result':
          if (part.toolCallId && part.toolName) {
            content.push({
              type: 'tool_result',
              id: part.toolCallId,
              name: part.toolName,
              result: part.result,
              isError: part.isError ?? false,
            });
          }
          break;
        case 'data-om-observation-start': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          content.push({
            type: 'om_observation_start',
            tokensToObserve: (data.tokensToObserve as number) ?? 0,
            operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
          });
          break;
        }
        case 'data-om-observation-end': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          content.push({
            type: 'om_observation_end',
            tokensObserved: (data.tokensObserved as number) ?? 0,
            observationTokens: (data.observationTokens as number) ?? 0,
            durationMs: (data.durationMs as number) ?? 0,
            operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
            observations: (data.observations as string) ?? undefined,
            currentTask: (data.currentTask as string) ?? undefined,
            suggestedResponse: (data.suggestedResponse as string) ?? undefined,
          });
          break;
        }
        case 'data-om-observation-failed': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          content.push({
            type: 'om_observation_failed',
            error: (data.error as string) ?? 'Unknown error',
            tokensAttempted: (data.tokensAttempted as number) ?? 0,
            operationType: (data.operationType as 'observation' | 'reflection') ?? 'observation',
          });
          break;
        }
        // Skip other part types (step-start, data-om-status, etc.)
      }
    }

    return { id: msg.id, role: msg.role, content, createdAt: msg.createdAt };
  }

  /**
   * Process a stream response (shared between sendMessage and tool approval).
   */
  private async processStream(response: { fullStream: AsyncIterable<any> }): Promise<{ message: HarnessMessage }> {
    let currentMessage: HarnessMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: [],
      createdAt: new Date(),
    };

    const textContentById = new Map<string, { index: number; text: string }>();
    const thinkingContentById = new Map<string, { index: number; text: string }>();

    for await (const chunk of response.fullStream) {
      if ('runId' in chunk && chunk.runId) {
        this.currentRunId = chunk.runId;
      }

      switch (chunk.type) {
        case 'text-start': {
          const textIndex = currentMessage.content.length;
          currentMessage.content.push({ type: 'text', text: '' });
          textContentById.set(chunk.payload.id, { index: textIndex, text: '' });
          this.emit({ type: 'message_start', message: { ...currentMessage } });
          break;
        }

        case 'text-delta': {
          const textState = textContentById.get(chunk.payload.id);
          if (textState) {
            textState.text += chunk.payload.text;
            const textContent = currentMessage.content[textState.index];
            if (textContent && textContent.type === 'text') {
              textContent.text = textState.text;
            }
            this.emit({ type: 'message_update', message: { ...currentMessage } });
          }
          break;
        }

        case 'reasoning-start': {
          const thinkingIndex = currentMessage.content.length;
          currentMessage.content.push({ type: 'thinking', thinking: '' });
          thinkingContentById.set(chunk.payload.id, { index: thinkingIndex, text: '' });
          this.emit({ type: 'message_update', message: { ...currentMessage } });
          break;
        }

        case 'reasoning-delta': {
          const thinkingState = thinkingContentById.get(chunk.payload.id);
          if (thinkingState) {
            thinkingState.text += chunk.payload.text;
            const thinkingContent = currentMessage.content[thinkingState.index];
            if (thinkingContent && thinkingContent.type === 'thinking') {
              thinkingContent.thinking = thinkingState.text;
            }
            this.emit({ type: 'message_update', message: { ...currentMessage } });
          }
          break;
        }

        case 'tool-call-input-streaming-start': {
          const { toolCallId, toolName } = chunk.payload;
          this.emit({ type: 'tool_input_start', toolCallId, toolName });
          break;
        }

        case 'tool-call-delta': {
          const { toolCallId, argsTextDelta, toolName } = chunk.payload;
          this.emit({ type: 'tool_input_delta', toolCallId, argsTextDelta, toolName });
          break;
        }

        case 'tool-call-input-streaming-end': {
          const { toolCallId } = chunk.payload;
          this.emit({ type: 'tool_input_end', toolCallId });
          break;
        }

        case 'tool-call': {
          const toolCall = chunk.payload;
          currentMessage.content.push({
            type: 'tool_call',
            id: toolCall.toolCallId,
            name: toolCall.toolName,
            args: toolCall.args,
          });
          this.emit({
            type: 'tool_start',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.args,
          });
          this.emit({ type: 'message_update', message: { ...currentMessage } });
          break;
        }

        case 'tool-result': {
          const toolResult = chunk.payload;
          currentMessage.content.push({
            type: 'tool_result',
            id: toolResult.toolCallId,
            name: toolResult.toolName,
            result: toolResult.result,
            isError: toolResult.isError ?? false,
          });
          this.emit({
            type: 'tool_end',
            toolCallId: toolResult.toolCallId,
            result: toolResult.result,
            isError: toolResult.isError ?? false,
          });
          this.emit({ type: 'message_update', message: { ...currentMessage } });
          break;
        }

        case 'tool-error': {
          const toolError = chunk.payload;
          this.emit({ type: 'tool_end', toolCallId: toolError.toolCallId, result: toolError.error, isError: true });
          break;
        }

        case 'tool-call-approval': {
          const toolCallId = chunk.payload.toolCallId;
          const toolName = chunk.payload.toolName;
          const toolArgs = chunk.payload.args;

          const policy = this.resolveToolApproval(toolName);

          if (policy === 'allow') {
            const result = await this.handleToolApprove(toolCallId);
            currentMessage = result.message;
            return { message: currentMessage };
          }

          if (policy === 'deny') {
            const result = await this.handleToolDecline(toolCallId);
            currentMessage = result.message;
            return { message: currentMessage };
          }

          this.pendingApprovalToolName = toolName;
          this.emit({ type: 'tool_approval_required', toolCallId, toolName, args: toolArgs });

          const decision = await new Promise<'approve' | 'decline'>(resolve => {
            this.pendingApprovalResolve = resolve;
          });
          this.pendingApprovalToolName = null;

          if (decision === 'approve') {
            const result = await this.handleToolApprove(toolCallId);
            currentMessage = result.message;
            return { message: currentMessage };
          } else {
            const result = await this.handleToolDecline(toolCallId);
            currentMessage = result.message;
            return { message: currentMessage };
          }
        }

        case 'error': {
          const streamError =
            chunk.payload.error instanceof Error ? chunk.payload.error : new Error(String(chunk.payload.error));
          this.emit({ type: 'error', error: streamError });
          break;
        }

        case 'step-finish': {
          const usage = chunk.payload?.output?.usage;
          if (usage) {
            const promptTokens = usage.promptTokens ?? 0;
            const completionTokens = usage.completionTokens ?? 0;
            const totalTokens = promptTokens + completionTokens;

            this.tokenUsage.promptTokens += promptTokens;
            this.tokenUsage.completionTokens += completionTokens;
            this.tokenUsage.totalTokens += totalTokens;

            this.persistTokenUsage().catch(() => {});
            this.emit({ type: 'usage_update', usage: { promptTokens, completionTokens, totalTokens } });
          }
          break;
        }

        case 'finish': {
          const finishReason = chunk.payload.stepResult?.reason;
          if (finishReason === 'stop' || finishReason === 'end-turn') {
            currentMessage.stopReason = 'complete';
          } else if (finishReason === 'tool-calls') {
            currentMessage.stopReason = 'tool_use';
          } else {
            currentMessage.stopReason = 'complete';
          }
          break;
        }

        // Observational Memory data parts
        // NOTE: OM data parts arrive as { type, data: { ... } } — NOT { type, payload }
        case 'data-om-status': {
          const d = (chunk as any).data as Record<string, any> | undefined;
          if (d?.windows) {
            const w = d.windows;
            const active = w.active ?? {};
            const msgs = active.messages ?? {};
            const obs = active.observations ?? {};
            const buffObs = w.buffered?.observations ?? {};
            const buffRef = w.buffered?.reflection ?? {};

            this.emit({
              type: 'om_status',
              windows: {
                active: {
                  messages: { tokens: msgs.tokens ?? 0, threshold: msgs.threshold ?? 0 },
                  observations: { tokens: obs.tokens ?? 0, threshold: obs.threshold ?? 0 },
                },
                buffered: {
                  observations: {
                    status: buffObs.status ?? 'idle',
                    chunks: buffObs.chunks ?? 0,
                    messageTokens: buffObs.messageTokens ?? 0,
                    projectedMessageRemoval: buffObs.projectedMessageRemoval ?? 0,
                    observationTokens: buffObs.observationTokens ?? 0,
                  },
                  reflection: {
                    status: buffRef.status ?? 'idle',
                    inputObservationTokens: buffRef.inputObservationTokens ?? 0,
                    observationTokens: buffRef.observationTokens ?? 0,
                  },
                },
              },
              recordId: d.recordId ?? '',
              threadId: d.threadId ?? '',
              stepNumber: d.stepNumber ?? 0,
              generationCount: d.generationCount ?? 0,
            });
          }
          break;
        }
        case 'data-om-observation-start': {
          const payload = (chunk as any).data as Record<string, any> | undefined;
          if (payload && payload.cycleId) {
            if (payload.operationType === 'observation') {
              this.emit({
                type: 'om_observation_start',
                cycleId: payload.cycleId,
                operationType: payload.operationType,
                tokensToObserve: payload.tokensToObserve ?? 0,
              });
            } else if (payload.operationType === 'reflection') {
              this.emit({
                type: 'om_reflection_start',
                cycleId: payload.cycleId,
                tokensToReflect: payload.tokensToObserve ?? 0,
              });
            }
          }
          break;
        }
        case 'data-om-observation-end': {
          const payload = (chunk as any).data as Record<string, any> | undefined;
          if (payload && payload.cycleId) {
            if (payload.operationType === 'reflection') {
              this.emit({
                type: 'om_reflection_end',
                cycleId: payload.cycleId,
                durationMs: payload.durationMs ?? 0,
                compressedTokens: payload.observationTokens ?? 0,
                observations: payload.observations,
              });
            } else {
              this.emit({
                type: 'om_observation_end',
                cycleId: payload.cycleId,
                durationMs: payload.durationMs ?? 0,
                tokensObserved: payload.tokensObserved ?? 0,
                observationTokens: payload.observationTokens ?? 0,
                observations: payload.observations,
                currentTask: payload.currentTask,
                suggestedResponse: payload.suggestedResponse,
              });
            }
          }
          break;
        }
        case 'data-om-observation-failed': {
          const payload = (chunk as any).data as Record<string, any> | undefined;
          if (payload) {
            if (payload.operationType === 'reflection') {
              this.emit({
                type: 'om_reflection_failed',
                cycleId: payload.cycleId ?? 'unknown',
                error: payload.error ?? 'Unknown error',
                durationMs: payload.durationMs ?? 0,
              });
            } else {
              this.emit({
                type: 'om_observation_failed',
                cycleId: payload.cycleId ?? 'unknown',
                error: payload.error ?? 'Unknown error',
                durationMs: payload.durationMs ?? 0,
              });
            }
          }
          break;
        }
        // Async buffering lifecycle
        case 'data-om-buffering-start': {
          const payload = (chunk as any).data as Record<string, any> | undefined;
          if (payload && payload.cycleId) {
            this.emit({
              type: 'om_buffering_start',
              cycleId: payload.cycleId,
              operationType: payload.operationType ?? 'observation',
              tokensToBuffer: payload.tokensToBuffer ?? 0,
            });
          }
          break;
        }
        case 'data-om-buffering-end': {
          const payload = (chunk as any).data as Record<string, any> | undefined;
          if (payload && payload.cycleId) {
            this.emit({
              type: 'om_buffering_end',
              cycleId: payload.cycleId,
              operationType: payload.operationType ?? 'observation',
              tokensBuffered: payload.tokensBuffered ?? 0,
              bufferedTokens: payload.bufferedTokens ?? 0,
              observations: payload.observations,
            });
          }
          break;
        }
        case 'data-om-buffering-failed': {
          const payload = (chunk as any).data as Record<string, any> | undefined;
          if (payload && payload.cycleId) {
            this.emit({
              type: 'om_buffering_failed',
              cycleId: payload.cycleId,
              operationType: payload.operationType ?? 'observation',
              error: payload.error ?? 'Unknown error',
            });
          }
          break;
        }
        case 'data-om-activation': {
          const payload = (chunk as any).data as Record<string, any> | undefined;
          if (payload && payload.cycleId) {
            this.emit({
              type: 'om_activation',
              cycleId: payload.cycleId,
              operationType: payload.operationType ?? 'observation',
              chunksActivated: payload.chunksActivated ?? 0,
              tokensActivated: payload.tokensActivated ?? 0,
              observationTokens: payload.observationTokens ?? 0,
              messagesActivated: payload.messagesActivated ?? 0,
              generationCount: payload.generationCount ?? 0,
            });
          }
          break;
        }

        default:
          break;
      }
    }

    this.emit({ type: 'message_end', message: currentMessage });
    return { message: currentMessage };
  }

  // ===========================================================================
  // Control
  // ===========================================================================

  /**
   * Abort the current operation.
   */
  abort(): void {
    if (this.abortController) {
      this.abortRequested = true;
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }
  }

  /**
   * Steer the agent mid-stream: aborts current run and sends a new message.
   */
  async steer({ content }: { content: string }): Promise<void> {
    this.abort();
    this.followUpQueue = [];
    await this.sendMessage({ content });
  }

  /**
   * Queue a follow-up message to be processed after the current operation completes.
   */
  async followUp({ content }: { content: string }): Promise<void> {
    if (this.isRunning()) {
      this.followUpQueue.push(content);
      this.emit({ type: 'follow_up_queued', count: this.followUpQueue.length });
    } else {
      await this.sendMessage({ content });
    }
  }

  getFollowUpCount(): number {
    return this.followUpQueue.length;
  }

  isRunning(): boolean {
    return this.abortController !== null;
  }

  getCurrentRunId(): string | null {
    return this.currentRunId;
  }

  /**
   * Respond to a pending tool approval from the UI.
   * "always_allow_category" grants the tool's category for the rest of the session, then approves.
   */
  respondToToolApproval({ decision }: { decision: 'approve' | 'decline' | 'always_allow_category' }): void {
    if (!this.pendingApprovalResolve) return;

    if (decision === 'always_allow_category') {
      const tn = this.pendingApprovalToolName;
      if (tn) {
        const category = this.getToolCategory({ toolName: tn });
        if (category) {
          this.grantSessionCategory({ category });
        }
      }
      this.pendingApprovalResolve('approve');
    } else {
      this.pendingApprovalResolve(decision);
    }
    this.pendingApprovalResolve = null;
  }

  // ===========================================================================
  // Question & Plan Approval
  // ===========================================================================

  /**
   * Register a pending question resolver.
   * Called by agent tools (e.g., ask_user) to pause execution until the UI responds.
   */
  registerQuestion({ questionId, resolve }: { questionId: string; resolve: (answer: string) => void }): void {
    this.pendingQuestions.set(questionId, resolve);
  }

  /**
   * Resolve a pending question with the user's answer.
   * Called by the UI when the user responds to a question dialog.
   */
  respondToQuestion({ questionId, answer }: { questionId: string; answer: string }): void {
    const resolve = this.pendingQuestions.get(questionId);
    if (resolve) {
      this.pendingQuestions.delete(questionId);
      resolve(answer);
    }
  }

  /**
   * Register a pending plan approval resolver.
   * Called by agent tools (e.g., submit_plan) to pause execution until approval.
   */
  registerPlanApproval({
    planId,
    resolve,
  }: {
    planId: string;
    resolve: (result: { action: 'approved' | 'rejected'; feedback?: string }) => void;
  }): void {
    this.pendingPlanApprovals.set(planId, resolve);
  }

  /**
   * Respond to a pending plan approval.
   * On approval: switches to the default mode, then resolves the promise.
   * On rejection: resolves with feedback (stays in current mode).
   */
  async respondToPlanApproval({
    planId,
    response,
  }: {
    planId: string;
    response: { action: 'approved' | 'rejected'; feedback?: string };
  }): Promise<void> {
    const resolve = this.pendingPlanApprovals.get(planId);
    if (!resolve) return;

    if (response.action === 'approved') {
      const defaultMode = this.config.modes.find(m => m.default) ?? this.config.modes[0];
      if (defaultMode && defaultMode.id !== this.currentModeId) {
        await this.switchMode({ modeId: defaultMode.id });
      }
    }

    this.pendingPlanApprovals.delete(planId);
    resolve(response);
  }

  private async handleToolApprove(toolCallId?: string): Promise<{ message: HarnessMessage }> {
    if (!this.currentRunId) {
      throw new Error('No active run to approve tool call for');
    }

    const agent = this.getCurrentAgent();
    if (!this.abortController) {
      this.abortController = new AbortController();
    }

    const requestContext = await this.buildRequestContext();
    const response = await agent.approveToolCall({
      runId: this.currentRunId,
      toolCallId,
      requireToolApproval: true,
      memory: this.currentThreadId ? { thread: this.currentThreadId, resource: this.resourceId } : undefined,
      abortSignal: this.abortController.signal,
      requestContext,
      toolsets: await this.buildToolsets(requestContext),
    });

    return await this.processStream(response);
  }

  private async handleToolDecline(toolCallId?: string): Promise<{ message: HarnessMessage }> {
    if (!this.currentRunId) {
      throw new Error('No active run to decline tool call for');
    }

    const agent = this.getCurrentAgent();
    if (!this.abortController) {
      this.abortController = new AbortController();
    }

    const requestContext = await this.buildRequestContext();
    const response = await agent.declineToolCall({
      runId: this.currentRunId,
      toolCallId,
      requireToolApproval: true,
      memory: this.currentThreadId ? { thread: this.currentThreadId, resource: this.resourceId } : undefined,
      abortSignal: this.abortController.signal,
      requestContext,
      toolsets: await this.buildToolsets(requestContext),
    });

    return await this.processStream(response);
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to harness events. Returns an unsubscribe function.
   */
  subscribe(listener: HarnessEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private emit(event: HarnessEvent): void {
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result && typeof result === 'object' && 'catch' in result) {
          (result as Promise<void>).catch(err => console.error('Error in harness event listener:', err));
        }
      } catch (err) {
        console.error('Error in harness event listener:', err);
      }
    }
  }

  // ===========================================================================
  // Runtime Context
  // ===========================================================================

  /**
   * Build the toolsets object that includes built-in harness tools (ask_user, submit_plan,
   * and optionally subagent) plus any user-configured tools.
   * Used by sendMessage, handleToolApprove, and handleToolDecline.
   */
  private async buildToolsets(requestContext: RequestContext): Promise<ToolsetsInput> {
    const builtInTools: ToolsInput = {
      ask_user: askUserTool,
      submit_plan: submitPlanTool,
      task_write: taskWriteTool,
      task_check: taskCheckTool,
    };

    // Resolve user-configured harness tools (needed for both the harness toolset and subagent allowedHarnessTools)
    let resolvedHarnessTools = undefined;
    if (this.config.tools) {
      const tools =
        typeof this.config.tools === 'function' ? await this.config.tools({ requestContext }) : this.config.tools;
      if (tools) {
        resolvedHarnessTools = tools;
      }
    }

    // Auto-create subagent tool if subagent definitions are configured
    if (this.config.subagents?.length && this.config.resolveModel) {
      const currentMode = this.getCurrentMode();
      builtInTools.subagent = createSubagentTool({
        subagents: this.config.subagents,
        resolveModel: this.config.resolveModel,
        harnessTools: resolvedHarnessTools,
        fallbackModelId: currentMode?.defaultModelId,
      });
    }

    if (resolvedHarnessTools) {
      return { harnessBuiltIn: builtInTools, harness: resolvedHarnessTools };
    }
    return { harnessBuiltIn: builtInTools };
  }

  /**
   * Build request context for agent execution.
   * Tools can access harness state via requestContext.get('harness').
   */
  private async buildRequestContext(): Promise<RequestContext> {
    const harnessContext: HarnessRequestContext<TState> = {
      harnessId: this.id,
      state: this.getState(),
      getState: () => this.getState(),
      setState: updates => this.setState(updates),
      threadId: this.currentThreadId,
      resourceId: this.resourceId,
      modeId: this.currentModeId,
      abortSignal: this.abortController?.signal,
      workspace: this.workspace,
      emitEvent: event => this.emit(event),
      registerQuestion: params => this.registerQuestion(params),
      registerPlanApproval: params => this.registerPlanApproval(params),
      getSubagentModelId: params => this.getSubagentModelId(params),
    };

    const requestContext = new RequestContext([['harness', harnessContext]]) as RequestContext;

    if (this.workspaceFn) {
      harnessContext.workspace = await Promise.resolve(this.workspaceFn({ requestContext }));
    }

    return requestContext;
  }

  // ===========================================================================
  // Token Usage
  // ===========================================================================

  getTokenUsage(): { promptTokens: number; completionTokens: number; totalTokens: number } {
    return { ...this.tokenUsage };
  }

  private async persistTokenUsage(): Promise<void> {
    if (!this.currentThreadId || !this.config.storage) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId: this.currentThreadId });
      if (thread) {
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: { ...thread.metadata, tokenUsage: this.tokenUsage },
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Token persistence is not critical
    }
  }

  // ===========================================================================
  // Workspace
  // ===========================================================================

  getWorkspace(): Workspace | undefined {
    return this.workspace;
  }

  hasWorkspace(): boolean {
    return this.config.workspace !== undefined;
  }

  isWorkspaceReady(): boolean {
    if (this.workspaceFn) return true;
    return this.workspaceInitialized && this.workspace !== undefined;
  }

  async destroyWorkspace(): Promise<void> {
    if (this.workspaceFn) return;
    if (this.workspace && this.workspaceInitialized) {
      try {
        this.emit({ type: 'workspace_status_changed', status: 'destroying' });
        await this.workspace.destroy();
        this.emit({ type: 'workspace_status_changed', status: 'destroyed' });
      } catch (error) {
        console.warn('Workspace destroy failed:', error);
      } finally {
        this.workspaceInitialized = false;
      }
    }
  }

  // ===========================================================================
  // Heartbeat Handlers
  // ===========================================================================

  private startHeartbeats(): void {
    const handlers = this.config.heartbeatHandlers;
    if (!handlers?.length) return;

    for (const hb of handlers) {
      if (this.heartbeatTimers.has(hb.id)) continue;

      const run = async () => {
        try {
          await hb.handler();
        } catch (error) {
          console.error(`[Heartbeat:${hb.id}] failed:`, error);
        }
      };

      if (hb.immediate !== false) {
        void run();
      }

      const timer = setInterval(run, hb.intervalMs);
      timer.unref();
      this.heartbeatTimers.set(hb.id, { timer, shutdown: hb.shutdown });
    }
  }

  registerHeartbeat(handler: HeartbeatHandler): void {
    void this.removeHeartbeat({ id: handler.id });

    const run = async () => {
      try {
        await handler.handler();
      } catch (error) {
        console.error(`[Heartbeat:${handler.id}] failed:`, error);
      }
    };

    if (handler.immediate !== false) {
      void run();
    }

    const timer = setInterval(run, handler.intervalMs);
    timer.unref();
    this.heartbeatTimers.set(handler.id, { timer, shutdown: handler.shutdown });
  }

  async removeHeartbeat({ id }: { id: string }): Promise<void> {
    const entry = this.heartbeatTimers.get(id);
    if (entry) {
      clearInterval(entry.timer);
      this.heartbeatTimers.delete(id);
      try {
        await entry.shutdown?.();
      } catch (error) {
        console.error(`[Heartbeat:${id}] shutdown failed:`, error);
      }
    }
  }

  async stopHeartbeats(): Promise<void> {
    const entries = [...this.heartbeatTimers.entries()];
    this.heartbeatTimers.clear();

    for (const [id, entry] of entries) {
      clearInterval(entry.timer);
      try {
        await entry.shutdown?.();
      } catch (error) {
        console.error(`[Heartbeat:${id}] shutdown failed:`, error);
      }
    }
  }

  // ===========================================================================
  // Session
  // ===========================================================================

  async getSession(): Promise<HarnessSession> {
    return {
      currentThreadId: this.currentThreadId,
      currentModeId: this.currentModeId,
      threads: await this.listThreads(),
    };
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private generateId(): string {
    if (this.config.idGenerator) {
      return this.config.idGenerator();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
