import type z from 'zod';

import type { MastraDBMessage } from '../agent';
import { RequestContext } from '../request-context';
import { Workspace } from '../workspace';
import type { WorkspaceConfig } from '../workspace';

import type {
  HarnessConfig,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMessageContent,
  HarnessMode,
  HarnessModeAccessor,
  HarnessRequestContext,
  HarnessStateAccessor,
  HarnessStateSchema,
  HarnessThread,
  HarnessThreads,
  HarnessUsageAccessor,
  HarnessSession,
  TokenUsage,
} from './types';

// =============================================================================
// Harness Class
// =============================================================================

/**
 * The Harness orchestrates multiple agent modes, shared state, memory, and storage.
 * It's the core abstraction that a TUI (or other UI) controls to build
 * AI coding agents.
 *
 * Public API is organized into namespaced sub-objects for clarity:
 * - `harness.threads` — thread CRUD + message loading
 * - `harness.state` — validated state get/set
 * - `harness.modes` — mode switching
 * - `harness.usage` — token tracking
 *
 * Top-level methods are reserved for the core conversation loop
 * (`send`, `abort`, `steer`) and lifecycle (`init`, `destroy`).
 *
 * @example
 * ```ts
 * const harness = new Harness({
 *   id: "my-coding-agent",
 *   resourceId: "project-123",
 *   storage: compositeStore,
 *   stateSchema: z.object({
 *     currentModelId: z.string().default("anthropic/claude-sonnet-4-20250514"),
 *   }),
 *   modes: [
 *     {
 *       id: "plan",
 *       name: "Plan Mode",
 *       default: true,
 *       agent: (state) => planAgent,
 *     },
 *   ],
 * })
 *
 * harness.subscribe((event) => {
 *   if (event.type === "message_update") renderMessage(event.message)
 * })
 *
 * await harness.init()
 * await harness.threads.selectOrCreate()
 * await harness.send("Hello!")
 * ```
 */
export class Harness<TState extends HarnessStateSchema = HarnessStateSchema> {
  readonly id: string;

  // -- Namespaced public API ---------------------------------------------
  readonly threads: HarnessThreads;
  readonly state: HarnessStateAccessor<TState>;
  readonly modes: HarnessModeAccessor<TState>;
  readonly usage: HarnessUsageAccessor;

  // -- Config & internal state -------------------------------------------
  private config: HarnessConfig<TState>;
  private _state: z.infer<TState>;
  private _currentModeId: string;
  private _currentThreadId: string | null = null;
  private _resourceId: string;
  private _defaultResourceId: string;
  private _userId: string | undefined;
  private _isRemoteStorage: boolean;

  // -- Event system -----------------------------------------------------
  private listeners: HarnessEventListener[] = [];

  // -- Operation tracking -----------------------------------------------
  private abortController: AbortController | null = null;
  private abortRequested: boolean = false;
  private currentOperationId: number = 0;
  private currentRunId: string | null = null;
  private followUpQueue: string[] = [];

  // -- Tool approval ----------------------------------------------------
  private pendingApprovalResolve: ((decision: 'approve' | 'decline') => void) | null = null;

  // -- Interactive prompts ----------------------------------------------
  private pendingQuestions = new Map<string, (answer: string) => void>();
  private pendingPlanApprovals = new Map<
    string,
    (result: { action: 'approved' | 'rejected'; feedback?: string }) => void
  >();

  // -- Token usage ------------------------------------------------------
  private _tokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // -- Workspace --------------------------------------------------------
  private _workspace: Workspace | undefined = undefined;
  private workspaceInitialized = false;

  // =====================================================================
  // Lifecycle
  // =====================================================================

