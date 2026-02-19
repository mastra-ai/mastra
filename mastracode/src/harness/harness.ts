import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Agent, MastraMessageContentV2 } from '@mastra/core/agent';
import type { StorageThreadType } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { Workspace } from '@mastra/core/workspace';
import type { WorkspaceConfig } from '@mastra/core/workspace';
import type { z } from 'zod';

import { AuthStorage, getOAuthProviders } from '../auth/index.js';
import type { OAuthProviderInterface, OAuthLoginCallbacks } from '../auth/index.js';
import type { HookManager } from '../hooks/index.js';
import type { MCPManager } from '../mcp/index.js';
import { SessionGrants, resolveApproval, createDefaultRules, getToolCategory } from '../permissions.js';
import type { PermissionRules, ToolCategory } from '../permissions.js';
import { parseError } from '../utils/errors.js';
import { acquireThreadLock, releaseThreadLock } from '../utils/thread-lock.js';
import type {
  HeartbeatHandler,
  HarnessConfig,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMessageContent,
  HarnessMode,
  HarnessRuntimeContext,
  HarnessSession,
  HarnessStateSchema,
  HarnessThread,
} from './types';

// =============================================================================
/**
 * Check if an unknown error object contains a substring in any of its
 * message-like properties. AI SDK errors may not be Error instances,
 * so we check .message, .error.message, and String() representation.
 */
function errorContains(error: unknown, needle: string): boolean {
  const errObj = error as Record<string, unknown>;
  const texts = [
    String(error),
    typeof errObj?.message === 'string' ? errObj.message : '',
    typeof (errObj?.error as Record<string, unknown>)?.message === 'string'
      ? String((errObj.error as Record<string, unknown>).message)
      : '',
  ];
  return texts.some(t => t.includes(needle));
}

