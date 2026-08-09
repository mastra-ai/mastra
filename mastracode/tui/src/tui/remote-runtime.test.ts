import { describe, expect, it, vi } from 'vitest';

import { MastraTUI } from './mastra-tui.js';
import { createRemoteMastraTUIRuntime } from './remote-runtime.js';

function backendFixture() {
  let callbacks:
    | {
        onSnapshot(value: any, boundary?: { bufferedEvents: any[] }): void;
        onEvent(value: any): void;
      }
    | undefined;
  const snapshot = {
    controllerId: 'mastra-code',
    resourceId: 'project',
    threadId: 'thread-1',
    modeId: 'build',
    modelId: 'model-1',
    runId: 'run-snapshot',
    traceId: 'trace-snapshot',
    grants: { categories: ['edit'], tools: ['write_file'] },
    messages: [],
    displayState: { isRunning: false, activeTools: {}, pendingSuspensions: {} },
  };
  const backend = {
    defaultResourceId: 'project',
    subagents: [
      { id: 'cortex', name: 'Cortex', description: 'Implementation' },
      { id: 'flux', name: 'Flux', description: 'Discovery' },
      { id: 'zen', name: 'Zen', description: 'Knowledge' },
    ],
    capabilities: {
      chat: true,
      threads: true,
      modes: true,
      models: true,
      goals: true,
      permissions: true,
      approvals: true,
      skills: true,
      localControlPlane: false,
    },
    start: vi.fn(async (nextCallbacks: typeof callbacks) => {
      callbacks = nextCallbacks;
      nextCallbacks!.onSnapshot(snapshot);
      return { snapshot, unsubscribe: vi.fn() };
    }),
    getSnapshot: vi.fn(async () => snapshot),
    listModes: vi.fn(async () => [{ id: 'build', name: 'Build' }]),
    listModels: vi.fn(async () => [
      {
        id: 'model-1',
        provider: 'test',
        modelName: 'model-1',
        hasApiKey: true,
        apiKeyEnvVar: 'TEST_API_KEY',
        useCount: 2,
      },
    ]),
    getPermissions: vi.fn(async () => ({ categories: {}, tools: {} })),
    listThreads: vi.fn(async () => [
      {
        id: 'thread-1',
        title: 'Existing thread',
        resourceId: 'project',
        tags: { projectPath: '/repo' },
        metadata: { clone: { sourceThreadId: 'parent' }, activeModelPack: 'quality' },
        createdAt: '2026-08-08T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
      },
    ]),
    sendMessage: vi.fn(async () => {}),
    sendSignal: vi.fn(async (input: { id: string }) => ({
      id: input.id,
      accepted: true as const,
      action: 'interjected',
      runId: 'run-signal',
    })),
    respondToToolApproval: vi.fn(async () => {}),
    respondToToolSuspension: vi.fn(async () => {}),
    respondToPlanApproval: vi.fn(async () => ({ title: 'Plan', plan: 'Do it' })),
    setCategoryPermission: vi.fn(async () => {}),
    setToolPermission: vi.fn(async () => {}),
    setResourceId: vi.fn(async () => {}),
    getResourceIds: vi.fn(async () => ['project', 'resource-2']),
    listSkills: vi.fn(async () => [
      {
        name: 'verify',
        path: '/repo/.agents/skills/verify',
        description: 'Verify work',
        instructions: 'Run checks.',
        source: { type: 'local' },
        references: [],
        scripts: [],
        assets: [],
        metadata: { goal: true },
      },
    ]),
    addFeedback: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    setState: vi.fn(async () => {}),
    setThreadSetting: vi.fn(async () => {}),
    detachThread: vi.fn(async () => {}),
    createThread: vi.fn(async () => ({
      id: 'thread-2',
      resourceId: 'project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    cloneThreadToCurrentResource: vi.fn(async () => ({
      id: 'thread-clone',
      resourceId: 'project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    setSubagentModel: vi.fn(async () => {}),
    setOMModel: vi.fn(async () => {}),
    steer: vi.fn(async () => {}),
  };
  return {
    backend,
    emit: (event: any) => callbacks?.onEvent(event),
    hydrate: (value: any, bufferedEvents: any[] = []) => callbacks?.onSnapshot(value, { bufferedEvents }),
  };
}

describe('createRemoteMastraTUIRuntime', () => {
  it.each(['aborted', 'error'] as const)(
    'uses persisted assistant terminal metadata when a disconnected run ends as %s',
    async reason => {
      const { backend, hydrate } = backendFixture();
      const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
      await controller.init();
      hydrate({
        ...(await backend.getSnapshot()),
        displayState: { isRunning: true, activeTools: {} },
      });
      const events: any[] = [];
      session.subscribe((event: any) => events.push(event));
      events.length = 0;

      hydrate({
        ...(await backend.getSnapshot()),
        messages: [
          {
            id: `terminal-${reason}`,
            role: 'assistant',
            content: { format: 2, parts: [], metadata: { stopReason: reason } },
          },
        ],
        displayState: { isRunning: false, activeTools: {} },
      });

      expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason }]);
    },
  );

  it('lets buffered terminal payloads override lossy snapshot transitions', async () => {
    const { backend, hydrate, emit } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    hydrate({
      ...(await backend.getSnapshot()),
      displayState: {
        isRunning: true,
        activeTools: { 'tool-1': { name: 'view', args: {}, status: 'running' } },
      },
    });
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));
    events.length = 0;
    const terminalEvents = [
      { type: 'tool_end', toolCallId: 'tool-1', result: { error: 'denied' }, isError: true },
      { type: 'agent_end', reason: 'error', error: 'model failed' },
    ];

    hydrate(
      {
        ...(await backend.getSnapshot()),
        displayState: { isRunning: false, activeTools: {} },
      },
      terminalEvents,
    );
    for (const event of terminalEvents) emit(event);

    expect(events.filter(event => event.type === 'tool_end')).toEqual([terminalEvents[0]]);
    expect(events.filter(event => event.type === 'agent_end')).toEqual([terminalEvents[1]]);
  });

  it('hydrates the rich TUI session facade and forwards live events and messages', async () => {
    const { backend, emit } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));

    emit({ type: 'agent_start', runId: 'run-1' });
    const signal = session.sendSignal({
      content: [
        { type: 'text', text: 'inspect this image' },
        { type: 'file', data: 'aW1hZ2U=', mediaType: 'image/png', filename: 'screen.png' },
      ],
      ifActive: { attributes: { source: 'tui' } },
    });
    await signal.accepted;

    expect(session.thread.getId()).toBe('thread-1');
    expect(session.mode.get()).toBe('build');
    expect(session.model.get()).toBe('model-1');
    expect(session.run.isRunning()).toBe(true);
    expect(session.getCurrentRunId()).toBe('run-signal');
    expect(session.run.getTraceId()).toBe('trace-snapshot');
    expect(session.getGrants()).toEqual({ categories: ['edit'], tools: ['write_file'] });
    expect(backend.sendSignal).toHaveBeenCalledWith({
      id: signal.id,
      content: [
        { type: 'text', text: 'inspect this image' },
        { type: 'file', data: 'aW1hZ2U=', mediaType: 'image/png', filename: 'screen.png' },
      ],
      ifActive: { attributes: { source: 'tui' } },
    });
    expect(backend.steer).not.toHaveBeenCalled();
    expect(events.map(event => event.type)).toContain('agent_start');
    const [thread] = await session.thread.list();
    expect(thread.metadata).toEqual({
      clone: { sourceThreadId: 'parent' },
      activeModelPack: 'quality',
      projectPath: '/repo',
    });
    expect(thread.updatedAt).toBeInstanceOf(Date);
  });

  it('emits one thread_created event when HTTP hydration beats delayed SSE', async () => {
    const { backend, emit } = backendFixture();
    const initial = await backend.getSnapshot();
    backend.getSnapshot.mockResolvedValue({ ...initial, threadId: 'thread-2', messages: [] });
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));

    await session.thread.create('Next');
    emit({
      type: 'thread_created',
      thread: {
        id: 'thread-2',
        resourceId: 'project',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(events.filter(event => event.type === 'thread_created')).toHaveLength(1);
    expect(events.filter(event => event.type === 'thread_changed')).toHaveLength(0);
  });

  it('hydrates an in-progress assistant message from the initial snapshot', async () => {
    const { backend } = backendFixture();
    const initial = await backend.getSnapshot();
    initial.displayState.currentMessage = {
      id: 'partial-1',
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text: 'still streaming' }] },
    };
    initial.displayState.isRunning = true;
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));

    expect(events.map(event => event.type)).toEqual(expect.arrayContaining(['message_start', 'message_update']));
    expect(events.find(event => event.type === 'message_update')?.message.id).toBe('partial-1');
  });

  it('hydrates the complete buffered tool-input prefix from the initial snapshot', async () => {
    const { backend } = backendFixture();
    const initial = await backend.getSnapshot();
    initial.displayState.toolInputBuffers = {
      'tool-input-1': { text: '{"path":"src/pa', toolName: 'view' },
    };
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));

    expect(events.filter(event => event.type.startsWith('tool_input_'))).toEqual([
      { type: 'tool_input_start', toolCallId: 'tool-input-1', toolName: 'view' },
      {
        type: 'tool_input_delta',
        toolCallId: 'tool-input-1',
        toolName: 'view',
        argsTextDelta: '{"path":"src/pa',
      },
    ]);
  });

  it('does not replay a live completed message after reconnect hydration', async () => {
    const { backend, emit, hydrate } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));
    const message = {
      id: 'live-1',
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts: [{ type: 'text', text: 'done' }] },
    };
    emit({ type: 'message_start', message });
    emit({ type: 'message_update', message });
    emit({ type: 'message_end', message });
    events.length = 0;

    const next = await backend.getSnapshot();
    hydrate({ ...next, messages: [message] });

    expect(events.filter(event => event.type.startsWith('message_'))).toEqual([]);
  });

  it('commits remote session state only after the server accepts it', async () => {
    const { backend } = backendFixture();
    backend.setState.mockRejectedValueOnce(new Error('state unavailable'));
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    await expect(session.state.set({ yolo: true })).rejects.toThrow('state unavailable');

    expect(session.state.get().yolo).not.toBe(true);
  });

  it('commits a remote thread setting only after the server accepts it', async () => {
    const { backend } = backendFixture();
    backend.setThreadSetting.mockRejectedValueOnce(new Error('thread setting unavailable'));
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    await expect(session.thread.setSetting({ key: 'escapeAsCancel', value: true })).rejects.toThrow(
      'thread setting unavailable',
    );

    expect(session.state.get().escapeAsCancel).not.toBe(true);
  });

  it('preserves the rich TUI approval, permission, resource, and thread call shapes', async () => {
    const { backend, emit } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    emit({ type: 'tool_approval_required', toolCallId: 'call-7', toolName: 'write_file', args: { path: 'x' } });
    await session.respondToToolApproval({ decision: 'always_allow_category' });
    await session.permissions.setForCategory({ category: 'edit', policy: 'allow' });
    await session.permissions.setForTool({ toolName: 'write_file', policy: 'deny' });
    await controller.setResourceId(session, { resourceId: 'resource-2' });
    const knownResources = await controller.getKnownResourceIds(session);
    await session.thread.list({ allResources: true, metadata: { projectPath: '/repo' } });
    await session.thread.cloneToCurrentResource({
      threadId: 'old-thread',
      expectedResourceId: 'old-resource',
      expectedProjectPath: '/repo',
    });
    await session.thread.setSetting({ key: 'projectPath', value: '/repo/nested' });

    expect(backend.respondToToolApproval).toHaveBeenCalledWith('call-7', 'always_allow_category', undefined);
    expect(backend.setCategoryPermission).toHaveBeenCalledWith('edit', 'allow');
    expect(backend.setToolPermission).toHaveBeenCalledWith('write_file', 'deny');
    expect(backend.setResourceId).toHaveBeenCalledWith('resource-2');
    expect(session.identity.getDefaultResourceId()).toBe('project');
    expect(knownResources).toEqual(['project', 'resource-2']);
    expect(backend.listThreads).toHaveBeenLastCalledWith({ allResources: true, tags: { projectPath: '/repo' } });
    expect(backend.cloneThreadToCurrentResource).toHaveBeenCalledWith({
      threadId: 'old-thread',
      expectedResourceId: 'old-resource',
      expectedProjectPath: '/repo',
    });
    expect(backend.setThreadSetting).toHaveBeenCalledWith('projectPath', '/repo/nested');
  });

  it('restores approval and suspension prompts when a remote response fails', async () => {
    const { backend, emit } = backendFixture();
    backend.respondToToolApproval.mockRejectedValueOnce(new Error('approval unavailable'));
    backend.respondToToolSuspension.mockRejectedValueOnce(new Error('resume unavailable'));
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));

    emit({ type: 'tool_approval_required', toolCallId: 'approval-1', toolName: 'write_file', args: {} });
    emit({
      type: 'tool_suspended',
      toolCallId: 'suspension-1',
      toolName: 'ask_user',
      args: {},
      suspendPayload: {},
    });
    await session.respondToToolApproval({ decision: 'approve' });
    await session.respondToToolSuspension({ toolCallId: 'suspension-1', resumeData: 'yes' });

    expect(events.filter(event => event.type === 'tool_approval_required')).toHaveLength(2);
    expect(events.filter(event => event.type === 'tool_suspended')).toHaveLength(2);
    expect(events.filter(event => event.type === 'error').map(event => event.error.message)).toEqual([
      'approval unavailable',
      'resume unavailable',
    ]);

    await session.respondToToolApproval({ decision: 'approve' });
    expect(backend.respondToToolApproval).toHaveBeenCalledTimes(2);
  });

  it('clears a pending approval when another client completes the matching tool', async () => {
    const { backend, emit } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    emit({ type: 'tool_approval_required', toolCallId: 'approval-remote', toolName: 'write_file', args: {} });
    expect(session.displayState.get().pendingApproval?.toolCallId).toBe('approval-remote');

    emit({ type: 'tool_end', toolCallId: 'approval-remote', toolName: 'write_file', result: 'done', isError: false });

    expect(session.displayState.get().pendingApproval).toBeNull();
  });

  it('delegates plan approval and archival to the server-owned backend', async () => {
    const { backend } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    await session.respondToPlanApproval({
      toolCallId: 'plan-1',
      submittedPath: '.mastracode/plans/change.md',
      action: 'approved',
    });

    expect(backend.respondToPlanApproval).toHaveBeenCalledWith({
      toolCallId: 'plan-1',
      submittedPath: '.mastracode/plans/change.md',
      action: 'approved',
    });
    expect(session.state.get().activePlan).toMatchObject({ title: 'Plan', plan: 'Do it' });
  });

  it('detaches without creating an orphan and creates exactly once for the next prompt', async () => {
    const { backend } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    await session.thread.detachFromCurrent();
    expect(session.thread.getId()).toBeUndefined();
    expect(backend.createThread).not.toHaveBeenCalled();
    await session.thread.create('Next');

    expect(backend.detachThread).toHaveBeenCalledOnce();
    expect(backend.createThread).toHaveBeenCalledOnce();
  });

  it('persists remote OM and subagent model selection through the server backend', async () => {
    const { backend } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    await session.om.observer.switchModel({ modelId: 'openai/observer' });
    await session.subagents.model.set({ agentType: 'cortex', modelId: 'openai/subagent' });

    expect(session.om.observer.modelId()).toBe('openai/observer');
    expect(session.subagents.model.get({ agentType: 'cortex' })).toBe('openai/subagent');
    expect(backend.setOMModel).toHaveBeenCalledWith('observer', 'openai/observer');
    expect(backend.setSubagentModel).toHaveBeenCalledWith('openai/subagent', 'cortex');
    expect(controller.config.subagents.map((subagent: { id: string }) => subagent.id)).toEqual([
      'cortex',
      'flux',
      'zen',
    ]);
  });

  it('routes rich TUI feedback through the remote observability API', async () => {
    const { backend } = backendFixture();
    const { controller } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const input = {
      traceId: 'trace-snapshot',
      feedback: { feedbackType: 'thumbs', feedbackSource: 'mastracode', value: 1 },
    };

    await controller.getMastra().observability.addFeedback(input);

    expect(backend.addFeedback).toHaveBeenCalledWith(input);
    await expect(controller.getMastra().startWorkers()).resolves.toBeUndefined();
  });

  it('exposes server-mounted skills through the rich TUI workspace facade', async () => {
    const { backend } = backendFixture();
    const { controller } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();

    const workspace = await controller.resolveWorkspace({});
    expect((await workspace.skills.list()).map((skill: { name: string }) => skill.name)).toEqual(['verify']);
    expect(await workspace.skills.get('verify')).toMatchObject({ instructions: 'Run checks.' });
    expect(await workspace.skills.get('/repo/.agents/skills/verify')).toMatchObject({ name: 'verify' });
  });

  it('hydrates completed tool output from a snapshot and resolves the pending tool component', async () => {
    const { backend, hydrate } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));
    const message = {
      id: 'assistant-tool',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'tool-1',
              toolName: 'read_file',
              args: { path: 'README.md' },
              state: 'result',
              result: 'contents',
              isError: false,
            },
          },
        ],
      },
    };

    hydrate({
      controllerId: 'mastra-code',
      resourceId: 'project',
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'model-1',
      messages: [message],
      displayState: { isRunning: false, activeTools: {}, pendingSuspensions: {} },
    });

    expect(events.map(event => event.type)).toEqual([
      'message_start',
      'message_update',
      'tool_end',
      'message_end',
      'display_state_changed',
    ]);
    expect(events.find(event => event.type === 'tool_end')).toMatchObject({
      toolCallId: 'tool-1',
      result: 'contents',
      isError: false,
    });
  });

  it('owns failed remote abort promises and surfaces the error without an unhandled rejection', async () => {
    const { backend } = backendFixture();
    backend.abort.mockRejectedValueOnce(new Error('abort unavailable'));
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));

    expect(session.abort()).toBeUndefined();
    await vi.waitFor(() => expect(events.some(event => event.type === 'error')).toBe(true));

    expect(events.find(event => event.type === 'error').error.message).toBe('abort unavailable');
    expect(backend.getSnapshot).toHaveBeenCalled();
  });

  it('lets the existing full-screen MastraTUI accept a remote backend directly', () => {
    const { backend } = backendFixture();
    expect(() => new MastraTUI({ backend: backend as never })).not.toThrow();
  });

  it('keeps embedded plan approval on the local compatibility path', () => {
    const { backend } = backendFixture();
    backend.capabilities.localControlPlane = true;
    const { session } = createRemoteMastraTUIRuntime(backend as never);

    expect(session.respondToPlanApproval).toBeUndefined();
  });

  it('keeps the main event stream alive when a temporary prompt subscriber leaves', async () => {
    const { backend, emit } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const mainEvents: string[] = [];
    const promptEvents: string[] = [];
    session.subscribe((event: any) => mainEvents.push(event.type));
    const unsubscribePrompt = session.subscribe((event: any) => promptEvents.push(event.type));

    emit({ type: 'tool_suspended', toolCallId: 'call-1', toolName: 'ask_user', args: {}, suspendPayload: {} });
    unsubscribePrompt();
    emit({ type: 'agent_end', reason: 'completed' });

    expect(mainEvents).toEqual(['tool_suspended', 'agent_end']);
    expect(promptEvents).toEqual(['tool_suspended']);
  });

  it('does not duplicate active prompts reconciled before the first rich listener subscribes', async () => {
    const { backend, hydrate } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    hydrate({
      controllerId: 'mastra-code',
      resourceId: 'project',
      threadId: 'thread-1',
      messages: [],
      displayState: {
        pendingApproval: { toolCallId: 'approval-1', toolName: 'write_file', args: {} },
        pendingSuspensions: {},
        activeTools: {},
        activeSubagents: {},
      },
    });
    const events: any[] = [];

    session.subscribe((event: any) => events.push(event));

    expect(events.filter(event => event.type === 'tool_approval_required')).toHaveLength(1);
  });

  it('reconciles messages, tasks, approvals, cleared settings, and permissions from a reconnect snapshot', async () => {
    const { backend, hydrate } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));
    await session.om.observer.switchModel({ modelId: 'stale-observer' });
    backend.getPermissions.mockResolvedValueOnce({ categories: { edit: 'deny' }, tools: { write_file: 'allow' } });

    hydrate({
      controllerId: 'mastra-code',
      resourceId: 'project',
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'model-1',
      messages: [{ id: 'message-after-reconnect', role: 'assistant', content: { format: 2, parts: [] } }],
      settings: {},
      displayState: {
        isRunning: false,
        activeTools: {},
        activeSubagents: {},
        pendingSuspensions: {},
        pendingApproval: { toolCallId: 'approval-2', toolName: 'write_file', args: { path: 'x' } },
        tasks: [{ id: 'task-1', content: 'Reconnect', status: 'in_progress' }],
      },
    });

    await vi.waitFor(() =>
      expect(session.permissions.getRules()).toEqual({
        categories: { edit: 'deny' },
        tools: { write_file: 'allow' },
      }),
    );
    expect(session.om.observer.modelId()).toBeUndefined();
    expect(events.map(event => event.type)).toEqual(
      expect.arrayContaining(['message_end', 'task_updated', 'tool_approval_required', 'display_state_changed']),
    );
    expect(events.find(event => event.type === 'message_end')?.message.id).toBe('message-after-reconnect');
    expect(events.filter(event => event.message?.id === 'message-after-reconnect').map(event => event.type)).toEqual([
      'message_start',
      'message_update',
      'message_end',
    ]);
  });

  it('surfaces remote hydration errors to rich TUI subscribers', async () => {
    const { backend } = backendFixture();
    let callbacks: any;
    backend.start.mockImplementationOnce(async (nextCallbacks: any) => {
      callbacks = nextCallbacks;
      nextCallbacks.onSnapshot({
        controllerId: 'mastra-code',
        resourceId: 'project',
        threadId: 'thread-1',
        messages: [],
        displayState: {},
      });
      return {
        snapshot: {
          controllerId: 'mastra-code',
          resourceId: 'project',
          threadId: 'thread-1',
          messages: [],
          displayState: {},
        },
        unsubscribe: vi.fn(),
      };
    });
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));

    callbacks.onError(new Error('snapshot retry failed'));

    expect(events).toContainEqual(expect.objectContaining({ type: 'error', error: expect.any(Error) }));
  });

  it('reconciles terminal removals when a run completes while the stream is disconnected', async () => {
    const { backend, hydrate } = backendFixture();
    const { controller, session } = createRemoteMastraTUIRuntime(backend as never);
    await controller.init();
    const events: any[] = [];
    session.subscribe((event: any) => events.push(event));
    hydrate({
      controllerId: 'mastra-code',
      resourceId: 'project',
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'model-1',
      messages: [],
      displayState: {
        isRunning: true,
        activeTools: { 'tool-1': { name: 'read_file', args: { path: 'x' }, status: 'running' } },
        activeSubagents: {
          'sub-1': {
            agentType: 'cortex',
            task: 'implement',
            modelId: 'model-1',
            toolCalls: [],
            textDelta: '',
            status: 'running',
          },
        },
        pendingApproval: { toolCallId: 'approval-1', toolName: 'write_file', args: { path: 'x' } },
        pendingSuspensions: {
          'suspend-1': { toolCallId: 'suspend-1', toolName: 'ask_user', args: {}, suspendPayload: {} },
        },
      },
    });
    events.length = 0;

    hydrate({
      controllerId: 'mastra-code',
      resourceId: 'project',
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'model-1',
      messages: [],
      displayState: {
        isRunning: false,
        activeTools: {},
        activeSubagents: {},
        pendingApproval: null,
        pendingSuspensions: {},
        tasks: [],
      },
    });

    expect(events.map(event => event.type)).toEqual(
      expect.arrayContaining(['agent_end', 'tool_end', 'subagent_end', 'tool_suspension_cancelled']),
    );
    expect(events.find(event => event.type === 'tool_end')).toMatchObject({ toolCallId: 'tool-1' });
    expect(events.find(event => event.type === 'tool_end' && event.toolCallId === 'approval-1')).toBeDefined();
  });
});
