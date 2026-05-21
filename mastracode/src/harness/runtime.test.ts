import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';

import { MastraCodeHarnessRuntime } from './runtime.js';

type RunSpec = {
  text?: string;
  finishReason?: string;
  suspendPayload?: unknown;
  chunks?: Array<{ type: string; payload?: unknown; data?: unknown; runId?: string }>;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

class RuntimeFakeAgent extends Agent<any, any, any> {
  calls: Array<{ messages: unknown; options: any }> = [];
  private runs: RunSpec[] = [];

  constructor(id = 'runtime-agent') {
    super({
      id,
      name: 'Runtime Agent',
      instructions: 'fake',
      model: 'openai/gpt-4o-mini' as any,
    });
  }

  enqueueRun(run: RunSpec): void {
    this.runs.push(run);
  }

  async stream(messages: unknown, options?: any): Promise<any> {
    this.calls.push({ messages, options });
    const run = this.runs.shift() ?? {};
    const runId = options?.runId ?? 'runtime-run';
    const out = buildOutput(runId, run);
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }
}

function buildOutput(runId: string, spec: RunSpec) {
  const usage = spec.usage ?? { inputTokens: 2, outputTokens: 3 };
  const fullOutput = {
    text: spec.text ?? 'runtime response',
    usage,
    totalUsage: usage,
    finishReason: spec.finishReason ?? 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId,
    suspendPayload: spec.suspendPayload,
    messages: [],
    rememberedMessages: [],
  };
  const chunks = spec.chunks ?? [];
  let finishedResolve!: () => void;
  const finished = new Promise<void>(resolve => {
    finishedResolve = resolve;
  });
  const fullStream = (async function* () {
    try {
      for (const chunk of chunks) yield { ...chunk, runId };
    } finally {
      finishedResolve();
    }
  })();
  return {
    runId,
    getFullOutput: async () => fullOutput,
    fullStream,
    text: Promise.resolve(fullOutput.text),
    finishReason: Promise.resolve(fullOutput.finishReason),
    usage: Promise.resolve(fullOutput.usage),
    _waitUntilFinished: () => finished,
  };
}

function createHarness(agent = new RuntimeFakeAgent()) {
  const harness = new MastraCodeHarnessRuntime({
    id: 'runtime-harness',
    storage: new InMemoryStore({ id: 'runtime-storage' }),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    initialState: { currentModelId: 'openai/gpt-4o-mini' },
  } as any);
  return { harness, agent };
}

describe('MastraCodeHarnessRuntime', () => {
  it('seeds currentModelId from the default mode when initial state omits it', () => {
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-default-model',
      storage: new InMemoryStore({ id: 'runtime-storage-default-model' }),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          defaultModelId: 'openai/gpt-4o-mini',
          agent: new RuntimeFakeAgent(),
        },
      ],
      initialState: {},
    } as any);

    expect(harness.getCurrentModelId()).toBe('openai/gpt-4o-mini');
    expect(harness.hasModelSelected()).toBe(true);
  });

  it('honors disabled built-in tools on v1 mode surfaces', () => {
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-disabled-tools',
      storage: new InMemoryStore({ id: 'runtime-storage-disabled-tools' }),
      modes: [{ id: 'default', name: 'Default', default: true, agent: new RuntimeFakeAgent() }],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
      disableBuiltinTools: ['ask_user', 'task_update'],
    } as any);

    const mode = harness.v1.listModes()[0] as { additionalTools?: Record<string, unknown> };
    expect(mode.additionalTools).not.toHaveProperty('ask_user');
    expect(mode.additionalTools).not.toHaveProperty('task_update');
    expect(mode.additionalTools).toHaveProperty('submit_plan');
  });

  it('exposes configured harness tools on v1 parent mode surfaces', async () => {
    const { harness, agent } = createHarness();
    agent.enqueueRun({});
    const tool = { id: 'custom_tool', execute: vi.fn() };
    (harness as any).configCompat.tools = ({ requestContext }: { requestContext: RequestContext }) => ({
      [String(requestContext.get('app') ?? 'custom_tool')]: tool,
    });

    await harness.init();
    await harness.createThread();
    await harness.sendMessage({
      content: 'Use custom tools',
      requestContext: new RequestContext([['app', 'dynamic_tool']]),
    });

    const mode = harness.v1.listModes()[0] as { additionalTools?: Record<string, unknown> };
    expect(mode.additionalTools).toHaveProperty('dynamic_tool', tool);
  });

  it('re-resolves function-valued mode agents before each v1 turn', async () => {
    const first = new RuntimeFakeAgent('first-agent');
    const second = new RuntimeFakeAgent('second-agent');
    first.enqueueRun({});
    second.enqueueRun({});
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-dynamic-agent',
      storage: new InMemoryStore({ id: 'runtime-storage-dynamic-agent' }),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: (state: Record<string, unknown>) => (state.useSecond ? second : first),
        },
      ],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
    } as any);

    await harness.init();
    await harness.createThread();
    await harness.sendMessage({ content: 'first' });
    await harness.setState({ useSecond: true } as any);
    await harness.sendMessage({ content: 'second' });

    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
  });

  it('adapts v1 turn events to legacy Harness events and token usage', async () => {
    const { harness, agent } = createHarness();
    agent.enqueueRun({
      chunks: [
        { type: 'text-start', payload: { id: 'msg-1' } },
        { type: 'text-delta', payload: { id: 'msg-1', text: 'hello' } },
        { type: 'text-end', payload: { id: 'msg-1' } },
      ],
    });

    await harness.init();
    await harness.createThread();
    const events: any[] = [];
    harness.subscribe(event => events.push(event));

    await harness.sendMessage({ content: 'Say hello' });

    expect(events.map(event => event.type)).toEqual(
      expect.arrayContaining(['agent_start', 'message_start', 'message_update', 'message_end', 'agent_end']),
    );
    expect(events.find(event => event.type === 'message_update')?.message.content[0].text).toBe('hello');
    expect(harness.getTokenUsage()).toMatchObject({ promptTokens: 2, completionTokens: 3, totalTokens: 5 });
    expect(agent.calls).toHaveLength(1);
  });

  it('restores persisted token usage when switching back to a thread', async () => {
    const { harness, agent } = createHarness();
    agent.enqueueRun({ usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 } });
    await harness.init();

    const first = await harness.createThread();
    await harness.sendMessage({ content: 'count usage' });
    expect(harness.getTokenUsage()).toMatchObject({ promptTokens: 4, completionTokens: 6, totalTokens: 10 });

    await harness.createThread();
    expect(harness.getTokenUsage()).toMatchObject({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

    await harness.switchThread({ threadId: first.id });
    expect(harness.getTokenUsage()).toMatchObject({ promptTokens: 4, completionTokens: 6, totalTokens: 10 });
  });

  it('clears pending display state when a pending item is answered', async () => {
    const { harness } = createHarness();
    const respondToPlanApproval = vi.fn(async () => ({ status: 'applied' }));
    (harness as any).session = { respondToPlanApproval };
    (harness as any).compatDisplayState.pendingPlanApproval = {
      planId: 'plan-1',
      title: 'Plan',
      plan: 'do work',
    };

    await harness.respondToPlanApproval({ planId: 'plan-1', response: { action: 'rejected', feedback: 'revise' } });

    expect(harness.getDisplayState().pendingPlanApproval).toBeNull();
    expect(respondToPlanApproval).toHaveBeenCalledWith({
      approved: false,
      revision: 'revise',
      transitionToMode: undefined,
    });
  });

  it('retries transient active-delivery races for legacy sendMessage', async () => {
    const { harness } = createHarness();
    const session = {
      signal: vi
        .fn()
        .mockRejectedValueOnce(new Error('active run ended before the message could be delivered; retry the message'))
        .mockResolvedValueOnce({ runId: 'retry-run', result: Promise.resolve({ runId: 'retry-run' }) }),
    };
    (harness as any).ensureSession = vi.fn(async () => session);
    (harness as any).refreshRuntimeForCurrentMode = vi.fn(async () => undefined);

    await harness.sendMessage({ content: 'retry me' });

    expect(session.signal).toHaveBeenCalledTimes(2);
  });

  it('maps v1 request_access suspension back to legacy sandbox_access_request', async () => {
    const { harness, agent } = createHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      suspendPayload: {
        toolCallId: 'request-access-1',
        toolName: 'request_access',
        args: { path: '/tmp/project', reason: 'Need to edit generated files' },
      },
    });

    await harness.init();
    await harness.createThread();
    const events: any[] = [];
    harness.subscribe(event => events.push(event));

    await harness.sendMessage({ content: 'Need access' });

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'sandbox_access_request',
        questionId: 'question:request-access-1',
        path: '/tmp/project',
        reason: 'Need to edit generated files',
      }),
    );
  });

  it('preserves non-text attachments when sending a message through v1 signals', async () => {
    const { harness, agent } = createHarness();
    agent.enqueueRun({});

    await harness.init();
    await harness.createThread();

    await harness.sendMessage({
      content: 'Inspect this screenshot',
      files: [{ data: 'data:image/png;base64,aW1hZ2U=', mediaType: 'image/png', filename: 'screen.png' }],
    });

    const dispatched = JSON.stringify(agent.calls[0]?.messages);
    expect(dispatched).toContain('data:image/png;base64,aW1hZ2U=');
    expect(dispatched).toContain('screen.png');
  });

  it('passes legacy request context through to v1 tool execution context', async () => {
    const { harness, agent } = createHarness();
    agent.enqueueRun({});

    await harness.init();
    await harness.createThread();

    const requestContext = new RequestContext([['app', { source: 'test' }]]);
    await harness.sendMessage({ content: 'Use app context', requestContext });

    expect(agent.calls[0]?.options.requestContext.get('app')).toEqual({ source: 'test' });
  });

  it('resolves dynamic memory through the adapter request context', async () => {
    const memory = { id: 'memory' };
    const memoryFactory = vi.fn(({ requestContext }: { requestContext: RequestContext }) => {
      const harnessCtx = requestContext.get('harness') as { getState: () => Record<string, unknown> };
      return harnessCtx.getState().memoryEnabled ? memory : undefined;
    });
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-memory',
      storage: new InMemoryStore({ id: 'runtime-storage-memory' }),
      memory: memoryFactory,
      modes: [{ id: 'default', name: 'Default', default: true, agent: new RuntimeFakeAgent() }],
      initialState: { currentModelId: 'openai/gpt-4o-mini', memoryEnabled: true },
    } as any);

    await expect(harness.getResolvedMemory()).resolves.toBe(memory);
    expect(memoryFactory).toHaveBeenCalledOnce();
  });

  it('persists system reminder messages on the active v1 thread', async () => {
    const { harness } = createHarness();
    await harness.createThread();

    const saved = await harness.saveSystemReminderMessage({
      reminderType: 'goal',
      message: 'continue',
      metadata: { gapText: 'after idle' },
    });

    expect(saved).toMatchObject({
      role: 'user',
      content: [{ type: 'system_reminder', reminderType: 'goal', message: 'continue', gapText: 'after idle' }],
    });
    await expect(harness.listMessages()).resolves.toEqual([
      expect.objectContaining({
        content: [expect.objectContaining({ type: 'system_reminder', reminderType: 'goal', message: 'continue' })],
      }),
    ]);
  });

  it('keeps OM model helpers on adapter state instead of legacy internals', async () => {
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-om',
      storage: new InMemoryStore({ id: 'runtime-storage-om' }),
      modes: [{ id: 'default', name: 'Default', default: true, agent: new RuntimeFakeAgent() }],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
      resolveModel: (modelId: string) => ({ modelId }),
    } as any);
    const events: any[] = [];
    harness.subscribe(event => events.push(event));
    await harness.createThread();

    await harness.switchObserverModel({ modelId: 'openai/gpt-5.2' });
    await harness.switchReflectorModel({ modelId: 'anthropic/claude-opus-4-6' });

    expect(harness.getObserverModelId()).toBe('openai/gpt-5.2');
    expect(harness.getReflectorModelId()).toBe('anthropic/claude-opus-4-6');
    expect(harness.getResolvedObserverModel()).toEqual({ modelId: 'openai/gpt-5.2' });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'om_model_changed', role: 'observer', modelId: 'openai/gpt-5.2' }),
        expect.objectContaining({ type: 'om_model_changed', role: 'reflector', modelId: 'anthropic/claude-opus-4-6' }),
      ]),
    );
  });

  it('routes legacy system-reminder signals to the v1 reminder channel', async () => {
    const { harness, agent } = createHarness();
    agent.enqueueRun({});

    await harness.init();
    await harness.createThread();

    const signal = harness.sendSignal({ type: 'system-reminder', contents: 'continue after approval' });
    await signal.accepted;

    const dispatched = JSON.stringify(agent.calls[0]?.messages);
    expect(dispatched).toContain('system-reminder');
    expect(dispatched).toContain('continue after approval');
  });

  it('preserves typed signal metadata when routing through v1 signals', async () => {
    const { harness } = createHarness();
    const session = {
      signal: vi.fn(async () => ({ runId: 'typed-signal-run' })),
    };
    (harness as any).ensureSession = vi.fn(async () => session);
    (harness as any).refreshWorkspaceForCurrentMode = vi.fn(async () => undefined);

    const signal = harness.sendSignal({
      type: 'user-message',
      contents: 'resume work',
      attributes: { source: 'goal' },
      metadata: { goalId: 'goal-1' },
    });
    await signal.accepted;

    expect(session.signal).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'resume work',
        type: 'user-message',
        attributes: { source: 'goal' },
        metadata: { goalId: 'goal-1' },
      }),
    );
  });

  it('forwards legacy question ids as v1 inbox item ids', () => {
    const { harness } = createHarness();
    const respondToQuestion = vi.fn(async () => ({ status: 'applied' }));
    (harness as any).session = { respondToQuestion };

    harness.respondToQuestion({ questionId: 'question:request-access-1', answer: 'yes' });

    expect(respondToQuestion).toHaveBeenCalledWith({ itemId: 'question:request-access-1', answer: 'yes' });
  });

  it('transitions approved plans to the configured default mode', async () => {
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-plan-mode',
      storage: new InMemoryStore({ id: 'runtime-storage-plan-mode' }),
      modes: [
        { id: 'execute', name: 'Execute', default: true, agent: new RuntimeFakeAgent() },
        { id: 'plan', name: 'Plan', agent: new RuntimeFakeAgent() },
      ],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
    } as any);
    const respondToPlanApproval = vi.fn(async () => ({ status: 'applied' }));
    (harness as any).session = { respondToPlanApproval };

    await harness.respondToPlanApproval({ planId: 'plan-1', response: { action: 'approved' } });

    expect(respondToPlanApproval).toHaveBeenCalledWith({
      approved: true,
      revision: undefined,
      transitionToMode: 'execute',
    });
  });

  it('preserves thread locking across create and switch operations', async () => {
    const acquire = vi.fn();
    const release = vi.fn();
    const { harness } = createHarness();
    (harness as any).configCompat.threadLock = { acquire, release };

    const first = await harness.createThread();
    const second = await harness.createThread();
    await harness.switchThread({ threadId: first.id });

    expect(acquire).toHaveBeenNthCalledWith(1, first.id);
    expect(acquire).toHaveBeenNthCalledWith(2, second.id);
    expect(release).toHaveBeenNthCalledWith(1, first.id);
    expect(acquire).toHaveBeenNthCalledWith(3, first.id);
    expect(release).toHaveBeenNthCalledWith(2, second.id);
  });

  it('does not re-acquire the previous thread lock when the next lock fails', async () => {
    const acquire = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('locked'));
    const release = vi.fn();
    const { harness } = createHarness();
    (harness as any).configCompat.threadLock = { acquire, release };

    await harness.createThread();
    await expect(harness.createThread()).rejects.toThrow('locked');

    expect(acquire).toHaveBeenCalledTimes(2);
    expect(release).not.toHaveBeenCalled();
  });

  it('creates constrained v1 modes for legacy subagent definitions', () => {
    const { harness } = createHarness();
    const subagentHarness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-subagents',
      storage: new InMemoryStore({ id: 'runtime-storage-subagents' }),
      modes: [{ id: 'default', name: 'Default', default: true, agent: new RuntimeFakeAgent() }],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
      subagents: [
        {
          id: 'explore',
          name: 'Explore',
          description: 'Read-only explorer',
          instructions: 'Explore only',
          allowedWorkspaceTools: ['view', 'search_content', 'find_files'],
        },
      ],
    } as any);

    const mode = subagentHarness.v1.listModes().find(item => item.id === '__mastracode_subagent_explore');
    const parentMode = subagentHarness.v1.listModes().find(item => item.id === 'default');
    expect(mode).toMatchObject({
      instructions: 'Explore only',
      tools: {},
      metadata: {
        allowedWorkspaceTools: ['view', 'search_content', 'find_files'],
      },
    });
    expect(parentMode?.additionalTools).toHaveProperty('subagent');
    expect((subagentHarness.v1 as any)._getSubagentType('explore')).toMatchObject({
      modeId: '__mastracode_subagent_explore',
    });
    expect(harness.v1.listModes()).toHaveLength(1);
  });

  it('registers legacy subagents against the synthetic v1 agent id for dynamic parent agents', () => {
    const dynamicAgent = new RuntimeFakeAgent('dynamic-parent-agent');
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-dynamic-subagent',
      storage: new InMemoryStore({ id: 'runtime-storage-dynamic-subagent' }),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: () => dynamicAgent,
        },
      ],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
      subagents: [
        {
          id: 'explore',
          name: 'Explore',
          description: 'Read-only explorer',
          instructions: 'Explore only',
        },
      ],
    } as any);

    expect((harness.v1 as any)._getSubagentType('explore')).toMatchObject({
      agentId: 'mastracode-default-agent',
      modeId: '__mastracode_subagent_explore',
    });
  });

  it('preserves legacy forked subagent cloning through the subagent alias', async () => {
    const agent = new RuntimeFakeAgent();
    agent.enqueueRun({ text: 'forked result' });
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-forked-subagent',
      storage: new InMemoryStore({ id: 'runtime-storage-forked-subagent' }),
      modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'openai/gpt-4o-mini' }],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
      subagents: [
        {
          id: 'explore',
          name: 'Explore',
          description: 'Read-only explorer',
          instructions: 'Explore only',
        },
      ],
    } as any);
    await harness.createThread();
    const parentThreadId = harness.getCurrentThreadId()!;
    const parentMode = harness.v1.listModes().find(item => item.id === 'default') as any;
    const subagent = parentMode.additionalTools.subagent;
    const events: any[] = [];
    const requestContext = new RequestContext([
      [
        'harness',
        {
          threadId: parentThreadId,
          resourceId: harness.getResourceId(),
          abortSignal: new AbortController().signal,
          getSubagentModelId: () => null,
          emitEvent: (event: unknown) => events.push(event),
        },
      ],
    ]);

    const result = await subagent.execute({ agentType: 'explore', task: 'inspect parent context', forked: true }, {
      requestContext,
      agent: { toolCallId: 'tc-fork', flushMessages: vi.fn(async () => undefined) },
    } as any);

    expect(result).toMatchObject({ content: 'forked result', isError: false });
    expect(agent.calls[0]?.options.memory.thread).not.toBe(parentThreadId);
    expect(agent.calls[0]?.options.memory.resource).toBe(harness.getResourceId());
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'subagent_start', forked: true })]));
    expect(await harness.listThreads()).toHaveLength(1);
    expect(await harness.listThreads({ includeForkedSubagents: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({ forkedSubagent: true, parentThreadId }),
        }),
      ]),
    );
  });

  it('normalizes WorkspaceConfig before propagating workspace to agents', async () => {
    const agent = new RuntimeFakeAgent();
    const harness = new MastraCodeHarnessRuntime({
      id: 'runtime-harness-workspace-config',
      storage: new InMemoryStore({ id: 'runtime-storage-workspace-config' }),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { currentModelId: 'openai/gpt-4o-mini' },
      workspace: { name: 'workspace-config', skills: ['/tmp/test-skills'] },
    } as any);

    expect(harness.getWorkspace()).toBeInstanceOf(Workspace);
    await expect(agent.getWorkspace()).resolves.toBe(harness.getWorkspace());
  });
});
