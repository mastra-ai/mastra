import { randomUUID } from 'node:crypto';

import type {
  AgentControllerEvent,
  AgentControllerThreadInfo,
  MastraDBMessage,
  PermissionPolicy,
  PermissionRules,
  ToolCategory,
} from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import { defaultDisplayState } from '@mastra/core/agent-controller';

import { getAssistantRenderParts } from './db-message-parts.js';
import type { AssistantRenderPart, ToolRenderPart } from './db-message-parts.js';
import type { MastraTUIBackend, MastraTUIBackendConnection, MastraTUIRemoteSnapshot } from './remote-backend.js';

type EventListener = (event: AgentControllerEvent) => void | Promise<void>;

/**
 * Controller/session compatibility objects for the existing rich MastraTUI.
 * They intentionally implement only the host-neutral surface used by the TUI;
 * local control-plane commands are capability-gated before reaching them.
 */
export function createRemoteMastraTUIRuntime(backend: MastraTUIBackend): {
  controller: any;
  session: any;
} {
  let snapshot: MastraTUIRemoteSnapshot | undefined;
  let connection: MastraTUIBackendConnection | undefined;
  const listeners = new Set<EventListener>();
  let closed = false;
  const queuedEvents: AgentControllerEvent[] = [];
  const messages = new Map<string, MastraDBMessage[]>();
  const modes = new Map<
    string,
    {
      id: string;
      name?: string;
      description?: string;
      metadata: Record<string, unknown>;
    }
  >();
  const models = new Map<
    string,
    {
      id: string;
      provider: string;
      modelName: string;
      hasApiKey: boolean;
      apiKeyEnvVar?: string;
      useCount: number;
    }
  >();
  let permissions: PermissionRules = { categories: {}, tools: {} } as PermissionRules;
  let localState: Record<string, unknown> = {};
  let displayState = defaultDisplayState();
  let resourceId = '';
  const defaultResourceId = backend.defaultResourceId;
  let currentRunId: string | undefined;
  let currentTraceId: string | undefined;
  let pendingThreadDetach: Promise<void> = Promise.resolve();
  let hasSubscribed = false;

  const notify = (event: AgentControllerEvent) => {
    if (closed) return;
    if (listeners.size > 0) for (const activeListener of listeners) void activeListener(event);
    else queuedEvents.push(event);
  };

  const applySnapshot = (next: MastraTUIRemoteSnapshot, boundary?: { bufferedEvents: AgentControllerEvent[] }) => {
    const previous = snapshot;
    const previousDisplayState = displayState;
    snapshot = next;
    resourceId = next.resourceId;
    // Session settings are server-owned. Replacement (rather than merge)
    // makes an omitted override authoritative after reconnect.
    localState = { ...(next.settings ?? {}) };
    displayState = hydrateDisplayState(next.displayState);
    currentRunId = next.runId;
    currentTraceId = next.traceId;
    if (next.threadId) messages.set(next.threadId, [...next.messages]);
    if (previous) {
      for (const event of reconcileSnapshot(
        previous,
        next,
        previousDisplayState,
        displayState,
        boundary?.bufferedEvents,
      ))
        notify(event);
      if (connection) {
        void backend
          .getPermissions()
          .then(rules => {
            permissions = rules;
          })
          .catch(error =>
            notify({
              type: 'error',
              error: asError(error),
            }),
          );
      }
    }
  };

  const applyEvent = (event: AgentControllerEvent) => {
    if (!isKnownAgentControllerEvent(event)) return;
    if (event.type === 'display_state_changed') displayState = hydrateDisplayState(event.displayState);
    if (event.type === 'agent_start') {
      displayState = { ...displayState, isRunning: true };
      currentRunId = 'runId' in event && typeof event.runId === 'string' ? event.runId : currentRunId;
      currentTraceId = 'traceId' in event && typeof event.traceId === 'string' ? event.traceId : currentTraceId;
    }
    if (event.type === 'agent_end' || event.type === 'error') displayState = { ...displayState, isRunning: false };
    if (event.type === 'tool_approval_required') {
      displayState = {
        ...displayState,
        pendingApproval: { toolCallId: event.toolCallId, toolName: event.toolName, args: event.args },
      };
    }
    if (event.type === 'tool_suspended') {
      displayState.pendingSuspensions.set(event.toolCallId, {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        suspendPayload: event.suspendPayload,
      });
    }
    if (event.type === 'tool_input_start') {
      displayState.toolInputBuffers.set(event.toolCallId, { text: '', toolName: event.toolName });
    }
    if (event.type === 'tool_input_delta') {
      const current = displayState.toolInputBuffers.get(event.toolCallId);
      displayState.toolInputBuffers.set(event.toolCallId, {
        text: `${current?.text ?? ''}${typeof event.argsTextDelta === 'string' ? event.argsTextDelta : String(event.argsTextDelta ?? '')}`,
        toolName: event.toolName ?? current?.toolName ?? '',
      });
    }
    if (event.type === 'tool_input_end') displayState.toolInputBuffers.delete(event.toolCallId);
    if (event.type === 'tool_suspension_cancelled' || event.type === 'tool_end') {
      displayState.pendingSuspensions.delete(event.toolCallId);
    }
    if (event.type === 'tool_end' && displayState.pendingApproval?.toolCallId === event.toolCallId) {
      displayState = { ...displayState, pendingApproval: null };
    }
    if (event.type === 'mode_changed') snapshot = snapshot ? { ...snapshot, modeId: event.modeId } : snapshot;
    if (event.type === 'model_changed') snapshot = snapshot ? { ...snapshot, modelId: event.modelId } : snapshot;
    if (event.type === 'thread_changed') snapshot = snapshot ? { ...snapshot, threadId: event.threadId } : snapshot;
    if (event.type === 'thread_created') {
      const threadId = (event.thread as { id: string }).id;
      snapshot = snapshot ? { ...snapshot, threadId, messages: [] } : snapshot;
      messages.set(threadId, []);
    }
    if (
      (event.type === 'message_start' || event.type === 'message_update' || event.type === 'message_end') &&
      snapshot?.threadId
    ) {
      const current = messages.get(snapshot.threadId) ?? [];
      const index = current.findIndex(message => message.id === event.message.id);
      const updated =
        index === -1
          ? [...current, event.message]
          : current.map((message, messageIndex) => (messageIndex === index ? event.message : message));
      messages.set(snapshot.threadId, updated);
      snapshot = { ...snapshot, messages: updated };
    }
  };

  const publish = (event: AgentControllerEvent) => {
    if (closed) return;
    if (event.type === 'thread_changed' && snapshot?.threadId === event.threadId) return;
    if (event.type === 'thread_created' && snapshot?.threadId === (event.thread as { id: string }).id) return;
    applyEvent(event);
    notify(event);
  };

  const refreshSnapshot = async () => {
    const next = await backend.getSnapshot();
    applySnapshot(next);
    return next;
  };

  const session = {
    identity: { getResourceId: () => resourceId, getDefaultResourceId: () => defaultResourceId },
    thread: {
      getId: () => snapshot?.threadId,
      list: async (listOptions?: { allResources?: boolean; metadata?: Record<string, string> }) =>
        (
          await backend.listThreads({
            allResources: listOptions?.allResources,
            ...(listOptions?.metadata ? { tags: listOptions.metadata } : {}),
          })
        ).map(hydrateThread),
      create: async (title?: string) => {
        await pendingThreadDetach;
        const thread = await backend.createThread(title);
        if (snapshot?.threadId !== thread.id) {
          publish({ type: 'thread_created', thread: hydrateThread(thread) } as AgentControllerEvent);
        }
        await refreshSnapshot();
        return hydrateThread(thread);
      },
      switch: async ({ threadId }: { threadId: string }) => {
        await pendingThreadDetach;
        await backend.switchThread(threadId);
        await refreshSnapshot();
      },
      listMessages: async ({ threadId, limit }: { threadId: string; limit?: number }) => {
        const result = await backend.listMessages(threadId, limit);
        messages.set(threadId, result);
        return result;
      },
      listActiveMessages: async () => {
        const threadId = snapshot?.threadId;
        if (!threadId) return [];
        const result = await backend.listMessages(threadId);
        messages.set(threadId, result);
        return result;
      },
      firstUserMessages: async ({ threadIds }: { threadIds: string[] }) => {
        const entries = await Promise.all(
          threadIds.map(async threadId => {
            const first = (await backend.listMessages(threadId)).find(message => message.role === 'user');
            return [threadId, first] as const;
          }),
        );
        return new Map(entries.filter((entry): entry is readonly [string, MastraDBMessage] => Boolean(entry[1])));
      },
      rename: async ({ threadId, title }: { threadId?: string; title: string }) => {
        const target = threadId ?? snapshot?.threadId;
        if (!target) throw new Error('No active remote thread');
        await backend.renameThread(target, title);
      },
      clone: async (options?: { sourceThreadId?: string; title?: string }) => {
        const thread = await backend.cloneThread(options);
        if (snapshot?.threadId !== thread.id) {
          publish({ type: 'thread_created', thread: hydrateThread(thread) } as AgentControllerEvent);
        }
        await refreshSnapshot();
        return hydrateThread(thread);
      },
      cloneToCurrentResource: async (options: {
        threadId: string;
        expectedResourceId: string;
        expectedProjectPath: string;
      }) => {
        await pendingThreadDetach;
        const thread = await backend.cloneThreadToCurrentResource(options);
        if (snapshot?.threadId !== thread.id) {
          publish({ type: 'thread_created', thread: hydrateThread(thread) } as AgentControllerEvent);
        }
        await refreshSnapshot();
        return hydrateThread(thread);
      },
      detachFromCurrent: () => {
        pendingThreadDetach = backend.detachThread().then(() => {
          if (snapshot) snapshot = { ...snapshot, threadId: undefined, messages: [] };
        });
        return pendingThreadDetach;
      },
      setSetting: async ({ key, value }: { key: string; value: unknown }) => {
        await backend.setThreadSetting(key, value);
        localState[key] = value;
      },
    },
    mode: {
      get: () => snapshot?.modeId ?? 'build',
      resolve: () => modes.get(snapshot?.modeId ?? '') ?? { id: snapshot?.modeId ?? 'build', metadata: {} },
      switch: async ({ modeId }: { modeId: string }) => {
        await backend.switchMode(modeId);
        if (snapshot) snapshot = { ...snapshot, modeId };
      },
    },
    model: {
      get: () => snapshot?.modelId ?? '',
      hasSelection: () => Boolean(snapshot?.modelId),
      switch: async ({ modelId }: { modelId: string }) => {
        await backend.switchModel(modelId);
        if (snapshot) snapshot = { ...snapshot, modelId };
      },
    },
    state: {
      get: () => localState,
      set: async (updates: Record<string, unknown>) => {
        await backend.setState(updates);
        localState = { ...localState, ...updates };
      },
    },
    displayState: {
      get: () => displayState,
      restoreTasks: (tasks: unknown[]) => {
        displayState = { ...displayState, tasks: tasks as never[] };
      },
      clearModifiedFiles: () => {
        displayState = { ...displayState, modifiedFiles: new Map() };
      },
    },
    stream: { isActive: () => displayState.isRunning === true },
    run: { isRunning: () => displayState.isRunning === true, getTraceId: () => currentTraceId },
    followUps: { count: () => displayState.queuedFollowUps ?? 0 },
    suspensions: { hasPending: () => displayState.pendingSuspensions.size > 0 },
    permissions: {
      getRules: () => permissions,
      setForCategory: async ({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }) => {
        await backend.setCategoryPermission(category, policy);
        permissions = { ...permissions, categories: { ...permissions.categories, [category]: policy } };
      },
      setForTool: async ({ toolName, policy }: { toolName: string; policy: PermissionPolicy }) => {
        await backend.setToolPermission(toolName, policy);
        permissions = { ...permissions, tools: { ...permissions.tools, [toolName]: policy } };
      },
    },
    subagents: {
      model: {
        get: ({ agentType }: { agentType?: string } = {}) => {
          const storedByAgent = localState.subagentModels;
          const perAgent = agentType
            ? storedByAgent && typeof storedByAgent === 'object'
              ? (storedByAgent as Record<string, unknown>)[agentType]
              : localState[`subagentModelId_${agentType}`]
            : undefined;
          if (typeof perAgent === 'string') return perAgent;
          return typeof localState.subagentModelId === 'string' ? localState.subagentModelId : null;
        },
        set: async ({ agentType, modelId }: { agentType?: string; modelId: string }) => {
          const key = agentType ? `subagentModelId_${agentType}` : 'subagentModelId';
          await backend.setSubagentModel(modelId, agentType);
          localState[key] = modelId;
          if (agentType) {
            localState.subagentModels = {
              ...(localState.subagentModels as Record<string, unknown> | undefined),
              [agentType]: modelId,
            };
          }
        },
      },
    },
    om: {
      observer: {
        modelId: () => (typeof localState.observerModelId === 'string' ? localState.observerModelId : undefined),
        threshold: () =>
          typeof localState.observationThreshold === 'number' ? localState.observationThreshold : undefined,
        switchModel: async ({ modelId }: { modelId: string }) => {
          await backend.setOMModel('observer', modelId);
          localState.observerModelId = modelId;
        },
      },
      reflector: {
        modelId: () => (typeof localState.reflectorModelId === 'string' ? localState.reflectorModelId : undefined),
        threshold: () =>
          typeof localState.reflectionThreshold === 'number' ? localState.reflectionThreshold : undefined,
        switchModel: async ({ modelId }: { modelId: string }) => {
          await backend.setOMModel('reflector', modelId);
          localState.reflectorModelId = modelId;
        },
      },
    },
    sendMessage: (message: string | { content: string; files?: Array<{ data: string; mediaType: string }> }) =>
      backend.sendMessage(message),
    sendSignal: (input: {
      content:
        | string
        | Array<
            | { type: 'text'; text: string; [key: string]: unknown }
            | { type: 'file'; data: string; mediaType: string; filename?: string; [key: string]: unknown }
          >;
      ifActive?: { attributes?: Record<string, string | number | boolean | null | undefined> };
      ifIdle?: { attributes?: Record<string, string | number | boolean | null | undefined> };
    }) => {
      const id = randomUUID();
      const accepted = backend.sendSignal({ id, ...input }).then(result => {
        if (result.runId) currentRunId = result.runId;
        return {
          accepted: result.accepted,
          ...(result.runId ? { runId: result.runId } : {}),
          ...(result.action ? { action: result.action } : {}),
        };
      });
      return { id, accepted };
    },
    abort: () => {
      void backend.abort().catch(error => {
        notify({ type: 'error', error: asError(error) });
        void refreshSnapshot().catch(snapshotError => notify({ type: 'error', error: asError(snapshotError) }));
      });
    },
    respondToToolApproval: ({
      toolCallId,
      decision,
      declineContext,
    }: {
      toolCallId?: string;
      decision: 'approve' | 'decline' | 'always_allow_category';
      declineContext?: { reason?: string; message?: string };
    }) => {
      const pendingToolCallId = toolCallId ?? displayState.pendingApproval?.toolCallId;
      if (!pendingToolCallId) throw new Error('No remote tool approval is pending');
      const pendingApproval = displayState.pendingApproval;
      return backend
        .respondToToolApproval(pendingToolCallId, decision, declineContext)
        .then(() => {
          if (displayState.pendingApproval?.toolCallId === pendingToolCallId) {
            displayState = { ...displayState, pendingApproval: null };
          }
        })
        .catch(error => {
          notify({ type: 'error', error: asError(error) });
          if (pendingApproval) notify({ type: 'tool_approval_required', ...pendingApproval });
        });
    },
    respondToToolSuspension: ({ toolCallId, resumeData }: { toolCallId: string; resumeData: any }) => {
      const pendingSuspension = displayState.pendingSuspensions.get(toolCallId);
      return backend
        .respondToToolSuspension(toolCallId, resumeData)
        .then(() => {
          displayState.pendingSuspensions.delete(toolCallId);
        })
        .catch(error => {
          notify({ type: 'error', error: asError(error) });
          if (pendingSuspension) notify({ type: 'tool_suspended', ...pendingSuspension });
        });
    },
    respondToPlanApproval: async (input: {
      toolCallId: string;
      submittedPath: string;
      action: 'approved' | 'rejected';
      feedback?: string;
    }) => {
      const resolved = await backend.respondToPlanApproval(input);
      if (input.action === 'approved') {
        localState.activePlan = { ...resolved, approvedAt: new Date().toISOString() };
      }
      return resolved;
    },
    subscribe: (nextListener: EventListener) => {
      listeners.add(nextListener);
      const initialEvents = queuedEvents.splice(0);
      if (!hasSubscribed) {
        hasSubscribed = true;
        for (const event of activeSnapshotEvents(displayState)) {
          if (!initialEvents.some(queued => sameSerialized(queued, event))) initialEvents.push(event);
        }
      }
      for (const event of initialEvents) void nextListener(event);
      return () => {
        listeners.delete(nextListener);
        if (listeners.size === 0) {
          closed = true;
          connection?.unsubscribe();
        }
      };
    },
    getCurrentRunId: () => currentRunId,
    getGrants: () => snapshot?.grants ?? { categories: [], tools: [] },
  };

  // The compatibility runtime can also wrap the local adapter. Preserve the
  // historical embedded plan path there by making the server-only operation
  // genuinely absent, which is what the prompt handler feature-detects.
  if (backend.capabilities.localControlPlane) {
    Reflect.deleteProperty(session, 'respondToPlanApproval');
  }

  const goalAgent = {
    id: 'remote-agent-controller',
    getObjective: () => backend.getGoal(),
    setObjective: (objective: string, options?: { judgeModelId?: string; maxRuns?: number }) =>
      backend.setGoal(objective, options),
    updateObjectiveOptions: (options: {
      judgeModelId?: string;
      maxRuns?: number;
      status?: 'active' | 'paused' | 'done';
      pausedReason?: string;
    }) => backend.updateGoal(options),
    clearObjective: () => backend.clearGoal(),
  };

  const remoteWorkspace = {
    skills: {
      list: () => backend.listSkills(),
      get: async (nameOrPath: string) =>
        (await backend.listSkills()).find(skill => skill.name === nameOrPath || skill.path === nameOrPath),
    },
  };

  const controller = {
    id: 'remote-agent-controller',
    config: { subagents: backend.subagents },
    init: async () => {
      if (connection) return;
      connection = await backend.start({
        onSnapshot: applySnapshot,
        onEvent: publish,
        onError: error => notify({ type: 'error', error: asError(error) }),
      });
      if (!snapshot) applySnapshot(connection.snapshot);
      const [remoteModes, remoteModels, remotePermissions] = await Promise.all([
        backend.listModes(),
        backend.listModels(),
        backend.getPermissions(),
      ]);
      for (const mode of remoteModes) modes.set(mode.id, { ...mode, metadata: mode.metadata ?? {} });
      for (const model of remoteModels) models.set(model.id, model);
      permissions = remotePermissions;
    },
    getMastra: () => ({
      startWorkers: async () => {},
      stopWorkers: async () => {},
      observability: { addFeedback: (input: any) => backend.addFeedback(input) },
    }),
    getWorkspace: () => (backend.capabilities.skills ? remoteWorkspace : undefined),
    hasWorkspace: () => backend.capabilities.skills,
    resolveWorkspace: async () => (backend.capabilities.skills ? remoteWorkspace : undefined),
    listModes: () => [...modes.values()],
    listAvailableModels: async () => [...models.values()],
    invalidateAvailableModelsCache: () => {},
    getCurrentModelAuthStatus: async () => {
      const model = models.get(snapshot?.modelId ?? '');
      return { hasAuth: model?.hasApiKey ?? true, apiKeyEnvVar: model?.apiKeyEnvVar };
    },
    loadOMProgress: async () => {},
    setResourceId: async (_session: unknown, input: { resourceId: string }) => {
      await backend.setResourceId(input.resourceId);
      resourceId = input.resourceId;
    },
    getKnownResourceIds: () => backend.getResourceIds(),
    getCurrentAgent: () => goalAgent,
  };

  return { controller, session };
}