  constructor(config: HarnessConfig<TState>) {
    this.id = config.id;
    this.config = config;
    this._resourceId = config.resourceId;
    this._defaultResourceId = config.defaultResourceId ?? config.resourceId;
    this._userId = config.userId;
    this._isRemoteStorage = config.isRemoteStorage ?? false;

    // Initialize state from schema defaults + initial overrides
    this._state = {
      ...this.getSchemaDefaults(),
      ...config.initialState,
    } as z.infer<TState>;

    // Find default mode
    const defaultMode = config.modes.find(m => m.default) ?? config.modes[0];
    if (!defaultMode) {
      throw new Error('Harness requires at least one agent mode');
    }
    this._currentModeId = defaultMode.id;

    // Store pre-built workspace (config-based workspace is constructed in init())
    if (config.workspace instanceof Workspace) {
      this._workspace = config.workspace;
    }

    // Build namespaced public API
    this.threads = {
      create: title => this.createThread(title),
      list: opts => this.listThreads(opts),
      switch: id => this.switchThread(id),
      rename: title => this.renameThread(title),
      selectOrCreate: () => this.selectOrCreateThread(),
      current: () => this._currentThreadId,
      messages: opts => this.listMessages(opts),
      persistSetting: (key, value) => this.persistThreadSetting(key, value),
    };

    this.state = {
      get: () => this.getState(),
      set: updates => this.setState(updates),
    };

    this.modes = {
      list: () => this.getModes(),
      switch: id => this.switchMode(id),
      current: () => this.getCurrentMode(),
      currentId: () => this._currentModeId,
    };

    this.usage = {
      get: () => this.getTokenUsage(),
    };
  }

