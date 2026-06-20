import { randomUUID } from 'node:crypto';

import { Agent } from '../agent';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { createSignal, mastraDBMessageToSignal } from '../agent/signals';
import type { AgentSignalAttributes, AgentSignalContents, AgentSignalInput } from '../agent/signals';
import type {
  AgentInstructions,
  AgentThreadSubscription,
  SendAgentNotificationSignalOptions,
  SendAgentNotificationSignalResult,
  ToolsInput,
  ToolsetsInput,
} from '../agent/types';
import type { MastraBrowser } from '../browser/browser';
import { getErrorFromUnknown } from '../error';
import { getServerSideFallbackInfo } from '../llm/model/server-side-fallback';
import { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { StorageThreadType } from '../memory/types';
import type { SendNotificationSignalInput } from '../notifications';
import type { TracingContext, TracingOptions } from '../observability';
import { RequestContext } from '../request-context';
import type { MemoryStorage } from '../storage/domains/memory/base';
import type { ObservationalMemoryRecord } from '../storage/types';
import { getTransformedToolPayload, hasTransformedToolPayload } from '../tools/payload-transform';
import type { ToolPayloadTransformPhase } from '../tools/types';
import { Workspace } from '../workspace/workspace';
import type { WorkspaceConfig } from '../workspace/workspace';

import { Session, SessionStream } from './session';
import type { ThreadDataStore } from './session';
import {
  askUserTool,
  createSubagentTool,
  submitPlanTool,
  taskCheckTool,
  taskCompleteTool,
  taskUpdateTool,
  taskWriteTool,
} from './tools';
import { createEmptyTokenUsage } from './types';
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
  HarnessThread,
  ModelAuthStatus,
  PermissionPolicy,
  PermissionRules,
  TokenUsage,
  ToolCategory,
} from './types';