function reconcileSnapshot(
  previous: MastraTUIRemoteSnapshot,
  next: MastraTUIRemoteSnapshot,
  previousDisplay: ReturnType<typeof defaultDisplayState>,
  nextDisplay: ReturnType<typeof defaultDisplayState>,
  boundaryEvents: AgentControllerEvent[] = [],
): AgentControllerEvent[] {
  const events: AgentControllerEvent[] = [];
  if (previous.threadId !== next.threadId && next.threadId) {
    events.push({ type: 'thread_changed', threadId: next.threadId, previousThreadId: previous.threadId ?? null });
  }
  if (previous.modeId !== next.modeId) {
    events.push({ type: 'mode_changed', modeId: next.modeId, previousModeId: previous.modeId });
  }
  if (previous.modelId !== next.modelId) events.push({ type: 'model_changed', modelId: next.modelId });

  const endedToolCallIds = new Set<string>();
  const previousMessages = new Map(previous.messages.map(message => [message.id, message]));
  for (const message of next.messages) {
    const prior = previousMessages.get(message.id);
    if (!prior) {
      events.push({ type: 'message_start', message }, { type: 'message_update', message });
      for (const event of completedToolEvents(message)) {
        endedToolCallIds.add(event.toolCallId);
        events.push(event);
      }
      events.push({ type: 'message_end', message });
    } else if (!sameSerialized(prior, message)) {
      events.push({ type: 'message_update', message });
      for (const event of completedToolEvents(message, prior)) {
        endedToolCallIds.add(event.toolCallId);
        events.push(event);
      }
      events.push({ type: 'message_end', message });
    }
  }
  const previousCurrentMessage = previousDisplay.currentMessage;
  const nextCurrentMessage = nextDisplay.currentMessage;
  if (
    nextCurrentMessage &&
    !next.messages.some(message => message.id === nextCurrentMessage.id) &&
    !sameSerialized(previousCurrentMessage, nextCurrentMessage)
  ) {
    if (!previousCurrentMessage || previousCurrentMessage.id !== nextCurrentMessage.id) {
      events.push({ type: 'message_start', message: nextCurrentMessage });
    }
    events.push({ type: 'message_update', message: nextCurrentMessage });
  }
  if (!sameSerialized(previousDisplay.tasks, nextDisplay.tasks)) {
    events.push({ type: 'task_updated', tasks: nextDisplay.tasks });
  }
  if (!previousDisplay.isRunning && nextDisplay.isRunning) events.push({ type: 'agent_start' });
  const previousApprovalId = previousDisplay.pendingApproval?.toolCallId;
  if (nextDisplay.pendingApproval && previousApprovalId !== nextDisplay.pendingApproval.toolCallId) {
    events.push({ type: 'tool_approval_required', ...nextDisplay.pendingApproval });
  }
  for (const [toolCallId, suspension] of nextDisplay.pendingSuspensions) {
    if (!previousDisplay.pendingSuspensions.has(toolCallId)) events.push({ type: 'tool_suspended', ...suspension });
  }
  for (const [toolCallId, buffer] of nextDisplay.toolInputBuffers) {
    const previousBuffer = previousDisplay.toolInputBuffers.get(toolCallId);
    if (!previousBuffer) {
      events.push(
        { type: 'tool_input_start', toolCallId, toolName: buffer.toolName },
        { type: 'tool_input_delta', toolCallId, toolName: buffer.toolName, argsTextDelta: buffer.text },
      );
    } else if (previousBuffer.text !== buffer.text) {
      if (buffer.text.startsWith(previousBuffer.text)) {
        events.push({
          type: 'tool_input_delta',
          toolCallId,
          toolName: buffer.toolName,
          argsTextDelta: buffer.text.slice(previousBuffer.text.length),
        });
      } else {
        events.push(
          { type: 'tool_input_start', toolCallId, toolName: buffer.toolName },
          { type: 'tool_input_delta', toolCallId, toolName: buffer.toolName, argsTextDelta: buffer.text },
        );
      }
    }
  }
  for (const [toolCallId] of previousDisplay.toolInputBuffers) {
    if (!nextDisplay.toolInputBuffers.has(toolCallId)) events.push({ type: 'tool_input_end', toolCallId });
  }
  for (const [toolCallId, tool] of nextDisplay.activeTools) {
    const previousTool = previousDisplay.activeTools.get(toolCallId);
    if (!previousTool) {
      events.push({ type: 'tool_start', toolCallId, toolName: tool.name, args: tool.args });
    }
    if (tool.partialResult && tool.partialResult !== previousTool?.partialResult) {
      events.push({ type: 'tool_update', toolCallId, partialResult: tool.partialResult });
    }
    if (tool.shellOutput && tool.shellOutput !== previousTool?.shellOutput) {
      const output =
        previousTool?.shellOutput && tool.shellOutput.startsWith(previousTool.shellOutput)
          ? tool.shellOutput.slice(previousTool.shellOutput.length)
          : tool.shellOutput;
      events.push({ type: 'shell_output', toolCallId, output, stream: 'stdout' });
    }
  }
  for (const [toolCallId, subagent] of nextDisplay.activeSubagents) {
    const previousSubagent = previousDisplay.activeSubagents.get(toolCallId);
    if (!previousSubagent) {
      events.push({
        type: 'subagent_start',
        toolCallId,
        agentType: subagent.agentType,
        task: subagent.task,
        modelId: subagent.modelId ?? '',
        forked: subagent.forked,
      });
    }
    const previousToolCount = previousSubagent?.toolCalls?.length ?? 0;
    for (const toolCall of (subagent.toolCalls ?? []).slice(previousToolCount)) {
      events.push(
        {
          type: 'subagent_tool_start',
          toolCallId,
          agentType: subagent.agentType,
          subToolName: toolCall.name,
          subToolArgs: undefined,
        },
        {
          type: 'subagent_tool_end',
          toolCallId,
          agentType: subagent.agentType,
          subToolName: toolCall.name,
          subToolResult: undefined,
          isError: toolCall.isError,
        },
      );
    }
    if (subagent.textDelta && subagent.textDelta !== previousSubagent?.textDelta) {
      const textDelta =
        previousSubagent?.textDelta && subagent.textDelta.startsWith(previousSubagent.textDelta)
          ? subagent.textDelta.slice(previousSubagent.textDelta.length)
          : subagent.textDelta;
      events.push({ type: 'subagent_text_delta', toolCallId, agentType: subagent.agentType, textDelta });
    }
  }
  for (const [toolCallId] of previousDisplay.activeTools) {
    if (!nextDisplay.activeTools.has(toolCallId)) {
      if (endedToolCallIds.has(toolCallId)) continue;
      endedToolCallIds.add(toolCallId);
      const completed = findCompletedTool(next.messages, toolCallId);
      events.push({
        type: 'tool_end',
        toolCallId,
        result: completed?.result,
        isError: completed?.isError ?? false,
      });
    }
  }
  if (
    previousDisplay.pendingApproval &&
    previousDisplay.pendingApproval.toolCallId !== nextDisplay.pendingApproval?.toolCallId &&
    !endedToolCallIds.has(previousDisplay.pendingApproval.toolCallId)
  ) {
    events.push({
      type: 'tool_end',
      toolCallId: previousDisplay.pendingApproval.toolCallId,
      result: undefined,
      isError: false,
    });
  }
  for (const [toolCallId, suspension] of previousDisplay.pendingSuspensions) {
    if (!nextDisplay.pendingSuspensions.has(toolCallId)) {
      events.push({
        type: 'tool_suspension_cancelled',
        toolCallId,
        toolName: suspension.toolName,
        reason: 'Remote session state no longer has this suspension',
      } as AgentControllerEvent);
    }
  }
  for (const [toolCallId, subagent] of previousDisplay.activeSubagents) {
    if (!nextDisplay.activeSubagents.has(toolCallId)) {
      events.push({
        type: 'subagent_end',
        toolCallId,
        agentType: subagent.agentType,
        result: subagent.result ?? '',
        isError: subagent.status === 'error',
        durationMs: subagent.durationMs ?? 0,
      } as AgentControllerEvent);
    }
  }
  if (previousDisplay.isRunning && !nextDisplay.isRunning) {
    const previousMessageIds = new Set(previous.messages.map(message => message.id));
    const terminalMessage = next.messages.findLast(
      message => message.role === 'assistant' && !previousMessageIds.has(message.id),
    );
    const stopReason = (terminalMessage?.content.metadata as { stopReason?: unknown } | undefined)?.stopReason;
    const reason =
      stopReason === 'error'
        ? 'error'
        : stopReason === 'aborted'
          ? 'aborted'
          : terminalMessage
            ? 'complete'
            : 'aborted';
    events.push({ type: 'agent_end', reason });
  }
  events.push({ type: 'display_state_changed', displayState: nextDisplay });
  return events.filter(event => !isRepresentedByBoundaryEvent(event, boundaryEvents));
}