  /**
   * Initialize the harness — storage and optional workspace.
   * Must be called before using the harness.
   *
   * Note: Does NOT auto-select a thread.
   * Call `threads.selectOrCreate()` or `threads.create()` after init.
   */
  async init(): Promise<void> {
    await this.config.storage.init();

    // Initialize workspace if configured
    if (this.config.workspace && !this.workspaceInitialized) {
      try {
        if (!this._workspace) {
          this._workspace = new Workspace(this.config.workspace as WorkspaceConfig);
        }

        void this.emit({
          type: 'workspace_status_changed',
          status: 'initializing',
        });

        await this._workspace.init();
        this.workspaceInitialized = true;

        void this.emit({
          type: 'workspace_status_changed',
          status: 'ready',
        });
        void this.emit({
          type: 'workspace_ready',
          workspaceId: this._workspace.id,
          workspaceName: this._workspace.name,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this._workspace = undefined;
        this.workspaceInitialized = false;

        void this.emit({
          type: 'workspace_status_changed',
          status: 'error',
          error: err,
        });
        void this.emit({
          type: 'workspace_error',
          error: err,
        });
      }
    }
  }

  /**
   * Destroy the harness — clean up workspace and resources.
   */
  async destroy(): Promise<void> {
    this.abort();

    if (this._workspace && this.workspaceInitialized) {
      try {
        void this.emit({
          type: 'workspace_status_changed',
          status: 'destroying',
        });
        await this._workspace.destroy();
        void this.emit({
          type: 'workspace_status_changed',
          status: 'destroyed',
        });
      } catch {
        // Best-effort cleanup
      } finally {
        this.workspaceInitialized = false;
      }
    }
  }

  // =====================================================================
  // Event System
  // =====================================================================

  /**
   * Subscribe to harness events.
   * Returns an unsubscribe function.
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

  /** Emit an event to all listeners. */
  private async emit(event: HarnessEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (err) {
        console.error('Error in harness event listener:', err);
      }
    }
  }

  // =====================================================================
  // Identity & Resource
  // =====================================================================

  /**
   * Get the current resource ID.
   */
  getResourceId(): string {
    return this._resourceId;
  }

  /**
   * Get the default (auto-detected) resource ID.
   */
  getDefaultResourceId(): string {
    return this._defaultResourceId;
  }

  /**
   * Set the resource ID (e.g., switching projects).
   * Clears the current thread.
   */
  setResourceId(resourceId: string): void {
    this._resourceId = resourceId;
    this._currentThreadId = null;
  }

  // =====================================================================
  // Control Flow
  // =====================================================================

  /**
   * Send a user message to the current mode's agent and process its stream.
   */
  async send(
    content: string,
    options?: {
      maxSteps?: number;
    },
  ): Promise<void> {
    if (!content.trim()) return;
    if (this.isRunning()) {
      throw new Error('Harness is already running');
    }

    const beforeSendResult = await this.config.hooks?.onBeforeSend?.(content);
    if (beforeSendResult && !beforeSendResult.allowed) {
      if (beforeSendResult.blockReason) {
        void this.emit({ type: 'info', message: beforeSendResult.blockReason });
      }
      return;
    }

    if (!this._currentThreadId) {
      await this.selectOrCreateThread();
    }

    this.abortRequested = false;
    this.currentOperationId += 1;
    this.abortController = new AbortController();
    let endReason: 'complete' | 'aborted' | 'error' = 'complete';

    void this.emit({ type: 'agent_start' });

    try {
      const agent = this.getCurrentAgent();
      const modelId = (this._state as Record<string, unknown>).currentModelId;
      const dynamicToolsets = typeof modelId === 'string' ? this.config.getToolsets?.(modelId) : undefined;

      const streamResult = await agent.stream(content, {
        requestContext: this.buildRequestContext(),
        memory: this._currentThreadId
          ? {
              thread: this._currentThreadId,
              resource: this._resourceId,
            }
          : undefined,
        toolsets: dynamicToolsets as any,
        maxSteps: options?.maxSteps,
      });

      const result = await this.processStream(streamResult.fullStream);
      await this.persistTokenUsage();

      const afterSend = await this.config.hooks?.onAfterSend?.({
        text: result.text,
        stopReason: result.stopReason,
      });
      if (afterSend?.continueWorking) {
        this.followUpQueue.push(afterSend.reason?.trim() || 'Continue with the next best step.');
        void this.emit({
          type: 'follow_up_queued',
          count: this.followUpQueue.length,
        });
      }
    } catch (error) {
      endReason = 'error';
      const parsed = this.config.hooks?.onError?.(error) ?? {
        error: error instanceof Error ? error : new Error(String(error)),
      };

      void this.emit({
        type: 'error',
        error: parsed.error,
        errorType: parsed.errorType,
        retryable: parsed.retryable,
        retryDelay: parsed.retryDelay,
      });
      throw parsed.error;
    } finally {
      this.abortController = null;
      if (this.abortRequested) {
        endReason = 'aborted';
      }
      void this.emit({ type: 'agent_end', reason: endReason });
    }
  }

  /**
   * Queue a follow-up steering instruction.
   */
  steer(instruction: string): void {
    if (!instruction.trim()) return;
    this.followUpQueue.push(instruction);
    void this.emit({ type: 'follow_up_queued', count: this.followUpQueue.length });
  }

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
   * Check if an operation is currently in progress.
   */
  isRunning(): boolean {
    return this.abortController !== null;
  }

  /**
   * Get the number of queued follow-up messages.
   */
  getFollowUpCount(): number {
    return this.followUpQueue.length;
  }

  // =====================================================================
  // Tool Approval
  // =====================================================================

  /**
   * Respond to a pending tool approval from the UI.
   */
  resolveToolApprovalDecision(decision: 'approve' | 'decline'): void {
    if (this.pendingApprovalResolve) {
      this.pendingApprovalResolve(decision);
      this.pendingApprovalResolve = null;
    }
  }

  // =====================================================================
  // Questions & Plan Approvals
  // =====================================================================

  /**
   * Register a pending question resolver (used by ask_user tools).
   */
  registerQuestion(questionId: string, resolve: (answer: string) => void): void {
    this.pendingQuestions.set(questionId, resolve);
  }

  /**
   * Resolve a pending question with the user's answer.
   */
  respondToQuestion(questionId: string, answer: string): void {
    const resolve = this.pendingQuestions.get(questionId);
    if (resolve) {
      this.pendingQuestions.delete(questionId);
      resolve(answer);
    }
  }

  /**
   * Register a pending plan approval resolver (used by submit_plan tools).
   */
  registerPlanApproval(
    planId: string,
    resolve: (result: { action: 'approved' | 'rejected'; feedback?: string }) => void,
  ): void {
    this.pendingPlanApprovals.set(planId, resolve);
  }

  /**
   * Respond to a pending plan approval.
   */
  async respondToPlanApproval(
    planId: string,
    response: {
      action: 'approved' | 'rejected';
      feedback?: string;
    },
  ): Promise<void> {
    const resolve = this.pendingPlanApprovals.get(planId);
    if (!resolve) return;

    this.pendingPlanApprovals.delete(planId);
    resolve(response);
  }

  // =====================================================================
  // Workspace
  // =====================================================================

  /**
   * Get the workspace instance (if configured and initialized).
   */
  getWorkspace(): Workspace | undefined {
    return this._workspace;
  }

  /**
   * Check if a workspace is configured.
   */
  hasWorkspace(): boolean {
    return this.config.workspace !== undefined;
  }

  /**
   * Check if the workspace is initialized and ready.
   */
  isWorkspaceReady(): boolean {
    return this.workspaceInitialized && this._workspace !== undefined;
  }

  // =====================================================================
  // Session
  // =====================================================================

  /**
   * Get current session info (for UI display).
   */
  async session(): Promise<HarnessSession> {
    return {
      currentThreadId: this._currentThreadId,
      currentModeId: this._currentModeId,
      threads: await this.listThreads(),
    };
  }

  // =====================================================================
  // State Management (private — exposed via this.state)
  // =====================================================================

  private getState(): Readonly<z.infer<TState>> {
    return { ...this._state };
  }

  private async setState(updates: Partial<z.infer<TState>>): Promise<void> {
    const changedKeys = Object.keys(updates);
    const newState = { ...this._state, ...updates };

    const result = this.config.stateSchema.safeParse(newState);
    if (!result.success) {
      throw new Error(`Invalid state update: ${result.error.message}`);
    }

    this._state = result.data as z.infer<TState>;

    void this.emit({
      type: 'state_changed',
      state: this._state,
      changedKeys,
    });
  }

  /** Extract default values from Zod schema shape. */
  private getSchemaDefaults(): Partial<z.infer<TState>> {
    const shape = this.config.stateSchema.shape;
    const defaults: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(shape)) {
      if (field instanceof Object && '_def' in field) {
        const def = (field as any)._def;
        if (def.defaultValue !== undefined) {
          defaults[key] = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
        }
      }
    }

    return defaults as Partial<z.infer<TState>>;
  }

