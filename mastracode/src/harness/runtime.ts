import { randomUUID } from 'node:crypto';

import type {
  AvailableModel,
  HarnessDisplayState,
  HarnessEvent,
  HarnessEventListener,
  HarnessMessage,
  HarnessMode as LegacyHarnessMode,
  HarnessSession,
  TaskItemSnapshot,
  HarnessThread,
  ModelAuthStatus,
  OMProgressState,
  PermissionPolicy,
  ToolCategory,
  StoredMessageRow,
} from '@mastra/core/harness';
import { convertStoredMessageToHarnessMessage, defaultDisplayState } from '@mastra/core/harness';
import {
  Harness as HarnessV1,
  getHarnessWorkspaceActionPathInput,
  isHarnessWorkspaceFileMutationTool,
} from '@mastra/core/harness/v1';
import type {
  AttachmentRef,
  HarnessEvent as HarnessV1Event,
  HarnessEventUnsubscribe as HarnessV1EventUnsubscribe,
  HarnessMessageContentPart,
  Session,
  SessionDisplayState,
  ThreadRecord,
} from '@mastra/core/harness/v1';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { WorkspaceActionJournalEntry } from '@mastra/core/storage';

import { isSubagentToolName } from '../tool-names.js';
import {
  MASTRACODE_RUNTIME_COMPATIBILITY_GENERATION,
  MASTRACODE_HARNESS_NAME,
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
const TOOL_CATEGORIES: readonly ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];
const HARNESS_SESSION_LIFECYCLE_ERROR_NAMES = new Set([
  'HarnessSessionClosedError',
  'HarnessSessionClosingError',
  'HarnessSessionDeletedError',
]);
type MastraCodeOMEvent = Extract<
  HarnessEvent,
  {
    type:
      | 'om_status'
      | 'om_observation_start'
      | 'om_observation_end'
      | 'om_observation_failed'
      | 'om_reflection_start'
      | 'om_reflection_end'
      | 'om_reflection_failed'
      | 'om_buffering_start'
      | 'om_buffering_end'
      | 'om_buffering_failed';
  }
>;

type AgentWithBrowser = {
  setBrowser?: (browser: unknown) => void;
  hasOwnBrowser?: () => boolean;
};