function isRepresentedByBoundaryEvent(
  synthetic: AgentControllerEvent,
  boundaryEvents: AgentControllerEvent[],
): boolean {
  if (synthetic.type === 'display_state_changed') return false;
  return boundaryEvents.some(actual => {
    if (actual.type !== synthetic.type) return false;
    const actualToolCallId = 'toolCallId' in actual ? actual.toolCallId : undefined;
    const syntheticToolCallId = 'toolCallId' in synthetic ? synthetic.toolCallId : undefined;
    if (actualToolCallId !== undefined || syntheticToolCallId !== undefined) {
      return actualToolCallId === syntheticToolCallId;
    }
    if ('message' in actual && 'message' in synthetic) {
      return (actual.message as { id?: unknown })?.id === (synthetic.message as { id?: unknown })?.id;
    }
    if (actual.type === 'thread_changed' && synthetic.type === 'thread_changed') {
      return actual.threadId === synthetic.threadId;
    }
    if (actual.type === 'thread_created' && synthetic.type === 'thread_created') {
      return (actual.thread as { id?: unknown })?.id === (synthetic.thread as { id?: unknown })?.id;
    }
    if (actual.type === 'mode_changed' && synthetic.type === 'mode_changed') {
      return actual.modeId === synthetic.modeId;
    }
    if (actual.type === 'model_changed' && synthetic.type === 'model_changed') {
      return actual.modelId === synthetic.modelId;
    }
    if (actual.type === 'task_updated' && synthetic.type === 'task_updated') {
      return sameSerialized(actual.tasks, synthetic.tasks);
    }
    return true;
  });
}