  // =====================================================================
  // Mode Management (private — exposed via this.modes)
  // =====================================================================

  private getModes(): HarnessMode<TState>[] {
    return this.config.modes;
  }

  private getCurrentMode(): HarnessMode<TState> {
    const mode = this.config.modes.find(m => m.id === this._currentModeId);
    if (!mode) {
      throw new Error(`Mode not found: ${this._currentModeId}`);
    }
    return mode;
  }

  private async switchMode(modeId: string): Promise<void> {
    const mode = this.config.modes.find(m => m.id === modeId);
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    this.abort();

    const previousModeId = this._currentModeId;
    this._currentModeId = modeId;

    await this.persistThreadSetting('currentModeId', modeId);

    void this.emit({
      type: 'mode_changed',
      modeId,
      previousModeId,
    });
  }

  /**
   * Resolve the agent for the current mode.
   * Handles both static Agent instances and dynamic factory functions.
   */
  private getCurrentAgent() {
    const mode = this.getCurrentMode();
    if (typeof mode.agent === 'function') {
      return mode.agent(this._state);
    }
    return mode.agent;
  }

  // =====================================================================
  // Thread Management (private — exposed via this.threads)
  // =====================================================================

  private async getMemoryStorage() {
    const memoryStorage = await this.config.storage.getStore('memory');
    if (!memoryStorage) {
      throw new Error('Storage does not have a memory domain configured');
    }
    return memoryStorage;
  }

  private async createThread(title?: string): Promise<HarnessThread> {
    const now = new Date();
    const thread: HarnessThread = {
      id: this.generateId(),
      resourceId: this._resourceId,
      title: title || 'New Thread',
      createdAt: now,
      updatedAt: now,
    };

    const hookMeta = this.config.hooks?.onThreadCreate?.(thread, this._state) ?? {};

    const metadata: Record<string, unknown> = { ...hookMeta };

    if (this._userId) {
      metadata.createdBy = this._userId;
    }

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

    this._currentThreadId = thread.id;

    this._tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    void this.emit({ type: 'thread_created', thread });

    return thread;
  }

