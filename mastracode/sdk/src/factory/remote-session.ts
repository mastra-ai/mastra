import { randomUUID } from 'node:crypto';

import type { AgentControllerEvent as ClientEvent } from '@mastra/client-js';
import type {
  AgentControllerDisplayState,
  AgentControllerEvent,
  AgentControllerEventListener,
  AgentControllerRequestStateUpdater,
  AgentControllerThread,
  Session,
} from '@mastra/core/agent-controller';
import { defaultDisplayState } from '@mastra/core/agent-controller';

import type { FactoryAddress } from './client.js';
import { createFactoryClient, FACTORY_CONTROLLER_ID } from './client.js';

type RemoteHandle = ReturnType<ReturnType<ReturnType<typeof createFactoryClient>['getAgentController']>['session']>;

const MAP_FIELDS = [
  'activeTools',
  'toolInputBuffers',
  'pendingSuspensions',
  'pendingApprovals',
  'activeSubagents',
  'modifiedFiles',
] as const;

/** The wire flattens the display state's Maps to objects; restore them. */
function hydrateDisplayState(wire: Record<string, unknown>): AgentControllerDisplayState {
  const state: Record<string, unknown> = { ...defaultDisplayState(), ...wire };
  for (const field of MAP_FIELDS) {
    const value = wire[field];
    state[field] = value instanceof Map ? value : new Map(Object.entries((value as object | undefined) ?? {}));
  }
  return state as unknown as AgentControllerDisplayState;
}

/** The wire flattens errors to `{ name, message }`; restore them. */
function hydrateEvent(event: ClientEvent): AgentControllerEvent {
  const out: Record<string, unknown> = { ...event };
  if (out.displayState && typeof out.displayState === 'object') {
    out.displayState = hydrateDisplayState(out.displayState as Record<string, unknown>);
  }
  const error = out.error as { name?: string; message?: string } | undefined;
  if (error && typeof error === 'object' && !(error instanceof Error)) {
    out.error = Object.assign(new Error(error.message ?? 'Remote error'), { name: error.name ?? 'Error' });
  }
  return out as unknown as AgentControllerEvent;
}

function toThread(
  thread: { id: string; title?: string; resourceId?: string; createdAt?: unknown; updatedAt?: unknown },
  resourceId: string,
): AgentControllerThread {
  const date = (value: unknown) => (value ? new Date(value as string) : new Date());
  return {
    id: thread.id,
    resourceId: thread.resourceId ?? resourceId,
    title: thread.title ?? '',
    createdAt: date(thread.createdAt),
    updatedAt: date(thread.updatedAt),
  } as AgentControllerThread;
}

/**
 * Stands in for an in-process `Session` while the agent, tools, and storage
 * run inside a Factory. Reads are served from state mirrored off the session's
 * event stream; every action is forwarded to the Factory over HTTP.
 *
 * Only the surface the TUI drives is implemented. Anything else resolves to a
 * no-op so local-only features (thread locks, grants) degrade instead of crash.
 */
export class RemoteSession {
  readonly #remote: RemoteHandle;
  readonly #resourceId: string;
  readonly #listeners = new Set<AgentControllerEventListener>();
  #unsubscribe: (() => void) | undefined;
  #threadId: string | null = null;
  #modeId = '';
  #modelId = '';
  #running = false;
  #state: Record<string, unknown> = {};
  #displayState: AgentControllerDisplayState = defaultDisplayState();

  constructor(address: FactoryAddress, resourceId: string, remote?: RemoteHandle) {
    this.#resourceId = resourceId;
    this.#remote = remote ?? createFactoryClient(address).getAgentController(FACTORY_CONTROLLER_ID).session(resourceId);
  }