// Harness Class
// =============================================================================

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
 *     activeModel: z.string(),
 *     thinkingLevel: z.enum(["off", "low", "medium", "high"]),
 *   }),
 *   initialState: {
 *     activeModel: "anthropic/claude-sonnet-4-20250514",
 *     thinkingLevel: "medium",
 *   },
 *   memory: new Memory({ storage }),
 *   modes: [
 *     {
 *       id: "plan",
 *       name: "Plan Mode",
 *       default: true,
 *       agent: (state) => new Agent({
 *         name: "Planner",
 *         model: state.activeModel,
 *         tools: { view: viewTool },
 *       }),
 *     },
 *     {
 *       id: "build",
 *       name: "Build Mode",
 *       agent: (state) => new Agent({
 *         name: "Builder",
 *         model: state.activeModel,
 *         tools: { view: viewTool, edit: editTool, bash: bashTool },
 *       }),
 *     },
 *   ],
 * })
 *
 * // TUI subscribes to events
 * harness.subscribe((event) => {
 *   if (event.type === "message_update") {
 *     renderMessage(event.message)
 *   }
 * })
 *
 * // TUI triggers actions
 * await harness.sendMessage("Hello!")
 * await harness.switchMode("build")
 * ```
 */
export class Harness<TState extends HarnessStateSchema = HarnessStateSchema> {
  readonly id: string;

  private config: HarnessConfig<TState>;
  private state: z.infer<TState>;
  private currentModeId: string;
  private currentThreadId: string | null = null;
  private resourceId: string;
  private defaultResourceId: string;
  private userId: string | undefined;
  private isRemoteStorage: boolean;
  private listeners: HarnessEventListener[] = [];
  private abortController: AbortController | null = null;
  private abortRequested: boolean = false;
  private currentRunId: string | null = null;
  private currentOperationId: number = 0;
  private followUpQueue: string[] = [];
  private pendingApprovalResolve: ((decision: 'approve' | 'decline' | 'always_allow_category') => void) | null = null;
  private workspace: Workspace | undefined = undefined;
  private workspaceFn:
    | ((ctx: { requestContext: RequestContext }) => Promise<Workspace | undefined> | Workspace | undefined)
    | undefined = undefined;
  private workspaceInitialized = false;
  private hookManager: HookManager | undefined;
  private mcpManager: MCPManager | undefined;
  private sessionGrants = new SessionGrants();
  private streamDebug = !!process.env.MASTRA_STREAM_DEBUG;
  private heartbeatTimers = new Map<string, { timer: NodeJS.Timeout; shutdown?: () => void | Promise<void> }>();
  private pendingQuestions = new Map<string, (answer: string) => void>();
  private pendingPlanApprovals = new Map<
    string,
    (result: { action: 'approved' | 'rejected'; feedback?: string }) => void
  >();
  private tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  constructor(config: HarnessConfig<TState>) {
    this.id = config.id;
    this.config = config;
    this.resourceId = config.resourceId;
    this.defaultResourceId = config.defaultResourceId ?? config.resourceId;
    this.userId = config.userId;
    this.isRemoteStorage = config.isRemoteStorage ?? false;

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

    // Store hook manager and MCP manager
    this.hookManager = config.hookManager;
    this.mcpManager = config.mcpManager;

    // Seed model from mode default or global last model if not set
    const currentModel = (this.state as any).currentModelId;
    if (!currentModel) {
      const lastModelId = config.authStorage?.getLastModelId();
      const seedModel = lastModelId || defaultMode.defaultModelId;
      if (seedModel) {
        this.setState({ currentModelId: seedModel } as unknown as Partial<z.infer<TState>>);
      }
    }
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================
  /**
   * Initialize the harness - loads persisted state.
   * Must be called before using the harness.
   *
   * Note: Does NOT auto-select a thread. Call selectThread() or createThread() after init.
   */
  async init(): Promise<void> {
    // Initialize storage
    await this.config.storage.init();

    // Load persisted state from storage (if we have a state storage mechanism)
    // For now, we use the initial state from config
    // TODO: Add state persistence via storage.getStore('agents') or custom domain

    // Initialize workspace if configured (skip for dynamic factory — resolved per-request)
    if (this.config.workspace && !this.workspaceInitialized && !this.workspaceFn) {
      try {
        // Construct workspace from config if not already a Workspace instance
        if (!this.workspace) {
          this.workspace = new Workspace(this.config.workspace as WorkspaceConfig);
        }

        this.emit({
          type: 'workspace_status_changed',
          status: 'initializing',
        });

        await this.workspace.init();
        this.workspaceInitialized = true;

        this.emit({
          type: 'workspace_status_changed',
          status: 'ready',
        });
        this.emit({
          type: 'workspace_ready',
          workspaceId: this.workspace.id,
          workspaceName: this.workspace.name,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.warn('Workspace initialization failed:', err.message);
        this.workspace = undefined;
        this.workspaceInitialized = false;

        this.emit({
          type: 'workspace_status_changed',
          status: 'error',
          error: err,
        });
        this.emit({
          type: 'workspace_error',
          error: err,
        });
      }
    }

    // Start heartbeat handlers
    this.startHeartbeats();
  }

  /**
   * Select the most recent thread, or create one if none exist.
   * Convenience method for simple initialization.
   */
  async selectOrCreateThread(): Promise<HarnessThread> {
    const threads = await this.listThreads();

    if (threads.length === 0) {
      // createThread handles lock acquisition internally
      return await this.createThread();
    }

    // Use the most recently updated thread
    const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    // Acquire lock on the thread
    acquireThreadLock(sortedThreads[0]!.id);
    this.currentThreadId = sortedThreads[0]!.id;

    // Load token usage and model ID for this thread
    await this.loadThreadMetadata();

    return sortedThreads[0]!;
  }

  /**
   * Get the memory storage domain.
   * Throws if storage doesn't have a memory domain.
   */
  private async getMemoryStorage(): Promise<
    NonNullable<Awaited<ReturnType<typeof this.config.storage.getStore<'memory'>>>>
  > {
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
   * Update harness state. Validates against schema.
   * Emits state_changed event.
   */
  async setState(updates: Partial<z.infer<TState>>): Promise<void> {
    const changedKeys = Object.keys(updates);
    const newState = { ...this.state, ...updates };

    // Validate against schema
    const result = this.config.stateSchema.safeParse(newState);
    if (!result.success) {
      throw new Error(`Invalid state update: ${result.error.message}`);
    }

    this.state = result.data as z.infer<TState>;

    // Persist specific state keys to thread metadata
    if ('todos' in updates) {
      // Only persist todos if they have items, otherwise remove from metadata
      if (Array.isArray(updates.todos) && updates.todos.length > 0) {
        this.persistThreadSetting('todos', updates.todos).catch(() => {});
      } else {
        // Remove todos from metadata when empty
        this.removeThreadSetting('todos').catch(() => {});
      }
    }

    this.emit({
      type: 'state_changed',
      state: this.state,
      changedKeys,
    });
  }

  private getSchemaDefaults(): Partial<z.infer<TState>> {
    // Extract defaults from Zod schema
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

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  /**
   * Get all available modes.
   */
  getModes(): HarnessMode<TState>[] {
    return this.config.modes;
  }

  /**
   * Get the hook manager (if configured).
   */
  getHookManager(): HookManager | undefined {
    return this.hookManager;
  }

  /**
   * Get the MCP manager (if configured).
   */
  getMcpManager(): MCPManager | undefined {
    return this.mcpManager;
  }

  /**
   * Register a pending question resolver.
   * Called by the ask_user tool to register a promise resolver
   * that will be resolved when the user answers in the TUI.
   */
  registerQuestion(questionId: string, resolve: (answer: string) => void): void {
    this.pendingQuestions.set(questionId, resolve);
  }

  /**
   * Resolve a pending question with the user's answer.
   * Called by the TUI when the user selects an option or submits text.
   */
  respondToQuestion(questionId: string, answer: string): void {
    const resolve = this.pendingQuestions.get(questionId);
    if (resolve) {
      this.pendingQuestions.delete(questionId);
      resolve(answer);
    }
  }

  /**
   * Register a pending plan approval resolver.
   * Called by the submit_plan tool to register a promise resolver.
   */
  registerPlanApproval(
    planId: string,
    resolve: (result: { action: 'approved' | 'rejected'; feedback?: string }) => void,
  ): void {
    this.pendingPlanApprovals.set(planId, resolve);
  }

  /**
   * Respond to a pending plan approval.
   * On approval: switches to Build mode, then resolves the promise.
   * On rejection: resolves with feedback (stays in Plan mode).
   */
  async respondToPlanApproval(
    planId: string,
    response: { action: 'approved' | 'rejected'; feedback?: string },
  ): Promise<void> {
    const resolve = this.pendingPlanApprovals.get(planId);
    if (!resolve) return;

    this.pendingPlanApprovals.delete(planId);

    // Resolve first so the plan approval component can update its UI
    resolve(response);

    if (response.action === 'approved') {
      await this.switchMode('build');
      // Note: The TUI handles triggering the build agent via system reminder
      // after this method completes, ensuring proper message ordering
    }
  }

  /**
   * Get current mode ID.
   */
  getCurrentModeId(): string {
    return this.currentModeId;
  }

  /**
   * Get current mode configuration.
   */
  getCurrentMode(): HarnessMode<TState> {
    const mode = this.config.modes.find(m => m.id === this.currentModeId);
    if (!mode) {
      throw new Error(`Mode not found: ${this.currentModeId}`);
    }
    return mode;
  }
  /**
   * Switch to a different mode.
   * Aborts any in-progress generation.
   * Also switches to the mode's stored model (or its default).
   */
  async switchMode(modeId: string): Promise<void> {
    const mode = this.config.modes.find(m => m.id === modeId);
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    // Abort current operation if any
    this.abort();

    // Save current model to the outgoing mode before switching
    const currentModelId = this.getCurrentModelId();
    if (currentModelId) {
      await this.persistThreadSetting(`modeModelId_${this.currentModeId}`, currentModelId);
    }

    const previousModeId = this.currentModeId;
    this.currentModeId = modeId;

    // Persist mode to thread metadata
    await this.persistThreadSetting('currentModeId', modeId);

    // Load the incoming mode's model
    const modeModelId = await this.loadModeModelId(modeId);
    if (modeModelId) {
      this.setState({ currentModelId: modeModelId } as unknown as Partial<z.infer<TState>>);
      this.emit({ type: 'model_changed', modelId: modeModelId } as HarnessEvent);
    }

    this.emit({
      type: 'mode_changed',
      modeId,
      previousModeId,
    });
  }

  /**
   * Load the stored model ID for a specific mode.
   * Falls back to: thread metadata → global per-mode → mode's defaultModelId → global last model → current model.
   */
  private async loadModeModelId(modeId: string): Promise<string | null> {
    // 1. Check thread metadata for per-mode model
    if (this.currentThreadId) {
      try {
        const memoryStorage = await this.getMemoryStorage();
        const thread = await memoryStorage.getThreadById({
          threadId: this.currentThreadId,
        });
        const meta = thread?.metadata as Record<string, unknown> | undefined;
        const stored = meta?.[`modeModelId_${modeId}`] as string | undefined;
        if (stored) return stored;
      } catch {
        // Fall through to defaults
      }
    }

    // 2. Check global per-mode model from auth storage
    const globalModeModel = this.config.authStorage?.getModeModelId(modeId);
    if (globalModeModel) return globalModeModel;

    // 3. Fall back to mode's defaultModelId
    const mode = this.config.modes.find(m => m.id === modeId);
    if (mode?.defaultModelId) return mode.defaultModelId;

    // 4. Fall back to global last model
    const lastModelId = this.config.authStorage?.getLastModelId();
    if (lastModelId) return lastModelId;

    // 5. Keep current model
    return null;
  }
  /**
   * Get the agent for the current mode.
   * Resolves dynamic agent functions with current state.
   */
  private getCurrentAgent(): Agent {
    const mode = this.getCurrentMode();
    if (typeof mode.agent === 'function') {
      return mode.agent(this.state);
    }
    return mode.agent;
  }

  /**
   * Get the current model name/ID.
   * Returns a short display name extracted from the model ID in state.
   */
  getModelName(): string {
    const modelId = this.getCurrentModelId();
    if (modelId === 'unknown') return modelId;

    // Extract just the model name from "provider/model" format
    const parts = modelId.split('/');
    return parts[parts.length - 1] || modelId;
  }

  /**
   * Get the full model ID (e.g., "anthropic/claude-sonnet-4").
   * Reads from harness state (set via switchModel()).
   */
  getFullModelId(): string {
    return this.getCurrentModelId();
  }

  /**
   * Check if the current model has authentication configured (env var or OAuth).
   * Returns { hasAuth, apiKeyEnvVar } for the current model's provider.
   */
  async getCurrentModelAuthStatus(): Promise<{
    hasAuth: boolean;
    apiKeyEnvVar?: string;
  }> {
    const modelId = this.getCurrentModelId();
    const provider = modelId.split('/')[0];
    if (!provider) return { hasAuth: true };

    // Check OAuth
    const providerToOAuthId: Record<string, string> = {
      anthropic: 'anthropic',
      openai: 'openai-codex',
    };
    const oauthId = providerToOAuthId[provider];
    if (oauthId && this.config.authStorage?.isLoggedIn(oauthId)) {
      return { hasAuth: true };
    }

    // Check env var via registry
    try {
      const { PROVIDER_REGISTRY } = await import('@mastra/core/llm');
      const registry = PROVIDER_REGISTRY as Record<string, { apiKeyEnvVar?: string }>;
      const providerConfig = registry[provider];
      const apiKeyEnvVar = providerConfig?.apiKeyEnvVar;
      if (apiKeyEnvVar && process.env[apiKeyEnvVar]) {
        return { hasAuth: true };
      }
      return { hasAuth: false, apiKeyEnvVar: apiKeyEnvVar || undefined };
    } catch {
      return { hasAuth: true }; // Can't check, assume OK
    }
  }

  /**
   * Get list of available models from Mastra's provider registry.
   * Returns models grouped by provider, with API key availability info.
   */
  async getAvailableModels(): Promise<
    Array<{
      id: string;
      provider: string;
      modelName: string;
      hasApiKey: boolean;
      apiKeyEnvVar?: string;
      useCount: number;
    }>
  > {
    try {
      // Import from the public @mastra/core/llm export
      const { PROVIDER_REGISTRY } = await import('@mastra/core/llm');

      if (!PROVIDER_REGISTRY) {
        console.warn('Provider registry not available');
        return [];
      }

      // PROVIDER_REGISTRY is a Proxy - use Object.keys to get providers
      // Cast to Record<string, any> to allow string indexing
      const registry = PROVIDER_REGISTRY as Record<string, { models?: string[]; name?: string; apiKeyEnvVar?: string }>;
      const providers = Object.keys(registry);
      const useCounts = this.config.authStorage?.getAllModelUseCounts() ?? {};
      const models: Array<{
        id: string;
        provider: string;
        modelName: string;
        hasApiKey: boolean;
        apiKeyEnvVar?: string;
        useCount: number;
      }> = [];
      // Map model provider prefixes to OAuth provider IDs
      const providerToOAuthId: Record<string, string> = {
        anthropic: 'anthropic',
        openai: 'openai-codex',
      };

      for (const provider of providers) {
        const providerConfig = registry[provider];
        // Check if API key is available via env var OR OAuth
        const apiKeyEnvVar = providerConfig?.apiKeyEnvVar;
        const hasEnvKey = apiKeyEnvVar ? !!process.env[apiKeyEnvVar] : false;
        const oauthId = providerToOAuthId[provider];
        const hasOAuth = oauthId ? (this.config.authStorage?.isLoggedIn(oauthId) ?? false) : false;
        const hasApiKey = hasEnvKey || hasOAuth;

        // Each provider config has a 'models' array
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
  /**
   * Switch to a different model at runtime.
   * Updates the harness state which the dynamic model function reads.
   * Also saves per-mode and as global "last model" for new threads.
   * @param modelId Full model ID (e.g., "anthropic/claude-sonnet-4-20250514")
   */
  /**
   * Switch the main agent model for a specific mode.
   * @param modelId Full model ID (e.g., "anthropic/claude-sonnet-4-20250514")
   * @param scope "global" for global default, "thread" for thread-specific setting
   * @param modeId Mode ID (defaults to current mode)
   */
  async switchModel(modelId: string, scope: 'global' | 'thread' = 'thread', modeId?: string): Promise<void> {
    const targetModeId = modeId ?? this.currentModeId;

    // Update current state for immediate effect if this is the current mode
    if (targetModeId === this.currentModeId) {
      this.setState({ currentModelId: modelId } as unknown as Partial<z.infer<TState>>);
    }

    // Persist based on scope
    if (scope === 'global') {
      // Global default for this mode - save to auth storage
      this.config.authStorage?.setModeModelId(targetModeId, modelId);
    } else {
      // Thread-specific setting for this mode - save to thread metadata
      await this.persistThreadSetting(`modeModelId_${targetModeId}`, modelId);
    }

    // Always bump use count for ranking
    this.config.authStorage?.incrementModelUseCount(modelId);

    // Emit event so TUI can update status line
    this.emit({
      type: 'model_changed',
      modelId,
      scope,
      modeId: targetModeId,
    } as HarnessEvent);
  }
  /**
   * Get the current model ID from state.
   * Returns empty string if no model is selected.
   */
  getCurrentModelId(): string {
    const state = this.getState() as { currentModelId?: string };
    return state.currentModelId ?? '';
  }

  /**
   * Check if a model is currently selected.
   */
  hasModelSelected(): boolean {
    return this.getCurrentModelId() !== '';
  }

  // =========================================================================
  // Observational Memory Model Management
  // =========================================================================

  /**
   * Get the current Observer model ID from state.
   */
  getObserverModelId(): string {
    const state = this.getState() as { observerModelId?: string };
    return state.observerModelId ?? 'google/gemini-2.5-flash';
  }

  /**
   * Get the current Reflector model ID from state.
   */
  getReflectorModelId(): string {
    const state = this.getState() as { reflectorModelId?: string };
    return state.reflectorModelId ?? 'google/gemini-2.5-flash';
  }
  /**
   * Switch the Observer model.
   * @param modelId Full model ID (e.g., "google/gemini-2.5-flash")
   */
  async switchObserverModel(modelId: string): Promise<void> {
    this.setState({ observerModelId: modelId } as unknown as Partial<z.infer<TState>>);
    await this.persistThreadSetting('observerModelId', modelId);

    this.emit({
      type: 'om_model_changed',
      role: 'observer',
      modelId,
    } as HarnessEvent);
  }

  /**
   * Switch the Reflector model.
   * @param modelId Full model ID (e.g., "google/gemini-2.5-flash")
   */
  async switchReflectorModel(modelId: string): Promise<void> {
    this.setState({ reflectorModelId: modelId } as unknown as Partial<z.infer<TState>>);
    await this.persistThreadSetting('reflectorModelId', modelId);

    this.emit({
      type: 'om_model_changed',
      role: 'reflector',
      modelId,
    } as HarnessEvent);
  }

  // =========================================================================
  // Subagent Model Management
  // =========================================================================

  /**
   * Get the subagent model ID for a specific agent type.
   * Falls back to: per-type thread model → per-type global model → null.
   * @param agentType Optional agent type (explore, plan, execute)
   */
  async getSubagentModelId(agentType?: string): Promise<string | null> {
    // 1. Check thread metadata for per-type subagent model
    if (agentType && this.currentThreadId) {
      try {
        const memoryStorage = await this.getMemoryStorage();
        const thread = await memoryStorage.getThreadById({
          threadId: this.currentThreadId,
        });
        const meta = thread?.metadata as Record<string, unknown> | undefined;

        const perTypeThread = meta?.[`subagentModelId_${agentType}`] as string | undefined;
        if (perTypeThread) return perTypeThread;
      } catch {
        // Fall through
      }
    }

    // 2. Check global per-type subagent model from auth storage
    if (agentType) {
      const perTypeGlobal = this.config.authStorage?.getSubagentModelId(agentType);
      if (perTypeGlobal) return perTypeGlobal;
    }

    // 3. No configured subagent model — caller should use defaults
    return null;
  }

  /**
   * Set the subagent model ID.
   * @param modelId Full model ID (e.g., "anthropic/claude-sonnet-4-20250514")
   * @param scope "global" for global default, "thread" for thread-level default
   * @param agentType Agent type (explore, plan, execute)
   */
  async setSubagentModelId(modelId: string, scope: 'global' | 'thread' = 'thread', agentType?: string): Promise<void> {
    if (!agentType) {
      throw new Error('agentType is required for setSubagentModelId');
    }

    if (scope === 'global') {
      // Persist to auth storage (global preference per agent type)
      this.config.authStorage?.setSubagentModelId(modelId, agentType);
    } else {
      // Persist thread-level subagent model per agent type
      await this.persistThreadSetting(`subagentModelId_${agentType}`, modelId);
    }

    this.emit({
      type: 'subagent_model_changed',
      modelId,
      scope,
      agentType,
    } as HarnessEvent);
  }

  /**
   * Get YOLO mode state.
   */
  getYoloMode(): boolean {
    return (this.state as any)?.yolo === true;
  }
  /**
   * Toggle YOLO mode (auto-approve all tool calls).
   */
  setYoloMode(enabled: boolean): void {
    this.setState({ yolo: enabled } as unknown as Partial<z.infer<TState>>);
    this.persistThreadSetting('yolo', enabled).catch(() => {});
    // When toggling YOLO off, reset session grants so user starts fresh
    if (!enabled) {
      this.sessionGrants.reset();
    }
  }

  // =========================================================================
  // Permissions
  // =========================================================================

  /**
   * Get the effective permission rules from state, with defaults.
   */
  private getPermissionRules(): PermissionRules {
    const stored = (this.state as any)?.permissionRules;
    const rules = createDefaultRules();
    if (stored?.categories) {
      Object.assign(rules.categories, stored.categories);
    }
    if (stored?.tools) {
      Object.assign(rules.tools, stored.tools);
    }
    return rules;
  }

  /**
   * Resolve whether a tool call should be allowed, prompted, or denied.
   * YOLO mode overrides everything to "allow".
   */
  private resolveToolApproval(toolName: string): 'allow' | 'ask' | 'deny' {
    if (this.getState().yolo === true) return 'allow';
    return resolveApproval(toolName, this.getPermissionRules(), this.sessionGrants);
  }

  /**
   * Grant a session-scoped "always allow" for a tool's category.
   */
  grantSessionCategory(category: ToolCategory): void {
    this.sessionGrants.allowCategory(category);
  }

  /**
   * Grant a session-scoped "always allow" for a specific tool.
   */
  grantSessionTool(toolName: string): void {
    this.sessionGrants.allowTool(toolName);
  }

  /**
   * Get the tool category for display purposes.
   */
  getToolCategory(toolName: string): ToolCategory | null {
    return getToolCategory(toolName);
  }

  /**
   * Get current session grants for display.
   */
  getSessionGrants(): { categories: ToolCategory[]; tools: string[] } {
    return {
      categories: this.sessionGrants.getGrantedCategories(),
      tools: this.sessionGrants.getGrantedTools(),
    };
  }

  /**
   * Update a category policy in the persisted permission rules.
   */
  setPermissionCategory(category: ToolCategory, policy: 'allow' | 'ask' | 'deny'): void {
    const rules = this.getPermissionRules();
    rules.categories[category] = policy;
    this.setState({ permissionRules: rules } as unknown as Partial<z.infer<TState>>);
  }

  /**
   * Update a per-tool policy in the persisted permission rules.
   */
  setPermissionTool(toolName: string, policy: 'allow' | 'ask' | 'deny'): void {
    const rules = this.getPermissionRules();
    rules.tools[toolName] = policy;
    this.setState({ permissionRules: rules } as unknown as Partial<z.infer<TState>>);
  }

  /**
   * Get current permission rules for display.
   */
  getPermissionRules_public(): PermissionRules {
    return this.getPermissionRules();
  }

  // =========================================================================
  // Thinking Level
  // =========================================================================

  /**
   * Get the current thinking level.
   */
  getThinkingLevel(): string {
    const state = this.getState() as { thinkingLevel?: string };
    return state.thinkingLevel ?? 'off';
  }

  /**
   * Set the thinking level and persist to thread metadata.
   * @param level One of: "off", "minimal", "low", "medium", "high"
   */
  async setThinkingLevel(level: string): Promise<void> {
    this.setState({ thinkingLevel: level } as unknown as Partial<z.infer<TState>>);
    await this.persistThreadSetting('thinkingLevel', level);
  }

  // =========================================================================
  // OM Threshold Settings
  // =========================================================================

  /**
   * Get the current observation threshold from state.
   */
  getObservationThreshold(): number {
    const state = this.getState() as { observationThreshold?: number };
    return state.observationThreshold ?? 30_000;
  }

  /**
   * Get the current reflection threshold from state.
   */
  getReflectionThreshold(): number {
    const state = this.getState() as { reflectionThreshold?: number };
    return state.reflectionThreshold ?? 40_000;
  }

  /**
   * Set the observation threshold and persist to thread metadata.
   * Note: Takes effect on next restart since OM thresholds are set at construction time.
   */
  async setObservationThreshold(value: number): Promise<void> {
    this.setState({ observationThreshold: value } as unknown as Partial<z.infer<TState>>);
    await this.persistThreadSetting('observationThreshold', value);
  }

  /**
   * Set the reflection threshold and persist to thread metadata.
   * Note: Takes effect on next restart since OM thresholds are set at construction time.
   */
  async setReflectionThreshold(value: number): Promise<void> {
    this.setState({ reflectionThreshold: value } as unknown as Partial<z.infer<TState>>);
    await this.persistThreadSetting('reflectionThreshold', value);
  }

  /**
   * Get current cumulative token usage for this thread.
   */
  getTokenUsage(): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    return { ...this.tokenUsage };
  }

  /**
   * Persist token usage to thread metadata.
   */
  private async persistTokenUsage(): Promise<void> {
    if (!this.currentThreadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({
        threadId: this.currentThreadId,
      });
      if (thread) {
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: {
              ...thread.metadata,
              tokenUsage: this.tokenUsage,
            },
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Silently fail - token persistence is not critical
    }
  }
  /**
   * Persist a key-value pair to the current thread's metadata.
   */
  async persistThreadSetting(key: string, value: unknown): Promise<void> {
    if (!this.currentThreadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({
        threadId: this.currentThreadId,
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
      // Silently fail - settings persistence is not critical
    }
  }

  /**
   * Remove a key from the current thread's metadata.
   */
  private async removeThreadSetting(key: string): Promise<void> {
    if (!this.currentThreadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({
        threadId: this.currentThreadId,
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
      // Silently fail - settings removal is not critical
    }
  }

  private async persistModelId(modelId: string): Promise<void> {
    await this.persistThreadSetting('currentModelId', modelId);
  }
  /**
   * Load token usage and model ID from thread metadata.
   */
  private async loadThreadMetadata(): Promise<void> {
    if (!this.currentThreadId) {
      this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      return;
    }

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({
        threadId: this.currentThreadId,
      });

      // Load token usage
      const savedUsage = thread?.metadata?.tokenUsage as typeof this.tokenUsage | undefined;
      if (savedUsage) {
        this.tokenUsage = {
          promptTokens: savedUsage.promptTokens ?? 0,
          completionTokens: savedUsage.completionTokens ?? 0,
          totalTokens: savedUsage.totalTokens ?? 0,
        };
      } else {
        this.tokenUsage = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        };
      }
      // Load saved settings from thread metadata
      const meta = thread?.metadata as Record<string, unknown> | undefined;
      const updates: Record<string, unknown> = {};

      // Prefer per-mode model ID, fall back to global currentModelId
      const modeModelKey = `modeModelId_${this.currentModeId}`;
      if (meta?.[modeModelKey]) {
        updates.currentModelId = meta[modeModelKey];
      } else if (meta?.currentModelId) {
        updates.currentModelId = meta.currentModelId;
      }

      if (meta?.observerModelId) updates.observerModelId = meta.observerModelId;
      if (meta?.reflectorModelId) updates.reflectorModelId = meta.reflectorModelId;
      if (meta?.observationThreshold) updates.observationThreshold = meta.observationThreshold;
      if (meta?.reflectionThreshold) updates.reflectionThreshold = meta.reflectionThreshold;
      if (meta?.thinkingLevel) updates.thinkingLevel = meta.thinkingLevel;
      if (typeof meta?.yolo === 'boolean') updates.yolo = meta.yolo;
      if (typeof meta?.escapeAsCancel === 'boolean') updates.escapeAsCancel = meta.escapeAsCancel;
      if (meta?.sandboxAllowedPaths && Array.isArray(meta.sandboxAllowedPaths)) {
        updates.sandboxAllowedPaths = meta.sandboxAllowedPaths;
      }
      // Load subagent model (thread-level)
      if (meta?.subagentModelId) updates.subagentModelId = meta.subagentModelId;
      // Only load todos if they exist and have items
      if (meta?.todos && Array.isArray(meta.todos) && meta.todos.length > 0) {
        updates.todos = meta.todos;
      }

      // Restore mode (must happen before model loading since model is per-mode)
      if (meta?.currentModeId) {
        const savedModeId = meta.currentModeId as string;
        const modeExists = this.config.modes.some(m => m.id === savedModeId);
        if (modeExists && savedModeId !== this.currentModeId) {
          this.currentModeId = savedModeId;
          // Re-resolve the per-mode model key now that mode is restored
          const modeModelKey = `modeModelId_${savedModeId}`;
          if (meta[modeModelKey]) {
            updates.currentModelId = meta[modeModelKey];
          }
          this.emit({
            type: 'mode_changed',
            modeId: savedModeId,
            previousModeId: this.config.modes.find(m => m.default)?.id || this.config.modes[0]!.id,
          });
        }
      }
      if (Object.keys(updates).length > 0) {
        this.setState(updates as unknown as Partial<z.infer<TState>>);
      }

      // Load OM progress from storage record
      await this.loadOMProgress();
    } catch {
      this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }
  }
  /**
   * Load Observational Memory status from storage and emit an om_status event.
   * Called on thread load/switch so the TUI status line reflects current state.
   * Also callable by the TUI after subscribing to ensure initial state is populated.
   */
  async loadOMProgress(): Promise<void> {
    if (!this.currentThreadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const record = await memoryStorage.getObservationalMemory(this.currentThreadId, this.resourceId);

      if (!record) return;

      // Extract thresholds from the record's config
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

      const observationThreshold = getThreshold(config?.observationThreshold, 30_000);
      const reflectionThreshold = getThreshold(config?.reflectionThreshold, 40_000);

      // Defaults from the OM record
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

      // Scan recent messages for the most recent data-om-status part
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
        const content = msg.content as MastraMessageContentV2 | string;
        if (typeof content === 'string' || !content?.parts) continue;

        for (let i = content.parts.length - 1; i >= 0; i--) {
          const part = content.parts[i] as {
            type?: string;
            data?: Record<string, any>;
          };
          if (part.type === 'data-om-status' && part.data?.windows) {
            const w = part.data.windows;
            messageTokens = w.active?.messages?.tokens ?? messageTokens;
            observationTokens = w.active?.observations?.tokens ?? observationTokens;
            // Override thresholds if present in the status
            const msgThresh = w.active?.messages?.threshold;
            const obsThresh = w.active?.observations?.threshold;
            if (msgThresh) Object.assign(config ?? {}, { observationThreshold: msgThresh });
            if (obsThresh) Object.assign(config ?? {}, { reflectionThreshold: obsThresh });
            // Buffered state
            const bo = w.buffered?.observations;
            if (bo) {
              bufferedObs = {
                status: bo.status ?? 'idle',
                chunks: bo.chunks ?? 0,
                messageTokens: bo.messageTokens ?? 0,
                projectedMessageRemoval: bo.projectedMessageRemoval ?? 0,
                observationTokens: bo.observationTokens ?? 0,
              };
            }
            const br = w.buffered?.reflection;
            if (br) {
              bufferedRef = {
                status: br.status ?? 'idle',
                inputObservationTokens: br.inputObservationTokens ?? 0,
                observationTokens: br.observationTokens ?? 0,
              };
            }
            generationCount = part.data.generationCount ?? 0;
            stepNumber = part.data.stepNumber ?? 0;
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
            messages: {
              tokens: messageTokens,
              threshold: observationThreshold,
            },
            observations: {
              tokens: observationTokens,
              threshold: reflectionThreshold,
            },
          },
          buffered: {
            observations: bufferedObs,
            reflection: bufferedRef,
          },
        },
        recordId: (record as any).id ?? '',
        threadId: this.currentThreadId,
        stepNumber,
        generationCount,
      });
    } catch {
      // OM not available or not initialized — that's fine
    }
  }

  // ===========================================================================
  // Thread Management
  // ===========================================================================

  /**
   * Get current thread ID.
   */
  getCurrentThreadId(): string | null {
    return this.currentThreadId;
  }
  /**
   * Get current resource ID.
   */
  getResourceId(): string {
    return this.resourceId;
  }

  /**
   * Get the auto-detected resource ID (before any overrides).
   */
  getDefaultResourceId(): string {
    return this.defaultResourceId;
  }

  /**
   * Get current user ID (for thread attribution).
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Whether the storage backend is remote.
   */
  getIsRemoteStorage(): boolean {
    return this.isRemoteStorage;
  }
  /**
   * Set the current resource ID (for switching between projects/resources).
   */
  setResourceId(resourceId: string): void {
    this.resourceId = resourceId;
    this.currentThreadId = null;
  }

  /**
   * Get distinct resource IDs from all existing threads.
   * Useful for showing a list of known resources to pick from.
   */
  async getKnownResourceIds(): Promise<string[]> {
    const threads = await this.listThreads({
      allResources: true,
      allPaths: true,
    });
    const ids = new Set<string>();
    for (const t of threads) {
      ids.add(t.resourceId);
    }
    // Put the current resource ID first, then sort the rest
    const sorted = [...ids].filter(id => id !== this.resourceId).sort();
    return [this.resourceId, ...sorted];
  }

  /**
   * Create a new thread.
   * Uses the global "last model" if available, otherwise uses initial state.
   */
  async createThread(title?: string): Promise<HarnessThread> {
    const now = new Date();
    const thread: HarnessThread = {
      id: this.generateId(),
      resourceId: this.resourceId,
      title: title || 'New Thread',
      createdAt: now,
      updatedAt: now,
    };
    // Resolve model for this mode:
    // 1. Current in-memory model (already set by switchMode/switchModel)
    // 2. Current mode's defaultModelId
    // 3. Global "last model" (user's most recent choice across sessions)
    const currentStateModel = (this.state as any).currentModelId;
    const currentMode = this.getCurrentMode();
    const lastModelId = this.config.authStorage?.getLastModelId();
    const modelId = currentStateModel || currentMode.defaultModelId || lastModelId;
    // Build metadata with both global and per-mode model ID
    const metadata: Record<string, unknown> = {};
    if (modelId) {
      metadata.currentModelId = modelId;
      metadata[`modeModelId_${this.currentModeId}`] = modelId;
    }
    // Inherit resource-level settings from the most recent thread
    try {
      const existingThreads = await this.listThreads();
      if (existingThreads.length > 0) {
        const sorted = [...existingThreads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        const prevMeta = sorted[0]!.metadata as Record<string, unknown> | undefined;
        if (prevMeta) {
          if (typeof prevMeta.yolo === 'boolean') {
            metadata.yolo = prevMeta.yolo;
            this.setState({ yolo: prevMeta.yolo } as unknown as Partial<z.infer<TState>>);
          }
          if (typeof prevMeta.escapeAsCancel === 'boolean') {
            metadata.escapeAsCancel = prevMeta.escapeAsCancel;
            this.setState({
              escapeAsCancel: prevMeta.escapeAsCancel,
            } as unknown as Partial<z.infer<TState>>);
          }
        }
      }
    } catch {
      // Non-critical — proceed without inheriting
    }

    // Store project path for directory-aware thread filtering (worktrees, etc.)
    const projectPath = (this.state as any)?.projectPath;
    if (projectPath) {
      metadata.projectPath = projectPath;
    }

    // Store user identity for multi-user thread attribution
    if (this.userId) {
      metadata.createdBy = this.userId;
    }

    // Persist thread to storage with model ID
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
    // Release lock on previous thread, acquire lock on new one
    if (this.currentThreadId) {
      releaseThreadLock(this.currentThreadId);
    }
    acquireThreadLock(thread.id);

    // Also switch to this new thread
    this.currentThreadId = thread.id;

    // Set the model in state (only if not already set)
    if (modelId && !currentStateModel) {
      this.setState({ currentModelId: modelId } as unknown as Partial<z.infer<TState>>);
    }

    // Reset token usage for new thread
    this.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    this.emit({ type: 'thread_created', thread });

    return thread;
  }
  /**
   * Rename the current thread.
   */
  async renameThread(title: string): Promise<void> {
    if (!this.currentThreadId) return;

    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({
      threadId: this.currentThreadId,
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

  /**
   * Switch to a different thread.
   */
  async switchThread(threadId: string): Promise<void> {
    // Abort current operation if any
    this.abort();

    // Verify thread exists
    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    // Acquire lock on new thread before releasing old one
    acquireThreadLock(threadId);

    const previousThreadId = this.currentThreadId;
    if (previousThreadId) {
      releaseThreadLock(previousThreadId);
    }
    this.currentThreadId = threadId;

    // Load token usage and model ID for this thread
    await this.loadThreadMetadata();

    this.emit({
      type: 'thread_changed',
      threadId,
      previousThreadId,
    });
  }
  /**
   * List threads. By default lists only threads for the current resource AND project path.
   * Pass `allResources: true` to list threads across all resources.
   * Pass `allPaths: true` to list threads across all paths for the current resource.
   * Pass `mineOnly: true` to filter to threads created by the current user.
   * When using remote storage, `mineOnly` defaults to `true`.
   */
  async listThreads(options?: {
    allResources?: boolean;
    allPaths?: boolean;
    mineOnly?: boolean;
  }): Promise<HarnessThread[]> {
    const memoryStorage = await this.getMemoryStorage();
    const projectPath = (this.state as any)?.projectPath as string | undefined;

    // Default mineOnly to true when remote storage + user ID are available
    const mineOnly = options?.mineOnly ?? (this.isRemoteStorage && !!this.userId && !options?.allResources);

    const metadataFilter: Record<string, unknown> = {};
    if (!options?.allPaths && projectPath) {
      metadataFilter.projectPath = projectPath;
    }
    if (mineOnly && this.userId) {
      metadataFilter.createdBy = this.userId;
    }

    const filter: { resourceId?: string; metadata?: Record<string, unknown> } | undefined = options?.allResources
      ? undefined
      : {
          resourceId: this.resourceId,
          ...(Object.keys(metadataFilter).length > 0 ? { metadata: metadataFilter } : {}),
        };

    const result = await memoryStorage.listThreads({
      perPage: options?.allResources ? false : undefined,
      filter,
    });

    return result.threads.map((thread: StorageThreadType) => ({
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: thread.metadata,
    }));
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  /**
   * Send a message to the current agent.
   * Streams the response and emits events.
   *
   * Uses an operation ID to safely handle steer (abort + re-send):
   * if a newer operation supersedes this one, events and cleanup are skipped.
   */
  async sendMessage(
    content: string,
    options?: {
      images?: Array<{ data: string; mimeType: string }>;
    },
  ): Promise<void> {
    // Run UserPromptSubmit hooks (blocking)
    if (this.hookManager) {
      const hookResult = await this.hookManager.runUserPromptSubmit(content);
      for (const warning of hookResult.warnings) {
        this.emit({ type: 'error', error: new Error(`[hook] ${warning}`) });
      }
      if (!hookResult.allowed) {
        this.emit({
          type: 'error',
          error: new Error(`Message blocked by hook: ${hookResult.blockReason || 'Policy violation'}`),
        });
        return;
      }
    }

    // Ensure we have a thread
    if (!this.currentThreadId) {
      const thread = await this.createThread();
      this.currentThreadId = thread.id;
    }

    // Tag this operation so steer() can safely supersede it
    const operationId = ++this.currentOperationId;

    // Create abort controller for this operation
    this.abortController = new AbortController();
    const agent = this.getCurrentAgent();

    this.emit({ type: 'agent_start' });

    try {
      // Build request context for tools
      const requestContext = await this.buildRequestContext();
      // Stream the response
      const streamOptions: Record<string, unknown> = {
        memory: {
          thread: this.currentThreadId,
          resource: this.resourceId,
        },
        abortSignal: this.abortController.signal,
        requestContext,
        maxSteps: 1000,
        requireToolApproval: this.getYoloMode() !== true,
        modelSettings: {
          temperature: 1,
        },
      };

      // Add provider-specific toolsets (e.g., Anthropic web search)
      if (this.config.getToolsets) {
        const modelId = this.getCurrentModelId();
        const toolsets = this.config.getToolsets(modelId);
        if (toolsets) {
          streamOptions.toolsets = toolsets;
        }
      }

      // Build message input: multimodal if images present, string otherwise
      let messageInput: string | Record<string, unknown> = content;
      if (options?.images?.length) {
        messageInput = {
          role: 'user',
          content: [
            { type: 'text', text: content },
            ...options.images.map(img => ({
              type: 'file',
              data: img.data,
              mediaType: img.mimeType,
            })),
          ],
        };
      }

      const response = await agent.stream(messageInput as any, streamOptions as any);
      // Process the stream. Tool approvals are handled inline via
      // the permission system and TUI dialog.
      let result = await this.processStream(response);

      const lastMessage = result.message;

      // Run Stop hooks (blocking: exit 2 = agent keeps working)
      if (this.hookManager && this.currentOperationId === operationId) {
        const assistantText =
          lastMessage?.content
            ?.filter((c): c is { type: 'text'; text: string } => c.type === 'text')
            .map(c => c.text)
            .join('') || undefined;

        const stopResult = await this.hookManager.runStop(assistantText, 'complete');
        for (const warning of stopResult.warnings) {
          this.emit({ type: 'error', error: new Error(`[hook] ${warning}`) });
        }
        if (!stopResult.allowed) {
          // Hook says agent should keep working
          this.followUpQueue.unshift(stopResult.blockReason || 'A hook has requested that you continue working.');
          return;
        }
      }

      // Only emit completion if not superseded by steer
      if (this.currentOperationId === operationId) {
        // Check if abort was requested - stream may complete gracefully even after abort
        const reason = this.abortRequested ? 'aborted' : 'complete';
        this.emit({ type: 'agent_end', reason });
      }
    } catch (error) {
      // If superseded by steer, silently exit
      if (this.currentOperationId !== operationId) return;

      if (error instanceof Error && error.name === 'AbortError') {
        // Aborted - emit end event with aborted status
        this.emit({ type: 'agent_end', reason: 'aborted' });
      } else if (error instanceof Error && error.message.match(/^Tool .+ not found$/)) {
        // Model hallucinated a tool name — recover by sending a corrective
        // follow-up so the agent can retry with the right tool
        const badTool = error.message.replace('Tool ', '').replace(' not found', '');
        this.emit({
          type: 'error',
          error: new Error(`Unknown tool "${badTool}". Shell commands must be run via execute_command.`),
          retryable: true,
        });
        this.followUpQueue.push(
          `[System] Your previous tool call used "${badTool}" which is not a valid tool. ` +
            `Shell commands like git, npm, etc. must be run via the execute_command tool. ` +
            `Please retry with the correct tool name.`,
        );
        this.emit({ type: 'agent_end', reason: 'error' });
      } else if (
        errorContains(error, 'must end with a user message') ||
        errorContains(error, 'assistant message prefill')
      ) {
        // Conversation ends with an assistant message (e.g. after
        // OM activation) — inject a synthetic user message
        // and retry so the model can continue.
        this.followUpQueue.unshift('<continue>');
        this.emit({
          type: 'error',
          error: new Error('Prefill rejection — patching chat and retrying'),
          retryable: true,
        });
        this.emit({ type: 'agent_end', reason: 'error' });
      } else {
        // Parse the error for better user feedback
        const parsed = parseError(error);
        this.emit({
          type: 'error',
          error: parsed.originalError,
          errorType: parsed.type,
          retryable: parsed.retryable,
          retryDelay: parsed.retryDelay,
        });
        this.emit({ type: 'agent_end', reason: 'error' });
      }
    } finally {
      // Only clean up if this is still the current operation
      if (this.currentOperationId === operationId) {
        this.abortController = null;
        this.abortRequested = false;
      }

      // Process follow-up queue after this operation completes
      if (this.currentOperationId === operationId && this.followUpQueue.length > 0) {
        const next = this.followUpQueue.shift()!;
        await this.sendMessage(next);
      }
    }
  }
  /**
   * Get message history for the current thread.
   */
  async getMessages(options?: { limit?: number }): Promise<HarnessMessage[]> {
    if (!this.currentThreadId) {
      return [];
    }
    return this.getMessagesForThread(this.currentThreadId, options);
  }

  /**
   * Get message history for a specific thread.
   * @param options.limit - Max number of most recent messages to fetch. Omit or pass undefined for all.
   */
  async getMessagesForThread(threadId: string, options?: { limit?: number }): Promise<HarnessMessage[]> {
    const memoryStorage = await this.getMemoryStorage();
    const limit = options?.limit;

    if (limit) {
      // Fetch the last N messages by querying DESC and reversing
      const result = await memoryStorage.listMessages({
        threadId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages.map(msg => this.convertToHarnessMessage(msg)).reverse();
    }

    const result = await memoryStorage.listMessages({
      threadId,
      perPage: false,
    });
    return result.messages.map(msg => this.convertToHarnessMessage(msg));
  }

  /**
   * Get the first user message for a thread (for previews).
   */
  async getFirstUserMessageForThread(threadId: string): Promise<HarnessMessage | null> {
    const memoryStorage = await this.getMemoryStorage();
    // Fetch a small batch from the beginning — first user message is usually in the first few
    const result = await memoryStorage.listMessages({
      threadId,
      perPage: 5,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    const userMsg = result.messages.find(m => m.role === 'user');
    return userMsg ? this.convertToHarnessMessage(userMsg) : null;
  }

  /**
   * Convert a Mastra DB message to a HarnessMessage.
   */
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
        // Nested tool invocation structure from Mastra storage
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
      if (part.type.startsWith(`data-`)) {
        part;
      }
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
          // Handle nested toolInvocation structure from Mastra storage
          if (part.toolInvocation) {
            const inv = part.toolInvocation;
            // Add tool_call
            content.push({
              type: 'tool_call',
              id: inv.toolCallId,
              name: inv.toolName,
              args: inv.args,
            });
            // If it has a result, add tool_result too
            if (inv.state === 'result' && inv.result !== undefined) {
              content.push({
                type: 'tool_result',
                id: inv.toolCallId,
                name: inv.toolName,
                result: inv.result,
                isError: inv.isError ?? false,
              });
            }
          }
          // Also handle flat structure
          else if (part.toolCallId && part.toolName) {
            content.push({
              type: 'tool_call',
              id: part.toolCallId,
              name: part.toolName,
              args: part.args,
            });
          }
          break;
        case 'tool-call':
          if (part.toolCallId && part.toolName) {
            content.push({
              type: 'tool_call',
              id: part.toolCallId,
              name: part.toolName,
              args: part.args,
            });
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

    return {
      id: msg.id,
      role: msg.role,
      content,
      createdAt: msg.createdAt,
    };
  }

  // ===========================================================================
  // Control
  // ===========================================================================

  /**
   * Abort the current operation (message generation, tool execution).
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
   * The new message interrupts the agent after the current tool completes.
   */
  async steer(content: string): Promise<void> {
    // Abort current operation if running
    this.abort();
    // Clear any pending follow-ups (steer overrides them)
    this.followUpQueue = [];
    // Send the new message immediately
    await this.sendMessage(content);
  }

  /**
   * Queue a follow-up message to be processed after the current operation completes.
   * If not streaming, sends immediately.
   */
  async followUp(content: string): Promise<void> {
    if (this.isRunning()) {
      this.followUpQueue.push(content);
      this.emit({
        type: 'follow_up_queued',
        count: this.followUpQueue.length,
      });
    } else {
      await this.sendMessage(content);
    }
  }

  /**
   * Get the number of queued follow-up messages.
   */
  getFollowUpCount(): number {
    return this.followUpQueue.length;
  }

  /**
   * Check if an operation is currently in progress.
   */
  isRunning(): boolean {
    return this.abortController !== null;
  }

  /**
   * Get the current run ID (for tool approval flows).
   */
  getCurrentRunId(): string | null {
    return this.currentRunId;
  }
  /**
   * Respond to a pending tool approval from the TUI.
   */
  resolveToolApprovalDecision(decision: 'approve' | 'decline' | 'always_allow_category'): void {
    if (this.pendingApprovalResolve) {
      this.pendingApprovalResolve(decision);
      this.pendingApprovalResolve = null;
    }
  }
  /**
   * Approve a tool call and resume the suspended stream.
   * Called from within processStream — reuses the existing abortController.
   */
  private async handleToolApprove(toolCallId?: string): Promise<{
    message: HarnessMessage;
  }> {
    if (!this.currentRunId) {
      throw new Error('No active run to approve tool call for');
    }

    const agent = this.getCurrentAgent();
    if (!this.abortController) {
      this.abortController = new AbortController();
    }
    function getRandomInteger(min: number, max: number) {
      // Ensure min and max are treated as integers for the calculation
      min = Math.ceil(min);
      max = Math.floor(max);
      // The formula for inclusive range: Math.floor(Math.random() * (max - min + 1)) + min
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    await new Promise(res => setTimeout(res, getRandomInteger(1000, 2000)));

    const response = await agent.approveToolCall({
      runId: this.currentRunId,
      toolCallId,
      memory: this.currentThreadId
        ? {
            thread: this.currentThreadId,
            resource: this.resourceId,
          }
        : undefined,
      abortSignal: this.abortController.signal,
      requestContext: await this.buildRequestContext(),
    });

    return await this.processStream(response);
  }

  /**
   * Decline a tool call and resume the suspended stream.
   * Called from within processStream — reuses the existing abortController.
   */
  private async handleToolDecline(toolCallId?: string): Promise<{
    message: HarnessMessage;
  }> {
    if (!this.currentRunId) {
      throw new Error('No active run to decline tool call for');
    }

    const agent = this.getCurrentAgent();
    if (!this.abortController) {
      this.abortController = new AbortController();
    }

    const response = await agent.declineToolCall({
      runId: this.currentRunId,
      toolCallId,
      memory: this.currentThreadId
        ? {
            thread: this.currentThreadId,
            resource: this.resourceId,
          }
        : undefined,
      abortSignal: this.abortController.signal,
      requestContext: await this.buildRequestContext(),
    });

    return await this.processStream(response);
  }
  /**
   * Process a stream response (shared between sendMessage and tool approval).
   */
  private async processStream(response: { fullStream: AsyncIterable<any> }): Promise<{
    message: HarnessMessage;
  }> {
    let currentMessage: HarnessMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: [],
      createdAt: new Date(),
    };

    const textContentById = new Map<string, { index: number; text: string }>();
    const thinkingContentById = new Map<string, { index: number; text: string }>();
    const debugFile = this.streamDebug ? join(process.cwd(), 'stream-debug.jsonl') : null;

    for await (const chunk of response.fullStream) {
      if (debugFile) {
        try {
          appendFileSync(debugFile, JSON.stringify(chunk) + '\n');
        } catch {}
      }
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
            this.emit({
              type: 'message_update',
              message: { ...currentMessage },
            });
          }
          break;
        }

        case 'reasoning-start': {
          const thinkingIndex = currentMessage.content.length;
          currentMessage.content.push({ type: 'thinking', thinking: '' });
          thinkingContentById.set(chunk.payload.id, {
            index: thinkingIndex,
            text: '',
          });
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
            this.emit({
              type: 'message_update',
              message: { ...currentMessage },
            });
          }
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

          // PostToolUse hooks (fire and forget)
          if (this.hookManager) {
            const toolCall = currentMessage.content.find(c => c.type === 'tool_call' && c.id === toolResult.toolCallId);
            if (toolCall && toolCall.type === 'tool_call') {
              this.hookManager
                .runPostToolUse(toolCall.name, toolCall.args, toolResult.result, toolResult.isError ?? false)
                .catch(() => {});
            }
          }
          break;
        }

        case 'tool-error': {
          const toolError = chunk.payload;
          this.emit({
            type: 'tool_end',
            toolCallId: toolError.toolCallId,
            result: toolError.error,
            isError: true,
          });
          break;
        }
        case 'tool-call-approval': {
          const toolCallId = chunk.payload.toolCallId;
          const toolName = chunk.payload.toolName;
          const toolArgs = chunk.payload.args;
          // The stream is now suspended — no more chunks will arrive
          // until approveToolCall() or declineToolCall() is called.

          let action: 'allow' | 'deny' | 'ask' = 'ask';

          // Run PreToolUse hooks first
          if (this.hookManager) {
            const hookResult = await this.hookManager.runPreToolUse(toolName, toolArgs);
            for (const warning of hookResult.warnings) {
              this.emit({
                type: 'error',
                error: new Error(`[hook] ${warning}`),
              });
            }
            if (!hookResult.allowed) {
              action = 'deny';
            }
          }
          // Resolve via YOLO / permission rules / session grants
          if (action !== 'deny') {
            action = this.resolveToolApproval(toolName);
          }

          if (action === 'allow') {
            // Auto-approve: resume the stream and process it
            const result = await this.handleToolApprove(toolCallId);
            currentMessage = result.message;
            // Stream is done after approval handling
            return { message: currentMessage };
          } else if (action === 'deny') {
            // Auto-deny: decline and process the resumed stream
            const result = await this.handleToolDecline(toolCallId);
            currentMessage = result.message;
            return { message: currentMessage };
          } else {
            // Ask the user — emit event and wait for decision
            const category = getToolCategory(toolName);

            this.emit({
              type: 'tool_approval_required',
              toolCallId,
              toolName,
              args: toolArgs,
            });

            // Wait for TUI to call resolveToolApprovalDecision()
            const decision = await new Promise<'approve' | 'decline' | 'always_allow_category'>(resolve => {
              this.pendingApprovalResolve = resolve;
            });

            if (decision === 'always_allow_category' && category) {
              this.sessionGrants.allowCategory(category);
            }

            if (decision === 'approve' || decision === 'always_allow_category') {
              const result = await this.handleToolApprove(toolCallId);
              currentMessage = result.message;
              return { message: currentMessage };
            } else {
              const result = await this.handleToolDecline(toolCallId);
              currentMessage = result.message;
              return { message: currentMessage };
            }
          }
        }
        case 'error': {
          const streamError =
            chunk.payload.error instanceof Error ? chunk.payload.error : new Error(String(chunk.payload.error));

          if (
            errorContains(streamError, 'must end with a user message') ||
            errorContains(streamError, 'assistant message prefill')
          ) {
            // Prefill error from stream — inject synthetic user message and retry
            this.followUpQueue.unshift('<continue>');
            this.emit({
              type: 'error',
              error: new Error('Prefill rejection — patching chat and retrying'),
              retryable: true,
            });
            break;
          }

          this.emit({
            type: 'error',
            error: streamError,
          });
          break;
        }
        case 'step-finish': {
          // Extract usage from step-finish payload
          const usage = chunk.payload?.output?.usage;
          if (usage) {
            const promptTokens = usage.promptTokens ?? 0;
            const completionTokens = usage.completionTokens ?? 0;
            const totalTokens = promptTokens + completionTokens;

            // Update cumulative token usage
            this.tokenUsage.promptTokens += promptTokens;
            this.tokenUsage.completionTokens += completionTokens;
            this.tokenUsage.totalTokens += totalTokens;

            // Persist to thread metadata (fire and forget)
            this.persistTokenUsage().catch(() => {});

            this.emit({
              type: 'usage_update',
              usage: {
                promptTokens,
                completionTokens,
                totalTokens,
              },
            });
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
          this.emit({ type: 'info', message: `finish reason: ${finishReason}` });
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

            // Emit new om_status event
            this.emit({
              type: 'om_status',
              windows: {
                active: {
                  messages: {
                    tokens: msgs.tokens ?? 0,
                    threshold: msgs.threshold ?? 0,
                  },
                  observations: {
                    tokens: obs.tokens ?? 0,
                    threshold: obs.threshold ?? 0,
                  },
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
          const payload = chunk.data;
          if (payload && payload.cycleId) {
            // Use operationType to distinguish reflection from observation
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
  // Event System
  // ===========================================================================

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

  private async emit(event: HarnessEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (err) {
        console.error('Error in harness event listener:', err);
      }
    }
  }

  // ===========================================================================
  // Runtime Context
  // ===========================================================================

  /**
   * Build request context for agent execution.
   * Tools can access harness state via requestContext.get('harness').
   */
  private async buildRequestContext(): Promise<RequestContext> {
    const harnessContext: HarnessRuntimeContext<TState> = {
      harnessId: this.id,
      state: this.getState() as z.infer<TState>,
      getState: () => this.getState() as z.infer<TState>,
      setState: updates => this.setState(updates),
      threadId: this.currentThreadId,
      resourceId: this.resourceId,
      modeId: this.currentModeId,
      abortSignal: this.abortController?.signal,
      workspace: this.workspace,
      emitEvent: event => this.emit(event),
      registerQuestion: (questionId, resolve) => this.registerQuestion(questionId, resolve),
      registerPlanApproval: (planId, resolve) => this.registerPlanApproval(planId, resolve),
      getSubagentModelId: (agentType?: string) => this.getSubagentModelId(agentType),
    };

    const requestContext = new RequestContext([['harness', harnessContext]]);
    // Resolve dynamic workspace factory with the built request context
    if (this.workspaceFn) {
      harnessContext.workspace = await Promise.resolve(this.workspaceFn({ requestContext: requestContext as any }));
    }

    return requestContext as any;
  }

  // ===========================================================================
  // Session Info
  // ===========================================================================

  /**
   * Get current session info (for TUI display).
   */
  async getSession(): Promise<HarnessSession> {
    return {
      currentThreadId: this.currentThreadId,
      currentModeId: this.currentModeId,
      threads: await this.listThreads(),
    };
  }
  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Get the auth storage instance.
   * Creates a default instance if not provided in config.
   */
  getAuthStorage(): AuthStorage {
    if (!this.config.authStorage) {
      this.config.authStorage = new AuthStorage();
    }
    return this.config.authStorage;
  }

  /**
   * Get all available OAuth providers.
   */
  getOAuthProviders(): OAuthProviderInterface[] {
    return getOAuthProviders();
  }

  /**
   * Check if a provider is logged in (has OAuth credentials).
   */
  isLoggedIn(providerId: string): boolean {
    return this.getAuthStorage().isLoggedIn(providerId);
  }

  /**
   * Check if a provider has any credentials (OAuth or API key).
   */
  hasCredentials(providerId: string): boolean {
    return this.getAuthStorage().has(providerId);
  }

  /**
   * Get all logged-in provider IDs.
   */
  getLoggedInProviders(): string[] {
    const providers = this.getOAuthProviders();
    return providers.filter(p => this.isLoggedIn(p.id)).map(p => p.id);
  }

  /**
   * Perform OAuth login for a provider.
   */
  async login(providerId: string, callbacks: OAuthLoginCallbacks): Promise<void> {
    await this.getAuthStorage().login(providerId, callbacks);
  }

  /**
   * Logout from a provider.
   */
  logout(providerId: string): void {
    this.getAuthStorage().logout(providerId);
  }

  /**
   * Get API key for a provider (from OAuth credentials or env).
   * Auto-refreshes OAuth tokens if needed.
   */
  async getApiKey(providerId: string): Promise<string | undefined> {
    return this.getAuthStorage().getApiKey(providerId);
  }

  // ===========================================================================
  // Workspace
  // ===========================================================================

  /**
   * Get the workspace instance (if configured and initialized).
   * Returns undefined if no workspace was configured or if init failed.
   */
  getWorkspace(): Workspace | undefined {
    return this.workspace;
  }

  /**
   * Check if a workspace is configured (regardless of init status).
   * Returns true for static workspaces, workspace configs, and dynamic factories.
   */
  hasWorkspace(): boolean {
    return this.config.workspace !== undefined;
  }

  /**
   * Check if the workspace is initialized and ready.
   * Dynamic workspace factories are always considered ready since they
   * resolve per-request and don't require upfront initialization.
   */
  isWorkspaceReady(): boolean {
    if (this.workspaceFn) return true;
    return this.workspaceInitialized && this.workspace !== undefined;
  }

  // ===========================================================================
  // Heartbeat Handlers
  // ===========================================================================

  /**
   * Start all configured heartbeat handlers.
   * Called automatically during `init()`.
   */
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
        run();
      }

      const timer = setInterval(run, hb.intervalMs);
      timer.unref();
      this.heartbeatTimers.set(hb.id, { timer, shutdown: hb.shutdown });
    }
  }

  /**
   * Register a heartbeat handler dynamically (after init).
   * If a handler with the same id already exists, it is replaced.
   */
  registerHeartbeat(handler: HeartbeatHandler): void {
    this.removeHeartbeat(handler.id);

    const run = async () => {
      try {
        await handler.handler();
      } catch (error) {
        console.error(`[Heartbeat:${handler.id}] failed:`, error);
      }
    };

    if (handler.immediate !== false) {
      run();
    }

    const timer = setInterval(run, handler.intervalMs);
    timer.unref();
    this.heartbeatTimers.set(handler.id, { timer, shutdown: handler.shutdown });
  }

  /**
   * Remove a heartbeat handler by id. Calls its shutdown hook if present.
   */
  async removeHeartbeat(id: string): Promise<void> {
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

  /**
   * Stop all heartbeat handlers and run their shutdown hooks. Call during shutdown.
   */
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

  /**
   * Destroy the workspace and clean up resources.
   * Can be called during harness shutdown for proper cleanup.
   * No-op for dynamic workspace factories (they are ephemeral per-request).
   */
  async destroyWorkspace(): Promise<void> {
    if (this.workspaceFn) return;
    if (this.workspace && this.workspaceInitialized) {
      try {
        this.emit({
          type: 'workspace_status_changed',
          status: 'destroying',
        });
        await this.workspace.destroy();
        this.emit({
          type: 'workspace_status_changed',
          status: 'destroyed',
        });
      } catch (error) {
        console.warn('Workspace destroy failed:', error);
      } finally {
        this.workspaceInitialized = false;
      }
    }
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================
  /**
   * Release the lock on the current thread.
   * Call this when the process is exiting.
   */
  releaseCurrentThreadLock(): void {
    if (this.currentThreadId) {
      releaseThreadLock(this.currentThreadId);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
