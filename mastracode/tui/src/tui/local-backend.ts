import type { AgentControllerEvent, PlanResume } from '@mastra/client-js';

import type { MastraTUIBackend, MastraTUIRemoteSnapshot } from './remote-backend.js';

/** Adapts the historical in-process controller/session pair to the neutral TUI backend contract. */
export function createLocalMastraTUIBackend(options: { controller: any; session: any }): MastraTUIBackend {
  const { controller, session } = options;
  const snapshot = async (): Promise<MastraTUIRemoteSnapshot> => {
    const threadId = session.thread.getId() ?? undefined;
    return {
      controllerId: controller.id,
      resourceId: session.identity.getResourceId(),
      threadId,
      modeId: session.mode.get(),
      modelId: session.model.get(),
      running: session.run.isRunning(),
      settings: session.state.get(),
      displayState: displayStateToWire(session.displayState.get()),
      messages: threadId ? await session.thread.listMessages({ threadId }) : [],
    } as MastraTUIRemoteSnapshot;
  };

  return {
    defaultResourceId: session.identity.getDefaultResourceId(),
    subagents:
      (controller as { config?: { subagents?: Array<{ id: string; name: string; description: string }> } }).config
        ?.subagents ?? [],
    capabilities: {
      chat: true,
      threads: true,
      modes: true,
      models: true,
      goals: true,
      permissions: true,
      approvals: true,
      skills: true,
      localControlPlane: true,
    },
    getSnapshot: snapshot,
    async start(callbacks) {
      const buffered: AgentControllerEvent[] = [];
      let hydrating = true;
      const unsubscribe = session.subscribe((event: AgentControllerEvent) => {
        if (hydrating) buffered.push(event);
        else callbacks.onEvent(event);
      });
      try {
        const initial = await snapshot();
        callbacks.onSnapshot(initial);
        hydrating = false;
        for (const event of buffered) callbacks.onEvent(event);
        return { snapshot: initial, unsubscribe };
      } catch (error) {
        unsubscribe();
        throw error;
      }
    },
    sendMessage: message => session.sendMessage(message),
    sendSignal: async signalInput => {
      const signal = session.sendSignal(signalInput, { requireDelivery: true });
      return { id: signal.id, ...(await signal.accepted) };
    },
    followUp: message => session.followUp({ content: message }),
    steer: message => session.steer({ content: message }),
    abort: () => session.abort(),
    approveTool: (toolCallId, approved) =>
      session.respondToToolApproval({
        toolCallId,
        decision: approved ? 'approve' : 'decline',
      }),
    respondToToolApproval: (toolCallId, decision, declineContext) =>
      session.respondToToolApproval({ toolCallId, decision, declineContext }),
    respondToToolSuspension: (toolCallId, response: string | string[] | PlanResume) =>
      session.respondToToolSuspension({ toolCallId, resumeData: response }),
    respondToPlanApproval: async () => {
      throw new Error('Embedded Mastra Code handles plan approval locally');
    },
    listModes: async () => controller.listModes().map((mode: any) => ({ id: mode.id, name: mode.name })),
    listModels: () => controller.listAvailableModels(),
    switchMode: modeId => session.mode.switch({ modeId }),
    switchModel: modelId => session.model.switch({ modelId }),
    listThreads: listOptions =>
      session.thread.list({
        allResources: listOptions?.allResources,
        ...(listOptions?.tags ? { metadata: listOptions.tags } : {}),
      }),
    createThread: title => session.thread.create({ ...(title ? { title } : {}) }),
    switchThread: threadId => session.thread.switch({ threadId }),
    detachThread: async () => {
      session.thread.detachFromCurrent();
      await session.thread.clearAndReleaseLock();
    },
    renameThread: (threadId, title) => session.thread.rename({ threadId, title }),
    cloneThread: cloneOptions => session.thread.clone(cloneOptions),
    cloneThreadToCurrentResource: cloneOptions => session.thread.cloneToCurrentResource(cloneOptions),
    deleteThread: threadId => session.thread.delete({ threadId }),
    listMessages: (threadId, limit) => session.thread.listMessages({ threadId, ...(limit ? { limit } : {}) }),
    setThreadSetting: (key, value) => session.thread.setSetting({ key, value }),
    setState: updates => session.state.set(updates),
    setOMModel: (role, modelId) => session.om[role].switchModel({ modelId }),
    setSubagentModel: (modelId, agentType) => session.subagents.model.set({ modelId, agentType }),
    setResourceId: resourceId => controller.setResourceId(session, { resourceId }),
    getResourceIds: () => controller.getKnownResourceIds(session),
    listSkills: async () => {
      const workspace = controller.getWorkspace() ?? (await controller.resolveWorkspace({ session }));
      if (!workspace?.skills) return [];
      const listed = await workspace.skills.list();
      const resolved = await Promise.all(listed.map((skill: { path: string }) => workspace.skills.get(skill.path)));
      return resolved.filter(Boolean);
    },
    addFeedback: async input => {
      const addFeedback = controller.getMastra()?.observability?.addFeedback;
      if (!addFeedback) throw new Error('Observability is not configured');
      await addFeedback(input);
    },
    getPermissions: async () => session.permissions.getRules(),
    setCategoryPermission: (category, policy) => session.permissions.setForCategory({ category, policy }),
    setToolPermission: (toolName, policy) => session.permissions.setForTool({ toolName, policy }),
    getGoal: async () => controller.getCurrentAgent(session)?.getObjective({ threadId: session.thread.getId() }),
    setGoal: (objective, goalOptions) =>
      controller.getCurrentAgent(session).setObjective(objective, {
        threadId: session.thread.getId(),
        resourceId: session.identity.getResourceId(),
        ...goalOptions,
      }),
    updateGoal: goalOptions =>
      controller.getCurrentAgent(session).updateObjectiveOptions({
        threadId: session.thread.getId(),
        ...goalOptions,
      }),
    clearGoal: () => controller.getCurrentAgent(session).clearObjective({ threadId: session.thread.getId() }),
  };
}

function displayStateToWire(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, nested instanceof Map ? Object.fromEntries(nested) : nested]),
  );
}