type SignalInput =
  | {
      content: string | HarnessMessageContentPart[];
      ifActive?: { attributes?: SignalDeliveryAttributes };
      ifIdle?: { attributes?: SignalDeliveryAttributes };
    }
  | {
      type: string;
      contents: string | HarnessMessageContentPart[];
      attributes?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

interface SignalHandle {
  id: string;
  accepted: Promise<unknown>;
}

function normalizeMessageContent(input: SignalInput): string {
  if ('content' in input) {
    if (typeof input.content === 'string') return input.content;
    return input.content.map(part => (part.type === 'text' ? part.text : `[${part.type}]`)).join('\n');
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
  const parts: HarnessMessageContentPart[] = [{ type: 'text', text: content }];
  for (const file of files) {
    if (!file || typeof file !== 'object') continue;
    const value = file as Record<string, unknown>;
    const media =
      typeof value.mimeType === 'string'
        ? { mediaType: value.mimeType }
        : typeof value.mediaType === 'string'
          ? { mediaType: value.mediaType }
          : {};
    if (typeof value.data === 'string') {
      parts.push({ type: 'file', data: value.data, ...media });
    } else if (typeof value.url === 'string') {
      parts.push({ type: 'file', url: value.url, ...media });
    } else if (value.file !== undefined) {
      parts.push({ type: 'file', file: value.file, ...media });
    }
  }
  return parts;
}

function fileUploadData(value: Record<string, unknown>): Uint8Array | undefined {
  if (value.data instanceof Uint8Array) return value.data;
  if (value.data instanceof ArrayBuffer) return new Uint8Array(value.data);
  if (typeof value.data === 'string') return new TextEncoder().encode(value.data);
  return undefined;
}

function fileContentType(value: Record<string, unknown>): string {
  return typeof value.mimeType === 'string'
    ? value.mimeType
    : typeof value.mediaType === 'string'
      ? value.mediaType
      : 'application/octet-stream';
}

function fileName(value: Record<string, unknown>, index: number): string {
  if (typeof value.name === 'string' && value.name.length > 0) return value.name;
  if (typeof value.filename === 'string' && value.filename.length > 0) return value.filename;
  if (typeof value.path === 'string' && value.path.length > 0) return value.path.split(/[\\/]/).pop() || value.path;
  return `attachment-${index + 1}`;
}

function isHarnessSessionLifecycleError(error: unknown): boolean {
  return error instanceof Error && HARNESS_SESSION_LIFECYCLE_ERROR_NAMES.has(error.name);
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

function toSystemReminderAttributes(
  attributes?: Record<string, unknown>,
): Record<string, string | number | boolean | null | undefined> | undefined {
  if (!attributes) return undefined;
  const normalized: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    ) {
      normalized[key] = value;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function recordToMap<T>(value: unknown): Map<string, T> {
  if (value instanceof Map) return new Map(value);
  if (value && typeof value === 'object') return new Map(Object.entries(value as Record<string, T>));
  return new Map();
}

function cloneTasks(value: unknown): TaskItemSnapshot[] {
  return Array.isArray(value) ? [...(value as TaskItemSnapshot[])] : [];
}

function toHarnessMessage(message: any): HarnessMessage {
  return convertStoredMessageToHarnessMessage(message as StoredMessageRow);
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
  private sessionEventUnsubscribe?: HarnessV1EventUnsubscribe;
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly heartbeatHandlers = new Map<
    string,
    NonNullable<MastraCodeRuntimeConfig<TState>['heartbeatHandlers']>[number]
  >();
  private currentWorkspace: Awaited<ReturnType<Session['getWorkspace']>> | undefined;
  private followUpCount = 0;
  private currentRunId: string | null = null;
  private currentTraceId: string | null = null;
  private readonly omProgress: OMProgressState = defaultDisplayState().omProgress;
  private bufferingMessages = false;
  private bufferingObservations = false;
  private stateUpdateQueue: Promise<void> = Promise.resolve();
  private previousDisplayTasks: TaskItemSnapshot[] = [];
  private currentDisplayTasks: TaskItemSnapshot[] = [];
  private readonly activeToolCalls = new Map<string, { name: string; args?: unknown }>();
  private readonly modifiedFiles = new Map<string, { operations: string[]; firstModified: Date }>();
  private harnessEventUnsubscribe?: HarnessV1EventUnsubscribe;
  private browser: unknown;

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
    this.currentDisplayTasks = cloneTasks(this.state.tasks);
    const harnessV1Agents = toHarnessV1Agents(config.agents, config.modes);
    const exposedSubagents = this.shouldExposeSubagentTool() ? config.subagents : [];
    const harnessV1Subagents =
      exposedSubagents.length > 0 ? { types: toHarnessV1Subagents(exposedSubagents) } : undefined;

    this.core = new HarnessV1({
      runtimeCompatibilityGeneration: MASTRACODE_RUNTIME_COMPATIBILITY_GENERATION,
      modes: toHarnessV1Modes(config.modes, harnessV1Agents, this.defaultModeId, exposedSubagents),
      subagents: harnessV1Subagents,
      defaultModeId: this.defaultModeId,
      toolCategoryResolver: config.toolCategoryResolver,
      models: [],
      modelAuthStatusResolver: modelId => this.resolveHarnessV1AuthStatus(modelId),
      workspace: config.workspace
        ? {
            kind: 'shared' as const,
            workspace: ({ requestContext }) => config.workspace!({ requestContext, mastra: this.mastra }),
          }
        : undefined,
    });

    this.mastra = new Mastra({
      agents: harnessV1Agents,
      storage: config.storage,
      observability: config.observability,
      workers: false,
      harnesses: { [MASTRACODE_HARNESS_NAME]: this.core },
    });

    if (config.browser && typeof config.browser !== 'function') {
      this.setBrowser(config.browser);
    }

    this.projector = new MastraCodeHarnessEventProjector(
      event => this.emit(event),
      () => this.getDisplayState(),
      async (threadId, resourceId) => {
        const thread = await this.core.threads.get({ threadId, resourceId });
        return thread ? toLegacyThread(thread) : undefined;
      },
    );

    for (const handler of config.heartbeatHandlers ?? []) {
      this.registerHeartbeat(handler);
    }
  }

  getMastra(): Mastra {
    return this.mastra;
  }

  async init(): Promise<void> {
    await this.initCore();
    await this.selectOrCreateThread();
  }

  async initCore(): Promise<void> {
    await this.core.init();
    if (!this.harnessEventUnsubscribe) {
      this.harnessEventUnsubscribe = this.core.subscribe(event => {
        if (!this.isThreadLifecycleEventForCurrentResource(event)) return;
        void this.projector.project(event).catch(error => this.emitNonLifecycleError(error));
      });
    }
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
    this.currentTraceId = this.getSessionDisplayState()?.currentTraceId ?? this.currentTraceId;
    if (event.type === 'state_changed' && this.session) {
      try {
        this.applyLocalState((await this.session.getState<TState>()) as Partial<TState>, { emitLegacy: false });
      } catch (error) {
        if (!isHarnessSessionLifecycleError(error)) throw error;
      }
    }
    if (event.type === 'mode_changed') {
      this.currentModeId = event.modeId;
      await this.setThreadSetting({ key: 'currentModeId', value: event.modeId }).catch(error =>
        this.emitNonLifecycleError(error),
      );
    }
    if (event.type === 'model_changed') {
      this.applyLocalState({ currentModelId: event.modelId } as unknown as Partial<TState>, { emitLegacy: false });
    }
    if (event.type === 'task_updated') {
      this.previousDisplayTasks = [...this.currentDisplayTasks];
      this.currentDisplayTasks = cloneTasks((event as { tasks?: unknown }).tasks);
    }
    this.applyModifiedFileEvent(event);
    this.applyOMEvent(event as HarnessV1Event | MastraCodeOMEvent);
    await this.projector.project(event);
  }

  private applyModifiedFileEvent(event: HarnessV1Event): void {
    if (event.type === 'tool_start') {
      this.activeToolCalls.set(event.toolCallId, { name: event.toolName, args: event.args });
      return;
    }
    if (event.type === 'subagent_tool_start') {
      this.activeToolCalls.set(event.innerToolCallId, { name: event.toolName, args: event.args });
      return;
    }
    const endedToolCallId =
      event.type === 'tool_end' ? event.toolCallId : event.type === 'subagent_tool_end' ? event.innerToolCallId : null;
    if (!endedToolCallId) return;
    const isError = event.type === 'tool_end' || event.type === 'subagent_tool_end' ? event.isError : false;

    const tool = this.activeToolCalls.get(endedToolCallId);
    this.activeToolCalls.delete(endedToolCallId);
    if (!tool || isError || !isHarnessWorkspaceFileMutationTool(tool.name)) return;

    const filePath = getHarnessWorkspaceActionPathInput(tool.name, tool.args as Record<string, unknown>);
    if (!filePath) return;

    const existing = this.modifiedFiles.get(filePath);
    if (existing) {
      existing.operations.push(tool.name);
      void this.refreshModifiedFilesFromWorkspaceJournal();
      return;
    }
    this.modifiedFiles.set(filePath, {
      operations: [tool.name],
      firstModified: new Date(),
    });
    void this.refreshModifiedFilesFromWorkspaceJournal();
  }

  private async refreshModifiedFilesFromWorkspaceJournal(): Promise<void> {
    const session = this.session;
    if (!session) return;
    const harnessStorage = (await this.config.storage.getStore('harness')) as
      | {
          listWorkspaceActionJournalEntries?: (input: {
            harnessName?: string;
            sessionId: string;
            resourceId: string;
            threadId?: string;
            actionKind?: WorkspaceActionJournalEntry['actionKind'];
            limit: number;
          }) => Promise<WorkspaceActionJournalEntry[]>;
        }
      | undefined;
    if (!harnessStorage?.listWorkspaceActionJournalEntries) return;

    const entries = await harnessStorage.listWorkspaceActionJournalEntries({
      harnessName: MASTRACODE_HARNESS_NAME,
      sessionId: session.id,
      resourceId: this.resourceId,
      threadId: session.threadId,
      actionKind: 'file',
      limit: 500,
    });

    const next = new Map<string, { operations: string[]; firstModified: Date }>();
    for (const entry of entries) {
      this.mergeModifiedFileJournalEntry(next, entry.path, entry.operation, entry.createdAt);
      this.mergeModifiedFileJournalEntry(next, entry.toPath, entry.operation, entry.createdAt);
    }
    for (const [path, value] of next) {
      this.modifiedFiles.set(path, value);
    }
  }

  private mergeModifiedFileJournalEntry(
    target: Map<string, { operations: string[]; firstModified: Date }>,
    path: WorkspaceActionJournalEntry['path'],
    operation: string | undefined,
    createdAt: number,
  ): void {
    const filePath = path?.relativePath || path?.path;
    if (!filePath) return;
    const existing = target.get(filePath);
    if (existing) {
      if (operation) existing.operations.push(operation);
      return;
    }
    target.set(filePath, {
      operations: operation ? [operation] : [],
      firstModified: new Date(createdAt),
    });
  }

  private isThreadLifecycleEventForCurrentResource(
    event: HarnessV1Event,
  ): event is Extract<HarnessV1Event, { type: 'thread_created' | 'thread_cloned' | 'thread_renamed' }> {
    return (
      (event.type === 'thread_created' || event.type === 'thread_cloned' || event.type === 'thread_renamed') &&
      event.resourceId === this.resourceId
    );
  }

  private applyOMEvent(event: HarnessV1Event | MastraCodeOMEvent): void {
    switch (event.type) {
      case 'om_status': {
        const w = event.windows;
        this.omProgress.pendingTokens = w.active.messages.tokens;
        this.omProgress.threshold = w.active.messages.threshold;
        this.omProgress.thresholdPercent =
          w.active.messages.threshold > 0 ? (w.active.messages.tokens / w.active.messages.threshold) * 100 : 0;
        this.omProgress.observationTokens = w.active.observations.tokens;
        this.omProgress.reflectionThreshold = w.active.observations.threshold;
        this.omProgress.reflectionThresholdPercent =
          w.active.observations.threshold > 0
            ? (w.active.observations.tokens / w.active.observations.threshold) * 100
            : 0;
        this.omProgress.buffered = {
          observations: { ...w.buffered.observations },
          reflection: { ...w.buffered.reflection },
        };
        this.omProgress.generationCount = event.generationCount;
        this.omProgress.stepNumber = event.stepNumber;
        this.bufferingMessages = w.buffered.observations.status === 'running';
        this.bufferingObservations = w.buffered.reflection.status === 'running';
        break;
      }
      case 'om_observation_start':
        this.omProgress.status = 'observing';
        this.omProgress.cycleId = event.cycleId;
        this.omProgress.startTime = Date.now();
        break;
      case 'om_observation_end':
        this.omProgress.status = 'idle';
        this.omProgress.cycleId = undefined;
        this.omProgress.startTime = undefined;
        this.omProgress.observationTokens = event.observationTokens;
        this.omProgress.pendingTokens = 0;
        this.omProgress.thresholdPercent = 0;
        break;
      case 'om_observation_failed':
        this.omProgress.status = 'idle';
        this.omProgress.cycleId = undefined;
        this.omProgress.startTime = undefined;
        break;
      case 'om_reflection_start':
        this.omProgress.status = 'reflecting';
        this.omProgress.cycleId = event.cycleId;
        this.omProgress.startTime = Date.now();
        this.omProgress.preReflectionTokens = this.omProgress.observationTokens;
        this.omProgress.observationTokens = event.tokensToReflect;
        this.omProgress.reflectionThresholdPercent =
          this.omProgress.reflectionThreshold > 0
            ? (event.tokensToReflect / this.omProgress.reflectionThreshold) * 100
            : 0;
        break;
      case 'om_reflection_end':
        this.omProgress.status = 'idle';
        this.omProgress.cycleId = undefined;
        this.omProgress.startTime = undefined;
        this.omProgress.observationTokens = event.compressedTokens;
        this.omProgress.reflectionThresholdPercent =
          this.omProgress.reflectionThreshold > 0
            ? (event.compressedTokens / this.omProgress.reflectionThreshold) * 100
            : 0;
        break;
      case 'om_reflection_failed':
        this.omProgress.status = 'idle';
        this.omProgress.cycleId = undefined;
        this.omProgress.startTime = undefined;
        break;
      case 'om_buffering_start':
        if (event.operationType === 'reflection') {
          this.bufferingObservations = true;
          this.omProgress.buffered.reflection.status = 'running';
          this.omProgress.buffered.reflection.inputObservationTokens = event.tokensToBuffer;
        } else {
          this.bufferingMessages = true;
          this.omProgress.buffered.observations.status = 'running';
          this.omProgress.buffered.observations.messageTokens = event.tokensToBuffer;
        }
        break;
      case 'om_buffering_end':
        if (event.operationType === 'reflection') {
          this.bufferingObservations = false;
          this.omProgress.buffered.reflection.status = 'complete';
          this.omProgress.buffered.reflection.observationTokens = event.bufferedTokens;
        } else {
          this.bufferingMessages = false;
          this.omProgress.buffered.observations.status = 'complete';
          this.omProgress.buffered.observations.observationTokens = event.bufferedTokens;
        }
        break;
      case 'om_buffering_failed':
        if (event.operationType === 'reflection') {
          this.bufferingObservations = false;
          this.omProgress.buffered.reflection.status = 'idle';
        } else {
          this.bufferingMessages = false;
          this.omProgress.buffered.observations.status = 'idle';
        }
        break;
    }
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
    await this.applyThreadMetadata(thread.metadata, { persist: false });
    this.bindActiveSession(
      await this.core.session({
        resourceId: this.resourceId,
        threadId: thread.id,
        modeId: this.currentModeId,
        modelId: this.resolveModeModel(this.currentModeId),
      }),
    );
    await this.ensureSessionState();
    await this.syncSessionControls();
    await this.resolveWorkspace().catch(() => undefined);
    return toLegacyThread(thread);
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    const thread = await this.core.threads.create({
      resourceId: this.resourceId,
      title: title ?? 'New thread',
      metadata: this.buildThreadMetadata(),
    });
    await this.applyThreadMetadata(thread.metadata, { persist: false });
    this.bindActiveSession(
      await this.core.session({
        resourceId: this.resourceId,
        threadId: thread.id,
        modeId: this.currentModeId,
        modelId: this.resolveModeModel(this.currentModeId),
      }),
    );
    await this.ensureSessionState();
    await this.syncSessionControls();
    await this.resolveWorkspace().catch(() => undefined);
    return toLegacyThread(thread);
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    if (this.isRunning()) this.abort();
    const previousThreadId = this.session?.threadId ?? null;
    const thread = await this.core.threads.get({ resourceId: this.resourceId, threadId });
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    await this.applyThreadMetadata(thread.metadata, { persist: false });
    this.bindActiveSession(
      await this.core.session({
        resourceId: this.resourceId,
        threadId,
        modeId: this.currentModeId,
        modelId: this.resolveModeModel(this.currentModeId),
      }),
    );
    await this.ensureSessionState();
    await this.syncSessionControls();
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
    return toLegacyThread(cloned);
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
    if (this.resourceId === resourceId) return;
    this.resourceId = resourceId;
    this.clearActiveSession();
    this.currentWorkspace = undefined;
  }

  getDefaultResourceId(): string {
    return this.defaultResourceId;
  }

  async getKnownResourceIds(): Promise<string[]> {
    const ids = new Set(
      (await this.listThreads({ allResources: true, includeForkedSubagents: true })).map(thread => thread.resourceId),
    );
    ids.add(this.defaultResourceId);
    ids.add(this.resourceId);
    return [...ids].sort();
  }

  getState(): Readonly<TState> {
    return this.state;
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const nextUpdate = this.stateUpdateQueue.then(async () => {
      this.applyLocalState(updates);
      if (this.session) {
        await this.session.setState(this.state);
      }
    });
    this.stateUpdateQueue = nextUpdate.catch(error => {
      console.error('MastraCode Harness state update failed', error);
    });
    return nextUpdate;
  }

  private applyLocalState(updates: Partial<TState>, options: { emitLegacy?: boolean } = {}): void {
    this.state = { ...this.state, ...updates };
    if (Object.prototype.hasOwnProperty.call(updates, 'tasks')) {
      this.previousDisplayTasks = [...this.currentDisplayTasks];
      this.currentDisplayTasks = cloneTasks((updates as Record<string, unknown>).tasks);
    }
    if (options.emitLegacy ?? true) {
      this.emit({
        type: 'state_changed',
        state: this.state,
        changedKeys: Object.keys(updates),
      } as unknown as HarnessEvent);
    }
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
    if (!this.modes.some(mode => mode.id === modeId)) {
      throw new Error(`Mode not found: ${modeId}`);
    }
    if (this.isRunning()) this.abort();
    const currentModelId = this.getCurrentModelId();
    if (currentModelId) {
      await this.setThreadSetting({ key: `modeModelId_${this.currentModeId}`, value: currentModelId });
    }
    this.currentModeId = modeId;
    const session = this.requireSession();
    await session.switchMode({ mode: modeId });
    await this.setThreadSetting({ key: 'currentModeId', value: modeId });
    await this.switchModel({ modelId: await this.loadModeModelId(modeId), modeId });
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
      this.applyLocalState({ currentModelId: modelId } as unknown as Partial<TState>);
      await this.requireSession().models.switch({ model: modelId });
    }
    if (scope === 'thread') {
      await this.setThreadSetting({ key: `modeModelId_${targetModeId}`, value: modelId });
    }
    await Promise.resolve(this.config.modelUseCountTracker?.(modelId)).catch(error => {
      console.error('Failed to persist model usage count', error);
    });
  }

  async listAvailableModels(): Promise<AvailableModel[]> {
    const registry = PROVIDER_REGISTRY as Record<
      string,
      { models?: string[]; name?: string; apiKeyEnvVar?: string | string[] }
    >;
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

    for (const customModel of (await Promise.resolve(this.config.customModelCatalogProvider?.()).catch(() => [])) ??
      []) {
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
    return (
      this.session?.models.getSubagent({ agentType }) ??
      (this.state[`subagentModelId_${agentType}`] as string | undefined) ??
      null
    );
  }

  async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }): Promise<void> {
    const key = agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
    if (agentType) {
      await this.requireSession().models.setSubagent({ agentType, model: modelId });
    }
    await this.setState({ [key]: modelId } as unknown as Partial<TState>);
    if (!agentType) {
      await this.syncSubagentModelOverrides(this.requireSession());
    }
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
    void this.mirrorPermissionRule('categories', category, policy);
  }

  setPermissionForTool({ toolName, policy }: { toolName: string; policy: PermissionPolicy }): void {
    void this.requireSession()
      .permissions.setPolicy({ toolName, policy })
      .catch(error => this.emitError(error));
    void this.mirrorPermissionRule('tools', toolName, policy);
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

  private async mirrorPermissionRule(
    kind: 'categories' | 'tools',
    key: string,
    policy: PermissionPolicy,
  ): Promise<void> {
    const current =
      (this.state.permissionRules as
        | { categories?: Record<string, PermissionPolicy>; tools?: Record<string, PermissionPolicy> }
        | undefined) ?? {};
    await this.setState({
      permissionRules: {
        categories: { ...(current.categories ?? {}) },
        tools: { ...(current.tools ?? {}) },
        [kind]: { ...(current[kind] ?? {}), [key]: policy },
      },
    } as unknown as Partial<TState>);
  }

  getToolCategory({ toolName }: { toolName: string }): ToolCategory | null {
    return this.config.toolCategoryResolver?.(toolName) ?? null;
  }

  sendSignal(input: SignalInput): SignalHandle {
    if ('type' in input && input.type === 'system-reminder') {
      const handle: SignalHandle = { id: `signal-${randomUUID()}`, accepted: Promise.resolve() };
      handle.accepted = this.ensureSession()
        .then(session =>
          session.injectSystemReminder(normalizeMessageContent({ content: input.contents }), {
            attributes: toSystemReminderAttributes(input.attributes),
            metadata: input.metadata,
          }),
        )
        .then(result => {
          handle.id = result.id;
          return result;
        });
      return handle;
    }

    const handle: SignalHandle = { id: `signal-${randomUUID()}`, accepted: Promise.resolve() };
    handle.accepted = this.ensureSession()
      .then(session =>
        session.signal({
          content: signalContents(input) as never,
          signalId: handle.id,
          ...('content' in input && input.ifActive ? { ifActive: input.ifActive } : {}),
          ...('content' in input && input.ifIdle ? { ifIdle: input.ifIdle } : {}),
        } as never),
      )
      .then(result => {
        handle.id = result.id;
        return result;
      });
    return handle;
  }

  async sendMessage({
    content,
    files,
    admissionId,
  }: {
    content: string;
    files?: unknown[];
    admissionId?: string;
  }): Promise<void> {
    const session = await this.ensureSession();
    await this.ensureSessionState();
    await this.syncSessionControls();
    const { attachments, inlineFiles } = await this.uploadMessageAttachments(session, files);
    await session.message({
      content: messageContents(content, inlineFiles),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...((this.state as Record<string, unknown>).yolo === true ? { yolo: true } : {}),
      ...(admissionId ? { admissionId } : {}),
      ...(admissionId ? {} : { prepareStep: this.prepareActiveToolsStep }),
    } as never);
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
    const result = await this.requireSession().injectSystemReminder(normalizeMessageContent({ content: message }), {
      attributes: toSystemReminderAttributes({ type: reminderType, role }),
      metadata: {
        systemReminder: {
          type: reminderType,
          message,
          ...metadata,
        },
      },
    });
    return {
      id: result.id,
      role,
      createdAt: new Date(),
      content: [{ type: 'system_reminder', reminderType, message }],
    };
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
      .queue({
        content,
        ...((this.state as Record<string, unknown>).yolo === true ? { yolo: true } : {}),
        prepareStep: this.prepareActiveToolsStep,
      } as never)
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
    const sessionState = this.getSessionDisplayState();
    const base = defaultDisplayState();
    const pending = sessionState?.pending as
      | {
          kind?: string;
          itemId?: string;
          toolCallId?: string;
          toolName?: string;
          payload?: Record<string, unknown>;
        }
      | null
      | undefined;
    const tasks = this.currentDisplayTasks.length > 0 ? this.currentDisplayTasks : cloneTasks(this.state.tasks);
    return {
      ...base,
      ...(sessionState ?? {}),
      activeTools: recordToMap((sessionState as { activeTools?: unknown } | undefined)?.activeTools),
      toolInputBuffers: recordToMap((sessionState as { toolInputBuffers?: unknown } | undefined)?.toolInputBuffers),
      activeSubagents: recordToMap((sessionState as { activeSubagents?: unknown } | undefined)?.activeSubagents),
      modifiedFiles: this.modifiedFiles,
      pendingApproval:
        pending?.kind === 'tool-approval'
          ? {
              toolCallId: pending.toolCallId ?? pending.itemId ?? '',
              toolName: pending.toolName ?? '',
              args: pending.payload?.input,
            }
          : null,
      pendingSuspension:
        pending?.kind === 'tool-suspension'
          ? {
              toolCallId: pending.toolCallId ?? pending.itemId ?? '',
              toolName: pending.toolName ?? '',
              args: pending.payload?.input,
              suspendPayload: pending.payload,
            }
          : null,
      pendingQuestion:
        pending?.kind === 'question'
          ? {
              questionId: pending.itemId ?? pending.toolCallId ?? '',
              question:
                typeof pending.payload?.question === 'string'
                  ? pending.payload.question
                  : 'The agent needs your input.',
              options: Array.isArray(pending.payload?.options) ? (pending.payload.options as never) : undefined,
              selectionMode:
                pending.payload?.selectionMode === 'single_select' || pending.payload?.selectionMode === 'multi_select'
                  ? pending.payload.selectionMode
                  : undefined,
            }
          : null,
      pendingPlanApproval:
        pending?.kind === 'plan-approval'
          ? {
              planId: pending.itemId ?? pending.toolCallId ?? '',
              title: typeof pending.payload?.title === 'string' ? pending.payload.title : undefined,
              plan: typeof pending.payload?.plan === 'string' ? pending.payload.plan : '',
            }
          : null,
      omProgress: {
        ...base.omProgress,
        ...emptyOMProgress(),
        ...this.omProgress,
        buffered: {
          observations: { ...this.omProgress.buffered.observations },
          reflection: { ...this.omProgress.buffered.reflection },
        },
      },
      bufferingMessages: this.bufferingMessages,
      bufferingObservations: this.bufferingObservations,
      tasks,
      previousTasks: [...this.previousDisplayTasks],
      isRunning: this.isRunning(),
      currentModelId: this.getCurrentModelId(),
      currentModeId: this.currentModeId,
      currentThreadId: this.getCurrentThreadId(),
      resourceId: this.resourceId,
      state: this.state,
    } as unknown as HarnessDisplayState;
  }

  restoreDisplayTasks(tasks: TaskItemSnapshot[]): void {
    this.previousDisplayTasks = [...this.currentDisplayTasks];
    this.currentDisplayTasks = [...tasks];
    this.emit({ type: 'display_state_changed', displayState: this.getDisplayState() } as unknown as HarnessEvent);
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
        const status = [...parts]
          .reverse()
          .find((part: any) => part?.type === 'data-om-status' && part.data?.windows) as { data?: any } | undefined;
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

      const event = {
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
      } as unknown as HarnessV1Event | MastraCodeOMEvent;
      this.applyOMEvent(event);
      this.emit(event as unknown as HarnessEvent);
      this.emit({ type: 'display_state_changed', displayState: this.getDisplayState() } as unknown as HarnessEvent);
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

  respondToQuestion({ questionId, answer }: { questionId?: string; answer: unknown }): void {
    void this.requireSession()
      .respondToQuestion({ ...(questionId !== undefined ? { itemId: questionId } : {}), answer })
      .catch(error => this.emitError(error));
  }

  respondToToolApproval({
    toolCallId,
    decision,
    approved,
    reason,
  }: {
    toolCallId?: string;
    decision?: 'approve' | 'decline' | 'deny' | 'always_allow_category';
    approved?: boolean;
    reason?: string;
  }): void {
    if (decision === 'always_allow_category') {
      const pending = this.requireSession().getDisplayState().pending as { toolName?: string } | undefined;
      const category = pending?.toolName ? this.getToolCategory({ toolName: pending.toolName }) : null;
      if (category) {
        this.grantSessionCategory({ category });
      }
    }
    void this.requireSession()
      .respondToToolApproval({
        ...(toolCallId !== undefined ? { itemId: toolCallId } : {}),
        approved: approved ?? (decision === 'approve' || decision === 'always_allow_category'),
        reason,
      })
      .catch(error => this.emitError(error));
  }

  async respondToToolSuspension({
    toolCallId,
    resumeData,
  }: {
    toolCallId?: string;
    resumeData: unknown;
    requestContext?: RequestContext;
  }): Promise<void> {
    await this.requireSession().respondToToolSuspension({
      ...(toolCallId !== undefined ? { itemId: toolCallId } : {}),
      resumeData,
    });
  }

  async respondToSandboxAccess({
    questionId,
    requestId,
    approved,
    reason,
  }: {
    questionId?: string;
    requestId?: string;
    approved: boolean;
    reason?: string;
  }): Promise<void> {
    await this.requireSession().respondToSandboxAccess({
      ...((requestId ?? questionId) !== undefined ? { itemId: requestId ?? questionId } : {}),
      approved,
      reason,
    });
  }

  async respondToPlanApproval({
    planId,
    response,
    approved,
    revision,
  }: {
    planId?: string;
    response?: { action?: string; feedback?: string };
    approved?: boolean;
    revision?: string;
  }): Promise<void> {
    const accepted = approved ?? response?.action !== 'rejected';
    await this.requireSession().respondToPlanApproval({
      ...(planId !== undefined ? { itemId: planId } : {}),
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
          sessionId: this.session?.id,
          threadId: this.getCurrentThreadId(),
          resourceId: this.resourceId,
          modeId: this.currentModeId,
          state: this.state,
          getState: () => this.state,
          setState: (updates: Partial<TState>) => this.setState(updates),
          getSubagentModelId: (params?: { agentType?: string }) => this.getSubagentModelId(params),
          workspace: this.currentWorkspace,
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

  setBrowser(browser: unknown): void {
    this.browser = browser;
    for (const mode of this.modes) {
      if (typeof mode.agent === 'function') continue;
      const agent = mode.agent as AgentWithBrowser;
      if (!agent.hasOwnBrowser?.()) agent.setBrowser?.(browser);
    }
    for (const agent of Object.values(this.config.agents) as AgentWithBrowser[]) {
      if (!agent.hasOwnBrowser?.()) agent.setBrowser?.(browser);
    }
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
    this.harnessEventUnsubscribe?.();
    this.harnessEventUnsubscribe = undefined;
    this.clearActiveSession();
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

  private async ensureSession(): Promise<Session> {
    if (!this.session) {
      await this.selectOrCreateThread();
    }
    return this.requireSession();
  }

  private requireSession(): Session {
    if (!this.session) {
      throw new Error('MastraCode Harness session has not been initialized');
    }
    return this.session;
  }

  private readonly prepareActiveToolsStep = ({ tools }: { tools?: Record<string, unknown> }) => ({
    activeTools: this.filterActiveTools(Object.keys(tools ?? {})),
  });

  private filterActiveTools(toolNames: string[]): string[] {
    const disabled = new Set(this.config.disabledTools ?? []);
    return toolNames.filter(toolName => !this.isToolDisabled(toolName, disabled) && !this.isToolDenied(toolName));
  }

  private async uploadMessageAttachments(
    session: Session,
    files?: unknown[],
  ): Promise<{ attachments: AttachmentRef[]; inlineFiles: unknown[] | undefined }> {
    if (!files?.length) return { attachments: [], inlineFiles: undefined };
    const attachments: AttachmentRef[] = [];
    const inlineFiles: unknown[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file || typeof file !== 'object') continue;
      const value = file as Record<string, unknown>;
      const data = fileUploadData(value);
      if (!data) {
        inlineFiles.push(file);
        continue;
      }
      attachments.push(
        await this.core.attachments.upload({
          sessionId: session.id,
          resourceId: session.resourceId,
          data,
          filename: fileName(value, index),
          contentType: fileContentType(value),
        }),
      );
    }
    return { attachments, inlineFiles: inlineFiles.length > 0 ? inlineFiles : undefined };
  }

  private isToolDenied(toolName: string): boolean {
    const rules =
      (this.state.permissionRules as
        | { categories?: Record<string, PermissionPolicy>; tools?: Record<string, PermissionPolicy> }
        | undefined) ?? {};
    if (rules.tools?.[toolName] === 'deny') return true;
    const category = this.getToolCategory({ toolName });
    return Boolean(category && rules.categories?.[category] === 'deny');
  }

  private isToolDisabled(toolName: string, disabled = new Set(this.config.disabledTools ?? [])): boolean {
    if (isSubagentToolName(toolName)) {
      return disabled.has('subagent') || disabled.has('spawn_subagent');
    }
    return disabled.has(toolName);
  }

  private shouldExposeSubagentTool(): boolean {
    if (this.config.subagents.length === 0) return false;
    return !this.isToolDisabled('spawn_subagent');
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

  private bindActiveSession(session: Session): void {
    if (this.session === session) return;
    this.sessionEventUnsubscribe?.();
    this.session = session;
    this.sessionEventUnsubscribe = session.subscribe(event => {
      void this.handleCoreEvent(event).catch(error => {
        this.emitNonLifecycleError(error);
      });
    });
  }

  private clearActiveSession(): void {
    this.sessionEventUnsubscribe?.();
    this.sessionEventUnsubscribe = undefined;
    this.session = undefined;
  }

  private async applyThreadMetadata(
    metadata?: Record<string, unknown>,
    options: { persist?: boolean } = {},
  ): Promise<void> {
    const persist = options.persist ?? true;
    if (!metadata) {
      await this.applyModeModelFallback({ persist });
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

    for (const key of [
      'observerModelId',
      'reflectorModelId',
      'observationThreshold',
      'reflectionThreshold',
      'subagentModelId',
    ]) {
      if (metadata[key] !== undefined) updates[key] = metadata[key];
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (key.startsWith('subagentModelId_') && typeof value === 'string') {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      if (persist) {
        await this.setState(updates as Partial<TState>);
      } else {
        this.state = { ...this.state, ...(updates as Partial<TState>) };
      }
    }
  }

  private async applyModeModelFallback(options: { persist?: boolean } = {}): Promise<void> {
    const fallback = this.resolveModeModel(this.currentModeId);
    if (fallback) {
      const updates = { currentModelId: fallback } as unknown as Partial<TState>;
      if (options.persist ?? true) {
        await this.setState(updates);
      } else {
        this.state = { ...this.state, ...updates };
      }
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
    const selectedModel =
      this.getCurrentModelId() || session.models.current() || this.resolveModeModel(this.currentModeId);
    this.state = { ...this.state, currentModelId: selectedModel };
    await session.models.switch({ model: selectedModel });
    await session.setState(this.state);
  }

  private async syncSessionControls(): Promise<void> {
    const session = this.requireSession();
    await this.syncPermissionRules(session);
    await this.syncSubagentModelOverrides(session);
  }

  private async syncPermissionRules(session: Session): Promise<void> {
    const rules =
      (this.state.permissionRules as
        | { categories?: Record<string, PermissionPolicy>; tools?: Record<string, PermissionPolicy> }
        | undefined) ?? {};
    await Promise.all([
      ...Object.entries(rules.categories ?? {})
        .filter(([category]) => TOOL_CATEGORIES.includes(category as ToolCategory))
        .map(([category, policy]) => session.permissions.setPolicy({ category: category as ToolCategory, policy })),
      ...Object.entries(rules.tools ?? {}).map(([toolName, policy]) =>
        session.permissions.setPolicy({ toolName, policy }),
      ),
    ]);
  }

  private async syncSubagentModelOverrides(session: Session): Promise<void> {
    const state = this.state as Record<string, unknown>;
    const defaultModel = typeof state.subagentModelId === 'string' ? state.subagentModelId : undefined;
    await Promise.all(
      this.config.subagents.map(subagent => {
        const key = `subagentModelId_${subagent.id}`;
        const model = typeof state[key] === 'string' ? state[key] : defaultModel;
        if (!model || session.models.getSubagent({ agentType: subagent.id }) === model) {
          return Promise.resolve();
        }
        return session.models.setSubagent({ agentType: subagent.id, model });
      }),
    );
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

  private emitNonLifecycleError(error: unknown): void {
    if (isHarnessSessionLifecycleError(error)) return;
    this.emitError(error);
  }

  private getSessionDisplayState(): SessionDisplayState | undefined {
    try {
      return this.session?.getDisplayState();
    } catch (error) {
      if (isHarnessSessionLifecycleError(error)) return undefined;
      throw error;
    }
  }
}
