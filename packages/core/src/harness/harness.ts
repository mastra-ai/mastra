import { randomUUID } from 'node:crypto';

import { Agent } from '../agent';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { createSignal, mastraDBMessageToSignal } from '../agent/signals';
import type { AgentSignalAttributes, AgentSignalContents, AgentSignalInput } from '../agent/signals';
import type {
  AgentThreadSubscription,
  SendAgentNotificationSignalOptions,
  SendAgentNotificationSignalResult,
  ToolsInput,
  ToolsetsInput,
} from '../agent/types';
import type { MastraBrowser } from '../browser/browser';
import { getServerSideFallbackInfo } from '../llm/model/server-side-fallback';
import { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { StorageThreadType } from '../memory/types';
import type { SendNotificationSignalInput } from '../notifications';
import type { TracingContext, TracingOptions } from '../observability';
import { RequestContext } from '../request-context';
import { toStandardSchema } from '../schema';
import type { StandardSchemaWithJSON } from '../schema';
import type { MemoryStorage } from '../storage/domains/memory/base';
import type { ObservationalMemoryRecord } from '../storage/types';
import { getTransformedToolPayload, hasTransformedToolPayload } from '../tools/payload-transform';
import type { ToolPayloadTransformPhase } from '../tools/types';
import { safeStringify } from '../utils';
import { Workspace } from '../workspace/workspace';
import type { WorkspaceConfig } from '../workspace/workspace';

import {
  CRITICAL_DISPLAY_STATE_EVENT_TYPES,
  DEFAULT_DISPLAY_STATE_SUBSCRIPTION_OPTIONS,
  DisplayStateScheduler,
} from './display-state-scheduler';
import {
  askUserTool,
  createSubagentTool,
  submitPlanTool,
  taskCheckTool,
  taskCompleteTool,
  taskUpdateTool,
  taskWriteTool,
} from './tools';
import type { TaskItemSnapshot } from './tools';
import { createEmptyTokenUsage, defaultDisplayState, defaultOMProgressState } from './types';
import type {
  AvailableModel,
  HeartbeatHandler,
  HarnessConfig,
  HarnessDisplayState,
  HarnessDisplayStateListener,
  HarnessDisplayStateSubscriptionOptions,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMessageContent,
  HarnessMode,
  HarnessRequestContext,
  HarnessSession,
  HarnessThread,
  ModelAuthStatus,
  PermissionPolicy,
  PermissionRules,
  TokenUsage,
  ToolCategory,
} from './types';

type HarnessStreamState = {
  currentMessage: HarnessMessage;
  isSuspended: boolean;
  textContentById: Map<string, { index: number; text: string }>;
  thinkingContentById: Map<string, { index: number; text: string }>;
  /**
   * Set when a stream ends on a non-success finish reason (e.g. `content-filter`,
   * `error`, `length`). Carries the user-facing message so the run finalizes
   * into an explicit terminal error state instead of silently completing.
   */
  terminalError?: string;
};

function validateModes(modes: HarnessMode[]): void {
  const modeIds = new Set<string>();

  for (const mode of modes) {
    if (modeIds.has(mode.id)) {
      throw new Error(`Duplicate mode id "${mode.id}" found when creating the Harness`);
    }

    modeIds.add(mode.id);

    const modeRecord = mode as unknown as { id: string; tools?: unknown; additionalTools?: unknown };
    if (modeRecord.tools && modeRecord.additionalTools) {
      throw new Error(`Mode "${modeRecord.id}" cannot set both "tools" and "additionalTools" - choose replace OR augment`);
    }
  }

  for (const mode of modes) {
    if (mode.transitionsTo && !modeIds.has(mode.transitionsTo)) {
      throw new Error(`Mode "${mode.id}" transitionsTo references unknown mode "${mode.transitionsTo}"`);
    }
  }
}

type HarnessSendNotificationSignalOptions = {
  ifActive?: SendAgentNotificationSignalOptions['ifActive'];
  ifIdle?: SendAgentNotificationSignalOptions['ifIdle'];
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
  requestContext?: RequestContext;
};

/**
 * Build a user-facing message for a non-success stream finish reason.
 *
 * Anthropic's classifier blocks / model refusals (e.g. `claude-fable-5`) surface
 * through the AI SDK as a `content-filter` finish reason, with details on
 * `providerMetadata.anthropic.stopDetails`. Without explicit handling these
 * runs end on an empty assistant message with no error, so the run appears to
 * silently stop. Returning a message here lets the harness finalize the run
 * into an explicit terminal error state.
 */
export function describeNonSuccessFinishReason(reason: string, providerMetadata: unknown): string | undefined {
  switch (reason) {
    case 'content-filter': {
      const stopDetails = (providerMetadata as { anthropic?: { stopDetails?: Record<string, unknown> } } | undefined)
        ?.anthropic?.stopDetails;
      const explanation =
        stopDetails && typeof stopDetails.explanation === 'string' ? stopDetails.explanation : undefined;
      const category = stopDetails && typeof stopDetails.category === 'string' ? stopDetails.category : undefined;
      const detail = explanation ?? (category ? `category: ${category}` : undefined);
      return detail ? `The model stopped on a content filter (${detail}).` : 'The model stopped on a content filter.';
    }
    case 'error':
      return 'The model stream ended with an error before producing a final response.';
    case 'length':
      return 'The model stopped because it reached its maximum output length before finishing.';
    default:
      return undefined;
  }
}

/**
 * The Anthropic model that `claude-fable-5` runs are automatically retried on
 * server-side when fable-5's safety classifiers block a turn. See
 * {@link buildFableFallbackProviderOptions}.
 */
const FABLE_FALLBACK_MODEL = 'claude-opus-4-8';

/**
 * Returns Anthropic `providerOptions` that enable a server-side fallback to
 * {@link FABLE_FALLBACK_MODEL} when the active model is `claude-fable-5`, and
 * `undefined` otherwise.
 *
 * fable-5 can have a turn blocked server-side by its safety classifiers. With
 * a fallback configured, Anthropic transparently retries the blocked turn on
 * the fallback model and returns that model's answer instead of refusing. If
 * the whole chain refuses, the run still ends on a `content-filter` finish
 * reason, which is handled as a terminal error.
 *
 * The match is suffix-based so it covers `anthropic/claude-fable-5`, a bare
 * `claude-fable-5`, and any pack/provider-prefixed form.
 */
export function buildFableFallbackProviderOptions(
  modelId: string,
): { anthropic: { fallbacks: { model: string }[] } } | undefined {
  if (!/(^|\/)claude-fable-5$/.test(modelId)) {
    return undefined;
  }
  return { anthropic: { fallbacks: [{ model: FABLE_FALLBACK_MODEL }] } };
}

/**
 * Build a user-facing notice when a turn was served by an Anthropic
 * server-side fallback model instead of the primary model.
 *
 * When the primary model's safety classifiers decline a turn and a fallback
 * chain is configured (see {@link buildFableFallbackProviderOptions}), the API
 * transparently retries on the fallback model and reports this via
 * `fallback_message` entries in `providerMetadata.anthropic.iterations`.
 * Without a notice the user has no way to tell that the response did not come
 * from the model they selected.
 */
export function describeServerSideFallback(providerMetadata: unknown): string | undefined {
  const fallback = getServerSideFallbackInfo(providerMetadata);
  if (!fallback) {
    return undefined;
  }
  return fallback.model
    ? `The selected model declined this turn; the response was generated by fallback model ${fallback.model}.`
    : 'The selected model declined this turn; the response was generated by a fallback model.';
}

function getUsageNumber(usage: Record<string, unknown>, key: string): number | undefined {
  const value = usage[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return undefined;
}

function addOptionalUsageField(
  usage: TokenUsage,
  key: keyof Pick<TokenUsage, 'reasoningTokens' | 'cachedInputTokens' | 'cacheCreationInputTokens'>,
  value: number | undefined,
): void {
  if (value !== undefined) {
    usage[key] = (usage[key] ?? 0) + value;
  }
}

function getDisplayTransform(metadata: unknown, phase: ToolPayloadTransformPhase, fallback: unknown) {
  const transform = getTransformedToolPayload(metadata, 'display', phase);
  return hasTransformedToolPayload(transform) ? transform.transformed : fallback;
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getRecordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function signalContentsToHarnessContent(contents: AgentSignalContents): HarnessMessageContent[] {
  if (typeof contents === 'string') return [{ type: 'text', text: contents }];
  return contents.flatMap((part): HarnessMessageContent[] => {
    if (part.type === 'text') {
      return [{ type: 'text', text: part.text }];
    }
    if (typeof part.data !== 'string') return [];
    if (part.mediaType.startsWith('image/')) {
      return [{ type: 'image', data: part.data, mimeType: part.mediaType }];
    }
    return [
      {
        type: 'file',
        data: part.data,
        mediaType: part.mediaType,
        filename: part.filename,
      },
    ];
  });
}

function toSystemReminderContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'system_reminder' }> | undefined {
  const attributes = getRecordValue(payload.attributes);
  const metadata = getRecordValue(payload.metadata);
  const message = signalContentsToText(payload.contents);
  if (!message) return undefined;

  return {
    type: 'system_reminder',
    message,
    reminderType:
      getStringValue(payload.reminderType) ?? getStringValue(attributes?.type) ?? getStringValue(payload.type),
    path: getStringValue(payload.path) ?? getStringValue(attributes?.path),
    precedesMessageId: getStringValue(payload.precedesMessageId) ?? getStringValue(attributes?.precedesMessageId),
    gapText: getStringValue(payload.gapText) ?? getStringValue(attributes?.gapText),
    gapMs:
      typeof payload.gapMs === 'number'
        ? payload.gapMs
        : typeof attributes?.gapMs === 'number'
          ? attributes.gapMs
          : undefined,
    timestamp: getStringValue(payload.timestamp) ?? getStringValue(attributes?.timestamp),
    goalMaxTurns:
      typeof payload.goalMaxTurns === 'number'
        ? payload.goalMaxTurns
        : typeof metadata?.goalMaxTurns === 'number'
          ? metadata.goalMaxTurns
          : undefined,
    judgeModelId: getStringValue(payload.judgeModelId) ?? getStringValue(metadata?.judgeModelId),
  };
}

function toUserSignalMessage(payload: Record<string, unknown>): HarnessMessage | undefined {
  const id = getStringValue(payload.id);
  const rawContents = payload.contents;
  if (!id || rawContents === undefined) return undefined;

  const signal = createSignal({
    id,
    type: 'user',
    tagName: 'user',
    contents: rawContents as AgentSignalContents,
    attributes: getRecordValue(payload.attributes) as AgentSignalInput['attributes'],
    createdAt: getStringValue(payload.createdAt),
  });
  const content = signalContentsToHarnessContent(signal.contents);
  if (content.length === 0) return undefined;

  return {
    id: signal.id,
    role: 'user',
    content,
    createdAt: signal.createdAt,
    attributes: signal.attributes,
  };
}

function signalContentsToText(contents: unknown): string {
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents)) return '';
  return contents
    .filter((part): part is { type: 'text'; text: string } => getRecordValue(part)?.type === 'text')
    .map(part => part.text)
    .join('\n');
}

function toStateSignalContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'state_signal' }> | undefined {
  const stateMetadata = getRecordValue(getRecordValue(payload.metadata)?.state);
  const stateId = getStringValue(stateMetadata?.id) ?? getStringValue(payload.tagName) ?? 'state';

  return {
    type: 'state_signal',
    id: getStringValue(payload.id),
    stateId,
    mode: stateMetadata?.mode === 'delta' ? 'delta' : 'snapshot',
    cacheKey: getStringValue(stateMetadata?.cacheKey),
    version: typeof stateMetadata?.version === 'number' ? stateMetadata.version : undefined,
    message: signalContentsToText(payload.contents),
  };
}

function toNotificationSummaryContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'notification_summary' }> | undefined {
  const metadataSummary = getRecordValue(getRecordValue(payload.metadata)?.notificationSummary);
  const bySource = getRecordValue(metadataSummary?.bySource) ?? {};
  const byPriority = getRecordValue(metadataSummary?.byPriority) ?? {};
  const notificationIds = Array.isArray(metadataSummary?.notificationIds)
    ? metadataSummary.notificationIds.filter((id): id is string => typeof id === 'string')
    : [];
  const pending = typeof metadataSummary?.pending === 'number' ? metadataSummary.pending : undefined;

  return {
    type: 'notification_summary',
    id: getStringValue(payload.id),
    message: signalContentsToText(payload.contents),
    pending: pending ?? notificationIds.length,
    bySource: Object.fromEntries(
      Object.entries(bySource).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ),
    byPriority: Object.fromEntries(
      Object.entries(byPriority).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
    ),
    notificationIds,
  };
}

function toReactiveSignalContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'reactive_signal' }> | undefined {
  const tagName = getStringValue(payload.tagName);
  if (!tagName) return undefined;

  return {
    type: 'reactive_signal',
    id: getStringValue(payload.id),
    tagName,
    message: signalContentsToText(payload.contents),
    attributes: getRecordValue(payload.attributes),
    metadata: getRecordValue(payload.metadata),
  };
}

function toNotificationContent(
  payload: Record<string, unknown>,
): Extract<HarnessMessageContent, { type: 'notification' }> | undefined {
  const attributes = getRecordValue(payload.attributes) ?? {};
  const metadata = getRecordValue(payload.metadata) ?? {};
  const notificationMetadata = getRecordValue(metadata.notification);
  const message = signalContentsToText(payload.contents);
  if (!message) return undefined;

  return {
    type: 'notification',
    id: getStringValue(payload.id),
    notificationId: getStringValue(attributes.id) ?? getStringValue(notificationMetadata?.recordId),
    message,
    source: getStringValue(attributes.source) ?? getStringValue(notificationMetadata?.source),
    kind:
      getStringValue(attributes.kind) ?? getStringValue(attributes.type) ?? getStringValue(notificationMetadata?.kind),
    priority: getStringValue(attributes.priority) ?? getStringValue(notificationMetadata?.priority),
    status: getStringValue(attributes.status) ?? getStringValue(notificationMetadata?.status),
    attributes,
    metadata,
  };
}

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
export class Harness<TState = {}> {
  readonly id: string;