function isCompletedToolPart(part: AssistantRenderPart): part is ToolRenderPart {
  return part.kind === 'tool' && part.hasResult;
}

function completedToolEvents(
  message: MastraDBMessage,
  previous?: MastraDBMessage,
): Array<Extract<AgentControllerEvent, { type: 'tool_end' }>> {
  const prior = new Map(
    (previous ? getAssistantRenderParts(previous) : [])
      .filter(isCompletedToolPart)
      .map(part => [part.toolCallId, part]),
  );
  return getAssistantRenderParts(message)
    .filter(isCompletedToolPart)
    .filter(part => !sameSerialized(prior.get(part.toolCallId), part))
    .map(part => ({
      type: 'tool_end' as const,
      toolCallId: part.toolCallId,
      result: part.result,
      isError: part.isError,
    }));
}

function findCompletedTool(messages: MastraDBMessage[], toolCallId: string) {
  for (const message of messages) {
    const tool = getAssistantRenderParts(message)
      .filter(isCompletedToolPart)
      .find(part => part.toolCallId === toolCallId);
    if (tool) return tool;
  }
  return undefined;
}

function activeSnapshotEvents(displayState: ReturnType<typeof defaultDisplayState>): AgentControllerEvent[] {
  const empty = defaultDisplayState();
  return reconcileSnapshot(
    { controllerId: '', resourceId: '', modeId: '', modelId: '', messages: [] },
    { controllerId: '', resourceId: '', modeId: '', modelId: '', messages: [] },
    empty,
    displayState,
  ).filter(event => event.type !== 'display_state_changed');
}