type HarnessStreamState = {
  currentMessage: HarnessMessage;
  lastFinishedMessage?: HarnessMessage;
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
      throw new Error(
        `Mode "${modeRecord.id}" cannot set both "tools" and "additionalTools" - choose replace OR augment`,
      );
    }
  }

  for (const mode of modes) {
    if (mode.transitionsTo === mode.id) {
      throw new Error(`Mode "${mode.id}" transitionsTo cannot reference itself`);
    }
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
 * Step budget applied to every harness-driven agent run.
 *
 * This MUST be passed to both the initial stream and `resumeStream`: when a run
 * suspends on an interactive tool (e.g. `ask_user`) and then resumes, the
 * resumed call merges over the agent's *default* options, whose `maxSteps` is
 * small (~5). Without re-supplying this budget the resumed run is silently
 * capped and ends with `reason:"complete"` after a few steps — the agent stops
 * mid-task even though it promised to continue. See {@link buildSharedRunOptions}.
 */
const HARNESS_MAX_STEPS = 1000;

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
    goalEvaluation: getRecordValue(metadata?.goalEvaluation) as
      | Extract<HarnessMessageContent, { type: 'system_reminder' }>['goalEvaluation']
      | undefined,
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
  private listeners: HarnessEventListener[] = [];
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
  readonly #session: Session<TState>;
  private availableModelsCache: AvailableModel[] | null = null;
  private availableModelsCacheTime: number = 0;
  readonly #instructions?: string;
  #internalMastra: Mastra | undefined = undefined;
  #legacyAgentMode: Record<string, Agent<any, any, any, any>> = {};

  constructor(config: HarnessConfig<TState>) {
    validateModes(config.modes);

    this.id = config.id;
    this.config = config;
    this.#instructions = config.instructions;

    this.#session = new Session({
      resourceId: config.resourceId ?? config.id,
      state: {
        initialState: config.initialState,
        stateSchema: config.stateSchema,
        emit: event => this.emit(event),
      },
    });

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
    this.#session.mode.set({ modeId: defaultMode.id });
    this.#session.setStore({
      get: key => this.#session.thread.getSetting({ key }),
      set: (key, value) => this.#session.thread.setSetting({ key, value }),
    });
    this.#session.setCategoryResolver(toolName => this.getToolCategory({ toolName }));
    this.#session.setSubagentNameResolver(agentType => this.getSubagentDisplayName(agentType));
    this.#session.mode.setResolver(modeId => this.config.modes.find(m => m.id === modeId) ?? null);
    this.#session.thread.connect(this.createThreadDataStore());

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

    // Seed the selected model: an explicit initialState.currentModelId wins,
    // otherwise fall back to the default mode's model. The model lives on the
    // session, not in persisted state, so initialState.currentModelId is read
    // here as a construction-time input only.
    const initialModelId = (config.initialState as { currentModelId?: string } | undefined)?.currentModelId;
    if (initialModelId) {
      this.#session.model.set({ modelId: initialModelId });
    } else if (defaultMode.defaultModelId) {
      this.#session.model.set({ modelId: defaultMode.defaultModelId });
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
   * The current harness session. Owns per-session runtime state such as
   * session-scoped permission grants. Prefer `harness.session.*` over the
   * (removed) re-exposed grant helpers on the Harness.
   */
  get session(): Session<TState> {
    return this.#session;
  }

  /**
   * Sets or updates the harness-level browser and propagates it to mode agents.
   */
  setBrowser(browser: MastraBrowser | undefined): void {
    this.browser = browser;
    this.browserFn = undefined;

    // Collect unique agents: shared backing agent + any deprecated mode.agent
    // instances so all receive the browser (signal providers may be attached to
    // any of them).
    const agents = new Set<Agent<any, any, any, any>>();
    if (this.config.agent) {
      agents.add(this.config.agent);
    }
    for (const mode of this.config.modes) {
      if (mode.agent || !this.config.agent) {
        agents.add(this.getAgentForMode(mode));
      }
    }
    for (const agent of agents) {
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
      const enabledGateways = this.config.gateways?.filter(gateway => gateway.shouldEnable?.() ?? true);
      const gateways = enabledGateways?.length
        ? Object.fromEntries(enabledGateways.map(gateway => [gateway.id, gateway]))
        : undefined;

      this.#internalMastra = new Mastra({
        logger: false,
        storage: this.config.storage,
        ...(this.config.pubsub ? { pubsub: this.config.pubsub } : {}),
        ...(this.config.observability ? { observability: this.config.observability } : {}),
        ...(gateways ? { gateways } : {}),
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
        const err = getErrorFromUnknown(error);
        this.workspace = undefined;
        this.workspaceInitialized = false;

        this.emit({ type: 'workspace_status_changed', status: 'error', error: err });
        this.emit({ type: 'workspace_error', error: err });
      }
    }

    // Propagate harness-level Mastra, memory, workspace, browser, and pubsub
    // to the agent(s) that back each mode (after workspace init).
    // Collect unique agents: shared backing agent + any deprecated mode.agent
    // instances so all receive runtime services.
    const agents = new Set<Agent<any, any, any, any>>();
    if (this.config.agent) {
      agents.add(this.config.agent);
    }
    for (const mode of this.config.modes) {
      if (mode.agent || !this.config.agent) {
        agents.add(this.getAgentForMode(mode));
      }
    }
    for (const agent of agents) {
      this.propagateRuntimeServicesToAgent(agent);
    }

    this.startHeartbeats();
  }

  /**
   * Select the most recent thread, or create one if none exist.
   */
  async selectOrCreateThread(): Promise<HarnessThread> {
    const threads = await this.#session.thread.list();

    if (threads.length === 0) {
      return await this.createThread();
    }

    const sortedThreads = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const mostRecent = sortedThreads[0]!;
    await this.config.threadLock?.acquire(mostRecent.id);
    this.#session.thread.set({ threadId: mostRecent.id });
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

  /**
   * The shared-host storage gateway the Session's thread domain reads/writes
   * through. The Session owns the thread-domain logic; this adapter just maps
   * raw storage rows to Harness types — it does not call back into Session.
   */
  private createThreadDataStore(): ThreadDataStore {
    return {
      listThreads: ({ resourceId, includeForkedSubagents }) =>
        this.queryThreads({ resourceId, includeForkedSubagents }),
      getById: ({ threadId }) => this.queryThreadById({ threadId }),
      listMessages: ({ threadId, limit }) => this.queryThreadMessages({ threadId, limit }),
      firstUserMessages: ({ threadIds }) => this.queryFirstUserMessages({ threadIds }),
      getMetadata: ({ threadId, key }) => this.readThreadMetadataValue({ threadId, key }),
      setMetadata: ({ threadId, key, value }) => this.writeThreadMetadataValue({ threadId, key, value }),
      deleteMetadata: ({ threadId, key }) => this.removeThreadMetadataValue({ threadId, key }),
    };
  }

  private async readThreadMetadataValue({ threadId, key }: { threadId: string; key: string }): Promise<unknown> {
    if (!this.config.storage) return undefined;
    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      const metadata = thread?.metadata as Record<string, unknown> | undefined;
      return metadata?.[key];
    } catch {
      // Settings reads are not critical
      return undefined;
    }
  }

  private async writeThreadMetadataValue({
    threadId,
    key,
    value,
  }: {
    threadId: string;
    key: string;
    value: unknown;
  }): Promise<void> {
    if (!this.config.storage) return;
    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (thread) {
        await memoryStorage.saveThread({
          thread: { ...thread, metadata: { ...thread.metadata, [key]: value }, updatedAt: new Date() },
        });
      }
    } catch {
      // Settings persistence is not critical
    }
  }

  private async removeThreadMetadataValue({ threadId, key }: { threadId: string; key: string }): Promise<void> {
    if (!this.config.storage) return;
    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
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

  private async queryThreadById({ threadId }: { threadId: string }): Promise<HarnessThread | null> {
    if (!this.config.storage) return null;
    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId });
    if (!thread) return null;
    return {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: thread.metadata,
    };
  }

  private async queryThreads({
    resourceId,
    includeForkedSubagents,
  }: {
    resourceId?: string;
    includeForkedSubagents?: boolean;
  }): Promise<HarnessThread[]> {
    if (!this.config.storage) return [];

    const memoryStorage = await this.getMemoryStorage();
    const filter: { resourceId?: string } | undefined = resourceId === undefined ? undefined : { resourceId };

    const result = await memoryStorage.listThreads({ filter, perPage: false });

    const threads = includeForkedSubagents
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

  private async queryThreadMessages({
    threadId,
    limit,
  }: {
    threadId: string;
    limit?: number;
  }): Promise<HarnessMessage[]> {
    if (!this.config.storage) return [];

    const memoryStorage = await this.getMemoryStorage();

    const result = await memoryStorage.listMessages({ threadId, perPage: false });
    const messages = result.messages.map(msg => this.convertToHarnessMessage(msg));

    if (!limit) return messages;

    return messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-limit);
  }

  private async queryFirstUserMessages({ threadIds }: { threadIds: string[] }): Promise<Map<string, HarnessMessage>> {
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

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Get current harness state (read-only snapshot).
   * @deprecated Prefer `harness.session.state.get()`.
   */
  getState(): Readonly<TState> {
    return this.#session.state.get();
  }

  /**
   * Update harness state. Validates against schema if provided.
   * Emits state_changed event.
   * @deprecated Prefer `harness.session.state.set(...)`.
   */
  async setState(updates: Partial<TState>): Promise<void> {
    return this.#session.state.set(updates);
  }

  private async updateState<TResult>(
    updater: (
      state: Readonly<TState>,
    ) =>
      | { updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: HarnessEvent[]; result: TResult }>,
  ): Promise<TResult> {
    return this.#session.state.update(updater);
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  listModes(): HarnessMode[] {
    return this.config.modes;
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

    const previousModeId = this.#session.mode.get();

    // Emit the mode change immediately so UIs can update without waiting for
    // the storage round-trips inside session.mode.switch().
    this.emit({ type: 'mode_changed', modeId, previousModeId });

    // The session owns the version-guarded switch sequence: remember the
    // outgoing mode's model, persist the new mode, then resolve and apply the
    // incoming mode's model. It returns the resolved model (or null if a newer
    // switch superseded this one) so we can emit model_changed.
    const { modelId } = await this.#session.mode.switch({ modeId, defaultModelId: mode.defaultModelId });
    if (modelId) {
      this.emit({ type: 'model_changed', modelId } as HarnessEvent);
    }
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
    // Deprecated per-mode agent — use directly, no forking.
    if (mode.agent) {
      if (!this.#legacyAgentMode[mode.id]) {
        this.#legacyAgentMode[mode.id] = mode.agent;
      }
      return this.#legacyAgentMode[mode.id]!;
    }

    // Shared backing agent — reuse the single instance.
    // The harness never mutates the agent's own instructions or tools.
    // Mode instructions are passed at call time via buildAgentMessageStreamOptions;
    // mode tools are resolved at execution time via buildToolsets.
    if (this.config.agent) {
      return this.config.agent;
    }

    // No backing agent — construct one per mode (cached).
    if (!this.#legacyAgentMode[mode.id]) {
      if (!mode.defaultModelId) {
        throw new Error(`Mode ${mode.id} requires a defaultModelId when no backing agent is configured`);
      }

      const instructions = [this.#instructions ?? '', mode.instructions].filter(Boolean).join('\n');
      const modeTools = {
        ...mode.tools,
        ...mode.additionalTools,
      };

      const model = this.config.resolveModel ? this.config.resolveModel(mode.defaultModelId) : mode.defaultModelId;
      this.#legacyAgentMode[mode.id] = new Agent({
        id: `${this.id}-agent`,
        name: `Harness ${this.id} agent`,
        model,
        instructions,
        tools: modeTools,
      });
    }
    return this.#legacyAgentMode[mode.id]!;
  }

  /**
   * Resolve the combined instructions for the current mode: harness-level
   * instructions + mode-specific instructions. Passed at call time via
   * `buildAgentMessageStreamOptions` so the agent's own instructions are
   * never mutated.
   */
  private resolveCurrentModeInstructions(): string | undefined {
    const mode = this.#session.mode.resolve();
    const combined = [this.#instructions ?? '', mode?.instructions ?? ''].filter(Boolean).join('\n');
    return combined || undefined;
  }

  /**
   * Convert AgentInstructions (string | string[] | system message objects) to
   * a plain string for combining with mode instructions.
   */
  private instructionsToString(instructions: AgentInstructions): string {
    if (typeof instructions === 'string') return instructions;
    if (Array.isArray(instructions)) {
      return instructions
        .map(msg => (typeof msg === 'string' ? msg : typeof msg.content === 'string' ? msg.content : ''))
        .filter(Boolean)
        .join('\n\n');
    }
    return typeof instructions.content === 'string' ? instructions.content : '';
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
    const mode = this.#session.mode.resolve();

    return this.propagateRuntimeServicesToAgent(this.getAgentForMode(mode));
  }

  /**
   * Get a short display name from the current model ID.
   */
  getModelName(): string {
    const modelId = this.#session.model.get();
    if (!modelId || modelId === 'unknown') return modelId || 'unknown';
    const parts = modelId.split('/');
    return parts[parts.length - 1] || modelId;
  }

  /**
   * Get the full model ID (e.g., "anthropic/claude-sonnet-4").
   */
  getFullModelId(): string {
    return this.#session.model.get();
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
    const targetModeId = modeId ?? this.#session.mode.get();

    if (targetModeId === this.#session.mode.get()) {
      this.#session.model.set({ modelId });
    }

    if (scope === 'thread') {
      await this.#session.model.saveForMode({ modeId: targetModeId, modelId });
    }

    try {
      await Promise.resolve(this.config.modelUseCountTracker?.(modelId));
    } catch (error) {
      console.error('Failed to track model usage count', error);
    }

    this.emit({ type: 'model_changed', modelId, scope, modeId: targetModeId } as HarnessEvent);
  }

  /**
   * Check if the current model's provider has authentication configured.
   * Uses app-provided catalog/auth hooks; Harness does not resolve gateway auth itself.
   */
  async getCurrentModelAuthStatus(): Promise<ModelAuthStatus> {
    const modelId = this.#session.model.get();
    if (!modelId) return { hasAuth: true };

    try {
      const availableModels = await this.listAvailableModels();
      const currentModel = availableModels.find(model => model.id === modelId);
      if (currentModel) {
        return {
          hasAuth: currentModel.hasApiKey,
          apiKeyEnvVar: currentModel.hasApiKey ? undefined : currentModel.apiKeyEnvVar,
        };
      }
    } catch {
      // Ignore catalog lookup errors and fall through to provider-based checks.
    }

    const provider = modelId.split('/', 1)[0];
    if (this.config.modelAuthChecker && provider) {
      const result = this.config.modelAuthChecker(provider);
      if (result !== undefined) return { hasAuth: result };
    }

    return { hasAuth: true };
  }

  /**
   * Get available models from the app-provided catalog hook with use counts applied.
   */
  async listAvailableModels(): Promise<AvailableModel[]> {
    const now = Date.now();
    if (this.availableModelsCache && now - this.availableModelsCacheTime < 10_000) {
      return this.availableModelsCache;
    }

    const useCounts = this.config.modelUseCountProvider?.() ?? {};
    const modelsById = new Map<string, AvailableModel>();

    const upsertModel = (model: Omit<AvailableModel, 'useCount'>): void => {
      if (!model.id || !model.provider || !model.modelName) return;
      modelsById.set(model.id, {
        ...model,
        useCount: useCounts[model.id] ?? 0,
      });
    };

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
        console.warn('Failed to load available models:', error);
      }
    }

    const result = [...modelsById.values()];
    this.availableModelsCache = result;
    this.availableModelsCacheTime = Date.now();
    return result;
  }

  invalidateAvailableModelsCache(): void {
    this.availableModelsCache = null;
    this.availableModelsCacheTime = 0;
  }

  // ===========================================================================
  // Thread Management
  // ===========================================================================

  async getResolvedMemory(): Promise<MastraMemory | null> {
    if (!this.config.memory) return null;
    return this.resolveMemory();
  }

  /**
   * Point the session at a different memory resourceId. The resourceId itself
   * lives on the session (`session.identity`); the Harness orchestrates the
   * surrounding teardown — dropping the current thread subscription and clearing
   * the active thread — since those are Harness-owned.
   */
  setResourceId({ resourceId }: { resourceId: string }): void {
    this.cleanupAgentThreadSubscription();
    this.#session.identity.setResourceId({ resourceId });
    this.#session.thread.clear();
  }

  async getKnownResourceIds(): Promise<string[]> {
    const threads = await this.#session.thread.list({ allResources: true });
    const ids = new Set(threads.map(t => t.resourceId));
    return [...ids].sort();
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    this.cleanupAgentThreadSubscription();
    const now = new Date();
    const thread: HarnessThread = {
      id: this.generateId(),
      resourceId: this.#session.identity.getResourceId(),
      title: title || '',
      createdAt: now,
      updatedAt: now,
    };

    const currentStateModel = this.#session.model.get();
    const currentMode = this.#session.mode.resolve();
    const modelId = currentStateModel || currentMode.defaultModelId;

    const metadata: Record<string, unknown> = {};
    if (modelId) {
      metadata.currentModelId = modelId;
      metadata[`modeModelId_${this.#session.mode.get()}`] = modelId;
    }

    // Auto-tag with projectPath from state so threads are scoped to the working directory
    const projectPath = (this.#session.state.get() as any).projectPath;
    if (projectPath) {
      metadata.projectPath = projectPath;
    }

    // Acquire lock on new thread before releasing old one.
    // If acquire fails, attempt to re-acquire the old lock before rethrowing.
    const oldThreadId = this.#session.thread.getId();
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
        if (reacquired && oldThreadId) {
          this.#session.thread.set({ threadId: oldThreadId });
        } else {
          this.#session.thread.clear();
        }
        throw err;
      }
    }

    this.#session.thread.set({ threadId: thread.id });

    if (modelId && !currentStateModel) {
      this.#session.model.set({ modelId });
    }

    this.#session.resetTokenUsage();
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
      listThreads: (options?: { allResources?: boolean; includeForkedSubagents?: boolean }) =>
        this.#session.thread.list(options),
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

    const isDeletingCurrentThread = this.#session.thread.getId() === threadId;

    await memoryStorage.deleteThread({ threadId });

    if (isDeletingCurrentThread) {
      try {
        await this.config.threadLock?.release(threadId);
      } catch {
        // Lock release failed; proceed with state cleanup regardless
      }
      this.cleanupAgentThreadSubscription();
      this.#session.thread.clear();
      this.#session.resetTokenUsage();
    }

    this.emit({ type: 'thread_deleted', threadId });
  }

  async renameThread({ title }: { title: string }): Promise<void> {
    const threadId = this.#session.thread.getId();
    if (!threadId || !this.config.storage) return;

    const memoryStorage = await this.getMemoryStorage();
    const thread = await memoryStorage.getThreadById({ threadId });
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
    const sourceId = sourceThreadId ?? this.#session.thread.getId();
    if (!sourceId) {
      throw new Error('No source thread to clone');
    }
    if (!this.config.memory) {
      throw new Error('Memory is not configured on this Harness');
    }

    const memory = await this.resolveMemory();

    const result = await memory.cloneThread({
      sourceThreadId: sourceId,
      resourceId: resourceId ?? this.#session.identity.getResourceId(),
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
    const oldThreadId = this.#session.thread.getId();
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
    this.#session.thread.set({ threadId: clonedThread.id });
    await this.loadThreadMetadata();
    this.#session.resetTokenUsage();
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
    const previousThreadId = this.#session.thread.getId();
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

    this.#session.thread.set({ threadId });

    await this.loadThreadMetadata();

    this.emit({ type: 'thread_changed', threadId, previousThreadId });
    await this.ensureCurrentAgentThreadSubscription();
  }

  private async loadThreadMetadata(): Promise<void> {
    const threadId = this.#session.thread.getId();
    if (!threadId || !this.config.storage) {
      this.#session.resetTokenUsage();
      return;
    }

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });

      // Load token usage
      const savedUsage = thread?.metadata?.tokenUsage as TokenUsage | undefined;
      if (savedUsage) {
        this.#session.setTokenUsage({
          ...createEmptyTokenUsage(),
          ...savedUsage,
          promptTokens: savedUsage.promptTokens ?? 0,
          completionTokens: savedUsage.completionTokens ?? 0,
          totalTokens: savedUsage.totalTokens ?? 0,
          cachedInputTokens: savedUsage.cachedInputTokens ?? 0,
          cacheCreationInputTokens: savedUsage.cacheCreationInputTokens ?? 0,
        });
      } else {
        this.#session.resetTokenUsage();
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
        if (modeExists && savedModeId !== this.#session.mode.get()) {
          previousModeIdForEmit = this.#session.mode.get();
          this.#session.mode.set({ modeId: savedModeId });
        }
      }

      // Resolve the model for the (now-restored) current mode and apply it to
      // the session (source of truth for the selected model).
      // Order: per-mode thread metadata → mode's defaultModelId → legacy
      // global currentModelId (set by createThread).
      const currentModeId = this.#session.mode.get();
      const modeModelKey = `modeModelId_${currentModeId}`;
      if (meta?.[modeModelKey]) {
        this.#session.model.set({ modelId: meta[modeModelKey] as string });
      } else {
        const currentMode = this.config.modes.find(m => m.id === currentModeId);
        if (currentMode?.defaultModelId) {
          this.#session.model.set({ modelId: currentMode.defaultModelId });
        } else if (meta?.currentModelId) {
          this.#session.model.set({ modelId: meta.currentModelId as string });
        }
      }

      if (previousModeIdForEmit !== undefined) {
        this.emit({
          type: 'mode_changed',
          modeId: this.#session.mode.get(),
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
          await this.#session.thread.setSetting({ key: 'observationThreshold', value: observationThreshold });
        }
      }
      if (!hasReflectionThreshold) {
        const reflectionThreshold = this.getReflectionThreshold();
        if (reflectionThreshold !== undefined) {
          await this.#session.thread.setSetting({ key: 'reflectionThreshold', value: reflectionThreshold });
        }
      }
    } catch {
      this.#session.resetTokenUsage();
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
    const threadId = this.#session.thread.getId();
    if (!threadId) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const record = await memoryStorage.getObservationalMemory(threadId, this.#session.identity.getResourceId());

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
        threadId,
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
        threadId,
        stepNumber,
        generationCount,
      });
    } catch {
      // OM not available or not initialized — that's fine
    }
  }

  async getObservationalMemoryRecord(): Promise<ObservationalMemoryRecord | null> {
    if (!this.#session.thread.getId()) return null;

    try {
      const memoryStorage = await this.getMemoryStorage();
      return await memoryStorage.getObservationalMemory(
        this.#session.thread.getId(),
        this.#session.identity.getResourceId(),
      );
    } catch {
      return null;
    }
  }

  /**
   * Returns the observer model ID from state, falling back to omConfig defaults.
   */
  getObserverModelId(): string | undefined {
    return (this.#session.state.get() as any).observerModelId ?? this.config.omConfig?.defaultObserverModelId;
  }

  /**
   * Returns the reflector model ID from state, falling back to omConfig defaults.
   */
  getReflectorModelId(): string | undefined {
    return (this.#session.state.get() as any).reflectorModelId ?? this.config.omConfig?.defaultReflectorModelId;
  }

  /**
   * Returns the observation threshold from state, falling back to omConfig defaults.
   */
  getObservationThreshold(): number | undefined {
    return (this.#session.state.get() as any).observationThreshold ?? this.config.omConfig?.defaultObservationThreshold;
  }

  /**
   * Returns the reflection threshold from state, falling back to omConfig defaults.
   */
  getReflectionThreshold(): number | undefined {
    return (this.#session.state.get() as any).reflectionThreshold ?? this.config.omConfig?.defaultReflectionThreshold;
  }

  /**
   * Resolves the observer model ID to a language model instance via the configured resolver.
   */
  getResolvedObserverModel() {
    const modelId = this.getObserverModelId();
    if (!modelId || !this.config.resolveModel) return undefined;
    return this.config.resolveModel(modelId);
  }

  /**
   * Resolves the reflector model ID to a language model instance via the configured resolver.
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
    await this.#session.thread.setSetting({ key: 'observerModelId', value: modelId });
    this.emit({ type: 'om_model_changed', role: 'observer', modelId } as HarnessEvent);
  }

  /**
   * Switch the Reflector model.
   */
  async switchReflectorModel({ modelId }: { modelId: string }): Promise<void> {
    void this.setState({ reflectorModelId: modelId } as unknown as Partial<TState>);
    await this.#session.thread.setSetting({ key: 'reflectorModelId', value: modelId });
    this.emit({ type: 'om_model_changed', role: 'reflector', modelId } as HarnessEvent);
  }

  // ===========================================================================
  // Subagent Model Management
  // ===========================================================================

  getSubagentModelId({ agentType }: { agentType?: string } = {}): string | null {
    const state = this.#session.state.get() as Record<string, unknown>;
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
    await this.#session.thread.setSetting({ key, value: modelId });
    this.emit({ type: 'subagent_model_changed', modelId, scope: 'thread', agentType } as HarnessEvent);
  }

  // ===========================================================================
  // Permissions
  // ===========================================================================

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
    const state = this.#session.state.get() as Record<string, unknown>;
    const rules = state.permissionRules as PermissionRules | undefined;
    return rules ?? { categories: {}, tools: {} };
  }

  /**
   * Resolve whether a tool call should be auto-approved, denied, or asked.
   * Resolution chain: per-tool deny → yolo → per-tool policy → session tool grant →
   * session category grant → category policy → "ask"
   */
  private resolveToolApproval(toolName: string): PermissionPolicy {
    const state = this.#session.state.get() as Record<string, unknown>;
    const rules = this.getPermissionRules();

    const toolPolicy = rules.tools[toolName];
    if (toolPolicy === 'deny') return 'deny';

    if (state.yolo === true) return 'allow';

    if (toolPolicy) return toolPolicy;

    if (this.#session.hasToolGrant(toolName)) return 'allow';

    const category = this.getToolCategory({ toolName });
    if (category) {
      if (this.#session.hasCategoryGrant(category)) return 'allow';
      const categoryPolicy = rules.categories[category];
      if (categoryPolicy) return categoryPolicy;
    }

    return 'ask';
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  private cleanupAgentThreadSubscription(): void {
    this.#session.stream.cleanup();
    this.#session.run.reset();
  }

  private async ensureAgentThreadSubscription(agent: Agent, threadId: string): Promise<void> {
    const key = SessionStream.keyFor({ agent, resourceId: this.#session.identity.getResourceId(), threadId });
    if (this.#session.stream.matches({ key })) return;

    this.cleanupAgentThreadSubscription();
    const subscription = await agent.subscribeToThread({
      resourceId: this.#session.identity.getResourceId(),
      threadId,
    });
    this.#session.stream.attach({ subscription, key });
    void this.processSubscribedThreadStream(subscription);
  }

  private async ensureCurrentAgentThreadSubscription(): Promise<void> {
    const threadId = this.#session.thread.getId();
    if (!threadId) return;
    await this.ensureAgentThreadSubscription(this.getCurrentAgent(), threadId);
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
    if (!this.#session.thread.getId()) {
      throw new Error('Cannot build stream options without a current thread');
    }

    this.#session.run.clearAbortRequested();
    const requestContext = await this.buildRequestContext(requestContextInput);
    // Resolve mode-aware instructions at call time so the agent's own
    // instructions are never mutated by the harness.
    // When mode/harness instructions exist, combine them with the agent's
    // own instructions so dynamic instructions (e.g. AGENTS.md, project
    // context) aren't lost — the agent treats options.instructions as a
    // full override.
    let callTimeInstructions: string | undefined;
    if (this.config.agent) {
      const modeInstructions = this.resolveCurrentModeInstructions();
      if (modeInstructions) {
        const agent = this.getCurrentAgent();
        const agentInstructions = await agent.getInstructions({ requestContext });
        const agentStr = this.instructionsToString(agentInstructions);
        callTimeInstructions = [agentStr, modeInstructions].filter(Boolean).join('\n') || undefined;
      }
      // When no mode instructions, don't pass instructions — the agent
      // uses its own getInstructions() naturally.
    }

    const streamOptions: Record<string, unknown> = {
      ...this.buildSharedRunOptions(),
      memory: { thread: this.#session.thread.getId(), resource: this.#session.identity.getResourceId() },
      abortSignal: this.#session.run.ensureAbortController().signal,
      requestContext,
      ...(tracingContext && { tracingContext }),
      ...(tracingOptions && { tracingOptions }),
      ...(callTimeInstructions && { instructions: callTimeInstructions }),
    };
    streamOptions.toolsets = await this.buildToolsets(requestContext);

    return streamOptions;
  }

  /**
   * Options that every harness-driven agent run must carry — the initial stream
   * AND every `resumeStream`. Centralized so the two paths can't drift: a
   * missing `maxSteps` on resume silently caps the resumed run at the agent's
   * small default and ends it mid-task (see {@link HARNESS_MAX_STEPS}).
   */
  private buildSharedRunOptions(): Record<string, unknown> {
    const isYolo = (this.#session.state.get() as Record<string, unknown>).yolo === true;
    const shared: Record<string, unknown> = {
      maxSteps: HARNESS_MAX_STEPS,
      savePerStep: false,
      requireToolApproval: !isYolo,
      modelSettings: { temperature: 1 },
    };

    // Auto-enable Anthropic server-side fallbacks for fable-5 so a classifier
    // block is transparently retried on the fallback model instead of failing.
    const fableFallback = buildFableFallbackProviderOptions(this.#session.model.get());
    if (fableFallback) {
      shared.providerOptions = { anthropic: { ...fableFallback.anthropic } };
    }

    return shared;
  }

  private async drainFollowUpQueue(options?: {
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<boolean> {
    if (this.#session.followUps.isEmpty()) return false;

    const next = this.#session.followUps.dequeue()!;
    const threadId = this.#session.thread.getId();
    try {
      if (this.#session.stream.isOpen() && threadId) {
        const agent = this.getCurrentAgent();
        const streamOptions = await this.buildAgentMessageStreamOptions({
          requestContext: next.requestContext,
          tracingContext: options?.tracingContext,
          tracingOptions: options?.tracingOptions,
        });
        const result = agent.queueMessage(this.createMessageInput({ content: next.content }), {
          resourceId: this.#session.identity.getResourceId(),
          threadId,
          ifIdle: { streamOptions: streamOptions as any },
        });
        this.emit({ type: 'follow_up_queued', count: this.#session.followUps.count(), runId: result.runId });
      } else {
        this.emit({ type: 'follow_up_queued', count: this.#session.followUps.count() });
        await this.sendMessage({
          content: next.content,
          requestContext: next.requestContext,
          tracingContext: options?.tracingContext,
          tracingOptions: options?.tracingOptions,
        });
      }
      return true;
    } catch (error) {
      this.#session.followUps.requeue(next);
      this.emit({ type: 'follow_up_queued', count: this.#session.followUps.count() });
      throw error;
    }
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
    const reason = error
      ? 'error'
      : suspended
        ? 'suspended'
        : aborted || this.#session.run.isAbortRequested()
          ? 'aborted'
          : 'complete';
    this.emit({ type: 'agent_end', reason });
    this.#session.run.reset();
    await this.drainFollowUpQueue();
  }

  private async handleSubscribedStreamError(error: unknown): Promise<void> {
    if (error instanceof Error && error.name === 'AbortError') {
      this.emit({ type: 'agent_end', reason: 'aborted' });
    } else {
      this.emit({ type: 'error', error: getErrorFromUnknown(error) });
      this.emit({ type: 'agent_end', reason: 'error' });
    }
    this.#session.stream.detach();
    this.#session.run.reset();
    await this.drainFollowUpQueue();
  }

  private async processSubscribedThreadStream(subscription: AgentThreadSubscription<any>): Promise<void> {
    const requestContext = await this.buildRequestContext();
    let currentRun: HarnessStreamState | undefined;
    let lastFinishedRunId: string | null = null;

    try {
      for await (const chunk of subscription.stream) {
        if (!this.#session.stream.isCurrent({ subscription })) {
          subscription.unsubscribe();
          break;
        }

        const chunkRunId = 'runId' in chunk ? chunk.runId : null;
        if (lastFinishedRunId && chunkRunId === lastFinishedRunId) {
          continue;
        }

        if (!currentRun) {
          currentRun = this.createStreamState();
          this.#session.run.nextOperation();
          this.#session.run.ensureAbortController();
          this.#session.run.setRunId({ runId: subscription.activeRunId() ?? ('runId' in chunk ? chunk.runId : null) });
          this.#session.run.setTraceId({ traceId: null });
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
            const finishedRunId: string | null = chunkRunId ?? this.#session.run.getRunId();
            const suspended =
              chunk.type === 'tool-call-suspended' ||
              (streamResult ?? this.finishStreamState(currentRun)).suspended ||
              undefined;
            const aborted = chunk.type === 'abort';
            // A non-success terminal finish reason (e.g. a `claude-fable-5`
            // content-filter refusal) is surfaced as an explicit error so the
            // run never silently stops without a visible terminal state.
            let isError = chunk.type === 'error';
            if (
              currentRun.terminalError &&
              !isError &&
              !aborted &&
              !this.#session.run.isAbortRequested() &&
              !suspended
            ) {
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
      if (this.#session.stream.isCurrent({ subscription })) {
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
      if (!this.#session.thread.getId()) {
        const thread = await this.createThread();
        this.#session.thread.set({ threadId: thread.id });
      }
      const threadId = this.#session.thread.getId()!;

      const agent = this.getCurrentAgent();
      await this.ensureAgentThreadSubscription(agent, threadId);

      if (this.#session.run.getRunId() && this.#session.stream.activeRunId()) {
        const result = agent.sendSignal(signal, {
          resourceId: this.#session.identity.getResourceId(),
          threadId,
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
        resourceId: this.#session.identity.getResourceId(),
        threadId,
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
    if (!this.#session.thread.getId()) {
      const thread = await this.createThread();
      this.#session.thread.set({ threadId: thread.id });
    }
    const threadId = this.#session.thread.getId()!;

    const agent = this.getCurrentAgent();
    await this.ensureAgentThreadSubscription(agent, threadId);

    if (this.#session.run.getRunId() && this.#session.stream.activeRunId()) {
      return agent.sendNotificationSignal(input, {
        resourceId: this.#session.identity.getResourceId(),
        threadId,
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
      resourceId: this.#session.identity.getResourceId(),
      threadId,
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

    const wasActive = this.#session.stream.isActive();
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
      if (!emittedAgentEnd && !this.#session.suspensions.hasPending()) {
        this.emit({ type: 'agent_end', reason: 'complete' });
      }
    }
    return;
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
    const threadId = this.#session.thread.getId();
    if (!threadId || !this.config.storage) return null;

    const memoryStorage = await this.getMemoryStorage();
    const dbMessage = {
      id: randomUUID(),
      role,
      threadId,
      resourceId: this.#session.identity.getResourceId(),
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

  private createEmptyAssistantMessage(): HarnessMessage {
    return {
      id: this.generateId(),
      role: 'assistant',
      content: [],
      createdAt: new Date(),
    };
  }

  private hasCurrentMessageContent(state: HarnessStreamState): boolean {
    return state.currentMessage.content.length > 0 || Boolean(state.currentMessage.stopReason);
  }

  private finishCurrentMessageAndRotate(state: HarnessStreamState): void {
    if (!this.hasCurrentMessageContent(state)) return;
    this.emit({ type: 'message_end', message: state.currentMessage });
    state.lastFinishedMessage = state.currentMessage;
    state.currentMessage = this.createEmptyAssistantMessage();
    state.textContentById.clear();
    state.thinkingContentById.clear();
  }

  /**
   * Process a stream response (shared between sendMessage and tool approval).
   */
  private createStreamState(): HarnessStreamState {
    return {
      currentMessage: this.createEmptyAssistantMessage(),
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
    this.#session.run.nextOperation();
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
        this.#session.run.isAbortRequested()
      ) {
        result ??= this.finishStreamState(state);
        break;
      }
    }

    result ??= this.finishStreamState(state);

    // A non-success terminal finish reason (e.g. a `claude-fable-5`
    // content-filter refusal) is surfaced as an explicit error so the run never
    // silently stops without a visible terminal state.
    if (state.terminalError && !error && !aborted && !this.#session.run.isAbortRequested() && !result.suspended) {
      error = true;
      this.emit({ type: 'error', error: new Error(state.terminalError) });
    }

    this.emit({
      type: 'agent_end',
      reason: error
        ? 'error'
        : result.suspended
          ? 'suspended'
          : aborted || this.#session.run.isAbortRequested()
            ? 'aborted'
            : 'complete',
    });

    this.#session.run.reset();
    await this.drainFollowUpQueue();

    return result;
  }

  private async processStreamChunk(
    state: HarnessStreamState,
    chunk: any,
    requestContext: RequestContext,
  ): Promise<{ message: HarnessMessage; suspended?: boolean } | undefined> {
    if ('runId' in chunk && chunk.runId) {
      this.#session.run.setRunId({ runId: chunk.runId });
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

        const approvalPromise = this.#session.approval.arm({ toolName });
        this.emit({ type: 'tool_approval_required', toolCallId, toolName, args: toolArgs });

        const approval = await approvalPromise;
        this.#session.approval.clearToolName();

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

        const suspRunId = this.#session.run.getRunId();
        if (suspRunId) {
          this.#session.suspensions.register({
            toolCallId: suspToolCallId,
            runId: suspRunId,
            toolName: suspToolName,
          });
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
        const streamError = getErrorFromUnknown(chunk.payload.error);
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

          this.#session.addUsage(stepUsage);

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
        // In-loop goal evaluation marks a boundary between assistant attempts.
        // Close the current assistant message before rendering the judge result
        // so a continuation starts a fresh message instead of overwriting the
        // previous attempt in streaming UIs.
        this.finishCurrentMessageAndRotate(state);
        // Forward the payload so consumers (the TUI's judge display) can render
        // judge progress and the decision.
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
            threadId: payload.threadId ?? this.#session.thread.getId() ?? 'unknown',
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
    if (this.hasCurrentMessageContent(state) || !state.lastFinishedMessage) {
      this.emit({ type: 'message_end', message: state.currentMessage });
      return { message: state.currentMessage, suspended: state.isSuspended || undefined };
    }

    return { message: state.lastFinishedMessage, suspended: state.isSuspended || undefined };
  }

  // ===========================================================================
  // Control
  // ===========================================================================

  /**
   * Abort the current operation.
   */
  abort(): void {
    // session.abortRun() drops the parked tool suspensions (so a run sitting in
    // a tool suspend() like ask_user / request_access isn't left orphaned),
    // aborts the live subscription, and marks the run as aborting. The Harness
    // owns the display-state mirror of those suspensions, so clear it here too.
    const hadPendingSuspensions = this.#session.displayState.get().pendingSuspensions.size > 0;
    this.#session.displayState.clearPendingSuspensions();
    this.#session.abortRun();
    // Clearing the suspension mirror is a direct mutation, so it doesn't flow
    // through emit()'s display-state reducer. Notify subscribers explicitly when
    // we actually removed something, otherwise stale suspension UI can linger.
    if (hadPendingSuspensions) {
      this.dispatchDisplayStateChanged();
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
    this.#session.followUps.clear();
    this.emit({ type: 'follow_up_queued', count: 0 });
    await this.sendMessage({ content, requestContext });
  }

  /**
   * Queue a follow-up message to be processed after the current operation completes.
   */
  async followUp({ content, requestContext }: { content: string; requestContext?: RequestContext }): Promise<void> {
    if (this.#session.run.isRunning()) {
      this.#session.followUps.enqueue({ content, requestContext });
      this.emit({ type: 'follow_up_queued', count: this.#session.followUps.count() });
    } else {
      await this.sendMessage({ content, requestContext });
    }
  }

  /**
   * True when one or more tools are parked awaiting a resume (e.g. ask_user /
   * request_access suspensions). A suspended run nulls the AbortController, so
   * isRunning() returns false even though the run is still pending — callers that
   * need to know whether the harness is awaiting user input (e.g. to allow abort)
   * should check this too.
   */
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
    while (this.#session.stream.isActive() || this.#session.run.getRunId() !== null) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  private getSubagentDisplayName(agentType: string): string | undefined {
    return this.config.subagents?.find(subagent => subagent.id === agentType)?.name;
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
    const resolvedToolCallId = this.#session.suspensions.resolveToolCallId(toolCallId);
    if (!resolvedToolCallId) return;

    const suspension = this.#session.suspensions.get({ toolCallId: resolvedToolCallId });

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
      const err = getErrorFromUnknown(error);
      this.emit({ type: 'error', error: err });
      this.emit({ type: 'agent_end', reason: 'error' });
    }
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
    this.#session.suspensions.delete({ toolCallId });

    const currentMode = this.#session.mode.resolve();
    const transitionModeId =
      currentMode.transitionsTo ??
      this.config.defaultModeId ??
      this.config.modes.find(mode => mode.default || mode.metadata?.default === true)?.id ??
      this.config.modes[0]?.id;

    const transitionMode = this.listModes().find(mode => mode.id === transitionModeId);
    if (transitionMode && transitionMode.id !== this.#session.mode.get()) {
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
    const runId = this.#session.run.getRunId();
    if (!runId) {
      throw new Error('No active run to approve tool call for');
    }

    const agent = this.getCurrentAgent();

    const requestContext = await this.buildRequestContext(requestContextInput);
    const isYolo = (this.#session.state.get() as Record<string, unknown>).yolo === true;
    const threadId = this.#session.thread.getId();
    await agent.approveToolCall({
      runId,
      toolCallId,
      requireToolApproval: !isYolo,
      memory: threadId ? { thread: threadId, resource: this.#session.identity.getResourceId() } : undefined,
      abortSignal: this.#session.run.ensureAbortController().signal,
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
    const runId = this.#session.run.getRunId();
    if (!runId) {
      throw new Error('No active run to decline tool call for');
    }

    const agent = this.getCurrentAgent();

    const requestContext = await this.buildRequestContext(requestContextInput);
    const isYolo = (this.#session.state.get() as Record<string, unknown>).yolo === true;
    const threadId = this.#session.thread.getId();
    await agent.declineToolCall({
      runId,
      toolCallId,
      requireToolApproval: !isYolo,
      memory: threadId ? { thread: threadId, resource: this.#session.identity.getResourceId() } : undefined,
      abortSignal: this.#session.run.ensureAbortController().signal,
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
    const suspension = this.#session.suspensions.get({ toolCallId });
    if (!suspension) {
      throw new Error('No active suspension to resume');
    }

    const agent = this.getCurrentAgent();

    // Remove before resuming so a re-suspend during the resumed run can re-register
    // the same toolCallId without being clobbered by this cleanup. Drop the matching
    // display-state entry too so the UI stops rendering only the resolved prompt
    // while any other parked suspensions stay visible.
    this.#session.suspensions.delete({ toolCallId });
    this.#session.displayState.deletePendingSuspension(toolCallId);

    const requestContext = await this.buildRequestContext(requestContextInput);
    const threadId = this.#session.thread.getId();

    const output = await agent.resumeStream(resumeData, {
      // Re-supply the shared run budget (maxSteps, etc). Without it the resumed
      // run merges over the agent's small default maxSteps and stops mid-task.
      ...this.buildSharedRunOptions(),
      runId: suspension.runId,
      toolCallId,
      memory: threadId ? { thread: threadId, resource: this.#session.identity.getResourceId() } : undefined,
      abortSignal: this.#session.run.ensureAbortController().signal,
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

  private emit(event: HarnessEvent): void {
    // The Session owns the display-state reducer; fold the event into the
    // canonical snapshot before dispatching to listeners. The Harness still owns
    // the event bus (listeners) and the display_state_changed fan-out.
    this.#session.displayState.apply(event);

    this.dispatchToListeners(event);

    if (event.type !== 'display_state_changed') {
      this.dispatchDisplayStateChanged();
    }
  }

  private dispatchDisplayStateChanged(): void {
    // After every event, emit display_state_changed so UIs that prefer a single
    // subscribe-and-render pattern can do so. We dispatch directly to listeners
    // (not through emit()) to avoid infinite recursion.
    this.dispatchToListeners({
      type: 'display_state_changed',
      displayState: this.#session.displayState.get(),
    });
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
      const currentMode = this.#session.mode.resolve();
      const hasMemory = Boolean(this.config.memory);
      builtInTools.subagent = createSubagentTool({
        subagents: this.config.subagents,
        resolveModel: this.config.resolveModel,
        harnessTools: resolvedHarnessTools,
        fallbackModelId: currentMode?.defaultModelId,
        getParentModelId: () => this.#session.model.get(),
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
          ? async ({ sourceThreadId, resourceId, title, excludeToolCallId }) => {
              const memory = await this.resolveMemory();
              const cloneInput: Parameters<typeof memory.cloneThread>[0] = {
                sourceThreadId,
                resourceId: resourceId ?? this.#session.identity.getResourceId(),
                title,
                metadata: {
                  forkedSubagent: true,
                  parentThreadId: sourceThreadId,
                },
              };

              // Exclude the in-flight assistant message (the one containing the
              // current subagent tool call) so the fork doesn't see a
              // half-finished `subagent` call in its cloned history. Without this
              // the forked model mirrors the parent's incomplete tool invocation.
              if (excludeToolCallId) {
                const { messages: allMessages } = await memory.recall({ threadId: sourceThreadId, perPage: false });
                const excludedIds = new Set<string>();
                for (const msg of allMessages) {
                  const hasToolCall = msg.content.parts.some(
                    (part: Record<string, unknown>) =>
                      (part.type === 'tool-call' && part.toolCallId === excludeToolCallId) ||
                      (part.type === 'tool-result' && part.toolCallId === excludeToolCallId) ||
                      (part.type === 'tool-invocation' &&
                        (part.toolInvocation as Record<string, unknown> | undefined)?.toolCallId === excludeToolCallId),
                  );
                  if (hasToolCall) {
                    excludedIds.add(msg.id);
                  }
                }
                const includedIds = allMessages.filter(msg => !excludedIds.has(msg.id)).map(msg => msg.id);
                cloneInput.options = {
                  messageFilter: { messageIds: includedIds },
                };
              }

              const result = await memory.cloneThread(cloneInput);
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

    const result: ToolsetsInput = { harnessBuiltIn: builtInTools };
    if (resolvedHarnessTools) {
      result.harness = resolvedHarnessTools;
    }

    // When using a shared backing agent, mode-specific tool overrides are
    // delivered through toolsets (not baked into the agent) so the agent's
    // own tools (including signal-provider tools) are never lost.
    //
    // Note: both `mode.tools` and `mode.additionalTools` are added as a
    // toolset (augment).  True "replace" semantics (masking the agent's own
    // tools) would require per-run tool filtering in the Agent, which isn't
    // supported yet.  validateModes() already prevents setting both on the
    // same mode.
    if (this.config.agent) {
      const currentMode = this.#session.mode.resolve();
      const modeTools = currentMode.tools ?? currentMode.additionalTools;
      if (modeTools) {
        result.modeTools = modeTools;
      }
    }

    return result;
  }

  /**
   * Build request context for agent execution.
   * Tools can access harness state via requestContext.get('harness').
   */
  private async buildRequestContext(requestContext?: RequestContext): Promise<RequestContext> {
    requestContext ??= new RequestContext();
    const harnessContext: HarnessRequestContext<TState> = {
      harnessId: this.id,
      state: this.#session.state.get(),
      getState: () => this.#session.state.get(),
      setState: updates => this.#session.state.set(updates),
      updateState: updater => this.#session.state.update(updater),
      threadId: this.#session.thread.getId(),
      resourceId: this.#session.identity.getResourceId(),
      session: {
        modeId: this.#session.mode.get(),
        modelId: this.#session.model.get(),
        state: {
          get: () => this.#session.state.get(),
          set: updates => this.#session.state.set(updates),
          update: updater => this.#session.state.update(updater),
        },
      },
      abortSignal: this.#session.run.getAbortSignal(),
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

  private async persistTokenUsage(): Promise<void> {
    const threadId = this.#session.thread.getId();
    if (!threadId || !this.config.storage) return;

    try {
      const memoryStorage = await this.getMemoryStorage();
      const thread = await memoryStorage.getThreadById({ threadId });
      if (thread) {
        await memoryStorage.saveThread({
          thread: {
            ...thread,
            metadata: { ...thread.metadata, tokenUsage: this.#session.getTokenUsage() },
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
    await this.stopHeartbeats();
    await this.destroyWorkspace();
  }

  // ===========================================================================
  // Session
  // ===========================================================================

  async getSession(): Promise<HarnessSession> {
    return {
      currentThreadId: this.#session.thread.getId(),
      currentModeId: this.#session.mode.get(),
      threads: await this.#session.thread.list(),
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
