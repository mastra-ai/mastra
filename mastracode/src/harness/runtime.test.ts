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
    modes: options.modes ?? [
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
    ] as any,
    subagents: options.subagents ?? [],
    initialState: {
      projectPath: options.projectPath ?? '/tmp/mastracode-runtime-test',
      currentModelId: 'anthropic/claude-haiku-4-5',
      ...options.initialState,
    },
    resolveModel: options.resolveModel,
  });
}

describe('MastraCodeHarnessRuntime', () => {
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

    expect(message).toHaveBeenCalledWith({
      content: [
        { type: 'text', text: 'inspect this' },
        { type: 'file', data: 'abc123', mediaType: 'image/png' },
      ],
    });

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

  it('registers hidden Harness v1 modes for MastraCode subagent agents', () => {
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
    expect((runtime.core as any)._getSubagentType('explore')?.modeId).toBe('mastracode-subagent-explore');
    expect(runtime.getMastra().getAgent('subagent-explore' as never)).toBe(exploreAgent);
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
});