function sameSerialized(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function hydrateDisplayState(value: Record<string, unknown> | undefined): ReturnType<typeof defaultDisplayState> {
  const base = defaultDisplayState();
  if (!value) return base;
  return {
    ...base,
    ...value,
    activeTools: recordToMap(value.activeTools),
    toolInputBuffers: recordToMap(value.toolInputBuffers),
    pendingSuspensions: recordToMap(value.pendingSuspensions),
    activeSubagents: recordToMap(value.activeSubagents),
    modifiedFiles: recordToMap(value.modifiedFiles),
    tasks: Array.isArray(value.tasks) ? (value.tasks as never[]) : [],
    previousTasks: Array.isArray(value.previousTasks) ? (value.previousTasks as never[]) : [],
  } as ReturnType<typeof defaultDisplayState>;
}

function recordToMap(value: unknown): Map<string, any> {
  if (value instanceof Map) return new Map(value);
  return value && typeof value === 'object' ? new Map(Object.entries(value)) : new Map();
}

function hydrateThread(thread: AgentControllerThreadInfo): Omit<
  AgentControllerThreadInfo,
  'createdAt' | 'updatedAt' | 'tags'
> & {
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    ...thread,
    metadata: { ...(thread.metadata ?? {}), ...(thread.tags ?? {}) },
    createdAt: new Date(thread.createdAt ?? 0),
    updatedAt: new Date(thread.updatedAt ?? thread.createdAt ?? 0),
  };
}
