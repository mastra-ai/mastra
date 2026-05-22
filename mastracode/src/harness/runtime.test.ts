import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

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
    browser: options.browser as never,
    disabledTools: options.disabledTools,
  });
}

describe('MastraCodeHarnessRuntime', () => {
  it('rejects empty mode configuration instead of inventing a default mode id', () => {
    expect(() => createRuntime({ modes: [] })).toThrow('No MastraCode harness modes configured');
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

    await runtime.sendSignal({
      content: 'hello',
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    }).accepted;
    const imageParts = [
      { type: 'text', text: 'look' },
      { type: 'file', data: 'abc123', mediaType: 'image/png' },
    ];
    await runtime.sendSignal({ content: imageParts }).accepted;
    await runtime.sendSignal({ type: 'system-reminder', contents: 'continue', attributes: { type: 'goal' } }).accepted;

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

  it('passes initial-message files through to Harness v1 message content parts', async () => {
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

    await runtime.sendMessage({
      content: 'inspect this',
      files: [{ data: 'abc123', mimeType: 'image/png' }],
    });

    expect(message).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          { type: 'text', text: 'inspect this' },
          { type: 'file', data: 'abc123', mediaType: 'image/png' },
        ],
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
        },
      ],
    });

    expect(runtime.core.getMode('mastracode-subagent-explore')?.agentId).toBe('subagent-explore');
    expect((runtime.core as any)._getSubagentType('explore')).toMatchObject({
      agentId: 'subagent-explore',
      modeId: 'mastracode-subagent-explore',
      defaultModelId: 'openai/gpt-4o-mini',
      workspace: 'inherit',
    });
    expect(runtime.getMastra().getAgent('subagent-explore' as never)).toBe(exploreAgent);
    expect(runtime.core.getMode('build')?.additionalTools).toBeUndefined();
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

  it('resumes v1 tool suspensions through the MastraCode compatibility surface', async () => {
    const runtime = createRuntime();
    const respondToToolSuspension = vi.fn(async () => undefined);
    (runtime as any).session = { respondToToolSuspension };

    await runtime.respondToToolSuspension({ resumeData: { ok: true } });

    expect(respondToToolSuspension).toHaveBeenCalledWith({ resumeData: { ok: true } });
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
});