  private config: HarnessConfig<TState>;
  private stateSchema: StandardSchemaWithJSON | undefined;
  private state: TState;
  private currentModeId: string;
  private currentThreadId: string | null = null;
  private resourceId: string;
  private defaultResourceId: string;
  private listeners: HarnessEventListener[] = [];
  private displayStateSchedulers = new Set<DisplayStateScheduler>();
  private abortController: AbortController | null = null;
  private abortRequested: boolean = false;
  private currentRunId: string | null = null;
  private currentTraceId: string | null = null;
  private currentOperationId: number = 0;
  private agentThreadSubscription: AgentThreadSubscription<any> | null = null;
  private agentThreadSubscriptionKey: string | null = null;
  private followUpQueue: Array<{ content: string; requestContext?: RequestContext }> = [];
  private pendingApprovalResolve:
    | ((params: { decision: 'approve' | 'decline'; requestContext?: RequestContext }) => void)
    | null = null;
  private pendingApprovalToolName: string | null = null;
  /**
   * Tool calls currently suspended via the native tool-suspension primitive,
   * keyed by `toolCallId`. Each entry records the `runId` to resume. A Map (rather
   * than single fields) lets multiple tools (e.g. parallel `ask_user` calls in one
   * step — see issue #13642) stay suspended and be resumed independently.
   */
  private pendingSuspensions = new Map<string, { runId: string; toolName: string }>();
  private workspace: Workspace | undefined = undefined;
  private workspaceFn:
    | ((ctx: {
        requestContext: RequestContext;
        mastra?: Mastra;
      }) => Promise<Workspace | undefined> | Workspace | undefined)
    | undefined = undefined;
  private workspaceInitialized = false;
  private browser: MastraBrowser | undefined = undefined;
  private browserFn:
    | ((ctx: { requestContext: RequestContext }) => Promise<MastraBrowser | undefined> | MastraBrowser | undefined)
    | undefined = undefined;
  private heartbeatTimers = new Map<string, { timer: NodeJS.Timeout; shutdown?: () => void | Promise<void> }>();
  private tokenUsage: TokenUsage = createEmptyTokenUsage();
  private sessionGrantedCategories = new Set<string>();
  private sessionGrantedTools = new Set<string>();
  private displayState: HarnessDisplayState = defaultDisplayState();
  private stateUpdateQueue: Promise<void> = Promise.resolve();
  private switchModeVersion: number = 0;
  private availableModelsCache: AvailableModel[] | null = null;
  private availableModelsCacheTime: number = 0;
  readonly #instructions?: string;
  #internalMastra: Mastra | undefined = undefined;
  #legacyAgentMode: Record<string, Agent<any, any, any, any>> = {};