  /** Create/resume the remote session, hydrate the mirror, and open the event stream. */
  async connect(): Promise<void> {
    await this.#remote.create();
    await this.#hydrate();
    const subscription = await this.#remote.subscribe({
      reconnect: true,
      onEvent: event => this.#receive(hydrateEvent(event)),
      // The server does not replay missed events; resync after a drop.
      onReconnect: () => void this.#hydrate().catch(() => {}),
    });
    this.#unsubscribe = subscription.unsubscribe;
  }

  disconnect(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  async #hydrate(): Promise<void> {
    const snapshot = await this.#remote.state();
    this.#threadId = snapshot.threadId ?? null;
    this.#modeId = snapshot.modeId;
    this.#modelId = snapshot.modelId;
    this.#running = Boolean(snapshot.running);
    if (snapshot.tasks) this.#displayState = { ...this.#displayState, tasks: snapshot.tasks };
  }

  #receive(event: AgentControllerEvent): void {
    const e = event as AgentControllerEvent & Record<string, any>;
    switch (e.type) {
      case 'mode_changed':
        this.#modeId = e.modeId;
        break;
      case 'model_changed':
        this.#modelId = e.modelId;
        break;
      case 'thread_changed':
        this.#threadId = e.threadId;
        break;
      case 'thread_created':
        this.#threadId = e.thread.id;
        break;
      case 'state_changed':
        this.#state = { ...this.#state, ...e.state };
        break;
      case 'display_state_changed':
        this.#displayState = e.displayState;
        break;
      case 'agent_start':
        this.#running = true;
        break;
      case 'agent_end':
        this.#running = false;
        break;
    }
    for (const listener of this.#listeners) {
      void Promise.resolve(listener(event)).catch(() => {});
    }
  }

  subscribe(listener: AgentControllerEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  onBeforeAgentEnd(): () => void {
    return () => {};
  }

  readonly identity = {
    getResourceId: () => this.#resourceId,
    getDefaultResourceId: () => this.#resourceId,
    getId: () => this.#resourceId,
    getOwnerId: () => this.#resourceId,
    setResourceId: () => {},
  };

  readonly thread = (() => {
    const remote = () => this.#remote;
    const resourceId = this.#resourceId;
    return {
      getId: () => this.#threadId,
      isSet: () => this.#threadId !== null,
      requireId: () => {
        if (!this.#threadId) throw new Error('No active thread');
        return this.#threadId;
      },
      ensureId: async () => {
        if (!this.#threadId) await this.thread.create();
        return this.#threadId!;
      },
      list: async () => (await remote().listThreads()).map(t => toThread(t, resourceId)),
      getById: async ({ threadId }: { threadId: string }) =>
        (await this.thread.list()).find(t => t.id === threadId) ?? null,
      create: async ({ title }: { title?: string } = {}) => {
        const created = await remote().createThread(title);
        const thread = toThread(created as any, resourceId);
        this.#threadId = thread.id;
        return thread;
      },
      switch: async ({ threadId }: { threadId: string }) => {
        await remote().switchThread(threadId);
        this.#threadId = threadId;
      },
      clone: async ({ sourceThreadId, title }: { sourceThreadId?: string; title?: string } = {}) => {
        const created = await remote().cloneThread({ sourceThreadId, title });
        const thread = toThread(created as any, resourceId);
        this.#threadId = thread.id;
        return thread;
      },
      rename: async ({ title }: { title: string }) => {
        if (this.#threadId) await remote().renameThread(this.#threadId, title);
      },
      delete: async ({ threadId }: { threadId: string }) => {
        await remote().deleteThread(threadId);
        if (this.#threadId === threadId) this.#threadId = null;
      },
      listMessages: ({ threadId, limit }: { threadId: string; limit?: number }) =>
        remote().listMessages(threadId, limit),
      listActiveMessages: async ({ limit }: { limit?: number } = {}) =>
        this.#threadId ? remote().listMessages(this.#threadId, limit) : [],
      firstUserMessage: async () => null,
      firstUserMessages: async () => new Map(),
      // Thread settings live in the Factory; local overrides are not persisted.
      getSetting: async () => undefined,
      getSettingOn: async () => undefined,
      setSetting: async () => {},
      setSettingOn: async () => {},
      deleteSetting: async () => {},
      cleanupSubscription: () => {},
      detachFromCurrent: () => {},
      clear: () => {
        this.#threadId = null;
      },
      clearAndReleaseLock: async () => {},
      cloneToCurrentResource: async ({ sourceThreadId }: { sourceThreadId: string }) =>
        this.thread.clone({ sourceThreadId }),
      loadMetadata: async () => {},
    };
  })();

  readonly mode = {
    get: () => this.#modeId,
    hasSelection: () => Boolean(this.#modeId),
    resolve: () => ({ id: this.#modeId, name: this.#modeId }),
    set: ({ modeId }: { modeId: string }) => {
      this.#modeId = modeId;
    },
    switch: async ({ modeId }: { modeId: string }) => {
      await this.#remote.switchMode(modeId);
      this.#modeId = modeId;
    },
  };

  readonly model = {
    get: () => this.#modelId,
    hasSelection: () => Boolean(this.#modelId),
    displayName: () => this.#modelId,
    set: ({ modelId }: { modelId: string }) => {
      this.#modelId = modelId;
    },
    switch: async (modelId: string, options: { thinkingLevel?: any } = {}) => {
      await this.#remote.switchModel(modelId, options);
      this.#modelId = modelId;
    },
    syncFromPersisted: async () => {},
  };

  readonly state = {
    get: () => this.#state,
    set: async (updates: Record<string, unknown>) => {
      this.#state = { ...this.#state, ...updates };
      await this.#remote.setState(updates);
    },
    setIf: async (updates: Record<string, unknown>, shouldApply: () => boolean) => {
      if (!shouldApply()) return false;
      await this.state.set(updates);
      return true;
    },
    update: async <TResult>(updater: AgentControllerRequestStateUpdater<any, TResult>): Promise<TResult> => {
      const { updates, result } = await updater(this.#state);
      if (updates) await this.state.set(updates);
      return result;
    },
  };

  readonly displayState = {
    get: () => this.#displayState,
    clearModifiedFiles: () => {
      this.#displayState = { ...this.#displayState, modifiedFiles: new Map() };
    },
    restoreTasks: () => {},
    clearPendingSuspensions: () => {},
    deletePendingSuspension: () => {},
    clearPendingApprovals: () => {},
    resetThread: () => {},
    apply: () => {},
  };

  readonly run = {
    isRunning: () => this.#running,
    getRunId: () => null,
    getTraceId: () => null,
  };

  readonly stream = { isActive: () => this.#running, isOpen: () => this.#running };

  readonly suspensions = {
    hasPending: () => this.#displayState.pendingSuspensions.size > 0,
    get: ({ toolCallId }: { toolCallId: string }) => this.#displayState.pendingSuspensions.get(toolCallId),
    has: ({ toolCallId }: { toolCallId: string }) => this.#displayState.pendingSuspensions.has(toolCallId),
    delete: () => {},
  };

  readonly permissions = {
    getRules: () => ({ categories: {}, tools: {} }),
    setForCategory: ({ category, policy }: { category: any; policy: any }) =>
      this.#remote.setPermissionForCategory(category, policy),
    setForTool: ({ toolName, policy }: { toolName: string; policy: any }) =>
      this.#remote.setPermissionForTool(toolName, policy),
  };

  getCurrentRunId(): string | null {
    return null;
  }

  getTags(): Record<string, string> {
    return {};
  }

  getTokenUsage() {
    return this.#displayState.tokenUsage;
  }

  getGrants() {
    return { categories: [], tools: [] };
  }

  async sendMessage({
    content,
    files,
  }: {
    content: string;
    files?: Array<{ data: string; mediaType: string; filename?: string }>;
  }) {
    await this.#remote.sendMessage({ content, files });
  }

  async queueMessage({ content }: { content: string }) {
    await this.#remote.followUp(content);
  }

  sendSignal(input: Parameters<Session['sendSignal']>[0]) {
    const content: unknown = 'content' in input ? input.content : undefined;
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map(part => (typeof part === 'string' ? part : ((part as { text?: string })?.text ?? ''))).join('')
          : JSON.stringify(content);
    const sent = this.#running ? this.#remote.followUp(text) : this.#remote.sendMessage(text);
    const accepted = sent.then(() => ({ accepted: true as const }));
    accepted.catch(() => {});
    return { id: randomUUID(), type: 'user' as const, accepted, persisted: sent };
  }

  async steer({ content }: { content: string }) {
    await this.#remote.steer(content);
  }

  async followUp({ content }: { content: string }) {
    await this.#remote.followUp(content);
  }

  respondToToolApproval({
    decision,
    toolCallId,
  }: {
    decision: 'approve' | 'decline' | 'always_allow_category';
    toolCallId: string;
  }) {
    void this.#remote.approveTool(toolCallId, decision !== 'decline').catch(() => {});
    return { accepted: true as const };
  }

  async respondToToolSuspension({ resumeData, toolCallId }: { resumeData: unknown; toolCallId?: string }) {
    const id = toolCallId ?? this.#displayState.pendingSuspensions.keys().next().value;
    if (!id) return;
    await this.#remote.respondToToolSuspension(
      id,
      resumeData as Parameters<RemoteHandle['respondToToolSuspension']>[1],
    );
  }

  claimToolResponse(): boolean {
    return true;
  }

  releaseToolResponse(): void {}

  abort(): void {
    void this.#remote.abort().catch(() => {});
  }

  abortRun(): void {
    this.abort();
  }
}