  private async switchThread(threadId: string): Promise<void> {
    this.abort();

    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const previousThreadId = this._currentThreadId;
    this._currentThreadId = threadId;

    await this.loadThreadMetadata();

    void this.emit({
      type: 'thread_changed',
      threadId,
      previousThreadId,
    });
  }

  private async listThreads(options?: { allResources?: boolean; mineOnly?: boolean }): Promise<HarnessThread[]> {
    const memoryStorage = await this.getMemoryStorage();

    const mineOnly = options?.mineOnly ?? (this._isRemoteStorage && !!this._userId && !options?.allResources);

    const metadataFilter: Record<string, unknown> = {};
    if (mineOnly && this._userId) {
      metadataFilter.createdBy = this._userId;
    }

    const filter = options?.allResources
      ? undefined
      : {
          resourceId: this._resourceId,
          ...(Object.keys(metadataFilter).length > 0 ? { metadata: metadataFilter } : {}),
        };

    const result = await memoryStorage.listThreads({
      perPage: options?.allResources ? false : undefined,
      filter,
    });

    return result.threads.map(thread => ({
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: thread.metadata,
    }));
  }

  private async renameThread(title: string): Promise<void> {
    if (!this._currentThreadId) return;

    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({
      threadId: this._currentThreadId,
    });
    if (thread) {
      await memoryStorage.saveThread({
        thread: {
          ...thread,
          title,
          updatedAt: new Date(),
        },
      });
    }
  }

  private async selectOrCreateThread(): Promise<HarnessThread> {
    const threads = await this.listThreads();

    if (threads.length === 0) {
      return await this.createThread();
    }

    const sorted = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const mostRecent = sorted[0]!;
    this._currentThreadId = mostRecent.id;
    await this.loadThreadMetadata();

    return mostRecent;
  }

  private async persistThreadSetting(key: string, value: unknown): Promise<void> {
    if (!this._currentThreadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({
        threadId: this._currentThreadId,
      });
      if (thread) {
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: {
              ...thread.metadata,
              [key]: value,
            },
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Settings persistence is not critical
    }
  }

  private async removeThreadSetting(key: string): Promise<void> {
    if (!this._currentThreadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({
        threadId: this._currentThreadId,
      });
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
    if (!this._currentThreadId) {
      this._tokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
      return;
    }

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({
        threadId: this._currentThreadId,
      });

      const savedUsage = thread?.metadata?.tokenUsage as TokenUsage | undefined;
      if (savedUsage) {
        this._tokenUsage = {
          promptTokens: savedUsage.promptTokens ?? 0,
          completionTokens: savedUsage.completionTokens ?? 0,
          totalTokens: savedUsage.totalTokens ?? 0,
        };
      } else {
        this._tokenUsage = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        };
      }

      const meta = thread?.metadata as Record<string, unknown> | undefined;
      if (meta?.currentModeId) {
        const savedModeId = meta.currentModeId as string;
        const modeExists = this.config.modes.some(m => m.id === savedModeId);
        if (modeExists && savedModeId !== this._currentModeId) {
          const previousModeId = this._currentModeId;
          this._currentModeId = savedModeId;
          void this.emit({
            type: 'mode_changed',
            modeId: savedModeId,
            previousModeId,
          });
        }
      }

      if (meta && this.config.hooks?.onThreadLoad) {
        const updates = this.config.hooks.onThreadLoad(meta);
        if (updates && Object.keys(updates).length > 0) {
          await this.setState(updates);
        }
      }
    } catch {
      this._tokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }
  }

  // =====================================================================
  // Messages & Stream Processing
  // =====================================================================

  private buildRequestContext(): RequestContext<HarnessRequestContext<TState>> {
    const ctx = new RequestContext<HarnessRequestContext<TState>>();
    ctx.set('harnessId', this.id);
    ctx.set('threadId', this._currentThreadId);
    ctx.set('resourceId', this._resourceId);
    ctx.set('modeId', this._currentModeId);
    ctx.set('state', this.getState() as z.infer<TState>);
    return ctx;
  }