  constructor(config: HarnessConfig<TState>) {
    validateModes(config.modes);

    this.id = config.id;
    this.config = config;
    this.resourceId = config.resourceId ?? config.id;
    this.defaultResourceId = this.resourceId;
    this.#instructions = config.instructions;

    // Convert PublicSchema to StandardSchemaWithJSON at the boundary
    this.stateSchema = config.stateSchema ? toStandardSchema(config.stateSchema) : undefined;

    // Initialize state from schema defaults + initial state
    this.state = {
      ...this.getSchemaDefaults(),
      ...config.initialState,
    } as TState;

    const defaultMode = config.defaultModeId
      ? config.modes.find(mode => mode.id === config.defaultModeId)
      : (config.modes.find(mode => mode.default || mode.metadata?.default === true) ?? config.modes[0]);
    if (!defaultMode) {
      throw new Error(
        config.defaultModeId
          ? `Default mode not found: ${config.defaultModeId}`
          : 'Harness requires at least one agent mode',
      );
    }
    this.currentModeId = defaultMode.id;

    // Store workspace: pre-built instance, dynamic factory, or config (constructed in init())
    if (config.workspace instanceof Workspace) {
      this.workspace = config.workspace;
    } else if (typeof config.workspace === 'function') {
      this.workspaceFn = config.workspace;
    }

    // Store browser: pre-built instance or dynamic factory
    if (config.browser && typeof config.browser !== 'function') {
      this.browser = config.browser;
    } else if (typeof config.browser === 'function') {
      this.browserFn = config.browser;
    }

    // Seed model from mode default if not set
    const currentModel = (this.state as any).currentModelId;
    if (!currentModel && defaultMode.defaultModelId) {
      void this.setState({ currentModelId: defaultMode.defaultModelId } as unknown as Partial<TState>);
    }
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Access the internal Mastra instance.
   * Available after `init()` when storage is configured.
   * Useful for scorer registration, observability access, and eval tooling.
   */
  getMastra(): Mastra | undefined {
    return this.#internalMastra;
  }

  /**
   * Sets or updates the harness-level browser and propagates it to static mode agents.
   */
  setBrowser(browser: MastraBrowser | undefined): void {
    this.browser = browser;
    this.browserFn = undefined;

    for (const mode of this.config.modes) {
      const agent = this.getAgentForMode(mode);
      agent.setBrowser(browser);
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
    // Create an internal Mastra instance so agents have access to storage
    // (required for tool approval snapshot persistence/resume).
    // We init storage through Mastra's proxied storage so augmentWithInit
    // tracks it and won't double-init.
    if (this.config.storage) {
      this.#internalMastra = new Mastra({
        logger: false,
        storage: this.config.storage,
        ...(this.config.pubsub ? { pubsub: this.config.pubsub } : {}),
        ...(this.config.observability ? { observability: this.config.observability } : {}),
      });
      await this.#internalMastra.getStorage()!.init();
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

    // Propagate harness-level Mastra, memory, workspace, browser, and pubsub to mode agents (after workspace init)
    for (const mode of this.config.modes) {
      const agent = this.getAgentForMode(mode);
      this.propagateRuntimeServicesToAgent(agent);
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
    await this.config.threadLock?.acquire(mostRecent.id);
    this.currentThreadId = mostRecent.id;
    await this.loadThreadMetadata();
    await this.ensureCurrentAgentThreadSubscription();

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
  getState(): Readonly<TState> {
    return { ...this.state };
  }

  private async applyStateUpdates(updates: Partial<TState>): Promise<void> {
    const changedKeys = Object.keys(updates);
    const newState = { ...this.state, ...updates };

    if (this.stateSchema) {
      const result = await this.stateSchema['~standard'].validate(newState);
      if (result.issues) {
        const messages = result.issues.map(i => i.message).join('; ');
        throw new Error(`Invalid state update: ${messages}`);
      }
      this.state = result.value as TState;
    } else {
      this.state = newState as TState;
    }

    this.emit({ type: 'state_changed', state: this.state as Record<string, unknown>, changedKeys });
  }

  /**
   * Update harness state. Validates against schema if provided.
   * Emits state_changed event.
   */
  async setState(updates: Partial<TState>): Promise<void> {
    const run = this.stateUpdateQueue.then(() => this.applyStateUpdates(updates));
    this.stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async updateState<TResult>(
    updater: (
      state: Readonly<TState>,
    ) =>
      | { updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }>,
  ): Promise<TResult> {
    const run = this.stateUpdateQueue.then(async () => {
      const update = await updater(this.getState());
      if (update.updates && Object.keys(update.updates).length > 0) {
        await this.applyStateUpdates(update.updates);
      }
      for (const event of update.events ?? []) {
        this.emit(event);
      }
      return update.result;
    });

    this.stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private getSchemaDefaults(): Partial<TState> {
    if (!this.stateSchema) return {};

    const defaults: Record<string, unknown> = {};

    try {
      // Extract defaults from the JSON Schema representation
      const jsonSchema = this.stateSchema['~standard'].jsonSchema.output({ target: 'draft-07' }) as {
        properties?: Record<string, { default?: unknown }>;
      };
      if (jsonSchema?.properties) {
        for (const [key, prop] of Object.entries(jsonSchema.properties)) {
          if (prop.default !== undefined) {
            defaults[key] = prop.default;
          }
        }
      }
    } catch {
      // Schema doesn't support JSON Schema extraction — skip defaults
    }

    return defaults as Partial<TState>;
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  listModes(): HarnessMode[] {
    return this.config.modes;
  }

  getCurrentModeId(): string {
    return this.currentModeId;
  }

  getCurrentMode(): HarnessMode {
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

    const currentModelId = this.getCurrentModelId();
    const previousModeId = this.currentModeId;
    const version = ++this.switchModeVersion;

    // Update local state and emit events immediately so UIs can update
    // without waiting for storage round-trips.
    this.currentModeId = modeId;
    this.emit({ type: 'mode_changed', modeId, previousModeId });

    // Save current model to the outgoing mode before switching
    if (currentModelId) {
      await this.setThreadSetting({ key: `modeModelId_${previousModeId}`, value: currentModelId });
    }
    if (this.switchModeVersion !== version) return;

    await this.setThreadSetting({ key: 'currentModeId', value: modeId });
    if (this.switchModeVersion !== version) return;

    // Load the incoming mode's model
    const modeModelId = await this.loadModeModelId(modeId);
    if (this.switchModeVersion !== version) return;
    if (modeModelId) {
      void this.setState({ currentModelId: modeModelId } as unknown as Partial<TState>);
      this.emit({ type: 'model_changed', modelId: modeModelId } as HarnessEvent);
    }
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

  private propagateRuntimeServicesToAgent(agent: Agent): Agent {
    const alreadyHasMastra = !!agent.getMastraInstance();
    const workspaceForAgents = this.workspaceFn ?? this.workspace;
    const browserForAgents = this.browserFn ?? this.browser;

    if (this.config.memory && !agent.hasOwnMemory()) {
      agent.__setMemory(this.config.memory);
    }
    if (workspaceForAgents && !agent.hasOwnWorkspace()) {
      agent.__setWorkspace(workspaceForAgents);
    }
    if (browserForAgents && !agent.hasOwnBrowser()) {
      agent.setBrowser(browserForAgents as MastraBrowser);
    }
    if (this.config.pubsub && !agent.hasOwnPubSub()) {
      agent.__setPubSub(this.config.pubsub);
    }

    if (this.#internalMastra && !alreadyHasMastra) {
      this.#internalMastra.addAgent(agent);
    }

    return agent;
  }

  private getAgentForMode(mode: HarnessMode): Agent<any, any, any, any> {
    if (!this.#legacyAgentMode[mode.id]) {
      const instructions = [this.#instructions ?? '', mode.instructions].filter(Boolean).join('\n');
      const modeTools = {
        ...mode.tools,
        ...mode.additionalTools,
      };

      if (mode.agent) {
        this.#legacyAgentMode[mode.id] = mode.agent;
      } else if (this.config.agent) {
        const forkedAgent = this.config.agent.__fork();
        if (instructions) {
          forkedAgent.__updateInstructions(instructions);
        }
        if (mode.tools || mode.additionalTools) {
          forkedAgent.__setTools(modeTools as any);
        }
        this.#legacyAgentMode[mode.id] = forkedAgent;
      } else {
        if (!mode.defaultModelId) {
          throw new Error(`Mode ${mode.id} requires a defaultModelId when no backing agent is configured`);
        }

        const model = this.config.resolveModel ? this.config.resolveModel(mode.defaultModelId) : mode.defaultModelId;
        const forkedAgent = new Agent({
          id: `${this.id}-agent`,
          name: `Harness ${this.id} agent`,
          model,
          instructions,
          // TODO move to permissions and global tools
          tools: modeTools,
        });

        this.#legacyAgentMode[mode.id] = forkedAgent;
      }
    }

    return this.#legacyAgentMode[mode.id]!;
  }

  /**
   * Get the agent for the current mode.
   */
  /**
   * Resolve the Agent backing the current mode, with runtime services (storage,
   * pubsub, telemetry) propagated. Public so consumers like MastraCode's
   * GoalManager can drive the agent's native objective methods
   * (`setObjective`/`getObjective`/`clearObjective`/`updateObjectiveOptions`),
   * which read/write the durable `threadState` `'goal'` slot.
   */
  getCurrentAgent(): Agent {
    const mode = this.getCurrentMode();

    return this.propagateRuntimeServicesToAgent(this.getAgentForMode(mode));
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
      void this.setState({ currentModelId: modelId } as unknown as Partial<TState>);
    }

    if (scope === 'thread') {
      await this.setThreadSetting({ key: `modeModelId_${targetModeId}`, value: modelId });
    }

    try {
      await Promise.resolve(this.config.modelUseCountTracker?.(modelId));
    } catch (error) {
      console.error('Failed to track model usage count', error);
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
   * Uses the optional `modelAuthChecker`, `modelUseCountProvider`, and
   * `customModelCatalogProvider` hooks.
   */
  async listAvailableModels(): Promise<AvailableModel[]> {
    const now = Date.now();
    if (this.availableModelsCache && now - this.availableModelsCacheTime < 10_000) {
      return this.availableModelsCache;
    }

    try {
      const { PROVIDER_REGISTRY } = await import('../llm/model/provider-registry.js');

      if (!PROVIDER_REGISTRY) return [];

      const registry = PROVIDER_REGISTRY as Record<
        string,
        { models?: string[]; name?: string; apiKeyEnvVar?: string | string[] }
      >;
      const providers = Object.keys(registry);
      const useCounts = this.config.modelUseCountProvider?.() ?? {};
      const modelsById = new Map<string, AvailableModel>();

      const upsertModel = (model: Omit<AvailableModel, 'useCount'>): void => {
        if (!model.id || !model.provider || !model.modelName) return;
        modelsById.set(model.id, {
          ...model,
          useCount: useCounts[model.id] ?? 0,
        });
      };

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
            upsertModel({
              id: `${provider}/${modelName}`,
              provider,
              modelName,
              hasApiKey,
              apiKeyEnvVar: apiKeyEnvVar || undefined,
            });
          }
        }
      }

      if (this.config.customModelCatalogProvider) {
        try {
          const customModels = await Promise.resolve(this.config.customModelCatalogProvider());
          for (const model of customModels) {
            upsertModel({
              id: model.id,
              provider: model.provider,
              modelName: model.modelName,
              hasApiKey: model.hasApiKey,
              apiKeyEnvVar: model.apiKeyEnvVar,
            });
          }
        } catch (error) {
          console.warn('Failed to load custom available models:', error);
        }
      }

      const result = [...modelsById.values()];
      this.availableModelsCache = result;
      this.availableModelsCacheTime = Date.now();
      return result;
    } catch (error) {
      console.warn('Failed to load available models:', error);
      return [];
    }
  }

  invalidateAvailableModelsCache(): void {
    this.availableModelsCache = null;
    this.availableModelsCacheTime = 0;
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

  async getResolvedMemory(): Promise<MastraMemory | null> {
    if (!this.config.memory) return null;
    return this.resolveMemory();
  }

  setResourceId({ resourceId }: { resourceId: string }): void {
    this.cleanupAgentThreadSubscription();
    this.resourceId = resourceId;
    this.currentThreadId = null;
  }

  getDefaultResourceId(): string {
    return this.defaultResourceId;
  }

  async getKnownResourceIds(): Promise<string[]> {
    const threads = await this.listThreads({ allResources: true });
    const ids = new Set(threads.map(t => t.resourceId));
    return [...ids].sort();
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    this.cleanupAgentThreadSubscription();
    const now = new Date();
    const thread: HarnessThread = {
      id: this.generateId(),
      resourceId: this.resourceId,
      title: title || '',
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

    // Acquire lock on new thread before releasing old one.
    // If acquire fails, attempt to re-acquire the old lock before rethrowing.
    const oldThreadId = this.currentThreadId;
    if (this.config.threadLock) {
      try {
        await this.config.threadLock.acquire(thread.id);
      } catch (err) {
        if (oldThreadId) {
          try {
            await this.config.threadLock.acquire(oldThreadId);
          } catch {
            // Best-effort re-acquire; original error is more important
          }
        }
        throw err;
      }
      if (oldThreadId) {
        await this.config.threadLock.release(oldThreadId);
      }
    }

    if (this.config.storage) {
      const memoryStorage = await this.getMemoryStorage();
      try {
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
      } catch (err) {
        // saveThread failed after lock was swapped; restore previous lock state
        let reacquired = false;
        if (this.config.threadLock) {
          try {
            await this.config.threadLock.release(thread.id);
          } catch {
            // Best-effort release of new thread lock
          }
          if (oldThreadId) {
            try {
              await this.config.threadLock.acquire(oldThreadId);
              reacquired = true;
            } catch {
              // Re-acquire failed; no lock is held
            }
          }
        }
        this.currentThreadId = reacquired ? oldThreadId : null;
        throw err;
      }
    }

    this.currentThreadId = thread.id;

    if (modelId && !currentStateModel) {
      void this.setState({ currentModelId: modelId } as unknown as Partial<TState>);
    }

    this.tokenUsage = createEmptyTokenUsage();
    this.emit({ type: 'thread_created', thread });
    await this.ensureCurrentAgentThreadSubscription();

    return thread;
  }

  /**
   * Returns a memory accessor with thread and message management methods.
   */
  get memory() {
    return {
      createThread: this.createThread.bind(this),
      switchThread: this.switchThread.bind(this),
      listThreads: this.listThreads.bind(this),
      renameThread: this.renameThread.bind(this),
      deleteThread: this.deleteThread.bind(this),
    };
  }

  private async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    if (!this.config.storage) return;

    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const isDeletingCurrentThread = this.currentThreadId === threadId;

    await memoryStorage.deleteThread({ threadId });

    if (isDeletingCurrentThread) {
      try {
        await this.config.threadLock?.release(threadId);
      } catch {
        // Lock release failed; proceed with state cleanup regardless
      }
      this.cleanupAgentThreadSubscription();
      this.currentThreadId = null;
      this.tokenUsage = createEmptyTokenUsage();
    }

    this.emit({ type: 'thread_deleted', threadId });
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

  async cloneThread({
    sourceThreadId,
    title,
    resourceId,
  }: {
    sourceThreadId?: string;
    title?: string;
    resourceId?: string;
  } = {}): Promise<HarnessThread> {
    const sourceId = sourceThreadId ?? this.currentThreadId;
    if (!sourceId) {
      throw new Error('No source thread to clone');
    }
    if (!this.config.memory) {
      throw new Error('Memory is not configured on this Harness');
    }

    const memory = await this.resolveMemory();

    const result = await memory.cloneThread({
      sourceThreadId: sourceId,
      resourceId: resourceId ?? this.resourceId,
      title,
    });

    const clonedThread: HarnessThread = {
      id: result.thread.id,
      resourceId: result.thread.resourceId,
      title: result.thread.title ?? 'Cloned Thread',
      createdAt: result.thread.createdAt,
      updatedAt: result.thread.updatedAt,
      metadata: result.thread.metadata,
    };

    // Acquire lock on new thread before releasing old one
    const oldThreadId = this.currentThreadId;
    if (this.config.threadLock) {
      try {
        await this.config.threadLock.acquire(clonedThread.id);
      } catch (err) {
        if (oldThreadId) {
          try {
            await this.config.threadLock.acquire(oldThreadId);
          } catch {
            // Best-effort re-acquire; original error is more important
          }
        }
        throw err;
      }
      if (oldThreadId) {
        await this.config.threadLock.release(oldThreadId);
      }
    }

    this.cleanupAgentThreadSubscription();
    this.currentThreadId = clonedThread.id;
    await this.loadThreadMetadata();
    this.tokenUsage = createEmptyTokenUsage();
    this.emit({ type: 'thread_created', thread: clonedThread });
    await this.ensureCurrentAgentThreadSubscription();

    return clonedThread;
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    this.abort();
    this.cleanupAgentThreadSubscription();

    // Acquire lock on new thread before releasing old one.
    // Lock operations must be adjacent (no intermediate awaits) so callers
    // can rely on a single microtask tick to observe both acquire and release.
    await this.config.threadLock?.acquire(threadId);
    const previousThreadId = this.currentThreadId;
    if (previousThreadId) {
      await this.config.threadLock?.release(previousThreadId);
    }

    if (this.config.storage) {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }
    }

    this.currentThreadId = threadId;

    await this.loadThreadMetadata();

    this.emit({ type: 'thread_changed', threadId, previousThreadId });
    await this.ensureCurrentAgentThreadSubscription();
  }

  async listThreads(options?: {
    allResources?: boolean;
    /**
     * Include forked subagent fork threads. Defaults to false: forks are
     * transient clones used by the runtime and should not show up in user-facing
     * thread lists / pickers / startup flows. Set to true for admin / debug
     * tooling that needs to see every thread.
     */
    includeForkedSubagents?: boolean;
  }): Promise<HarnessThread[]> {
    if (!this.config.storage) return [];

    const memoryStorage = await this.getMemoryStorage();
    const filter: { resourceId?: string } | undefined = options?.allResources
      ? undefined
      : { resourceId: this.resourceId };

    const result = await memoryStorage.listThreads({ filter, perPage: false });

    const threads = options?.includeForkedSubagents
      ? result.threads
      : result.threads.filter(thread => {
          const metadata = thread.metadata as Record<string, unknown> | undefined;
          return metadata?.forkedSubagent !== true;
        });

    return threads.map((thread: StorageThreadType) => ({
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
      this.tokenUsage = createEmptyTokenUsage();
      return;
    }

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId: this.currentThreadId });

      // Load token usage
      const savedUsage = thread?.metadata?.tokenUsage as typeof this.tokenUsage | undefined;
      if (savedUsage) {
        this.tokenUsage = {
          ...createEmptyTokenUsage(),
          ...savedUsage,
          promptTokens: savedUsage.promptTokens ?? 0,
          completionTokens: savedUsage.completionTokens ?? 0,
          totalTokens: savedUsage.totalTokens ?? 0,
          cachedInputTokens: savedUsage.cachedInputTokens ?? 0,
          cacheCreationInputTokens: savedUsage.cacheCreationInputTokens ?? 0,
        };
      } else {
        this.tokenUsage = createEmptyTokenUsage();
      }

      const meta = thread?.metadata as Record<string, unknown> | undefined;
      const updates: Record<string, unknown> = {};

      // Restore the saved mode FIRST so we resolve currentModelId for the
      // correct mode. Otherwise we'd look up modeModelId_<defaultMode> first
      // and then never overwrite it when the saved mode has no per-mode
      // override persisted (e.g. user only ever used the mode's default
      // model), leaving the wrong mode's model active on restart.
      let previousModeIdForEmit: string | undefined;
      if (meta?.currentModeId) {
        const savedModeId = meta.currentModeId as string;
        const modeExists = this.config.modes.some(m => m.id === savedModeId);
        if (modeExists && savedModeId !== this.currentModeId) {
          previousModeIdForEmit = this.currentModeId;
          this.currentModeId = savedModeId;
        }
      }

      // Resolve the model for the (now-restored) current mode.
      // Order: per-mode thread metadata → mode's defaultModelId → legacy
      // global currentModelId (set by createThread).
      const modeModelKey = `modeModelId_${this.currentModeId}`;
      if (meta?.[modeModelKey]) {
        updates.currentModelId = meta[modeModelKey];
      } else {
        const currentMode = this.config.modes.find(m => m.id === this.currentModeId);
        if (currentMode?.defaultModelId) {
          updates.currentModelId = currentMode.defaultModelId;
        } else if (meta?.currentModelId) {
          updates.currentModelId = meta.currentModelId;
        }
      }

      if (previousModeIdForEmit !== undefined) {
        this.emit({
          type: 'mode_changed',
          modeId: this.currentModeId,
          previousModeId: previousModeIdForEmit,
        });
      }

      // Restore observer/reflector model IDs
      if (meta?.observerModelId) {
        updates.observerModelId = meta.observerModelId;
      }
      if (meta?.reflectorModelId) {
        updates.reflectorModelId = meta.reflectorModelId;
      }
      const hasObservationThreshold = typeof meta?.observationThreshold === 'number';
      const hasReflectionThreshold = typeof meta?.reflectionThreshold === 'number';

      if (hasObservationThreshold) {
        updates.observationThreshold = meta.observationThreshold;
      }
      if (hasReflectionThreshold) {
        updates.reflectionThreshold = meta.reflectionThreshold;
      }

      if (Object.keys(updates).length > 0) {
        await this.setState(updates as unknown as Partial<TState>);
      }

      if (!hasObservationThreshold) {
        const observationThreshold = this.getObservationThreshold();
        if (observationThreshold !== undefined) {
          await this.setThreadSetting({ key: 'observationThreshold', value: observationThreshold });
        }
      }
      if (!hasReflectionThreshold) {
        const reflectionThreshold = this.getReflectionThreshold();
        if (reflectionThreshold !== undefined) {
          await this.setThreadSetting({ key: 'reflectionThreshold', value: reflectionThreshold });
        }
      }
    } catch {
      this.tokenUsage = createEmptyTokenUsage();
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
    void this.setState({ observerModelId: modelId } as unknown as Partial<TState>);
    await this.setThreadSetting({ key: 'observerModelId', value: modelId });
    this.emit({ type: 'om_model_changed', role: 'observer', modelId } as HarnessEvent);
  }

  /**
   * Switch the Reflector model.
   */
  async switchReflectorModel({ modelId }: { modelId: string }): Promise<void> {
    void this.setState({ reflectorModelId: modelId } as unknown as Partial<TState>);
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
    void this.setState({ [key]: modelId } as unknown as Partial<TState>);
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
    void this.setState({ permissionRules: rules } as unknown as Partial<TState>);
  }

  setPermissionForTool({ toolName, policy }: { toolName: string; policy: PermissionPolicy }): void {
    const rules = this.getPermissionRules();
    rules.tools[toolName] = policy;
    void this.setState({ permissionRules: rules } as unknown as Partial<TState>);
  }

  getPermissionRules(): PermissionRules {
    const state = this.state as Record<string, unknown>;
    const rules = state.permissionRules as PermissionRules | undefined;
    return rules ?? { categories: {}, tools: {} };
  }

  /**
   * Resolve whether a tool call should be auto-approved, denied, or asked.
   * Resolution chain: per-tool deny → yolo → per-tool policy → session tool grant →
   * session category grant → category policy → "ask"
   */
  private resolveToolApproval(toolName: string): PermissionPolicy {
    const state = this.state as Record<string, unknown>;
    const rules = this.getPermissionRules();

    const toolPolicy = rules.tools[toolName];
    if (toolPolicy === 'deny') return 'deny';

    if (state.yolo === true) return 'allow';

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

  private cleanupAgentThreadSubscription(): void {
    this.agentThreadSubscription?.abort();
    this.agentThreadSubscription?.unsubscribe();
    this.agentThreadSubscription = null;
    this.agentThreadSubscriptionKey = null;
    this.currentRunId = null;
    this.currentTraceId = null;
    this.abortController = null;
    this.abortRequested = false;
  }

  private getAgentThreadSubscriptionKey(agent: Agent, threadId: string): string {
    return `${agent.id}:${this.resourceId}:${threadId}`;
  }

  private async ensureAgentThreadSubscription(agent: Agent, threadId: string): Promise<void> {
    const key = this.getAgentThreadSubscriptionKey(agent, threadId);
    if (this.agentThreadSubscriptionKey === key && this.agentThreadSubscription) return;

    this.cleanupAgentThreadSubscription();
    const subscription = await agent.subscribeToThread({ resourceId: this.resourceId, threadId });
    this.agentThreadSubscription = subscription;
    this.agentThreadSubscriptionKey = key;
    void this.processSubscribedThreadStream(subscription);
  }

  private async ensureCurrentAgentThreadSubscription(): Promise<void> {
    if (!this.currentThreadId) return;
    await this.ensureAgentThreadSubscription(this.getCurrentAgent(), this.currentThreadId);
  }

  private createMessageInput({
    content,
    files,
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
  }): AgentSignalContents {
    if (!files?.length) return content;

    const fileParts = files.map(f => {
      const isText = f.mediaType.startsWith('text/') || f.mediaType === 'application/json';
      if (isText) {
        let textContent = f.data;
        const base64Match = f.data.match(/^data:[^;]*;base64,(.*)$/);
        if (base64Match) {
          try {
            textContent = Buffer.from(base64Match[1]!, 'base64').toString('utf-8');
          } catch {
            // Fall through with raw data
          }
        }
        const label = f.filename ? `[File: ${f.filename}]` : '[Attached file]';
        const maxBacktickRun = Math.max(0, ...Array.from(textContent.matchAll(/`+/g), match => match[0].length));
        const fence = '`'.repeat(Math.max(3, maxBacktickRun + 1));
        return { type: 'text' as const, text: `${label}\n${fence}\n${textContent}\n${fence}` };
      }
      return {
        type: 'file' as const,
        data: f.data,
        mediaType: f.mediaType,
        ...(f.filename ? { filename: f.filename } : {}),
      };
    });

    return [{ type: 'text', text: content }, ...fileParts];
  }

  private async buildAgentMessageStreamOptions({
    requestContext: requestContextInput,
    tracingContext,
    tracingOptions,
  }: {
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<Record<string, unknown>> {
    if (!this.currentThreadId) {
      throw new Error('Cannot build stream options without a current thread');
    }

    this.abortRequested = false;
    this.abortController ??= new AbortController();
    const requestContext = await this.buildRequestContext(requestContextInput);
    const isYolo = (this.state as Record<string, unknown>).yolo === true;
    const streamOptions: Record<string, unknown> = {
      memory: { thread: this.currentThreadId, resource: this.resourceId },
      abortSignal: this.abortController.signal,
      requestContext,
      maxSteps: 1000,
      savePerStep: false,
      requireToolApproval: !isYolo,
      modelSettings: { temperature: 1 },
      ...(tracingContext && { tracingContext }),
      ...(tracingOptions && { tracingOptions }),
    };
    streamOptions.toolsets = await this.buildToolsets(requestContext);

    // Auto-enable Anthropic server-side fallbacks for fable-5 so a classifier
    // block is transparently retried on the fallback model instead of failing.
    const fableFallback = buildFableFallbackProviderOptions(this.getCurrentModelId());
    if (fableFallback) {
      const existing = streamOptions.providerOptions as Record<string, unknown> | undefined;
      const existingAnthropic = (existing?.anthropic as Record<string, unknown> | undefined) ?? {};
      streamOptions.providerOptions = {
        ...existing,
        anthropic: { ...existingAnthropic, ...fableFallback.anthropic },
      };
    }

    return streamOptions;
  }

  private async drainFollowUpQueue(options?: {
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<boolean> {
    if (this.followUpQueue.length === 0) return false;

    const next = this.followUpQueue.shift()!;
    try {
      if (this.agentThreadSubscription && this.currentThreadId) {
        const agent = this.getCurrentAgent();
        const streamOptions = await this.buildAgentMessageStreamOptions({
          requestContext: next.requestContext,
          tracingContext: options?.tracingContext,
          tracingOptions: options?.tracingOptions,
        });
        const result = agent.queueMessage(this.createMessageInput({ content: next.content }), {
          resourceId: this.resourceId,
          threadId: this.currentThreadId,
          ifIdle: { streamOptions: streamOptions as any },
        });
        this.emit({ type: 'follow_up_queued', count: this.followUpQueue.length, runId: result.runId });
      } else {
        this.emit({ type: 'follow_up_queued', count: this.followUpQueue.length });
        await this.sendMessage({
          content: next.content,
          requestContext: next.requestContext,
          tracingContext: options?.tracingContext,
          tracingOptions: options?.tracingOptions,
        });
      }
      return true;
    } catch (error) {
      this.followUpQueue.unshift(next);
      this.emit({ type: 'follow_up_queued', count: this.followUpQueue.length });
      throw error;
    }
  }

  private isActiveAgentThreadSubscription(subscription: AgentThreadSubscription<any>): boolean {
    return this.agentThreadSubscription === subscription;
  }

  private async finishSubscribedStreamRun({
    suspended,
    error,
    aborted,
  }: {
    suspended?: boolean;
    error?: boolean;
    aborted?: boolean;
  }): Promise<void> {
    const reason = error ? 'error' : suspended ? 'suspended' : aborted || this.abortRequested ? 'aborted' : 'complete';
    this.emit({ type: 'agent_end', reason });
    this.currentRunId = null;
    this.currentTraceId = null;
    this.abortController = null;
    this.abortRequested = false;
    await this.drainFollowUpQueue();
  }

  private async handleSubscribedStreamError(error: unknown): Promise<void> {
    if (error instanceof Error && error.name === 'AbortError') {
      this.emit({ type: 'agent_end', reason: 'aborted' });
    } else {
      this.emit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      this.emit({ type: 'agent_end', reason: 'error' });
    }
    this.agentThreadSubscription?.unsubscribe();
    this.agentThreadSubscription = null;
    this.agentThreadSubscriptionKey = null;
    this.currentRunId = null;
    this.currentTraceId = null;
    this.abortController = null;
    this.abortRequested = false;
    await this.drainFollowUpQueue();
  }

  private async processSubscribedThreadStream(subscription: AgentThreadSubscription<any>): Promise<void> {
    const requestContext = await this.buildRequestContext();
    let currentRun: HarnessStreamState | undefined;
    let lastFinishedRunId: string | null = null;

    try {
      for await (const chunk of subscription.stream) {
        if (!this.isActiveAgentThreadSubscription(subscription)) {
          subscription.unsubscribe();
          break;
        }

        const chunkRunId = 'runId' in chunk ? chunk.runId : null;
        if (lastFinishedRunId && chunkRunId === lastFinishedRunId) {
          continue;
        }

        if (!currentRun) {
          currentRun = this.createStreamState();
          this.currentOperationId += 1;
          this.abortController ??= new AbortController();
          this.currentRunId = subscription.activeRunId() ?? ('runId' in chunk ? chunk.runId : null);
          this.currentTraceId = null;
          this.emit({ type: 'agent_start' });
        }

        if (chunk.type === 'start') {
          continue;
        }

        try {
          const streamResult = await this.processStreamChunk(currentRun, chunk, requestContext);
          if (
            streamResult ||
            chunk.type === 'finish' ||
            chunk.type === 'error' ||
            chunk.type === 'abort' ||
            chunk.type === 'tool-call-suspended'
          ) {
            const finishedRunId: string | null = chunkRunId ?? this.currentRunId;
            const suspended =
              chunk.type === 'tool-call-suspended' ||
              (streamResult ?? this.finishStreamState(currentRun)).suspended ||
              undefined;
            const aborted = chunk.type === 'abort';
            // A non-success terminal finish reason (e.g. a `claude-fable-5`
            // content-filter refusal) is surfaced as an explicit error so the
            // run never silently stops without a visible terminal state.
            let isError = chunk.type === 'error';
            if (currentRun.terminalError && !isError && !aborted && !this.abortRequested && !suspended) {
              isError = true;
              this.emit({ type: 'error', error: new Error(currentRun.terminalError) });
            }
            await this.finishSubscribedStreamRun({
              suspended,
              error: isError,
              aborted,
            });
            lastFinishedRunId = finishedRunId;
            currentRun = undefined;
          }
        } catch (error) {
          await this.handleSubscribedStreamError(error);
          currentRun = undefined;
        }
      }
    } catch (error) {
      if (this.isActiveAgentThreadSubscription(subscription)) {
        await this.handleSubscribedStreamError(error);
      }
    }
  }

  /**
   * Send a signal to the current agent/thread.
   */
  sendSignal(
    input:
      | AgentSignalInput
      | {
          content: AgentSignalContents;
          ifActive?: { attributes?: AgentSignalAttributes };
          ifIdle?: { attributes?: AgentSignalAttributes };
          tracingContext?: TracingContext;
          tracingOptions?: TracingOptions;
          requestContext?: RequestContext;
        },
  ): { id: string; type: AgentSignalInput['type']; accepted: Promise<{ accepted: true; runId: string }> } {
    const { tracingContext, tracingOptions, requestContext: requestContextInput } = 'content' in input ? input : {};
    const ifActive = 'content' in input ? input.ifActive : undefined;
    const ifIdle = 'content' in input ? input.ifIdle : undefined;
    const signal = createSignal(
      'content' in input ? { type: 'user', tagName: 'user', contents: input.content } : input,
    );
    const accepted = Promise.resolve().then(async () => {
      if (!this.currentThreadId) {
        const thread = await this.createThread();
        this.currentThreadId = thread.id;
      }

      const agent = this.getCurrentAgent();
      await this.ensureAgentThreadSubscription(agent, this.currentThreadId);

      if (this.currentRunId && this.agentThreadSubscription?.activeRunId()) {
        const result = agent.sendSignal(signal, {
          resourceId: this.resourceId,
          threadId: this.currentThreadId,
          ifActive,
          ifIdle,
        });
        return { accepted: result.accepted, runId: result.runId };
      }

      const streamOptions = await this.buildAgentMessageStreamOptions({
        requestContext: requestContextInput,
        tracingContext,
        tracingOptions,
      });

      const result = agent.sendSignal(signal, {
        resourceId: this.resourceId,
        threadId: this.currentThreadId,
        ifActive,
        ifIdle: { ...ifIdle, streamOptions: streamOptions as any },
      });
      return { accepted: result.accepted, runId: result.runId };
    });

    return { id: signal.id, type: signal.type, accepted };
  }

  /**
   * Send a notification signal to the current agent/thread.
   */
  async sendNotificationSignal(
    input: SendNotificationSignalInput,
    options: HarnessSendNotificationSignalOptions = {},
  ): Promise<SendAgentNotificationSignalResult> {
    const { ifActive, ifIdle, requestContext: requestContextInput, tracingContext, tracingOptions } = options;
    if (!this.currentThreadId) {
      const thread = await this.createThread();
      this.currentThreadId = thread.id;
    }

    const agent = this.getCurrentAgent();
    await this.ensureAgentThreadSubscription(agent, this.currentThreadId);

    if (this.currentRunId && this.agentThreadSubscription?.activeRunId()) {
      return agent.sendNotificationSignal(input, {
        resourceId: this.resourceId,
        threadId: this.currentThreadId,
        ifActive,
        ifIdle,
      });
    }

    const streamOptions = await this.buildAgentMessageStreamOptions({
      requestContext: requestContextInput,
      tracingContext,
      tracingOptions,
    });

    return agent.sendNotificationSignal(input, {
      resourceId: this.resourceId,
      threadId: this.currentThreadId,
      ifActive,
      ifIdle: { ...ifIdle, streamOptions: streamOptions as any },
    });
  }

  /**
   * Send a message to the current agent.
   * Streams the response and emits events.
   */
  async sendMessage({
    content,
    files,
    tracingContext,
    tracingOptions,
    requestContext: requestContextInput,
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    requestContext?: RequestContext;
  }): Promise<void> {
    const messageInput = this.createMessageInput({ content, files });

    const wasActive = this.isCurrentThreadStreamActive();
    let emittedAgentEnd = false;
    const unsubscribeAgentEnd = wasActive
      ? undefined
      : this.subscribe(event => {
          if (event.type === 'agent_end') emittedAgentEnd = true;
        });
    const signal = this.sendSignal({
      content: messageInput,
      tracingContext,
      tracingOptions,
      requestContext: requestContextInput,
    });
    await signal.accepted;
    if (!wasActive) {
      await new Promise(resolve => setTimeout(resolve, 0));
      await this.waitForCurrentThreadStreamIdle();
      unsubscribeAgentEnd?.();
      if (!emittedAgentEnd && this.pendingSuspensions.size === 0) {
        this.emit({ type: 'agent_end', reason: 'complete' });
      }
    }
    return;
  }

  async listMessages(options?: { limit?: number }): Promise<HarnessMessage[]> {
    if (!this.currentThreadId) return [];
    return this.listMessagesForThread({ threadId: this.currentThreadId, limit: options?.limit });
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
    if (!this.currentThreadId || !this.config.storage) return null;

    const memoryStorage = await this.getMemoryStorage();
    const dbMessage = {
      id: randomUUID(),
      role,
      threadId: this.currentThreadId,
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

    const result = await memoryStorage.saveMessages({ messages: [dbMessage] });
    const saved = result.messages[0] ?? dbMessage;
    return this.convertToHarnessMessage(saved);
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
    const messages = await this.getFirstUserMessagesForThreads({ threadIds: [threadId] });
    return messages.get(threadId) ?? null;
  }

  async getFirstUserMessagesForThreads({ threadIds }: { threadIds: string[] }): Promise<Map<string, HarnessMessage>> {
    if (!this.config.storage || threadIds.length === 0) return new Map();

    const memoryStorage = await this.getMemoryStorage();
    const result = await memoryStorage.listMessages({
      threadId: threadIds,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    const firstUserMessages = new Map<string, HarnessMessage>();
    for (const message of result.messages) {
      if (message.role !== 'user' || !message.threadId || firstUserMessages.has(message.threadId)) continue;
      firstUserMessages.set(message.threadId, this.convertToHarnessMessage(message));

      if (firstUserMessages.size === threadIds.length) {
        break;
      }
    }

    return firstUserMessages;
  }

  private convertToHarnessMessage(msg: {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'signal';
    createdAt: Date;
    content: {
      content?: string;
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
      metadata?: Record<string, unknown>;
    };
  }): HarnessMessage {
    const content: HarnessMessageContent[] = [];
    const systemReminder = getRecordValue(msg.content.metadata?.systemReminder);

    if (systemReminder && typeof systemReminder.type === 'string') {
      const reminder = toSystemReminderContent({
        ...systemReminder,
        contents: typeof systemReminder.message === 'string' ? systemReminder.message : '',
        reminderType: systemReminder.type,
      });
      if (reminder) {
        content.push(reminder);
      }

      return {
        id: msg.id,
        role: msg.role === 'signal' ? 'user' : msg.role,
        content,
        createdAt: msg.createdAt,
      };
    }

    if (msg.role === 'signal') {
      const signal = mastraDBMessageToSignal(msg as MastraDBMessage);

      if (signal.type === 'user') {
        const signalContent = signalContentsToHarnessContent(signal.contents);
        if (signalContent.length > 0) {
          return {
            id: msg.id,
            role: 'user',
            content: signalContent,
            createdAt: msg.createdAt,
            attributes: signal.attributes,
          };
        }
      }

      if (signal.type === 'state') {
        const stateSignal = toStateSignalContent({
          id: signal.id,
          type: signal.type,
          tagName: signal.tagName,
          contents: signal.contents,
          metadata: signal.metadata,
        });
        if (stateSignal) {
          content.push(stateSignal);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'reactive' && signal.tagName === 'system-reminder') {
        const reminder = toSystemReminderContent({
          type: signal.type,
          contents: signalContentsToText(signal.contents),
          attributes: signal.attributes ?? msg.content.metadata,
          metadata: signal.metadata,
        });
        if (reminder) {
          content.push(reminder);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'notification' && signal.tagName === 'notification-summary') {
        const notificationSummary = toNotificationSummaryContent({
          id: signal.id,
          contents: signal.contents,
          attributes: signal.attributes,
          metadata: signal.metadata,
        });
        if (notificationSummary) {
          content.push(notificationSummary);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'notification' && signal.tagName === 'notification') {
        const notification = toNotificationContent({
          id: signal.id,
          contents: signal.contents,
          attributes: signal.attributes,
          metadata: signal.metadata,
        });
        if (notification) {
          content.push(notification);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }

      if (signal.type === 'reactive') {
        const reactiveSignal = toReactiveSignalContent({
          id: signal.id,
          type: signal.type,
          tagName: signal.tagName,
          contents: signal.contents,
          attributes: signal.attributes,
          metadata: signal.metadata,
        });
        if (reactiveSignal) {
          content.push(reactiveSignal);
        }

        return {
          id: msg.id,
          role: 'user',
          content,
          createdAt: msg.createdAt,
        };
      }
    }

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
              const partProviderMetadata = part.providerMetadata as Record<string, unknown> | undefined;
              content.push({
                type: 'tool_result',
                id: inv.toolCallId,
                name: inv.toolName,
                result: inv.result,
                isError: inv.isError ?? false,
                ...(partProviderMetadata ? { providerMetadata: partProviderMetadata } : {}),
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
            const resultProviderMetadata = part.providerMetadata as Record<string, unknown> | undefined;
            content.push({
              type: 'tool_result',
              id: part.toolCallId,
              name: part.toolName,
              result: part.result,
              isError: part.isError ?? false,
              ...(resultProviderMetadata ? { providerMetadata: resultProviderMetadata } : {}),
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
        case 'data-signal': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          if (data.type === 'state') {
            const stateSignal = toStateSignalContent(data);
            if (stateSignal) content.push(stateSignal);
          } else if (data.type === 'reactive' && data.tagName === 'system-reminder') {
            const reminder = toSystemReminderContent(data);
            if (reminder) content.push(reminder);
          } else if (data.type === 'notification' && data.tagName === 'notification-summary') {
            const notificationSummary = toNotificationSummaryContent(data);
            if (notificationSummary) content.push(notificationSummary);
          } else if (data.type === 'notification' && data.tagName === 'notification') {
            const notification = toNotificationContent(data);
            if (notification) content.push(notification);
          } else if (data.type === 'reactive') {
            const reactiveSignal = toReactiveSignalContent(data);
            if (reactiveSignal) content.push(reactiveSignal);
          }
          break;
        }
        case 'data-user-message': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          const message = toUserSignalMessage(data);
          if (message) {
            content.push(...message.content);
          }
          break;
        }
        // Back-compat: persisted streams may still contain data-system-reminder parts
        case 'data-system-reminder': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          const reminder = toSystemReminderContent(data);
          if (reminder) {
            content.push(reminder);
          }
          break;
        }
        case 'file':
          if (typeof part.data !== 'string') {
            console.warn('[Harness] Skipping file part with non-string data:', typeof part.data);
            break;
          }
          content.push({
            type: 'file',
            data: part.data,
            mediaType:
              (part as { mediaType?: string }).mediaType ??
              (part as { mimeType?: string }).mimeType ??
              'application/octet-stream',
            ...((part as { filename?: string }).filename ? { filename: (part as { filename?: string }).filename } : {}),
          });
          break;
        case 'image': {
          const imgData =
            typeof part.data === 'string'
              ? part.data
              : typeof (part as { image?: string }).image === 'string'
                ? (part as { image?: string }).image!
                : '';
          content.push({
            type: 'image',
            data: imgData,
            mimeType:
              (part as { mimeType?: string }).mimeType ?? (part as { mediaType?: string }).mediaType ?? 'image/png',
          });
          break;
        }
        case 'data-om-thread-update': {
          const data = (part as { data?: Record<string, unknown> }).data ?? {};
          if (data.newTitle) {
            content.push({
              type: 'om_thread_title_updated',
              threadId: (data.threadId as string) ?? '',
              oldTitle: (data.oldTitle as string) ?? undefined,
              newTitle: data.newTitle as string,
            });
          }
          break;
        }
        // Skip other part types (step-start, data-om-status, etc.)
      }
    }

    return { id: msg.id, role: msg.role === 'signal' ? 'user' : msg.role, content, createdAt: msg.createdAt };
  }

  /**
   * Process a stream response (shared between sendMessage and tool approval).
   */
  private createStreamState(): HarnessStreamState {
    return {
      currentMessage: {
        id: this.generateId(),
        role: 'assistant',
        content: [],
        createdAt: new Date(),
      },
      isSuspended: false,
      textContentById: new Map<string, { index: number; text: string }>(),
      thinkingContentById: new Map<string, { index: number; text: string }>(),
    };
  }

  private abortForOmFailure({ operationType, stage, error }: { operationType: string; stage: string; error: string }) {
    this.emit({
      type: 'error',
      error: new Error(`Observational memory ${operationType} ${stage} failed: ${error}`),
    });
    this.abort();
  }

  private async processStream(
    response: { fullStream: AsyncIterable<any> },
    requestContextInput?: RequestContext,
  ): Promise<{ message: HarnessMessage; suspended?: boolean } | undefined> {
    const state = this.createStreamState();
    const requestContext = await this.buildRequestContext(requestContextInput);
    this.currentOperationId += 1;
    this.emit({ type: 'agent_start' });

    let result: { message: HarnessMessage; suspended?: boolean } | undefined;
    let error = false;
    let aborted = false;

    for await (const chunk of response.fullStream) {
      result = await this.processStreamChunk(state, chunk, requestContext);
      if (chunk.type === 'error') {
        error = true;
      }
      if (chunk.type === 'abort') {
        aborted = true;
      }
      if (
        result ||
        chunk.type === 'finish' ||
        chunk.type === 'error' ||
        chunk.type === 'abort' ||
        chunk.type === 'tool-call-suspended' ||
        this.abortRequested
      ) {
        result ??= this.finishStreamState(state);
        break;
      }
    }

    result ??= this.finishStreamState(state);

    // A non-success terminal finish reason (e.g. a `claude-fable-5`
    // content-filter refusal) is surfaced as an explicit error so the run never
    // silently stops without a visible terminal state.
    if (state.terminalError && !error && !aborted && !this.abortRequested && !result.suspended) {
      error = true;
      this.emit({ type: 'error', error: new Error(state.terminalError) });
    }

    this.emit({
      type: 'agent_end',
      reason: error
        ? 'error'
        : result.suspended
          ? 'suspended'
          : aborted || this.abortRequested
            ? 'aborted'
            : 'complete',
    });

    this.currentRunId = null;
    this.currentTraceId = null;
    this.abortController = null;
    this.abortRequested = false;
    await this.drainFollowUpQueue();

    return result;
  }

  private async processStreamChunk(
    state: HarnessStreamState,
    chunk: any,
    requestContext: RequestContext,
  ): Promise<{ message: HarnessMessage; suspended?: boolean } | undefined> {
    if ('runId' in chunk && chunk.runId) {
      this.currentRunId = chunk.runId;
    }

    switch (chunk.type) {
      case 'text-start': {
        const textIndex = state.currentMessage.content.length;
        state.currentMessage.content.push({ type: 'text', text: '' });
        state.textContentById.set(chunk.payload.id, { index: textIndex, text: '' });
        this.emit({ type: 'message_start', message: { ...state.currentMessage } });
        break;
      }

      case 'text-delta': {
        const textState = state.textContentById.get(chunk.payload.id);
        if (textState) {
          textState.text += chunk.payload.text;
          const textContent = state.currentMessage.content[textState.index];
          if (textContent && textContent.type === 'text') {
            textContent.text = textState.text;
          }
          this.emit({ type: 'message_update', message: { ...state.currentMessage } });
        }
        break;
      }

      case 'reasoning-start': {
        const thinkingIndex = state.currentMessage.content.length;
        state.currentMessage.content.push({ type: 'thinking', thinking: '' });
        state.thinkingContentById.set(chunk.payload.id, { index: thinkingIndex, text: '' });
        this.emit({ type: 'message_update', message: { ...state.currentMessage } });
        break;
      }

      case 'reasoning-delta': {
        const thinkingState = state.thinkingContentById.get(chunk.payload.id);
        if (thinkingState) {
          thinkingState.text += chunk.payload.text;
          const thinkingContent = state.currentMessage.content[thinkingState.index];
          if (thinkingContent && thinkingContent.type === 'thinking') {
            thinkingContent.thinking = thinkingState.text;
          }
          this.emit({ type: 'message_update', message: { ...state.currentMessage } });
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
        const transform = getTransformedToolPayload(chunk.metadata, 'display', 'input-delta');
        if (!transform?.suppress) {
          this.emit({
            type: 'tool_input_delta',
            toolCallId,
            argsTextDelta: hasTransformedToolPayload(transform) ? transform.transformed : argsTextDelta,
            toolName,
          });
        }
        break;
      }

      case 'tool-call-input-streaming-end': {
        const { toolCallId } = chunk.payload;
        this.emit({ type: 'tool_input_end', toolCallId });
        break;
      }

      case 'tool-call': {
        const toolCall = chunk.payload;
        const args = getDisplayTransform(chunk.metadata, 'input-available', toolCall.args);
        state.currentMessage.content.push({
          type: 'tool_call',
          id: toolCall.toolCallId,
          name: toolCall.toolName,
          args,
        });
        this.emit({
          type: 'tool_start',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args,
        });
        this.emit({ type: 'message_update', message: { ...state.currentMessage } });
        break;
      }

      case 'tool-result': {
        const toolResult = chunk.payload;
        const providerMetadata = toolResult.providerMetadata as Record<string, unknown> | undefined;
        const result = getDisplayTransform(chunk.metadata, 'output-available', toolResult.result);
        state.currentMessage.content.push({
          type: 'tool_result',
          id: toolResult.toolCallId,
          name: toolResult.toolName,
          result,
          isError: toolResult.isError ?? false,
          ...(providerMetadata ? { providerMetadata } : {}),
        });
        this.emit({
          type: 'tool_end',
          toolCallId: toolResult.toolCallId,
          result,
          isError: toolResult.isError ?? false,
          ...(providerMetadata ? { providerMetadata } : {}),
        });
        this.emit({ type: 'message_update', message: { ...state.currentMessage } });
        break;
      }

      case 'tool-error': {
        const toolError = chunk.payload;
        this.emit({
          type: 'tool_end',
          toolCallId: toolError.toolCallId,
          result: getDisplayTransform(chunk.metadata, 'error', toolError.error),
          isError: true,
        });
        break;
      }

      case 'tool-call-approval': {
        const toolCallId = chunk.payload.toolCallId;
        const toolName = chunk.payload.toolName;
        const approvalTransform = getTransformedToolPayload(chunk.metadata, 'display', 'approval');
        const toolArgs = hasTransformedToolPayload(approvalTransform)
          ? approvalTransform.transformed
          : getDisplayTransform(chunk.metadata, 'input-available', chunk.payload.args);

        const policy = this.resolveToolApproval(toolName);

        if (policy === 'allow') {
          await this.handleToolApprove({ toolCallId, requestContext });
          break;
        }

        if (policy === 'deny') {
          await this.handleToolDecline({ toolCallId, requestContext });
          break;
        }

        this.pendingApprovalToolName = toolName;
        this.emit({ type: 'tool_approval_required', toolCallId, toolName, args: toolArgs });

        const approval = await new Promise<{ decision: 'approve' | 'decline'; requestContext?: RequestContext }>(
          resolve => {
            this.pendingApprovalResolve = resolve;
          },
        );
        this.pendingApprovalToolName = null;

        if (approval.decision === 'approve') {
          await this.handleToolApprove({ toolCallId, requestContext: approval.requestContext ?? requestContext });
        } else {
          await this.handleToolDecline({ toolCallId, requestContext: approval.requestContext ?? requestContext });
        }
        break;
      }

      case 'tool-call-suspended': {
        const suspToolCallId = chunk.payload.toolCallId;
        const suspToolName = chunk.payload.toolName;
        const suspArgs = getDisplayTransform(chunk.metadata, 'input-available', chunk.payload.args);
        const suspPayload = getDisplayTransform(chunk.metadata, 'suspend', chunk.payload.suspendPayload);
        const suspResumeSchema = chunk.payload.resumeSchema;

        if (this.currentRunId) {
          this.pendingSuspensions.set(suspToolCallId, { runId: this.currentRunId, toolName: suspToolName });
        }
        state.isSuspended = true;

        this.emit({
          type: 'tool_suspended',
          toolCallId: suspToolCallId,
          toolName: suspToolName,
          args: suspArgs,
          suspendPayload: suspPayload,
          resumeSchema: suspResumeSchema,
        });

        break;
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
          const usageRecord = usage as Record<string, unknown>;
          const promptTokens =
            getUsageNumber(usageRecord, 'promptTokens') ?? getUsageNumber(usageRecord, 'inputTokens') ?? 0;
          const completionTokens =
            getUsageNumber(usageRecord, 'completionTokens') ?? getUsageNumber(usageRecord, 'outputTokens') ?? 0;
          const totalTokens = getUsageNumber(usageRecord, 'totalTokens') ?? promptTokens + completionTokens;
          const stepUsage: TokenUsage = {
            promptTokens,
            completionTokens,
            totalTokens,
          };
          addOptionalUsageField(stepUsage, 'reasoningTokens', getUsageNumber(usageRecord, 'reasoningTokens'));
          addOptionalUsageField(stepUsage, 'cachedInputTokens', getUsageNumber(usageRecord, 'cachedInputTokens'));
          addOptionalUsageField(
            stepUsage,
            'cacheCreationInputTokens',
            getUsageNumber(usageRecord, 'cacheCreationInputTokens'),
          );
          if (usageRecord.raw !== undefined) {
            stepUsage.raw = usageRecord.raw;
          }

          this.tokenUsage.promptTokens += promptTokens;
          this.tokenUsage.completionTokens += completionTokens;
          this.tokenUsage.totalTokens += totalTokens;
          addOptionalUsageField(this.tokenUsage, 'reasoningTokens', stepUsage.reasoningTokens);
          addOptionalUsageField(this.tokenUsage, 'cachedInputTokens', stepUsage.cachedInputTokens);
          addOptionalUsageField(this.tokenUsage, 'cacheCreationInputTokens', stepUsage.cacheCreationInputTokens);
          if (stepUsage.raw !== undefined) {
            this.tokenUsage.raw = stepUsage.raw;
          }

          this.persistTokenUsage().catch(() => {});
          this.emit({ type: 'usage_update', usage: stepUsage });
        }
        break;
      }

      case 'finish': {
        const finishReason = chunk.payload.stepResult?.reason;
        const finishProviderMetadata = chunk.payload?.metadata?.providerMetadata ?? chunk.payload?.providerMetadata;
        // A server-side fallback means the turn was answered by a different
        // model than the one the user selected (e.g. fable-5 declined and the
        // fallback served the response). Surface that, otherwise the
        // substitution is invisible.
        const fallbackNotice = describeServerSideFallback(finishProviderMetadata);
        if (fallbackNotice) {
          this.emit({ type: 'info', message: fallbackNotice });
        }
        if (finishReason === 'stop' || finishReason === 'end-turn') {
          state.currentMessage.stopReason = 'complete';
        } else if (finishReason === 'tool-calls') {
          state.currentMessage.stopReason = 'tool_use';
        } else {
          // Non-success terminal reasons (e.g. `content-filter` from a
          // `claude-fable-5` refusal, `error`, or `length`) must surface as an
          // explicit terminal error rather than a silent `complete`. Otherwise
          // the run ends with no final message and no error, leaving the user
          // unable to tell whether it completed, failed, or is still active.
          const errorMessage = describeNonSuccessFinishReason(finishReason, finishProviderMetadata);
          if (errorMessage) {
            state.currentMessage.stopReason = 'error';
            state.currentMessage.errorMessage = errorMessage;
            state.terminalError = errorMessage;
          } else {
            state.currentMessage.stopReason = 'complete';
          }
        }
        break;
      }

      case 'goal': {
        // In-loop goal evaluation. Forward the payload so consumers (the TUI's
        // judge display) can render judge progress and the decision.
        this.emit({ type: 'goal_evaluation', payload: chunk.payload });
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
          const operationType = payload.operationType === 'reflection' ? 'reflection' : 'observation';
          const error = payload.error ?? 'Unknown error';

          if (operationType === 'reflection') {
            this.emit({
              type: 'om_reflection_failed',
              cycleId: payload.cycleId ?? 'unknown',
              error,
              durationMs: payload.durationMs ?? 0,
            });
          } else {
            this.emit({
              type: 'om_observation_failed',
              cycleId: payload.cycleId ?? 'unknown',
              error,
              durationMs: payload.durationMs ?? 0,
            });
          }

          this.abortForOmFailure({ operationType, stage: 'run', error });
          return { message: state.currentMessage };
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
        if (payload) {
          const operationType = payload.operationType ?? 'observation';
          const error = payload.error ?? 'Unknown error';

          this.emit({
            type: 'om_buffering_failed',
            cycleId: payload.cycleId,
            operationType,
            error,
          });

          this.abortForOmFailure({ operationType, stage: 'buffering', error });
          return { message: state.currentMessage };
        }
        break;
      }
      case 'data-signal': {
        const payload = (chunk as any).data as Record<string, unknown> | undefined;
        if (payload?.type === 'state') {
          const stateSignal = toStateSignalContent(payload);
          if (stateSignal) {
            state.currentMessage.content.push(stateSignal);
            this.emit({ type: 'message_update', message: state.currentMessage });
          }
        } else if (payload?.type === 'reactive' && payload.tagName === 'system-reminder') {
          const reminder = toSystemReminderContent(payload);
          if (reminder) {
            state.currentMessage.content.push(reminder);
            this.emit({ type: 'message_update', message: state.currentMessage });
          }
        } else if (payload?.type === 'notification' && payload.tagName === 'notification-summary') {
          const notificationSummary = toNotificationSummaryContent(payload);
          if (notificationSummary) {
            state.currentMessage.content.push(notificationSummary);
            this.emit({ type: 'message_update', message: state.currentMessage });
          }
        } else if (payload?.type === 'notification' && payload.tagName === 'notification') {
          const notification = toNotificationContent(payload);
          if (notification) {
            state.currentMessage.content.push(notification);
            this.emit({ type: 'message_update', message: state.currentMessage });
          }
        } else if (payload?.type === 'reactive') {
          const reactiveSignal = toReactiveSignalContent(payload);
          if (reactiveSignal) {
            state.currentMessage.content.push(reactiveSignal);
            this.emit({ type: 'message_update', message: state.currentMessage });
          }
        }
        break;
      }
      case 'data-user-message': {
        const payload = (chunk as any).data as Record<string, unknown> | undefined;
        const message = payload ? toUserSignalMessage(payload) : undefined;
        if (message) {
          if (state.currentMessage.content.length > 0) {
            state.currentMessage.stopReason ??= 'complete';
            this.emit({ type: 'message_end', message: { ...state.currentMessage } });
            state.currentMessage = {
              id: this.generateId(),
              role: 'assistant',
              content: [],
              createdAt: new Date(),
            };
            state.textContentById.clear();
            state.thinkingContentById.clear();
          }
          this.emit({ type: 'message_start', message });
          this.emit({ type: 'message_end', message });
        }
        break;
      }
      // Back-compat: persisted streams may still contain data-system-reminder parts
      case 'data-system-reminder': {
        const payload = (chunk as any).data as Record<string, unknown> | undefined;
        const reminder = payload ? toSystemReminderContent(payload) : undefined;
        if (reminder) {
          state.currentMessage.content.push(reminder);
          this.emit({ type: 'message_update', message: state.currentMessage });
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
            triggeredBy: payload.triggeredBy,
            lastActivityAt: payload.lastActivityAt,
            ttlExpiredMs: payload.ttlExpiredMs,
            activateAfterIdle:
              typeof payload.config?.activateAfterIdle === 'number' ? payload.config.activateAfterIdle : undefined,
            previousModel: payload.previousModel,
            currentModel: payload.currentModel,
          });
        }
        break;
      }
      case 'data-om-thread-update': {
        const payload = (chunk as any).data as Record<string, any> | undefined;
        if (payload && payload.newTitle) {
          this.emit({
            type: 'om_thread_title_updated',
            cycleId: payload.cycleId ?? 'unknown',
            threadId: payload.threadId ?? this.currentThreadId ?? 'unknown',
            oldTitle: payload.oldTitle,
            newTitle: payload.newTitle,
          });
        }
        break;
      }

      // Sandbox streaming data chunks (from workspace execute_command tool)
      case 'data-sandbox-stdout': {
        const d = (chunk as any).data as Record<string, any> | undefined;
        if (d?.output && d?.toolCallId) {
          this.emit({ type: 'shell_output', toolCallId: d.toolCallId, output: d.output, stream: 'stdout' });
        }
        break;
      }
      case 'data-sandbox-stderr': {
        const d = (chunk as any).data as Record<string, any> | undefined;
        if (d?.output && d?.toolCallId) {
          this.emit({ type: 'shell_output', toolCallId: d.toolCallId, output: d.output, stream: 'stderr' });
        }
        break;
      }

      default:
        break;
    }
  }

  private finishStreamState(state: HarnessStreamState): { message: HarnessMessage; suspended?: boolean } {
    this.emit({ type: 'message_end', message: state.currentMessage });
    return { message: state.currentMessage, suspended: state.isSuspended || undefined };
  }

  // ===========================================================================
  // Control
  // ===========================================================================

  /**
   * Abort the current operation.
   */
  abort(): void {
    this.abortRequested = true;
    // Drop any tool suspensions parked awaiting a resume. A run sitting in a
    // tool suspend() (e.g. ask_user / request_access) is not actively streaming,
    // so aborting the AbortController alone leaves it orphaned. Clearing the map
    // ensures the harness no longer considers itself awaiting resumes after an
    // abort, and that a later respondToToolSuspension is a safe no-op.
    this.pendingSuspensions.clear();
    this.displayState.pendingSuspensions.clear();
    try {
      this.agentThreadSubscription?.abort();
    } catch {}
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }
  }

  /**
   * Detach from the current thread's event stream without switching to another
   * thread. Used by the TUI `/new` command to stop receiving cross-process
   * events from the old thread while the new thread creation is deferred until
   * the first user message.
   *
   * The current thread ID is preserved so that {@link createThread} can still
   * release the thread lock (when configured) for the previous thread.
   */
  detachFromCurrentThread(): void {
    this.abort();
    this.cleanupAgentThreadSubscription();
  }

  /**
   * Steer the agent mid-stream: aborts current run and sends a new message.
   */
  async steer({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    this.abort();
    this.followUpQueue = [];
    this.emit({ type: 'follow_up_queued', count: 0 });
    await this.sendMessage({ content, requestContext });
  }

  /**
   * Queue a follow-up message to be processed after the current operation completes.
   */
  async followUp({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    if (this.isRunning()) {
      this.followUpQueue.push({ content, requestContext });
      this.emit({ type: 'follow_up_queued', count: this.followUpQueue.length });
    } else {
      await this.sendMessage({ content, requestContext });
    }
  }

  getFollowUpCount(): number {
    return this.followUpQueue.length;
  }

  isRunning(): boolean {
    return this.abortController !== null;
  }

  /**
   * True when one or more tools are parked awaiting a resume (e.g. ask_user /
   * request_access suspensions). A suspended run nulls the AbortController, so
   * isRunning() returns false even though the run is still pending — callers that
   * need to know whether the harness is awaiting user input (e.g. to allow abort)
   * should check this too.
   */
  hasPendingSuspensions(): boolean {
    return this.pendingSuspensions.size > 0;
  }

  getCurrentRunId(): string | null {
    return this.agentThreadSubscription?.activeRunId() ?? this.currentRunId;
  }

  isCurrentThreadStreamActive(): boolean {
    return (
      this.agentThreadSubscription?.activeRunId() !== null && this.agentThreadSubscription?.activeRunId() !== undefined
    );
  }

  /**
   * Resolve once the current thread's stream is fully idle.
   *
   * After `abort()` is called the run's status can still be `'running'` for a
   * few microtasks while the underlying model stream finalizes. Callers that
   * need to send a fresh signal after an abort (e.g. plan approval → mode
   * switch → trigger reminder) should await this before calling `sendSignal`
   * to avoid the new signal being queued onto the dying run, which would then
   * be drained with the previous run's already-aborted abortSignal.
   */
  private async waitForCurrentThreadStreamIdle(): Promise<void> {
    while (this.isCurrentThreadStreamActive() || this.currentRunId !== null) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  getCurrentTraceId(): string | null {
    return this.currentTraceId;
  }

  private getSubagentDisplayName(agentType: string): string | undefined {
    return this.config.subagents?.find(subagent => subagent.id === agentType)?.name;
  }

  // ===========================================================================
  // Display State
  // ===========================================================================

  /**
   * Returns a read-only snapshot of the canonical display state.
   * UIs should use this to render instead of building up state from raw events.
   */
  getDisplayState(): Readonly<HarnessDisplayState> {
    return this.displayState;
  }

  /**
   * Restore task display state after a UI replays persisted task tool history.
   * This updates the Harness-owned display snapshot without emitting a live
   * `task_updated` event, since no task tool just ran.
   */
  restoreDisplayTasks(tasks: TaskItemSnapshot[]): void {
    this.displayState.previousTasks = [...this.displayState.tasks];
    this.displayState.tasks = [...tasks];
    this.dispatchDisplayStateChanged(false);
  }

  /**
   * Reset display state fields that are scoped to a thread.
   * Called on thread switch/creation.
   */
  private resetThreadDisplayState(): void {
    this.displayState.activeTools = new Map();
    this.displayState.toolInputBuffers = new Map();
    this.displayState.pendingApproval = null;
    this.displayState.pendingSuspensions = new Map();
    this.displayState.activeSubagents = new Map();
    this.displayState.currentMessage = null;
    this.followUpQueue = [];
    this.displayState.queuedFollowUps = 0;
    this.displayState.modifiedFiles = new Map();
    this.displayState.tasks = [];
    this.displayState.previousTasks = [];
    this.displayState.omProgress = defaultOMProgressState();
    this.displayState.bufferingMessages = false;
    this.displayState.bufferingObservations = false;
  }

  /**
   * Respond to a pending tool approval from the UI.
   * "always_allow_category" grants the tool's category for the rest of the session, then approves.
   */
  respondToToolApproval({
    decision,
    requestContext,
  }: {
    decision: 'approve' | 'decline' | 'always_allow_category';
    requestContext?: RequestContext;
  }): void {
    if (!this.pendingApprovalResolve) return;

    if (decision === 'always_allow_category') {
      const tn = this.pendingApprovalToolName;
      if (tn) {
        const category = this.getToolCategory({ toolName: tn });
        if (category) {
          this.grantSessionCategory({ category });
        }
      }
      this.pendingApprovalResolve({ decision: 'approve', requestContext });
    } else {
      this.pendingApprovalResolve({ decision, requestContext });
    }
    this.pendingApprovalResolve = null;
  }

  /**
   * Respond to a pending tool suspension from the UI.
   * Provides resume data so the suspended tool can continue execution.
   *
   * `toolCallId` selects which suspended tool to resume — required when more than
   * one tool is suspended concurrently (e.g. parallel `ask_user` calls, see issue
   * #13642). When omitted it resolves to the sole pending suspension.
   */
  async respondToToolSuspension({
    resumeData,
    toolCallId,
    requestContext,
  }: {
    resumeData: any;
    toolCallId?: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    const resolvedToolCallId = this.resolvePendingSuspensionToolCallId(toolCallId);
    if (!resolvedToolCallId) return;

    const suspension = this.pendingSuspensions.get(resolvedToolCallId);

    try {
      // `submit_plan` resumes carry a plan-approval decision. Approval additionally
      // switches the Harness from its planning mode to its default execution mode, so
      // it is handled separately from a plain tool resume. Non-Harness consumers skip
      // this entirely and resume the tool directly via agent.resumeStream.
      if (suspension?.toolName === 'submit_plan') {
        await this.handlePlanApprovalResume({
          toolCallId: resolvedToolCallId,
          response: resumeData as { action: 'approved' | 'rejected'; feedback?: string },
          requestContext,
        });
        return;
      }

      await this.handleToolResume({
        resumeData,
        toolCallId: resolvedToolCallId,
        requestContext,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit({ type: 'error', error: err });
      this.emit({ type: 'agent_end', reason: 'error' });
    }
  }

  /**
   * Resolve which suspended tool call to act on. With an explicit `toolCallId` it
   * must match a pending suspension; without one it returns the single pending
   * suspension (or undefined when there are zero or several).
   */
  private resolvePendingSuspensionToolCallId(toolCallId?: string): string | undefined {
    if (toolCallId) {
      return this.pendingSuspensions.has(toolCallId) ? toolCallId : undefined;
    }
    if (this.pendingSuspensions.size === 1) {
      return this.pendingSuspensions.keys().next().value;
    }
    return undefined;
  }

  // ===========================================================================
  // Plan Approval
  // ===========================================================================

  /**
   * Respond to a suspended `submit_plan` tool call.
   *
   * `submit_plan` is an agent-agnostic tool that pauses via the native tool-suspension
   * primitive. The Harness layers its planning UX on top of that generic pause here:
   *
   * - On **rejection**, the plan-mode run is resumed with the feedback so the agent can
   *   revise and submit again. This is an ordinary tool resume.
   * - On **approval**, the parked plan-mode suspension is abandoned and the Harness
   *   switches to its default (execution) mode. switchMode aborts the plan-mode run, so
   *   there is no point resuming it first; the next signal/message drives the fresh
   *   default-mode run. The model still sees the "approved" tool result on the rebuilt
   *   message history when the default-mode run starts.
   *
   * Non-Harness consumers (a plain Agent in Studio or a customer app) instead resume the
   * tool directly via `agent.resumeStream({ action, feedback })` — no modes involved.
   */
  private async handlePlanApprovalResume({
    toolCallId,
    response,
    requestContext,
  }: {
    toolCallId: string;
    response: { action: 'approved' | 'rejected'; feedback?: string };
    requestContext?: RequestContext;
  }): Promise<void> {
    if (response.action === 'rejected') {
      await this.handleToolResume({ resumeData: response, toolCallId, requestContext });
      return;
    }

    // Approved: drop the parked suspension (its run is about to be aborted by the mode
    // switch) and move to the default execution mode.
    this.pendingSuspensions.delete(toolCallId);

    const currentMode = this.getCurrentMode();
    const transitionModeId =
      currentMode.transitionsTo ??
      this.config.defaultModeId ??
      this.config.modes.find(mode => mode.default || mode.metadata?.default === true)?.id ??
      this.config.modes[0]?.id;

    const transitionMode = this.listModes().find(mode => mode.id === transitionModeId);
    if (transitionMode && transitionMode.id !== this.currentModeId) {
      await new Promise(resolveTimeout => setTimeout(resolveTimeout, 0));
      await this.switchMode({ modeId: transitionMode.id });
      // switchMode aborts the in-flight run but does not wait for it to
      // finalize. If the caller (e.g. mastracode's plan-approval handler)
      // immediately fires a system-reminder signal, that signal can land in
      // the dying run's pending queue and later get drained with the run's
      // already-aborted abortSignal — manifesting as a hang where the agent
      // never resumes after "The user has approved the plan, begin
      // executing.". Waiting for the stream to be fully idle here ensures
      // the next sendSignal() always starts a fresh run.
      await this.waitForCurrentThreadStreamIdle();
    }
  }

  private async handleToolApprove({
    toolCallId,
    requestContext: requestContextInput,
  }: {
    toolCallId?: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    if (!this.currentRunId) {
      throw new Error('No active run to approve tool call for');
    }

    const agent = this.getCurrentAgent();

    if (!this.abortController) {
      this.abortController = new AbortController();
    }

    const requestContext = await this.buildRequestContext(requestContextInput);
    const isYolo = (this.state as Record<string, unknown>).yolo === true;
    await agent.approveToolCall({
      runId: this.currentRunId,
      toolCallId,
      requireToolApproval: !isYolo,
      memory: this.currentThreadId ? { thread: this.currentThreadId, resource: this.resourceId } : undefined,
      abortSignal: this.abortController.signal,
      requestContext,
      toolsets: await this.buildToolsets(requestContext),
    });
  }

  private async handleToolDecline({
    toolCallId,
    requestContext: requestContextInput,
  }: {
    toolCallId?: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    if (!this.currentRunId) {
      throw new Error('No active run to decline tool call for');
    }

    const agent = this.getCurrentAgent();
    if (!this.abortController) {
      this.abortController = new AbortController();
    }

    const requestContext = await this.buildRequestContext(requestContextInput);
    const isYolo = (this.state as Record<string, unknown>).yolo === true;
    await agent.declineToolCall({
      runId: this.currentRunId,
      toolCallId,
      requireToolApproval: !isYolo,
      memory: this.currentThreadId ? { thread: this.currentThreadId, resource: this.resourceId } : undefined,
      abortSignal: this.abortController.signal,
      requestContext,
      toolsets: await this.buildToolsets(requestContext),
    });
  }

  private async handleToolResume({
    resumeData,
    toolCallId,
    requestContext: requestContextInput,
  }: {
    resumeData: any;
    toolCallId: string;
    requestContext?: RequestContext;
  }): Promise<void> {
    const suspension = this.pendingSuspensions.get(toolCallId);
    if (!suspension) {
      throw new Error('No active suspension to resume');
    }

    const agent = this.getCurrentAgent();

    if (!this.abortController) {
      this.abortController = new AbortController();
    }

    // Remove before resuming so a re-suspend during the resumed run can re-register
    // the same toolCallId without being clobbered by this cleanup. Drop the matching
    // display-state entry too so the UI stops rendering only the resolved prompt
    // while any other parked suspensions stay visible.
    this.pendingSuspensions.delete(toolCallId);
    this.displayState.pendingSuspensions.delete(toolCallId);

    const requestContext = await this.buildRequestContext(requestContextInput);
    const isYolo = (this.state as Record<string, unknown>).yolo === true;
    const output = await agent.resumeStream(resumeData, {
      runId: suspension.runId,
      toolCallId,
      requireToolApproval: !isYolo,
      memory: this.currentThreadId ? { thread: this.currentThreadId, resource: this.resourceId } : undefined,
      abortSignal: this.abortController.signal,
      requestContext,
      toolsets: await this.buildToolsets(requestContext),
    });
    await this.processStream(output, requestContext);
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

  /**
   * Subscribe to coalesced display state snapshots.
   *
   * Use this for UI rendering paths that only need the latest display state.
   * Raw event consumers should continue to use `subscribe()`.
   */
  subscribeDisplayState(
    listener: HarnessDisplayStateListener,
    options: HarnessDisplayStateSubscriptionOptions = {},
  ): () => void {
    const scheduler = new DisplayStateScheduler(
      listener,
      options.windowMs ?? DEFAULT_DISPLAY_STATE_SUBSCRIPTION_OPTIONS.windowMs,
      options.maxWaitMs ?? DEFAULT_DISPLAY_STATE_SUBSCRIPTION_OPTIONS.maxWaitMs,
    );
    this.displayStateSchedulers.add(scheduler);

    return () => {
      this.displayStateSchedulers.delete(scheduler);
      scheduler.dispose();
    };
  }

  private emit(event: HarnessEvent): void {
    // Update display state based on the event (before dispatching to listeners)
    this.applyDisplayStateUpdate(event);

    this.dispatchToListeners(event);

    if (event.type !== 'display_state_changed') {
      const isCritical = CRITICAL_DISPLAY_STATE_EVENT_TYPES.has(event.type);
      this.dispatchDisplayStateChanged(isCritical);
    }
  }

  private dispatchDisplayStateChanged(isCritical: boolean): void {
    // After every event, emit display_state_changed so UIs that prefer a single
    // subscribe-and-render pattern can do so. We dispatch directly to listeners
    // (not through emit()) to avoid infinite recursion.
    this.dispatchToListeners({
      type: 'display_state_changed',
      displayState: this.displayState,
    });

    if (this.displayStateSchedulers.size > 0) {
      for (const scheduler of Array.from(this.displayStateSchedulers)) {
        scheduler.notify(this.displayState, isCritical);
      }
    }
  }

  private dispatchToListeners(event: HarnessEvent): void {
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

  /**
   * Apply a display state update based on an incoming event.
   * This is the centralized state machine that keeps HarnessDisplayState in sync
   * with every event the Harness emits.
   */
  private applyDisplayStateUpdate(event: HarnessEvent): void {
    const ds = this.displayState;

    switch (event.type) {
      // ── Agent lifecycle ────────────────────────────────────────────────
      case 'agent_start':
        ds.isRunning = true;
        ds.activeTools = new Map();
        ds.toolInputBuffers = new Map();
        ds.currentMessage = null;
        ds.pendingApproval = null;
        // Parked tool suspensions are intentionally NOT cleared here: resuming
        // one parked tool restarts the run (a fresh agent_start) and the other
        // parallel prompts must stay rendered until they are resolved.
        break;

      case 'agent_end':
        ds.isRunning = false;
        ds.pendingApproval = null;
        // A suspended run keeps its pending tool suspensions alive so the UI can
        // still render the prompts (e.g. `ask_user`, which pauses via the native
        // tool-suspension primitive). When the run ends for any other reason the
        // parked suspensions are abandoned, so clear them all.
        if (event.reason !== 'suspended') {
          ds.pendingSuspensions.clear();
        }
        // Mark any still-running tools as errored (handles abort mid-run)
        for (const [, tool] of ds.activeTools) {
          if (tool.status === 'running' || tool.status === 'streaming_input') {
            tool.status = 'error';
          }
        }
        ds.activeSubagents = new Map();
        break;

      // ── Message streaming ──────────────────────────────────────────────
      case 'message_start':
        ds.currentMessage = event.message;
        break;

      case 'message_update':
        ds.currentMessage = event.message;
        break;

      case 'message_end':
        ds.currentMessage = event.message;
        break;

      // ── Tool lifecycle ─────────────────────────────────────────────────
      case 'tool_input_start': {
        ds.toolInputBuffers.set(event.toolCallId, { text: '', toolName: event.toolName });
        const existing = ds.activeTools.get(event.toolCallId);
        if (existing) {
          existing.status = 'streaming_input';
        } else {
          ds.activeTools.set(event.toolCallId, {
            name: event.toolName,
            args: {},
            status: 'streaming_input',
          });
        }
        break;
      }

      case 'tool_input_delta': {
        const buf = ds.toolInputBuffers.get(event.toolCallId);
        if (buf) {
          buf.text += event.argsTextDelta;
        }
        break;
      }

      case 'tool_input_end':
        ds.toolInputBuffers.delete(event.toolCallId);
        break;

      case 'tool_start': {
        const existingTool = ds.activeTools.get(event.toolCallId);
        if (existingTool) {
          existingTool.name = event.toolName;
          existingTool.args = event.args;
          existingTool.status = 'running';
        } else {
          ds.activeTools.set(event.toolCallId, {
            name: event.toolName,
            args: event.args,
            status: 'running',
          });
        }
        break;
      }

      case 'tool_update': {
        const tool = ds.activeTools.get(event.toolCallId);
        if (tool) {
          tool.partialResult =
            typeof event.partialResult === 'string' ? event.partialResult : safeStringify(event.partialResult);
        }
        break;
      }

      case 'tool_end': {
        const endedTool = ds.activeTools.get(event.toolCallId);
        if (endedTool) {
          endedTool.status = event.isError ? 'error' : 'completed';
          endedTool.result = event.result;
          endedTool.isError = event.isError;
        }
        // Track file modifications
        if (!event.isError) {
          const FILE_TOOLS = ['string_replace_lsp', 'write_file', 'ast_smart_edit'];
          const toolState = ds.activeTools.get(event.toolCallId);
          if (toolState && FILE_TOOLS.includes(toolState.name)) {
            const toolArgs = toolState.args as Record<string, unknown>;
            const filePath = toolArgs?.path as string;
            if (filePath) {
              const existing = ds.modifiedFiles.get(filePath);
              if (existing) {
                existing.operations.push(toolState.name);
              } else {
                ds.modifiedFiles.set(filePath, {
                  operations: [toolState.name],
                  firstModified: new Date(),
                });
              }
            }
          }
        }
        break;
      }

      case 'shell_output': {
        const shellTool = ds.activeTools.get(event.toolCallId);
        if (shellTool) {
          shellTool.shellOutput = (shellTool.shellOutput ?? '') + event.output;
        }
        break;
      }

      case 'tool_approval_required':
        ds.pendingApproval = {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        };
        break;

      case 'tool_suspended':
        ds.pendingSuspensions.set(event.toolCallId, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          suspendPayload: event.suspendPayload,
          resumeSchema: event.resumeSchema,
        });
        break;

      // ── Subagent tracking ──────────────────────────────────────────────
      case 'subagent_start': {
        const displayName = this.getSubagentDisplayName(event.agentType);
        ds.activeSubagents.set(event.toolCallId, {
          agentType: event.agentType,
          ...(displayName !== undefined ? { displayName } : {}),
          task: event.task,
          modelId: event.modelId,
          forked: event.forked,
          toolCalls: [],
          textDelta: '',
          status: 'running',
        });
        break;
      }

      case 'subagent_text_delta': {
        const sub = ds.activeSubagents.get(event.toolCallId);
        if (sub) {
          sub.textDelta += event.textDelta;
        }
        break;
      }

      case 'subagent_tool_start': {
        const subAgent = ds.activeSubagents.get(event.toolCallId);
        if (subAgent) {
          subAgent.toolCalls.push({ name: event.subToolName, isError: false });
        }
        break;
      }

      case 'subagent_tool_end': {
        const subTool = ds.activeSubagents.get(event.toolCallId);
        if (subTool) {
          const tc = subTool.toolCalls.find(t => t.name === event.subToolName && !t.isError);
          if (tc) {
            tc.isError = event.isError;
          }
        }
        break;
      }

      case 'subagent_end': {
        const endedSub = ds.activeSubagents.get(event.toolCallId);
        if (endedSub) {
          endedSub.status = event.isError ? 'error' : 'completed';
          endedSub.durationMs = event.durationMs;
          endedSub.result = event.result;
        }
        break;
      }

      // ── Observational Memory ───────────────────────────────────────────
      case 'om_status': {
        const w = event.windows;
        ds.omProgress.pendingTokens = w.active.messages.tokens;
        ds.omProgress.threshold = w.active.messages.threshold;
        ds.omProgress.thresholdPercent =
          w.active.messages.threshold > 0 ? (w.active.messages.tokens / w.active.messages.threshold) * 100 : 0;
        ds.omProgress.observationTokens = w.active.observations.tokens;
        ds.omProgress.reflectionThreshold = w.active.observations.threshold;
        ds.omProgress.reflectionThresholdPercent =
          w.active.observations.threshold > 0
            ? (w.active.observations.tokens / w.active.observations.threshold) * 100
            : 0;
        ds.omProgress.buffered = {
          observations: { ...w.buffered.observations },
          reflection: { ...w.buffered.reflection },
        };
        ds.omProgress.generationCount = event.generationCount;
        ds.omProgress.stepNumber = event.stepNumber;
        // Drive buffering animation flags from status fields
        ds.bufferingMessages = w.buffered.observations.status === 'running';
        ds.bufferingObservations = w.buffered.reflection.status === 'running';
        break;
      }

      case 'om_observation_start':
        ds.omProgress.status = 'observing';
        ds.omProgress.cycleId = event.cycleId;
        ds.omProgress.startTime = Date.now();
        break;

      case 'om_observation_end':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        ds.omProgress.observationTokens = event.observationTokens;
        // Messages have been observed — reset pending tokens
        ds.omProgress.pendingTokens = 0;
        ds.omProgress.thresholdPercent = 0;
        break;

      case 'om_observation_failed':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        break;

      case 'om_reflection_start':
        ds.omProgress.status = 'reflecting';
        ds.omProgress.cycleId = event.cycleId;
        ds.omProgress.startTime = Date.now();
        ds.omProgress.preReflectionTokens = ds.omProgress.observationTokens;
        ds.omProgress.observationTokens = event.tokensToReflect;
        ds.omProgress.reflectionThresholdPercent =
          ds.omProgress.reflectionThreshold > 0 ? (event.tokensToReflect / ds.omProgress.reflectionThreshold) * 100 : 0;
        break;

      case 'om_reflection_end':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        ds.omProgress.observationTokens = event.compressedTokens;
        ds.omProgress.reflectionThresholdPercent =
          ds.omProgress.reflectionThreshold > 0
            ? (event.compressedTokens / ds.omProgress.reflectionThreshold) * 100
            : 0;
        break;

      case 'om_reflection_failed':
        ds.omProgress.status = 'idle';
        ds.omProgress.cycleId = undefined;
        ds.omProgress.startTime = undefined;
        break;

      case 'om_buffering_start':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = true;
        } else {
          ds.bufferingObservations = true;
        }
        break;

      case 'om_buffering_end':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      case 'om_buffering_failed':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      case 'om_activation':
        if (event.operationType === 'observation') {
          ds.bufferingMessages = false;
        } else {
          ds.bufferingObservations = false;
        }
        break;

      // ── Token usage ────────────────────────────────────────────────────
      case 'usage_update':
        ds.tokenUsage = { ...this.tokenUsage };
        break;

      // ── Tasks ──────────────────────────────────────────────────────────
      case 'task_updated':
        ds.previousTasks = [...ds.tasks];
        ds.tasks = event.tasks;
        break;

      // ── Follow-up queue ────────────────────────────────────────────────
      case 'follow_up_queued':
        ds.queuedFollowUps = event.count;
        break;

      // ── Thread lifecycle ───────────────────────────────────────────────
      case 'thread_changed':
        this.resetThreadDisplayState();
        ds.tokenUsage = { ...this.tokenUsage };
        break;

      case 'thread_created':
        this.resetThreadDisplayState();
        ds.tokenUsage = createEmptyTokenUsage();
        break;

      case 'thread_deleted':
        if (!this.currentThreadId) {
          this.resetThreadDisplayState();
          ds.tokenUsage = createEmptyTokenUsage();
        }
        break;

      // ── State changes (for OM threshold overrides) ──────────────────────
      case 'state_changed': {
        const keys = event.changedKeys;
        if (keys.includes('observationThreshold')) {
          const value = (event.state as Record<string, unknown>).observationThreshold;
          if (typeof value === 'number') {
            ds.omProgress.threshold = value;
            ds.omProgress.thresholdPercent = value > 0 ? (ds.omProgress.pendingTokens / value) * 100 : 0;
          }
        }
        if (keys.includes('reflectionThreshold')) {
          const value = (event.state as Record<string, unknown>).reflectionThreshold;
          if (typeof value === 'number') {
            ds.omProgress.reflectionThreshold = value;
            ds.omProgress.reflectionThresholdPercent = value > 0 ? (ds.omProgress.observationTokens / value) * 100 : 0;
          }
        }
        break;
      }

      default:
        break;
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
      task_update: taskUpdateTool,
      task_complete: taskCompleteTool,
      task_check: taskCheckTool,
    };

    // Resolve user-configured harness tools (needed for both the harness toolset and subagent allowedHarnessTools)
    let resolvedHarnessTools: ToolsInput | undefined = undefined;
    if (this.config.tools) {
      const tools =
        typeof this.config.tools === 'function' ? await this.config.tools({ requestContext }) : this.config.tools;
      if (tools) {
        resolvedHarnessTools = { ...tools };
      }
    }

    // Auto-create subagent tool if subagent definitions are configured
    if (this.config.subagents?.length && this.config.resolveModel) {
      const currentMode = this.getCurrentMode();
      const hasMemory = Boolean(this.config.memory);
      builtInTools.subagent = createSubagentTool({
        subagents: this.config.subagents,
        resolveModel: this.config.resolveModel,
        harnessTools: resolvedHarnessTools,
        fallbackModelId: currentMode?.defaultModelId,
        getParentModelId: () => this.getCurrentModelId(),
        // Resolved lazily so forked subagents see the current mode's agent
        // even if the mode switches between tool-call scheduling and execution.
        getParentAgent: () => {
          try {
            return this.getCurrentAgent();
          } catch {
            return undefined;
          }
        },
        // Only wired up when memory is configured. Clones at the memory layer
        // (not via Harness.cloneThread) so the parent thread stays the active
        // thread while the forked subagent runs on the clone.
        //
        // The clone is tagged with `forkedSubagent: true` + `parentThreadId` so
        // that thread pickers / startup flows can hide transient fork threads —
        // see `listThreads` (filtered by default).
        cloneThreadForFork: hasMemory
          ? async ({ sourceThreadId, resourceId, title }) => {
              const memory = await this.resolveMemory();
              const result = await memory.cloneThread({
                sourceThreadId,
                resourceId: resourceId ?? this.resourceId,
                title,
                metadata: {
                  forkedSubagent: true,
                  parentThreadId: sourceThreadId,
                },
              });
              return { id: result.thread.id, resourceId: result.thread.resourceId };
            }
          : undefined,
        // Forks inherit the parent's toolsets verbatim so harness-injected
        // tools (`ask_user`, `submit_plan`, user-configured harness tools, etc.)
        // remain available inside the fork. The `subagent` entry itself is
        // deliberately kept — its schema/description are part of the parent's
        // prompt-cache prefix, and stripping it would invalidate the cache.
        // Recursive forking is blocked at runtime instead: see the patched
        // `subagent` execute that the forked tool path installs in `tools.ts`.
        getParentToolsets: forkRequestContext => this.buildToolsets(forkRequestContext ?? requestContext),
      });
    }

    // Remove any explicitly disabled built-in tools
    if (this.config.disableBuiltinTools?.length) {
      for (const toolId of this.config.disableBuiltinTools) {
        delete builtInTools[toolId];
      }
    }

    const permissionRules = this.getPermissionRules();
    for (const [toolId, policy] of Object.entries(permissionRules.tools)) {
      if (policy === 'deny') {
        delete builtInTools[toolId];
        delete resolvedHarnessTools?.[toolId];
      }
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
  private async buildRequestContext(requestContext?: RequestContext): Promise<RequestContext> {
    requestContext ??= new RequestContext();
    const harnessContext: HarnessRequestContext<Readonly<TState>> = {
      harnessId: this.id,
      state: this.getState(),
      getState: () => this.getState(),
      setState: updates => this.setState(updates),
      updateState: updater => this.updateState(updater),
      threadId: this.currentThreadId,
      resourceId: this.resourceId,
      modeId: this.currentModeId,
      abortSignal: this.abortController?.signal,
      workspace: this.workspace,
      emitEvent: event => this.emit(event),
      getSubagentModelId: params => this.getSubagentModelId(params),
    };

    requestContext.set('harness', harnessContext);

    if (this.workspaceFn) {
      // Pass the internal Mastra instance so the workspace factory can dedupe
      // against the registered workspace (getWorkspaceById). Without it, a
      // dynamic factory would build a *separate* Workspace/filesystem instance
      // from the one the agent resolves and registers — leaving harness-side
      // tools (e.g. request_access) mutating a different filesystem than the
      // agent's workspace tools (e.g. view) read from.
      const resolved = await Promise.resolve(this.workspaceFn({ requestContext, mastra: this.#internalMastra }));
      harnessContext.workspace = resolved;
      // Cache for getWorkspace() so callers outside request flow (e.g. /skills) can access it
      this.workspace = resolved;
    }

    return requestContext;
  }

  /**
   * Resolve memory from config — handles both static instances and dynamic factory functions.
   */
  private async resolveMemory(): Promise<MastraMemory> {
    const mem = this.config.memory;
    if (!mem) {
      throw new Error('Memory is not configured on this Harness');
    }
    if (typeof mem !== 'function') {
      return mem;
    }
    const requestContext = await this.buildRequestContext();
    const resolved = await Promise.resolve(mem({ requestContext }));
    if (!resolved) {
      throw new Error('Dynamic memory factory returned empty value');
    }
    return resolved;
  }

  // ===========================================================================
  // Token Usage
  // ===========================================================================

  getTokenUsage(): TokenUsage {
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

  /**
   * Eagerly resolve the workspace. For dynamic workspaces (factory function),
   * this triggers resolution and caches the result so getWorkspace() returns it.
   * Useful for code paths outside the request flow (e.g. slash commands).
   */
  async resolveWorkspace({
    requestContext,
  }: {
    requestContext?: RequestContext;
  } = {}): Promise<Workspace | undefined> {
    if (this.workspace) return this.workspace;
    if (this.workspaceFn) {
      // buildRequestContext resolves the workspace and caches it on this.workspace
      await this.buildRequestContext(requestContext);
      return this.workspace;
    }
    return undefined;
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
    const handlers = [...(this.config.heartbeatHandlers ?? [])];
    if (!handlers.length) return;

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
  // Lifecycle
  // ===========================================================================

  async destroy(): Promise<void> {
    this.cleanupAgentThreadSubscription();
    for (const scheduler of this.displayStateSchedulers) {
      scheduler.dispose();
    }
    this.displayStateSchedulers.clear();
    await this.stopHeartbeats();
    await this.destroyWorkspace();
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
