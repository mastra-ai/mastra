import type {
  AgentControllerEvent,
  AgentControllerSessionState,
  AgentControllerThreadInfo,
  MastraDBMessage,
  PermissionPolicy,
  PermissionRules,
  PlanResume,
  ToolCategory,
} from '@mastra/client-js';
import { MastraClient } from '@mastra/client-js';

export interface MastraTUIBackendCapabilities {
  readonly chat: boolean;
  readonly threads: boolean;
  readonly modes: boolean;
  readonly models: boolean;
  readonly goals: boolean;
  readonly permissions: boolean;
  readonly approvals: boolean;
  readonly skills: boolean;
  readonly localControlPlane: boolean;
}

export interface MastraTUIRemoteSnapshot extends AgentControllerSessionState {
  readonly messages: MastraDBMessage[];
}

export interface MastraTUISignalInput {
  id?: string;
  content:
    | string
    | Array<
        | { type: 'text'; text: string; [key: string]: unknown }
        | { type: 'file'; data: string; mediaType: string; filename?: string; [key: string]: unknown }
      >;
  ifActive?: { attributes?: Record<string, string | number | boolean | null | undefined> };
  ifIdle?: { attributes?: Record<string, string | number | boolean | null | undefined> };
}

export interface MastraTUISkill {
  name: string;
  path: string;
  description: string;
  instructions: string;
  source: unknown;
  references: string[];
  scripts: string[];
  assets: string[];
  license?: string;
  compatibility?: unknown;
  'user-invocable'?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MastraTUIFeedbackInput {
  traceId?: string;
  correlationContext?: { traceId?: string; runId?: string };
  feedback: {
    feedbackType: string;
    feedbackSource?: string;
    feedbackUserId?: string;
    value: number | string;
    comment?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface MastraTUIBackendConnection {
  readonly snapshot: MastraTUIRemoteSnapshot;
  unsubscribe(): void;
}

export interface MastraTUISessionBackend {
  start(callbacks: {
    onSnapshot(snapshot: MastraTUIRemoteSnapshot, boundary?: { bufferedEvents: AgentControllerEvent[] }): void;
    onEvent(event: AgentControllerEvent): void;
    onError?(error: unknown): void;
  }): Promise<MastraTUIBackendConnection>;
  getSnapshot(): Promise<MastraTUIRemoteSnapshot>;
  sendMessage(
    message: string | { content: string; files?: Array<{ data: string; mediaType: string; filename?: string }> },
  ): Promise<void>;
  sendSignal(input: MastraTUISignalInput): Promise<{ id: string; accepted: true; runId?: string; action?: string }>;
  followUp(message: string): Promise<void>;
  steer(message: string): Promise<void>;
  abort(): Promise<void>;
  approveTool(toolCallId: string, approved: boolean): Promise<void>;
  respondToToolApproval(
    toolCallId: string,
    decision: 'approve' | 'decline' | 'always_allow_category',
    declineContext?: { reason?: string; message?: string },
  ): Promise<void>;
  respondToToolSuspension(toolCallId: string, response: string | string[] | PlanResume): Promise<void>;
  respondToPlanApproval(input: {
    toolCallId: string;
    submittedPath: string;
    action: 'approved' | 'rejected';
    feedback?: string;
  }): Promise<{ title: string; plan: string }>;
  listModes(): Promise<Array<{ id: string; name?: string; description?: string; metadata?: { color?: string } }>>;
  listModels(): Promise<
    Array<{
      id: string;
      provider: string;
      modelName: string;
      hasApiKey: boolean;
      apiKeyEnvVar?: string;
      useCount: number;
    }>
  >;
  switchMode(modeId: string): Promise<void>;
  switchModel(modelId: string): Promise<void>;
  listThreads(options?: {
    allResources?: boolean;
    tags?: Record<string, string>;
  }): Promise<AgentControllerThreadInfo[]>;
  createThread(title?: string): Promise<AgentControllerThreadInfo>;
  switchThread(threadId: string): Promise<void>;
  detachThread(): Promise<void>;
  renameThread(threadId: string, title: string): Promise<void>;
  cloneThread(options?: { sourceThreadId?: string; title?: string }): Promise<AgentControllerThreadInfo>;
  cloneThreadToCurrentResource(options: {
    threadId: string;
    expectedResourceId: string;
    expectedProjectPath: string;
  }): Promise<AgentControllerThreadInfo>;
  deleteThread(threadId: string): Promise<void>;
  listMessages(threadId: string, limit?: number): Promise<MastraDBMessage[]>;
  setThreadSetting(key: string, value: unknown): Promise<void>;
  setState(updates: Record<string, unknown>): Promise<void>;
  setOMModel(role: 'observer' | 'reflector', modelId: string): Promise<void>;
  setSubagentModel(modelId: string, agentType?: string): Promise<void>;
  setResourceId(resourceId: string): Promise<void>;
  getResourceIds(): Promise<string[]>;
  listSkills(): Promise<MastraTUISkill[]>;
  addFeedback(input: MastraTUIFeedbackInput): Promise<void>;
  getPermissions(): Promise<PermissionRules>;
  setCategoryPermission(category: ToolCategory, policy: PermissionPolicy): Promise<void>;
  setToolPermission(toolName: string, policy: PermissionPolicy): Promise<void>;
  getGoal(): Promise<unknown>;
  setGoal(objective: string, options?: { judgeModelId?: string; maxRuns?: number }): Promise<unknown>;
  updateGoal(options: {
    judgeModelId?: string;
    maxRuns?: number;
    status?: 'active' | 'paused' | 'done';
    pausedReason?: string;
  }): Promise<unknown>;
  clearGoal(): Promise<void>;
}

/**
 * Transport-neutral controller backend consumed by a Mastra Code terminal.
 * The session operations are separated so hosts can retain the existing
 * controller/session ownership model while choosing a local or remote
 * transport adapter.
 */
export interface MastraTUIBackend extends MastraTUISessionBackend {
  readonly capabilities: MastraTUIBackendCapabilities;
  readonly defaultResourceId: string;
  readonly subagents: ReadonlyArray<{ id: string; name: string; description: string }>;
}

export interface RemoteMastraTUIBackendOptions {
  readonly baseUrl?: string;
  readonly client?: Pick<MastraClient, 'getAgentController' | 'createFeedback'>;
  readonly controllerId: string;
  readonly resourceId: string;
  readonly scope?: string;
  readonly tags?: Record<string, string>;
  readonly capabilities: Omit<MastraTUIBackendCapabilities, 'localControlPlane'>;
  readonly subagents: ReadonlyArray<{ id: string; name: string; description: string }>;
}

export function createRemoteMastraTUIBackend(options: RemoteMastraTUIBackendOptions): MastraTUIBackend {
  const client = options.client ?? new MastraClient({ baseUrl: options.baseUrl ?? 'http://127.0.0.1:4111' });
  const controller = client.getAgentController(options.controllerId);
  let session = controller.session(options.resourceId, options.scope);
  let rebindActiveSession: ((nextSession: typeof session) => Promise<void>) | undefined;

  const hydrate = async (): Promise<MastraTUIRemoteSnapshot> => {
    const state = await session.state();
    const messages = state.messages ?? (state.threadId ? await session.listMessages(state.threadId) : []);
    return { ...state, messages };
  };

  return {
    defaultResourceId: options.resourceId,
    subagents: options.subagents,
    capabilities: {
      ...options.capabilities,
      localControlPlane: false,
    },
    getSnapshot: hydrate,
    async start(callbacks) {
      await session.create({ tags: options.tags });
      let closed = false;
      let buffering = true;
      const buffered: AgentControllerEvent[] = [];
      const publish = (event: AgentControllerEvent) => {
        if (closed) return;
        if (buffering) buffered.push(event);
        else callbacks.onEvent(event);
      };
      let requestedHydration = 0;
      let appliedHydration = 0;
      let latestSnapshot: MastraTUIRemoteSnapshot | undefined;
      let previousSnapshotAtBoundary: MastraTUIRemoteSnapshot | undefined;
      let hydrationLoop: Promise<MastraTUIRemoteSnapshot | undefined> | undefined;
      const hydrateWithRetry = async (): Promise<MastraTUIRemoteSnapshot> => {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await hydrate();
          } catch (error) {
            lastError = error;
            callbacks.onError?.(error);
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
          }
        }
        throw lastError;
      };
      const runHydrationLoop = async (): Promise<MastraTUIRemoteSnapshot | undefined> => {
        while (!closed && appliedHydration < requestedHydration) {
          const generation = requestedHydration;
          const candidate = await hydrateWithRetry();
          if (closed) return undefined;
          // A newer stream reconnected while this request was in flight. Its
          // snapshot is authoritative, so never publish the stale candidate.
          if (generation !== requestedHydration) continue;
          previousSnapshotAtBoundary = latestSnapshot;
          latestSnapshot = candidate;
          appliedHydration = generation;
          const rawBoundaryEvents = buffered.splice(0);
          // Mode/model/thread/task events are projections of snapshot state.
          // If one raced the state read, take another snapshot before exposing
          // either value. This establishes a quiet ordered boundary without
          // guessing whether a differing buffered value is older or newer.
          if (rawBoundaryEvents.some(isSnapshotProjectionEvent)) {
            buffered.unshift(...rawBoundaryEvents.filter(event => !isSnapshotProjectionEvent(event)));
            requestedHydration++;
            continue;
          }
          const boundaryEvents = pruneSnapshotRepresentedEvents(
            rawBoundaryEvents,
            candidate,
            previousSnapshotAtBoundary,
          );
          callbacks.onSnapshot(candidate, { bufferedEvents: boundaryEvents });
          if (!closed && generation === requestedHydration) {
            buffering = false;
            for (const event of boundaryEvents) {
              callbacks.onEvent(event);
            }
          }
        }
        if (!closed && appliedHydration === requestedHydration) {
          buffering = false;
          for (const event of buffered.splice(0)) {
            callbacks.onEvent(event);
          }
        }
        return latestSnapshot;
      };
      const requestHydration = (): Promise<MastraTUIRemoteSnapshot | undefined> => {
        requestedHydration++;
        buffering = true;
        if (!hydrationLoop) {
          hydrationLoop = runHydrationLoop().finally(() => {
            hydrationLoop = undefined;
          });
        }
        return hydrationLoop;
      };
      const subscribeCurrentSession = () =>
        session.subscribe({
          onEvent: publish,
          onError: callbacks.onError,
          onReconnect: () => {
            buffering = true;
            void (async () => {
              if (latestSnapshot?.threadId && typeof session.switchThread === 'function') {
                await session.switchThread(latestSnapshot.threadId);
              }
              await requestHydration();
            })().catch(error => {
              if (!closed) {
                buffering = false;
                for (const event of buffered.splice(0)) callbacks.onEvent(event);
                callbacks.onError?.(error);
              }
            });
          },
          reconnect: true,
        });
      let subscription = await subscribeCurrentSession();
      rebindActiveSession = async nextSession => {
        buffering = true;
        subscription.unsubscribe();
        session = nextSession;
        await session.create({ tags: options.tags, threadId: latestSnapshot?.threadId });
        subscription = await subscribeCurrentSession();
        await requestHydration();
      };
      try {
        const snapshot = await requestHydration();
        if (!snapshot) throw new Error('Remote session closed during initial hydration');
        return {
          snapshot,
          unsubscribe: () => {
            closed = true;
            buffered.length = 0;
            rebindActiveSession = undefined;
            subscription.unsubscribe();
          },
        };
      } catch (error) {
        closed = true;
        rebindActiveSession = undefined;
        subscription.unsubscribe();
        throw error;
      }
    },
    sendMessage: message => session.sendMessage(message),
    sendSignal: signalInput => session.sendSignal(signalInput),
    followUp: message => session.followUp(message),
    steer: message => session.steer(message),
    abort: () => session.abort(),
    approveTool: (toolCallId, approved) => session.approveTool(toolCallId, approved),
    respondToToolApproval: (toolCallId, decision, declineContext) =>
      session.respondToToolApproval(toolCallId, decision, declineContext ? { declineContext } : undefined),
    respondToToolSuspension: (toolCallId, response) => session.respondToToolSuspension(toolCallId, response),
    respondToPlanApproval: input => session.respondToPlanApproval(input),
    listModes: () => controller.listModes(),
    listModels: () => controller.listModels(),
    switchMode: modeId => session.switchMode(modeId),
    switchModel: modelId => session.switchModel(modelId),
    listThreads: listOptions =>
      session.listThreads({
        ...(listOptions?.allResources ? { allResources: true } : {}),
        ...((listOptions?.tags ?? options.tags) ? { tags: listOptions?.tags ?? options.tags } : {}),
      }),
    createThread: title => session.createThread(title),
    switchThread: threadId => session.switchThread(threadId),
    detachThread: () => session.detachThread(),
    renameThread: (threadId, title) => session.renameThread(threadId, title),
    cloneThread: cloneOptions => session.cloneThread(cloneOptions),
    cloneThreadToCurrentResource: cloneOptions => session.cloneThreadToCurrentResource(cloneOptions),
    deleteThread: threadId => session.deleteThread(threadId),
    listMessages: (threadId, limit) => session.listMessages(threadId, limit),
    setThreadSetting: (key, value) => session.setThreadSetting(key, value),
    setState: updates => session.setState(updates),
    setOMModel: (role, modelId) => session.setOMModel(role, modelId),
    setSubagentModel: (modelId, agentType) => session.setSubagentModel(modelId, agentType),
    setResourceId: async resourceId => {
      await session.setResourceId(resourceId);
      const nextSession = controller.session(resourceId, options.scope);
      if (rebindActiveSession) await rebindActiveSession(nextSession);
      else session = nextSession;
    },
    getResourceIds: () => session.getResourceIds(),
    listSkills: () => session.listSkills(),
    addFeedback: async input => {
      await client.createFeedback({
        feedback: {
          traceId: input.traceId ?? input.correlationContext?.traceId,
          ...input.feedback,
          source: input.feedback.feedbackSource,
        },
      });
    },
    getPermissions: () => session.getPermissions(),
    setCategoryPermission: (category, policy) => session.setPermissionForCategory(category, policy),
    setToolPermission: (toolName, policy) => session.setPermissionForTool(toolName, policy),
    getGoal: () => session.getGoal(),
    setGoal: (objective, goalOptions) => session.setGoal(objective, goalOptions),
    updateGoal: goalOptions => session.updateGoal(goalOptions),
    clearGoal: () => session.clearGoal(),
  };
}

function isSnapshotProjectionEvent(event: AgentControllerEvent): boolean {
  return (
    event.type === 'mode_changed' ||
    event.type === 'model_changed' ||
    event.type === 'thread_changed' ||
    event.type === 'thread_created' ||
    event.type === 'task_updated'
  );
}

function pruneSnapshotRepresentedEvents(
  events: AgentControllerEvent[],
  snapshot: MastraTUIRemoteSnapshot | undefined,
  previousSnapshot?: MastraTUIRemoteSnapshot,
): AgentControllerEvent[] {
  if (!snapshot) return events;
  const snapshotMessages = new Map(snapshot.messages.map(message => [message.id, message]));
  const lastBufferedMessage = new Map<string, MastraDBMessage>();
  for (const event of events) {
    const message = messageEventPayload(event);
    if (message) lastBufferedMessage.set(message.id, message);
  }
  const representedIds = new Set(
    [...lastBufferedMessage]
      .filter(([id, message]) => sameSerialized(snapshotMessages.get(id), message))
      .map(([id]) => id),
  );
  const display = snapshot.displayState ?? {};
  const activeTools = asRecord(display.activeTools);
  const pendingSuspensions = asRecord(display.pendingSuspensions);
  const activeSubagents = asRecord(display.activeSubagents);
  const pendingApproval =
    display.pendingApproval && typeof display.pendingApproval === 'object'
      ? (display.pendingApproval as { toolCallId?: unknown })
      : undefined;
  const toolInputBuffers = asRecord(display.toolInputBuffers);
  const previousDisplay = previousSnapshot?.displayState ?? {};
  const previousActiveTools = asRecord(previousDisplay.activeTools);
  const previousSuspensions = asRecord(previousDisplay.pendingSuspensions);
  const previousToolInputBuffers = asRecord(previousDisplay.toolInputBuffers);
  const previousApprovalId =
    previousDisplay.pendingApproval && typeof previousDisplay.pendingApproval === 'object'
      ? (previousDisplay.pendingApproval as { toolCallId?: unknown }).toolCallId
      : undefined;
  const bufferedToolInput = new Map<string, string>();
  const bufferedShellOutput = new Map<string, string>();
  const bufferedSubagentText = new Map<string, string>();
  for (const event of events) {
    const toolCallId = 'toolCallId' in event && typeof event.toolCallId === 'string' ? event.toolCallId : undefined;
    if (!toolCallId) continue;
    if (event.type === 'tool_input_delta') {
      bufferedToolInput.set(
        toolCallId,
        `${bufferedToolInput.get(toolCallId) ?? ''}${String(event.argsTextDelta ?? '')}`,
      );
    }
    if (event.type === 'shell_output') {
      bufferedShellOutput.set(toolCallId, `${bufferedShellOutput.get(toolCallId) ?? ''}${event.output}`);
    }
    if (event.type === 'subagent_text_delta') {
      bufferedSubagentText.set(toolCallId, `${bufferedSubagentText.get(toolCallId) ?? ''}${event.textDelta}`);
    }
  }
  return events.filter(event => {
    const message = messageEventPayload(event);
    const eventToolCallId =
      'toolCallId' in event && typeof event.toolCallId === 'string' ? event.toolCallId : undefined;
    if (message && representedIds.has(message.id)) return false;
    if (event.type === 'tool_start' && eventToolCallId && eventToolCallId in activeTools) return false;
    if (event.type === 'tool_approval_required' && pendingApproval?.toolCallId === eventToolCallId) return false;
    if (event.type === 'tool_suspended' && eventToolCallId && eventToolCallId in pendingSuspensions) return false;
    if (event.type === 'subagent_start' && eventToolCallId && eventToolCallId in activeSubagents) return false;
    if (event.type === 'task_updated' && sameSerialized(display.tasks, event.tasks)) return false;
    if (event.type === 'mode_changed' && snapshot.modeId === event.modeId) return false;
    if (event.type === 'model_changed' && snapshot.modelId === event.modelId) return false;
    if (event.type === 'thread_changed' && snapshot.threadId === event.threadId) return false;
    if (event.type === 'thread_created' && snapshot.threadId === (event.thread as { id?: unknown }).id) return false;
    if (event.type === 'agent_start' && snapshot.running === true) return false;
    if (
      (event.type === 'tool_input_start' || event.type === 'tool_input_delta') &&
      eventToolCallId &&
      typeof (toolInputBuffers[eventToolCallId] as { text?: unknown } | undefined)?.text === 'string' &&
      (toolInputBuffers[eventToolCallId] as { text: string }).text.endsWith(
        bufferedToolInput.get(eventToolCallId) ?? '',
      )
    )
      return false;
    if (
      event.type === 'tool_input_end' &&
      eventToolCallId &&
      eventToolCallId in previousToolInputBuffers &&
      !(eventToolCallId in toolInputBuffers)
    )
      return false;
    if (event.type === 'tool_update' && eventToolCallId) {
      const tool = activeTools[eventToolCallId] as { partialResult?: unknown } | undefined;
      if (sameSerialized(tool?.partialResult, event.partialResult)) return false;
    }
    if (event.type === 'shell_output' && eventToolCallId) {
      const tool = activeTools[eventToolCallId] as { shellOutput?: unknown } | undefined;
      if (
        typeof tool?.shellOutput === 'string' &&
        tool.shellOutput.endsWith(bufferedShellOutput.get(eventToolCallId) ?? '')
      )
        return false;
    }
    if (event.type === 'subagent_text_delta' && eventToolCallId) {
      const subagent = activeSubagents[eventToolCallId] as { textDelta?: unknown } | undefined;
      if (
        typeof subagent?.textDelta === 'string' &&
        subagent.textDelta.endsWith(bufferedSubagentText.get(eventToolCallId) ?? '')
      )
        return false;
    }
    return true;
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function messageEventPayload(event: AgentControllerEvent): MastraDBMessage | undefined {
  if (event.type !== 'message_start' && event.type !== 'message_update' && event.type !== 'message_end')
    return undefined;
  const message = (event as { message?: unknown }).message;
  if (!message || typeof message !== 'object' || typeof (message as { id?: unknown }).id !== 'string') return undefined;
  return message as MastraDBMessage;
}

function sameSerialized(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}