  private async processStream(stream: any): Promise<{ text?: string; stopReason: string }> {
    let message: HarnessMessage | null = null;
    let stopReason: 'complete' | 'tool_use' | 'aborted' | 'error' = 'complete';
    let approvalDeclined = false;

    const reader = stream.getReader();
    while (true) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      const part = chunk as any;

      // OM and other data chunks
      if (typeof part.type === 'string' && part.type.startsWith('data-')) {
        const data = (part.data ?? {}) as Record<string, unknown>;
        switch (part.type) {
          case 'data-om-status':
            void this.emit({ type: 'om_status', ...(data as any) });
            break;
          case 'data-om-observation-start':
            void this.emit({ type: 'om_observation_start', ...(data as any) });
            break;
          case 'data-om-observation-end':
            void this.emit({ type: 'om_observation_end', ...(data as any) });
            break;
          case 'data-om-observation-failed':
            void this.emit({ type: 'om_observation_failed', ...(data as any) });
            break;
          case 'data-om-reflection-start':
            void this.emit({ type: 'om_reflection_start', ...(data as any) });
            break;
          case 'data-om-reflection-end':
            void this.emit({ type: 'om_reflection_end', ...(data as any) });
            break;
          case 'data-om-reflection-failed':
            void this.emit({ type: 'om_reflection_failed', ...(data as any) });
            break;
          case 'data-om-buffering-start':
            void this.emit({ type: 'om_buffering_start', ...(data as any) });
            break;
          case 'data-om-buffering-end':
            void this.emit({ type: 'om_buffering_end', ...(data as any) });
            break;
          case 'data-om-buffering-failed':
            void this.emit({ type: 'om_buffering_failed', ...(data as any) });
            break;
          case 'data-om-activation':
            void this.emit({ type: 'om_activation', ...(data as any) });
            break;
          case 'data-om-model-changed':
            void this.emit({ type: 'om_model_changed', ...(data as any) });
            break;
          default:
            break;
        }
        continue;
      }

      switch (part.type) {
        case 'text-start': {
          message = {
            id: part.payload?.id ?? this.generateId(),
            role: 'assistant',
            content: [],
            createdAt: new Date(),
          };
          void this.emit({ type: 'message_start', message });
          break;
        }
        case 'text-delta': {
          if (!message) {
            message = {
              id: part.payload?.id ?? this.generateId(),
              role: 'assistant',
              content: [],
              createdAt: new Date(),
            };
            void this.emit({ type: 'message_start', message });
          }
          const textDelta = String(part.payload?.text ?? '');
          if (textDelta) {
            const last = message.content[message.content.length - 1];
            if (last?.type === 'text') {
              last.text += textDelta;
            } else {
              message.content.push({ type: 'text', text: textDelta });
            }
            void this.emit({ type: 'message_update', message });
          }
          break;
        }
        case 'reasoning-delta': {
          if (!message) {
            message = {
              id: this.generateId(),
              role: 'assistant',
              content: [],
              createdAt: new Date(),
            };
            void this.emit({ type: 'message_start', message });
          }
          const thinkingDelta = String(part.payload?.text ?? '');
          if (thinkingDelta) {
            const last = message.content[message.content.length - 1];
            if (last?.type === 'thinking') {
              last.thinking += thinkingDelta;
            } else {
              message.content.push({
                type: 'thinking',
                thinking: thinkingDelta,
              });
            }
            void this.emit({ type: 'message_update', message });
          }
          break;
        }
        case 'tool-call': {
          if (!message) {
            message = {
              id: this.generateId(),
              role: 'assistant',
              content: [],
              createdAt: new Date(),
            };
            void this.emit({ type: 'message_start', message });
          }
          const toolCallId = String(part.payload?.toolCallId ?? this.generateId());
          const toolName = String(part.payload?.toolName ?? 'unknown_tool');
          const args = part.payload?.args;
          message.content.push({
            type: 'tool_call',
            id: toolCallId,
            name: toolName,
            args,
          });
          void this.emit({
            type: 'tool_start',
            toolCallId,
            toolName,
            args,
          });
          void this.emit({ type: 'message_update', message });
          break;
        }
        case 'tool-call-approval': {
          const toolCallId = String(part.payload?.toolCallId ?? this.generateId());
          const toolName = String(part.payload?.toolName ?? 'unknown_tool');
          const args = part.payload?.args;
          const policyDecision = this.config.hooks?.resolveToolApproval?.(toolName, args) ?? 'ask';
          let approved = policyDecision === 'allow';

          if (policyDecision === 'deny') {
            approved = false;
          } else if (policyDecision === 'ask') {
            void this.emit({
              type: 'tool_approval_required',
              toolCallId,
              toolName,
              args,
            });
            const userDecision = await new Promise<'approve' | 'decline'>(resolve => {
              this.pendingApprovalResolve = resolve;
            });
            approved = userDecision === 'approve';
            this.pendingApprovalResolve = null;
          }

          if (approved) {
            const beforeTool = await this.config.hooks?.onBeforeToolUse?.(toolName, args);
            if (beforeTool && !beforeTool.allowed) {
              approved = false;
            }
          }

          if (!approved) {
            approvalDeclined = true;
            const declineMessage = 'Tool call was declined by approval policy.';
            if (message) {
              message.content.push({
                type: 'tool_result',
                id: toolCallId,
                name: toolName,
                result: declineMessage,
                isError: true,
              });
              void this.emit({ type: 'message_update', message });
            }
            void this.emit({
              type: 'tool_end',
              toolCallId,
              result: declineMessage,
              isError: true,
            });
          }
          break;
        }
        case 'tool-result': {
          if (!message) {
            message = {
              id: this.generateId(),
              role: 'assistant',
              content: [],
              createdAt: new Date(),
            };
            void this.emit({ type: 'message_start', message });
          }
          const toolCallId = String(part.payload?.toolCallId ?? this.generateId());
          const toolName = String(part.payload?.toolName ?? 'unknown_tool');
          const result = part.payload?.result;
          const isError = Boolean(part.payload?.isError);
          message.content.push({
            type: 'tool_result',
            id: toolCallId,
            name: toolName,
            result,
            isError,
          });
          void this.emit({
            type: 'tool_end',
            toolCallId,
            result,
            isError,
          });
          void this.emit({ type: 'message_update', message });
          void this.config.hooks?.onAfterToolUse?.(toolName, part.payload?.args, result, isError);
          break;
        }
        case 'tool-error': {
          const toolCallId = String(part.payload?.toolCallId ?? this.generateId());
          const toolName = String(part.payload?.toolName ?? 'unknown_tool');
          const errorValue = part.payload?.error;
          void this.emit({
            type: 'tool_end',
            toolCallId,
            result: errorValue,
            isError: true,
          });
          void this.config.hooks?.onAfterToolUse?.(toolName, part.payload?.args, errorValue, true);
          break;
        }
        case 'step-finish':
        case 'finish': {
          const usage = part.payload?.output?.usage;
          const prompt = Number(usage?.inputTokens ?? usage?.promptTokens ?? 0) || 0;
          const completion = Number(usage?.outputTokens ?? usage?.completionTokens ?? 0) || 0;
          const total = Number(usage?.totalTokens ?? prompt + completion) || 0;
          this._tokenUsage = {
            promptTokens: prompt,
            completionTokens: completion,
            totalTokens: total,
          };
          void this.emit({
            type: 'usage_update',
            usage: this._tokenUsage,
          });
          if (part.type === 'finish') {
            const reason = String(part.payload?.stepResult?.reason ?? '');
            stopReason = reason === 'tool-calls' || reason === 'tool-use' ? 'tool_use' : 'complete';
            if (approvalDeclined && stopReason === 'complete') {
              stopReason = 'tool_use';
            }
            if (message) {
              message.stopReason = stopReason;
              void this.emit({ type: 'message_end', message });
            }
          }
          break;
        }
        case 'abort': {
          stopReason = 'aborted';
          if (message) {
            message.stopReason = 'aborted';
            void this.emit({ type: 'message_end', message });
          }
          break;
        }
        case 'error': {
          stopReason = 'error';
          const err = part.payload?.error;
          const messageText = err instanceof Error ? err.message : String(err);
          if (!message) {
            message = {
              id: this.generateId(),
              role: 'assistant',
              content: [],
              createdAt: new Date(),
            };
          }
          message.errorMessage = messageText;
          message.stopReason = 'error';
          void this.emit({
            type: 'error',
            error: err instanceof Error ? err : new Error(String(messageText)),
          });
          void this.emit({ type: 'message_end', message });
          break;
        }
        default:
          break;
      }
    }

