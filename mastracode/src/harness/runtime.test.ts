import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { MASTRACODE_HARNESS_NAME } from './config.js';
import { MastraCodeHarnessRuntime } from './runtime.js';

function createRuntime(
  options: {
    storage?: InMemoryStore;
    projectPath?: string;
    modes?: any[];
    agents?: Record<string, Agent>;
    subagents?: any[];
    initialState?: Record<string, unknown>;
    resolveModel?: (modelId: string) => unknown;
    browser?: unknown;
    disabledTools?: string[];
    memory?: any;
  } = {},
) {
  const agent = new Agent({
    id: 'code-agent',
    name: 'Code Agent',
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
  return new MastraCodeHarnessRuntime({
    resourceId: 'resource-one',
    storage: options.storage ?? new InMemoryStore({ id: `mc-runtime-test-${Date.now()}-${Math.random()}` }),
    agents: options.agents ?? { 'code-agent': agent },
    modes:
      options.modes ??
      ([
        {
          id: 'build',
          name: 'Build',
          color: 'green',
          default: true,
          defaultModelId: 'anthropic/claude-haiku-4-5',
          agent,
        },
        {
          id: 'plan',
          name: 'Plan',
          color: 'blue',
          defaultModelId: 'openai/gpt-4o-mini',
          agent,
        },
      ] as any),
    subagents: options.subagents ?? [],
    initialState: {
      projectPath: options.projectPath ?? '/tmp/mastracode-runtime-test',
      currentModelId: 'anthropic/claude-haiku-4-5',
      ...options.initialState,
    },
    resolveModel: options.resolveModel,
    memory: options.memory,
    browser: options.browser as never,
    disabledTools: options.disabledTools,
  });
}

describe('MastraCodeHarnessRuntime', () => {
  it('rejects empty mode configuration instead of inventing a default mode id', () => {
    expect(() => createRuntime({ modes: [] })).toThrow('No MastraCode harness modes configured');
  });

  it('registers the Harness v1 runtime on the returned Mastra instance', () => {
    const runtime = createRuntime();

    expect(runtime.getMastra().getHarness(MASTRACODE_HARNESS_NAME)).toBe(runtime.core);
  });

  it('propagates configured memory to custom mode agents without their own memory', () => {
    const customAgent = new Agent({
      id: 'custom-agent',
      name: 'Custom Agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini' as any,
    });

    expect(customAgent.hasOwnMemory()).toBe(false);
    createRuntime({
      agents: {},
      modes: [
        {
          id: 'custom',
          name: 'Custom',
          color: 'purple',
          default: true,
          defaultModelId: 'openai/gpt-4o-mini',
          agent: customAgent,
        },
      ] as any,
      memory: {} as any,
    });

    expect(customAgent.hasOwnMemory()).toBe(true);
  });

  it('creates a fresh startup thread when the matching project thread is held by a stale foreign lease', async () => {
    const storage = new InMemoryStore({ id: `mc-runtime-lease-test-${Date.now()}-${Math.random()}` });
    const first = createRuntime({ storage });
    await first.init();
    const lockedSession = (first as any).session;

    const restarted = createRuntime({ storage });
    await restarted.init();
    const restartedSession = (restarted as any).session;

    expect(restartedSession.id).not.toBe(lockedSession.id);
    expect(restartedSession.threadId).not.toBe(lockedSession.threadId);
    expect(restarted.getCurrentThreadId()).toBe(restartedSession.threadId);

    await first.destroy();
    await restarted.destroy();
  });

  it('restores Harness v1 thread metadata into MastraCode runtime state', async () => {
    const runtime = createRuntime();
    await runtime.init();
    const first = await runtime.createThread({ title: 'first' });

    await runtime.switchMode({ modeId: 'plan' });
    await runtime.switchModel({ modelId: 'openai/gpt-5.4-mini' });
    await runtime.switchObserverModel({ modelId: 'google/gemini-2.5-flash' });
    await runtime.switchReflectorModel({ modelId: 'anthropic/claude-haiku-4-5' });
    await runtime.setSubagentModelId({ modelId: 'openai/gpt-5.4-mini' });

    await runtime.createThread({ title: 'second' });
    await runtime.switchMode({ modeId: 'build' });
    await runtime.switchModel({ modelId: 'anthropic/claude-opus-4-6' });

    await runtime.switchThread({ threadId: first.id });

    expect(runtime.getCurrentModeId()).toBe('plan');
    expect(runtime.getCurrentModelId()).toBe('openai/gpt-5.4-mini');
    expect(runtime.getObserverModelId()).toBe('google/gemini-2.5-flash');
    expect(runtime.getReflectorModelId()).toBe('anthropic/claude-haiku-4-5');
    expect(runtime.getSubagentModelId()).toBe('openai/gpt-5.4-mini');

    await runtime.destroy();
  });

  it('does not write target thread metadata into the previously active session while switching threads', async () => {
    const runtime = createRuntime();
    await runtime.init();
    const firstThreadId = runtime.getCurrentThreadId();
    if (!firstThreadId) throw new Error('expected initial thread');
    await runtime.setState({ currentModelId: 'openai/gpt-5.4-mini' });

    await runtime.createThread({ title: 'second' });
    const secondSession = (runtime as any).session;
    await runtime.setState({ currentModelId: 'anthropic/claude-haiku-4-5' });

    await runtime.switchThread({ threadId: firstThreadId });

    await expect(secondSession.getState()).resolves.toMatchObject({
      currentModelId: 'anthropic/claude-haiku-4-5',
    });
    await runtime.destroy();
  });

  it('does not project events from non-active child sessions as top-level MastraCode events', async () => {
    const runtime = createRuntime();
    await runtime.init();
    const parent = (runtime as any).session;
    const child = await runtime.core.session({
      resourceId: runtime.getResourceId(),
      threadId: { fresh: true },
      parentSessionId: parent.id,
      origin: 'subagent-tool',
      modeId: runtime.getCurrentModeId(),
      modelId: runtime.getCurrentModelId(),
    });
    const listener = vi.fn();
    runtime.subscribe(listener);

    child._emit({ type: 'message_start', messageId: 'child-message' } as any);

    expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'message_start' }));
    await runtime.destroy();
  });

  it('lists threads and known resource ids across resources', async () => {
    const runtime = createRuntime();
    await runtime.init();
    await runtime.createThread({ title: 'one' });
    runtime.setResourceId({ resourceId: 'resource-two' });
    await runtime.createThread({ title: 'two' });

    const resourceIds = await runtime.getKnownResourceIds();
    const threads = await runtime.listThreads({ allResources: true });

    expect(resourceIds).toEqual(['resource-one', 'resource-two']);
    expect(threads.map(thread => thread.resourceId).sort()).toContain('resource-one');
    expect(threads.map(thread => thread.resourceId).sort()).toContain('resource-two');

    await runtime.destroy();
  });

  it('routes user signals and system reminders through Harness v1 session APIs', async () => {
    const runtime = createRuntime();
    const signal = vi.fn(async () => ({ id: 'sig-user', accepted: true }));
    const injectSystemReminder = vi.fn(async () => ({ id: 'sig-reminder', accepted: true }));
    (runtime as any).session = { signal, injectSystemReminder };

    const acceptedUser = await runtime.sendSignal({
      content: 'hello',
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    }).accepted;
    const imageParts = [
      { type: 'text' as const, text: 'look' },
      { type: 'file' as const, data: 'abc123', mediaType: 'image/png' },
    ];
    await runtime.sendSignal({ content: imageParts }).accepted;
    const acceptedReminder = await runtime.sendSignal({
      type: 'system-reminder',
      contents: 'continue',
      attributes: { type: 'goal' },
    }).accepted;

    expect(signal).toHaveBeenCalledWith({
      content: 'hello',
      signalId: expect.stringMatching(/^signal-/),
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    });
    expect(signal).toHaveBeenCalledWith({ content: imageParts, signalId: expect.stringMatching(/^signal-/) });
    expect(injectSystemReminder).toHaveBeenCalledWith('continue', {
      attributes: { type: 'goal' },
      metadata: undefined,
    });
    expect(acceptedUser).toEqual({ id: 'sig-user', accepted: true });
    expect(acceptedReminder).toEqual({ id: 'sig-reminder', accepted: true });

    await runtime.destroy();
  });

  it('persists saved system reminders without waking the Harness v1 session', async () => {
    const runtime = createRuntime();
    await runtime.init();
    const injectSystemReminder = vi.fn();
    (runtime as any).session.injectSystemReminder = injectSystemReminder;

    const saved = await runtime.saveSystemReminderMessage({ message: 'done', reminderType: 'goal-judge' });
    const messages = await runtime.listMessagesForThread({ threadId: runtime.getCurrentThreadId()! });

    expect(injectSystemReminder).not.toHaveBeenCalled();
    expect(saved).toMatchObject({
      role: 'user',
      content: [{ type: 'system_reminder', reminderType: 'goal-judge', message: 'done' }],
    });
    expect(messages).toEqual([
      expect.objectContaining({
        id: saved!.id,
        role: 'user',
        content: [expect.objectContaining({ type: 'system_reminder', message: 'done', reminderType: 'goal-judge' })],
      }),
    ]);
    await runtime.destroy();
  });

  it('retains Harness v1 OM progress in the MastraCode display state', async () => {
    const runtime = createRuntime();

    await (runtime as any).handleCoreEvent({
      type: 'om_status',
      windows: {
        active: {
          messages: { tokens: 41, threshold: 30000 },
          observations: { tokens: 1200, threshold: 40000 },
        },
        buffered: {
          observations: {
            status: 'running',
            chunks: 1,
            messageTokens: 41,
            projectedMessageRemoval: 0,
            observationTokens: 0,
          },
          reflection: {
            status: 'idle',
            inputObservationTokens: 0,
            observationTokens: 0,
          },
        },
      },
      recordId: 'om-record-1',
      threadId: 'thread-1',
      stepNumber: 2,
      generationCount: 3,
    });

    const displayState = runtime.getDisplayState();
    expect(displayState.omProgress.pendingTokens).toBe(41);
    expect(displayState.omProgress.observationTokens).toBe(1200);
    expect(displayState.omProgress.stepNumber).toBe(2);
    expect(displayState.omProgress.generationCount).toBe(3);
    expect(displayState.bufferingMessages).toBe(true);

    await (runtime as any).handleCoreEvent({
      type: 'om_observation_end',
      cycleId: 'obs-1',
      durationMs: 10,
      tokensObserved: 41,
      observationTokens: 1200,
    });

    expect(runtime.getDisplayState().omProgress.pendingTokens).toBe(0);
    expect(runtime.getDisplayState().bufferingMessages).toBe(true);
    await runtime.destroy();
  });

  it('applies replayed OM progress from memory into the display state', async () => {
    const runtime = createRuntime();
    await runtime.init();
    await runtime.createThread({ title: 'with om' });
    (runtime as any).getMemoryStorage = vi.fn(async () => ({
      getObservationalMemory: vi.fn(async () => ({
        id: 'om-record-1',
        config: { observationThreshold: 100, reflectionThreshold: 200 },
        pendingMessageTokens: 7,
        observationTokenCount: 11,
      })),
      listMessages: vi.fn(async () => ({
        messages: [
          {
            role: 'assistant',
            content: {
              parts: [
                {
                  type: 'data-om-status',
                  data: {
                    windows: {
                      active: {
                        messages: { tokens: 19, threshold: 100 },
                        observations: { tokens: 31, threshold: 200 },
                      },
                      buffered: {
                        observations: { status: 'running', chunks: 2, messageTokens: 19, observationTokens: 0 },
                        reflection: { status: 'idle', inputObservationTokens: 0, observationTokens: 0 },
                      },
                    },
                    generationCount: 4,
                    stepNumber: 5,
                  },
                },
              ],
            },
          },
        ],
      })),
    }));

    await runtime.loadOMProgress();

    const displayState = runtime.getDisplayState();
    expect(displayState.omProgress.pendingTokens).toBe(19);
    expect(displayState.omProgress.observationTokens).toBe(31);
    expect(displayState.omProgress.generationCount).toBe(4);
    expect(displayState.omProgress.stepNumber).toBe(5);
    expect(displayState.bufferingMessages).toBe(true);
    await runtime.destroy();
  });

  it('keeps projecting late Harness v1 events after the session is closed', async () => {
    const runtime = createRuntime();
    const closed = new Error('Session "closed" is closed');
    closed.name = 'HarnessSessionClosedError';
    (runtime as any).session = {
      isRunning: () => false,
      getDisplayState: () => {
        throw closed;
      },
      getState: async () => {
        throw closed;
      },
      setState: async () => {
        throw closed;
      },
    };
    const listener = vi.fn();
    runtime.subscribe(listener);

    await expect(
      (runtime as any).handleCoreEvent({
        type: 'task_updated',
        tasks: [{ id: 'late-task', title: 'Late task', status: 'completed' }],
      }),
    ).resolves.toBeUndefined();

    expect(runtime.getDisplayState().tasks).toEqual([{ id: 'late-task', title: 'Late task', status: 'completed' }]);
    await expect((runtime as any).handleCoreEvent({ type: 'state_changed' })).resolves.toBeUndefined();
    await expect(
      (runtime as any).handleCoreEvent({ type: 'model_changed', modelId: 'openai/gpt-4o-mini' }),
    ).resolves.toBeUndefined();
    expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    await runtime.destroy();
  });

  it('uploads initial-message files through Harness v1 attachments', async () => {
    const runtime = createRuntime();
    const message = vi.fn(async () => undefined);
    const upload = vi.spyOn(runtime.core.attachments, 'upload').mockResolvedValue({
      attachmentId: 'attachment-1',
      resourceId: 'resource-one',
      ownerSessionId: 'session-one',
      bytes: 6,
      mimeType: 'image/png',
      name: 'attachment-1',
    });
    (runtime as any).session = {
      id: 'session-one',
      resourceId: 'resource-one',
      message,
      models: {
        current: () => 'anthropic/claude-haiku-4-5',
        switch: vi.fn(async () => undefined),
      },
      setState: vi.fn(async () => undefined),
    };

    await runtime.sendMessage({
      content: 'inspect this',
      files: [{ data: 'abc123', mimeType: 'image/png' }],
    });

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-one',
        resourceId: 'resource-one',
        data: expect.any(Uint8Array),
        filename: 'attachment-1',
        contentType: 'image/png',
      }),
    );
    expect(message).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'inspect this',
        attachments: [expect.objectContaining({ attachmentId: 'attachment-1' })],
      }),
    );

    await runtime.destroy();
  });

  it('does not pass prepareStep when sending duplicate-admission messages', async () => {
    const runtime = createRuntime();
    const message = vi.fn(async () => undefined);
    (runtime as any).session = {
      message,
      models: {
        current: () => 'anthropic/claude-haiku-4-5',
        switch: vi.fn(async () => undefined),
      },
      setState: vi.fn(async () => undefined),
    };

    await runtime.sendMessage({ content: 'repeatable', admissionId: 'admission-one' });

    expect(message).toHaveBeenCalledWith({
      content: 'repeatable',
      admissionId: 'admission-one',
    });

    await runtime.destroy();
  });

  it('passes yolo to initial Harness v1 message turns when enabled', async () => {
    const runtime = createRuntime({ initialState: { yolo: true } });
    const message = vi.fn(async () => undefined);
    (runtime as any).session = {
      message,
      models: {
        current: () => 'anthropic/claude-haiku-4-5',
        switch: vi.fn(async () => undefined),
      },
      setState: vi.fn(async () => undefined),
    };

    await runtime.sendMessage({ content: 'run without approval prompts' });

    expect(message).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'run without approval prompts',
        yolo: true,
      }),
    );

    await runtime.destroy();
  });

  it('filters active tools through prepareStep for non-admission messages', async () => {
    const runtime = createRuntime({ disabledTools: ['blocked_tool'] });
    const message = vi.fn(async () => undefined);
    (runtime as any).session = {
      message,
      models: {
        current: () => 'anthropic/claude-haiku-4-5',
        switch: vi.fn(async () => undefined),
      },
      setState: vi.fn(async () => undefined),
    };

    await runtime.sendMessage({ content: 'run tools' });

    const [{ prepareStep }] = message.mock.calls[0] as any;
    expect(prepareStep({ tools: { allowed_tool: {}, blocked_tool: {} } })).toEqual({ activeTools: ['allowed_tool'] });

    await runtime.destroy();
  });

  it('persists system reminder messages and first user previews through memory storage', async () => {
    const runtime = createRuntime();
    await runtime.init();
    const thread = await runtime.createThread({ title: 'messages' });

    await runtime.saveSystemReminderMessage({ reminderType: 'goal-judge', message: 'done\ncomplete' });
    const saved = await runtime.listMessages();
    const savedByThread = await runtime.listMessagesForThread({ threadId: thread.id });
    const previews = await runtime.getFirstUserMessagesForThreads({ threadIds: [thread.id] });

    expect(saved.some(message => message.content.some(part => part.type === 'system_reminder'))).toBe(true);
    expect(savedByThread.some(message => message.content.some(part => part.type === 'system_reminder'))).toBe(true);
    expect(previews.get(thread.id)?.content.some(part => part.type === 'system_reminder')).toBe(true);

    await runtime.destroy();
  });

  it('selects existing threads by project path when a resource is reused', async () => {
    const storage = new InMemoryStore({ id: `mc-runtime-project-test-${Date.now()}-${Math.random()}` });
    const firstRuntime = createRuntime({ storage, projectPath: '/tmp/first-project' });
    await firstRuntime.init();
    const firstThreadId = firstRuntime.getCurrentThreadId();
    await firstRuntime.destroy();

    const secondRuntime = createRuntime({ storage, projectPath: '/tmp/second-project' });
    await secondRuntime.init();
    const secondThreadId = secondRuntime.getCurrentThreadId();
    await secondRuntime.destroy();

    const resumedFirstRuntime = createRuntime({ storage, projectPath: '/tmp/first-project' });
    await resumedFirstRuntime.init();
    expect(resumedFirstRuntime.getCurrentThreadId()).toBe(firstThreadId);
    expect(secondThreadId).not.toBe(firstThreadId);
    await resumedFirstRuntime.destroy();
  });

  it('registers static custom mode agents with Harness v1', () => {
    const codeAgent = new Agent({
      id: 'code-agent',
      name: 'Code Agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini' as any,
    });
    const reviewAgent = new Agent({
      id: 'review-agent',
      name: 'Review Agent',
      instructions: 'review',
      model: 'openai/gpt-4o-mini' as any,
    });
    const runtime = createRuntime({
      agents: { 'code-agent': codeAgent },
      modes: [
        { id: 'build', name: 'Build', default: true, agent: codeAgent },
        { id: 'review', name: 'Review', agent: reviewAgent },
      ],
    });

    expect(runtime.getMastra().getAgent('mode-review-agent' as never)).toBe(reviewAgent);
  });

  it('registers native Harness v1 spawn_subagent types for MastraCode subagent agents', () => {
    const codeAgent = new Agent({
      id: 'code-agent',
      name: 'Code Agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini' as any,
    });
    const exploreAgent = new Agent({
      id: 'subagent-explore',
      name: 'Explore',
      instructions: 'explore',
      model: 'openai/gpt-4o-mini' as any,
    });
    const runtime = createRuntime({
      agents: { 'code-agent': codeAgent, 'subagent-explore': exploreAgent },
      modes: [{ id: 'build', name: 'Build', default: true, agent: codeAgent }],
      subagents: [
        {
          id: 'explore',
          name: 'Explore',
          description: 'Read-only exploration',
          instructions: 'explore',
          defaultModelId: 'openai/gpt-4o-mini',
          forked: true,
          maxSteps: 7,
        },
      ],
    });

    expect(runtime.core.getMode('mastracode-subagent-explore')?.agentId).toBe('subagent-explore');
    expect((runtime.core as any)._getSubagentType('explore')).toMatchObject({
      agentId: 'subagent-explore',
      modeId: 'mastracode-subagent-explore',
      defaultModelId: 'openai/gpt-4o-mini',
      forked: true,
      maxSteps: 7,
      workspace: 'inherit',
    });
    expect(runtime.getMastra().getAgent('subagent-explore' as never)).toBe(exploreAgent);
    expect(runtime.core.getMode('build')?.additionalTools).toBeUndefined();
  });

  it('seeds global MastraCode subagent model defaults into Harness v1 native spawn overrides', async () => {
    const codeAgent = new Agent({
      id: 'code-agent',
      name: 'Code Agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini' as any,
    });
    const exploreAgent = new Agent({
      id: 'subagent-explore',
      name: 'Explore',
      instructions: 'explore',
      model: 'openai/gpt-4o-mini' as any,
    });
    const runtime = createRuntime({
      agents: { 'code-agent': codeAgent, 'subagent-explore': exploreAgent },
      modes: [{ id: 'build', name: 'Build', default: true, agent: codeAgent }],
      subagents: [
        {
          id: 'explore',
          name: 'Explore',
          description: 'Read-only exploration',
          instructions: 'explore',
          defaultModelId: 'openai/gpt-4o-mini',
        },
      ],
      initialState: {
        subagentModelId: 'anthropic/claude-haiku-4-5',
        subagentModelId_explore: 'anthropic/claude-haiku-4-5',
      },
    });

    expect(runtime.getSubagentModelId({ agentType: 'explore' })).toBe('anthropic/claude-haiku-4-5');
    await runtime.init();

    expect((runtime as any).session.models.getSubagent({ agentType: 'explore' })).toBe('anthropic/claude-haiku-4-5');
    await (runtime as any).session.models.setSubagent({ agentType: 'explore', model: 'openai/gpt-4o-mini' });
    expect(runtime.getSubagentModelId({ agentType: 'explore' })).toBe('openai/gpt-4o-mini');
    await runtime.destroy();
  });

  it('does not register native subagents when the subagent tool is disabled', () => {
    const codeAgent = new Agent({
      id: 'code-agent',
      name: 'Code Agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini' as any,
    });
    const exploreAgent = new Agent({
      id: 'subagent-explore',
      name: 'Explore',
      instructions: 'explore',
      model: 'openai/gpt-4o-mini' as any,
    });
    const runtime = createRuntime({
      agents: { 'code-agent': codeAgent, 'subagent-explore': exploreAgent },
      modes: [{ id: 'build', name: 'Build', default: true, agent: codeAgent }],
      subagents: [
        {
          id: 'explore',
          name: 'Explore',
          description: 'Read-only exploration',
          instructions: 'explore',
          defaultModelId: 'openai/gpt-4o-mini',
        },
      ],
      disabledTools: ['subagent'],
    });

    expect((runtime.core as any)._getSubagentType('explore')).toBeUndefined();
    expect(runtime.core.getMode('mastracode-subagent-explore')).toBeUndefined();
  });

  it('filters denied tool categories and syncs permission rules into the Harness v1 session', async () => {
    const runtime = createRuntime({
      initialState: {
        permissionRules: {
          categories: { execute: 'deny' },
          tools: { read_file: 'allow' },
        },
      },
    });
    (runtime as any).config.toolCategoryResolver = (toolName: string) => (toolName === 'shell' ? 'execute' : null);
    await runtime.init();

    expect((runtime as any).filterActiveTools(['read_file', 'shell'])).toEqual(['read_file']);
    expect((runtime as any).session.permissions.getRules()).toEqual({
      categories: { execute: 'deny' },
      tools: { read_file: 'allow' },
    });

    await runtime.destroy();
  });

  it('bridges legacy session and model resolver helpers', async () => {
    const resolvedModels: string[] = [];
    const runtime = createRuntime({
      initialState: {
        observerModelId: 'openai/gpt-5.4-mini',
        reflectorModelId: 'anthropic/claude-haiku-4-5',
      },
      resolveModel: modelId => {
        resolvedModels.push(modelId);
        return { modelId };
      },
    });
    await runtime.init();

    const session = await runtime.getSession();
    expect(session.currentThreadId).toBe(runtime.getCurrentThreadId());
    expect(session.currentModeId).toBe(runtime.getCurrentModeId());
    expect(session.threads.length).toBeGreaterThan(0);
    expect(runtime.getResolvedObserverModel()).toEqual({ modelId: 'openai/gpt-5.4-mini' });
    expect(runtime.getResolvedReflectorModel()).toEqual({ modelId: 'anthropic/claude-haiku-4-5' });
    expect(resolvedModels).toEqual(['openai/gpt-5.4-mini', 'anthropic/claude-haiku-4-5']);

    await runtime.destroy();
  });

  it('returns legacy Map-backed display state from v1 record snapshots', () => {
    const runtime = createRuntime();
    (runtime as any).session = {
      getDisplayState: () => ({
        activeTools: {
          tool_1: { toolName: 'read_file', status: 'running' },
        },
        toolInputBuffers: {
          tool_1: { toolName: 'read_file', text: '{"path"' },
        },
        activeSubagents: {
          sub_1: { agentType: 'explore', task: 'inspect', status: 'running' },
        },
        tokenUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        pending: null,
      }),
      threadId: 'thread-one',
      isRunning: () => false,
    };

    const display = runtime.getDisplayState();

    expect(display.activeTools).toBeInstanceOf(Map);
    expect(display.toolInputBuffers).toBeInstanceOf(Map);
    expect(display.activeSubagents).toBeInstanceOf(Map);
    expect(display.toolInputBuffers.get('tool_1')).toEqual({ toolName: 'read_file', text: '{"path"' });
  });

  it('tracks modified files from v1 file mutation tool events for /diff parity', async () => {
    const runtime = createRuntime();

    await (runtime as any).handleCoreEvent({
      type: 'tool_start',
      toolCallId: 'tool-1',
      toolName: 'write_file',
      args: { path: 'src/app.ts' },
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_end',
      toolCallId: 'tool-1',
      result: 'ok',
      isError: false,
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_start',
      toolCallId: 'tool-2',
      toolName: 'string_replace_lsp',
      args: { path: 'src/app.ts' },
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_end',
      toolCallId: 'tool-2',
      result: 'ok',
      isError: false,
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_start',
      toolCallId: 'tool-3',
      toolName: 'ast_smart_edit',
      args: { path: 'src/app.ts' },
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_end',
      toolCallId: 'tool-3',
      result: 'ok',
      isError: false,
    });
    await (runtime as any).handleCoreEvent({
      type: 'subagent_tool_start',
      innerToolCallId: 'sub-tool-1',
      toolName: 'write_file',
      args: { path: 'src/from-subagent.ts' },
    });
    await (runtime as any).handleCoreEvent({
      type: 'subagent_tool_end',
      innerToolCallId: 'sub-tool-1',
      toolName: 'write_file',
      output: 'ok',
      isError: false,
    });

    expect(runtime.getDisplayState().modifiedFiles.get('src/app.ts')).toMatchObject({
      operations: ['write_file', 'string_replace_lsp', 'ast_smart_edit'],
    });
    expect(runtime.getDisplayState().modifiedFiles.get('src/from-subagent.ts')).toMatchObject({
      operations: ['write_file'],
    });

    runtime.getDisplayState().modifiedFiles.clear();
    expect(runtime.getDisplayState().modifiedFiles.size).toBe(0);
    await runtime.destroy();
  });

  it('does not track errored or non-mutating tools as modified files', async () => {
    const runtime = createRuntime();

    await (runtime as any).handleCoreEvent({
      type: 'tool_start',
      toolCallId: 'tool-1',
      toolName: 'write_file',
      args: { path: 'src/app.ts' },
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_end',
      toolCallId: 'tool-1',
      result: 'fail',
      isError: true,
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_start',
      toolCallId: 'tool-2',
      toolName: 'execute_command',
      args: { command: 'touch src/other.ts' },
    });
    await (runtime as any).handleCoreEvent({
      type: 'tool_end',
      toolCallId: 'tool-2',
      result: 'ok',
      isError: false,
    });

    expect(runtime.getDisplayState().modifiedFiles.size).toBe(0);
    await runtime.destroy();
  });

  it('restores replayed task display snapshots for TUI history replay', () => {
    const runtime = createRuntime({
      initialState: { tasks: [{ id: 'old', content: 'Old', status: 'pending', activeForm: 'Doing old' }] },
    });
    const nextTasks = [{ id: 'new', content: 'New', status: 'in_progress', activeForm: 'Doing new' }];
    const listener = vi.fn();
    runtime.subscribe(listener);

    runtime.restoreDisplayTasks(nextTasks as any);

    expect(runtime.getDisplayState().previousTasks).toEqual([
      { id: 'old', content: 'Old', status: 'pending', activeForm: 'Doing old' },
    ]);
    expect(runtime.getDisplayState().tasks).toEqual(nextTasks);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'display_state_changed' }));
  });

  it('forwards explicit pending ids through the MastraCode compatibility response surface', async () => {
    const runtime = createRuntime();
    const respondToToolSuspension = vi.fn(async () => undefined);
    const respondToQuestion = vi.fn(async () => undefined);
    const respondToToolApproval = vi.fn(async () => undefined);
    const respondToSandboxAccess = vi.fn(async () => undefined);
    const respondToPlanApproval = vi.fn(async () => undefined);
    const getDisplayState = vi.fn(() => ({ pending: { toolName: 'write_file' } }));
    (runtime as any).session = {
      respondToQuestion,
      respondToToolApproval,
      respondToToolSuspension,
      respondToSandboxAccess,
      respondToPlanApproval,
      getDisplayState,
    };

    runtime.respondToQuestion({ questionId: 'q-1', answer: 'yes' });
    runtime.respondToToolApproval({ toolCallId: 'tool-1', decision: 'approve' });
    await runtime.respondToToolSuspension({ toolCallId: 'tool-2', resumeData: { ok: true } });
    await runtime.respondToSandboxAccess({ questionId: 'sandbox-1', approved: true });
    await runtime.respondToPlanApproval({ planId: 'plan-1', response: { action: 'approved' } });

    await Promise.resolve();
    expect(respondToQuestion).toHaveBeenCalledWith({ itemId: 'q-1', answer: 'yes' });
    expect(respondToToolApproval).toHaveBeenCalledWith({ itemId: 'tool-1', approved: true, reason: undefined });
    expect(respondToToolSuspension).toHaveBeenCalledWith({ itemId: 'tool-2', resumeData: { ok: true } });
    expect(respondToSandboxAccess).toHaveBeenCalledWith({ itemId: 'sandbox-1', approved: true, reason: undefined });
    expect(respondToPlanApproval).toHaveBeenCalledWith({
      itemId: 'plan-1',
      approved: true,
      revision: undefined,
    });
  });

  it('applies startup and live browser instances to mode agents', () => {
    const browser = { name: 'browser' };
    const setBrowser = vi.fn();
    const agent = new Agent({
      id: 'code-agent',
      name: 'Code Agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini' as any,
    }) as any;
    agent.setBrowser = setBrowser;
    agent.hasOwnBrowser = () => false;

    const runtime = createRuntime({
      agents: { 'code-agent': agent },
      modes: [{ id: 'build', name: 'Build', default: true, agent }],
      browser,
    });

    expect(setBrowser).toHaveBeenCalledWith(browser);
    const nextBrowser = { name: 'next-browser' };
    runtime.setBrowser(nextBrowser);
    expect(setBrowser).toHaveBeenCalledWith(nextBrowser);
  });

  it('creates a session lazily after changing resource id before headless send', async () => {
    const runtime = createRuntime();
    const message = vi.fn(async () => undefined);
    const session = {
      message,
      models: {
        current: () => 'anthropic/claude-haiku-4-5',
        switch: vi.fn(async () => undefined),
      },
      setState: vi.fn(async () => undefined),
    };
    const selectOrCreateThread = vi.spyOn(runtime, 'selectOrCreateThread').mockImplementation(async () => {
      (runtime as any).session = session;
      return {
        id: 'thread-two',
        resourceId: 'resource-two',
        title: 'New thread',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    runtime.setResourceId({ resourceId: 'resource-two' });
    await runtime.sendMessage({ content: 'hello' });

    expect(selectOrCreateThread).toHaveBeenCalled();
    expect(message).toHaveBeenCalledWith(expect.objectContaining({ content: 'hello' }));
  });

  it('does not clear the active session when setting the same resource id', async () => {
    const runtime = createRuntime();
    await runtime.init();
    const currentThreadId = runtime.getCurrentThreadId();

    runtime.setResourceId({ resourceId: 'resource-one' });

    expect(runtime.getCurrentThreadId()).toBe(currentThreadId);
  });
});