    const text = message?.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return { text, stopReason };
  }

  private async listMessages(options?: { threadId?: string }): Promise<HarnessMessage[]> {
    const threadId = options?.threadId ?? this._currentThreadId;
    if (!threadId) return [];

    const memoryStorage = await this.getMemoryStorage();
    const result = await memoryStorage.listMessages({
      threadId,
      perPage: false,
    });

    return result.messages.map(message => this.convertToHarnessMessage(message as MastraDBMessage));
  }

  private convertToHarnessMessage(message: MastraDBMessage): HarnessMessage {
    const content: HarnessMessageContent[] = [];

    for (const part of message.content.parts ?? []) {
      if (part.type === 'text' && 'text' in part) {
        content.push({ type: 'text', text: String(part.text ?? '') });
        continue;
      }

      if (part.type === 'reasoning') {
        const reasoningText = 'text' in part && typeof part.text === 'string' ? part.text : '';
        if (reasoningText) {
          content.push({ type: 'thinking', thinking: reasoningText });
        }
        continue;
      }

      if (part.type === 'tool-invocation' && 'toolInvocation' in part) {
        const invocation = part.toolInvocation as unknown as Record<string, unknown>;
        const toolCallId = String(invocation.toolCallId ?? this.generateId());
        const toolName = String(invocation.toolName ?? 'unknown_tool');
        const state = String(invocation.state ?? 'call');
        if (state === 'result') {
          content.push({
            type: 'tool_result',
            id: toolCallId,
            name: toolName,
            result: invocation.result,
            isError: false,
          });
        } else {
          content.push({
            type: 'tool_call',
            id: toolCallId,
            name: toolName,
            args: invocation.args,
          });
        }
        continue;
      }

      if (part.type === 'file' && 'mimeType' in part && 'data' in part) {
        const mimeType = String(part.mimeType ?? '');
        const data = part.data;
        if (mimeType.startsWith('image/') && typeof data === 'string') {
          content.push({
            type: 'image',
            data,
            mimeType,
          });
        }
        continue;
      }

      if (typeof part.type === 'string' && part.type.startsWith('data-om-')) {
        const data = (part as any).data ?? {};
        if (part.type === 'data-om-observation-start') {
          content.push({
            type: 'om_observation_start',
            tokensToObserve: Number(data.tokensToObserve ?? 0),
            operationType: data.operationType,
          });
        } else if (part.type === 'data-om-observation-end') {
          content.push({
            type: 'om_observation_end',
            tokensObserved: Number(data.tokensObserved ?? 0),
            observationTokens: Number(data.observationTokens ?? 0),
            durationMs: Number(data.durationMs ?? 0),
            operationType: data.operationType,
            observations: data.observations,
            currentTask: data.currentTask,
            suggestedResponse: data.suggestedResponse,
          });
        } else if (part.type === 'data-om-observation-failed') {
          content.push({
            type: 'om_observation_failed',
            error: String(data.error ?? 'Unknown error'),
            tokensAttempted: data.tokensAttempted != null ? Number(data.tokensAttempted) : undefined,
            operationType: data.operationType,
          });
        }
      }
    }

    return {
      id: message.id,
      role: message.role,
      content,
      createdAt: message.createdAt,
    };
  }

  private async persistTokenUsage(): Promise<void> {
    await this.persistThreadSetting('tokenUsage', this._tokenUsage);
  }

  // =====================================================================
  // Token Usage (private — exposed via this.usage)
  // =====================================================================

  private getTokenUsage(): TokenUsage {
    return { ...this._tokenUsage };
  }

  // =====================================================================
  // Utilities
  // =====================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
