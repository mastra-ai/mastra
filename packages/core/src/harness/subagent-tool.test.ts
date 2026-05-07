import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../request-context';

// We need to mock Agent before importing tools.ts.
const { mockStream, MockAgent, mockCreateWorkspaceTools } = vi.hoisted(() => {
  const mockStream = vi.fn();
  const mockCreateWorkspaceTools = vi.fn().mockReturnValue({});
  let lastConstructorOpts: any = null;
  class MockAgent {
    stream = mockStream;
    static get lastConstructorOpts() {
      return lastConstructorOpts;
    }
    constructor(opts: any) {
      lastConstructorOpts = opts;
    }
  }
  return { mockStream, MockAgent, mockCreateWorkspaceTools };
});

vi.mock('../agent', () => ({
  Agent: MockAgent,
}));

vi.mock('../workspace/tools/tools', () => ({
  createWorkspaceTools: mockCreateWorkspaceTools,
}));

import { createSubagentTool } from './tools';
import type { HarnessRequestContext, HarnessSubagent } from './types';

/**
 * Helper to create a readable stream that yields the given chunks then closes.
 */
function createMockFullStream(chunks: Array<{ type: string; payload: Record<string, unknown> }>) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < chunks.length) {
            return { value: chunks[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

function createMockStreamResponse(text: string, chunks?: Array<{ type: string; payload: Record<string, unknown> }>) {
  return {
    fullStream: createMockFullStream(chunks ?? [{ type: 'text-delta', payload: { text } }]),
    getFullOutput: vi.fn().mockResolvedValue({ text }),
  };
}

const subagents: HarnessSubagent[] = [
  {
    id: 'explore',
    name: 'Explore',
    description: 'Read-only codebase exploration.',
    instructions: 'You are an explorer.',
    tools: { view: { id: 'view' } as any },
  },
  {
    id: 'execute',
    name: 'Execute',
    description: 'Task execution with write capabilities.',
    instructions: 'You are an executor.',
    tools: { view: { id: 'view' } as any, write_file: { id: 'write_file' } as any },
  },
];

const resolveModel = vi.fn().mockReturnValue({ modelId: 'test-model' });

describe('createSubagentTool requestContext forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT append the internal `<subagent-meta />` tag to model-facing content (success path)', async () => {
    // Regression: when the parent model can see this tag in a tool result it
    // sometimes echoes the literal markup back into its own assistant text on
    // the next turn. The metadata must travel via structured events only.
    mockStream.mockResolvedValue(createMockStreamResponse('clean result text'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'task' },
      { requestContext: new RequestContext(), agent: { toolCallId: 'tc-meta' } },
    );

    expect(result.isError).toBe(false);
    expect(result.content).toBe('clean result text');
    expect(result.content).not.toContain('<subagent-meta');
    expect(result.content).not.toContain('modelId=');
    expect(result.content).not.toContain('durationMs=');
  });

  it('does NOT append the internal `<subagent-meta />` tag on the error path either', async () => {
    mockStream.mockRejectedValue(new Error('boom'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'task' },
      { requestContext: new RequestContext(), agent: { toolCallId: 'tc-meta-err' } },
    );

    expect(result.isError).toBe(true);
    expect(result.content).not.toContain('<subagent-meta');
  });

  it('forwards a copy of requestContext with threadId/resourceId stripped', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('result text'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    // Build a requestContext with harness data including threadId/resourceId
    const requestContext = new RequestContext();
    const harnessCtx: Partial<HarnessRequestContext> = {
      emitEvent: vi.fn(),
      threadId: 'parent-thread-123',
      resourceId: 'parent-resource-456',
    };
    requestContext.set('harness', harnessCtx);

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Find all usages of foo' },
      { requestContext, agent: { toolCallId: 'tc-1' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamCall = mockStream.mock.calls[0]!;
    const subagentCtx = streamCall[1].requestContext;
    // Should be a new instance (not the parent's context)
    expect(subagentCtx).not.toBe(requestContext);
    // Harness context should have threadId/resourceId cleared
    const subagentHarness = subagentCtx.get('harness') as Partial<HarnessRequestContext>;
    expect(subagentHarness.threadId).toBeNull();
    expect(subagentHarness.resourceId).toBe('');
    // Other harness fields should be preserved
    expect(subagentHarness.emitEvent).toBe(harnessCtx.emitEvent);
    expect(result.isError).toBe(false);
  });

  it('forwards requestContext copy when harness context is not set', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('result text'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    // RequestContext without harness data — still should be forwarded
    const requestContext = new RequestContext();
    requestContext.set('custom-key', 'custom-value');

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Explore something' },
      { requestContext, agent: { toolCallId: 'tc-2' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamCall = mockStream.mock.calls[0]!;
    const subagentCtx = streamCall[1].requestContext;
    // Should be a new instance but with same data
    expect(subagentCtx).not.toBe(requestContext);
    // Verify the custom data is accessible through the forwarded context
    expect(subagentCtx.get('custom-key')).toBe('custom-value');
    expect(result.isError).toBe(false);
  });

  it('passes maxSteps, abortSignal, and requireToolApproval alongside requestContext', async () => {
    const abortController = new AbortController();
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    const requestContext = new RequestContext();
    const harnessCtx: Partial<HarnessRequestContext> = {
      emitEvent: vi.fn(),
      abortSignal: abortController.signal,
    };
    requestContext.set('harness', harnessCtx);

    await (tool as any).execute(
      { agentType: 'explore', task: 'Do stuff' },
      { requestContext, agent: { toolCallId: 'tc-3' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamOpts = mockStream.mock.calls[0]![1];
    expect(streamOpts).toMatchObject({
      maxSteps: 50,
      stopWhen: undefined,
      abortSignal: abortController.signal,
      requireToolApproval: false,
    });
    // Subagent gets a copy of the request context (not the original)
    expect(streamOpts.requestContext).toBeInstanceOf(RequestContext);
  });

  it('does not default maxSteps when stopWhen is configured', async () => {
    const stopFn = vi.fn().mockReturnValue({ continue: true });
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const subagentsWithStopWhen: HarnessSubagent[] = [
      {
        id: 'custom',
        name: 'Custom',
        description: 'Subagent with stopWhen.',
        instructions: 'You are custom.',
        tools: { view: { id: 'view' } as any },
        stopWhen: stopFn,
      },
    ];

    const tool = createSubagentTool({
      subagents: subagentsWithStopWhen,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn() });

    await (tool as any).execute(
      { agentType: 'custom', task: 'Do stuff' },
      { requestContext, agent: { toolCallId: 'tc-5' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamOpts = mockStream.mock.calls[0]![1];
    expect(streamOpts.maxSteps).toBeUndefined();
    expect(streamOpts.stopWhen).toBe(stopFn);
  });

  it('forwards default RequestContext when parent context has no explicit requestContext', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('result text'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    // Execute without requestContext — core's createTool wrapper creates a default one
    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Explore something' },
      { agent: { toolCallId: 'tc-4' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamCall = mockStream.mock.calls[0]!;
    // The core creates a default RequestContext when none is provided
    expect(streamCall[1].requestContext).toBeInstanceOf(RequestContext);
    expect(result.isError).toBe(false);
  });
});

describe('createSubagentTool tracingContext forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards tracingContext to subagent.stream() when provided', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    const mockSpan = { spanContext: () => ({ traceId: 'abc', spanId: 'def' }) };
    const tracingContext = { currentSpan: mockSpan } as any;

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn() });

    await (tool as any).execute(
      { agentType: 'explore', task: 'Investigate' },
      { requestContext, tracingContext, agent: { toolCallId: 'tc-trace-1' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamOpts = mockStream.mock.calls[0]![1];
    expect(streamOpts.tracingContext).toBe(tracingContext);
  });

  it('does not include tracingContext when not provided', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn() });

    await (tool as any).execute(
      { agentType: 'explore', task: 'Investigate' },
      { requestContext, agent: { toolCallId: 'tc-trace-2' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamOpts = mockStream.mock.calls[0]![1];
    expect(streamOpts).not.toHaveProperty('tracingContext');
  });
});

describe('createSubagentTool workspace propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes the parent workspace to the subagent Agent constructor', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('result'));

    const fakeWorkspace = { id: 'ws-1' } as any;

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    await (tool as any).execute(
      { agentType: 'explore', task: 'Find stuff' },
      { workspace: fakeWorkspace, agent: { toolCallId: 'tc-ws-1' } },
    );

    expect(MockAgent.lastConstructorOpts.workspace).toBe(fakeWorkspace);
  });

  it('does not set workspace when parent has no workspace', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('result'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    await (tool as any).execute({ agentType: 'explore', task: 'Find stuff' }, { agent: { toolCallId: 'tc-ws-2' } });

    expect(MockAgent.lastConstructorOpts.workspace).toBeUndefined();
  });
});

describe('createSubagentTool allowedWorkspaceTools filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters workspace tools via prepareStep when allowedWorkspaceTools is set', async () => {
    // createWorkspaceTools returns tools keyed by exposed names
    mockCreateWorkspaceTools.mockReturnValue({
      view: { id: 'view' },
      write_file: { id: 'write_file' },
      execute_command: { id: 'execute_command' },
      find_files: { id: 'find_files' },
      search_content: { id: 'search_content' },
    });
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const fakeWorkspace = { id: 'ws-2' } as any;

    const subagentsWithFilter: HarnessSubagent[] = [
      {
        id: 'explore',
        name: 'Explore',
        description: 'Read-only.',
        instructions: 'Explorer.',
        allowedWorkspaceTools: ['view', 'search_content', 'find_files'],
      },
    ];

    const tool = createSubagentTool({
      subagents: subagentsWithFilter,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    await (tool as any).execute(
      { agentType: 'explore', task: 'Look around' },
      { workspace: fakeWorkspace, agent: { toolCallId: 'tc-filter-1' } },
    );

    // Verify prepareStep was passed to stream
    const streamOpts = mockStream.mock.calls[0]![1];
    expect(streamOpts.prepareStep).toBeTypeOf('function');

    // Simulate what the agent loop does: call prepareStep with all tools
    const allTools = {
      view: {},
      write_file: {},
      execute_command: {},
      find_files: {},
      search_content: {},
      skill: {}, // non-workspace tool
    };
    const result = streamOpts.prepareStep({ tools: allTools });

    // Should keep allowed workspace tools + non-workspace tools, hide the rest
    expect(result.activeTools).toEqual(expect.arrayContaining(['view', 'search_content', 'find_files', 'skill']));
    expect(result.activeTools).not.toContain('write_file');
    expect(result.activeTools).not.toContain('execute_command');
  });

  it('does not add prepareStep when allowedWorkspaceTools is not set', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const fakeWorkspace = { id: 'ws-3' } as any;

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    await (tool as any).execute(
      { agentType: 'explore', task: 'Explore' },
      { workspace: fakeWorkspace, agent: { toolCallId: 'tc-filter-2' } },
    );

    const streamOpts = mockStream.mock.calls[0]![1];
    expect(streamOpts.prepareStep).toBeUndefined();
  });

  it('does not add prepareStep when there is no workspace', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const subagentsWithFilter: HarnessSubagent[] = [
      {
        id: 'explore',
        name: 'Explore',
        description: 'Read-only.',
        instructions: 'Explorer.',
        allowedWorkspaceTools: ['view'],
      },
    ];

    const tool = createSubagentTool({
      subagents: subagentsWithFilter,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    await (tool as any).execute({ agentType: 'explore', task: 'Explore' }, { agent: { toolCallId: 'tc-filter-3' } });

    const streamOpts = mockStream.mock.calls[0]![1];
    // No workspace → no filtering possible
    expect(streamOpts.prepareStep).toBeUndefined();
  });

  it('keeps explicit tools visible alongside allowed workspace tools', async () => {
    mockCreateWorkspaceTools.mockReturnValue({
      view: { id: 'view' },
      write_file: { id: 'write_file' },
      execute_command: { id: 'execute_command' },
    });
    mockStream.mockResolvedValue(createMockStreamResponse('done'));

    const fakeWorkspace = { id: 'ws-4' } as any;

    const subagentsWithExplicitTools: HarnessSubagent[] = [
      {
        id: 'execute',
        name: 'Execute',
        description: 'Executor.',
        instructions: 'Execute stuff.',
        tools: { task_write: { id: 'task_write' } as any, task_check: { id: 'task_check' } as any },
        allowedWorkspaceTools: ['view', 'write_file', 'execute_command'],
      },
    ];

    const tool = createSubagentTool({
      subagents: subagentsWithExplicitTools,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    await (tool as any).execute(
      { agentType: 'execute', task: 'Do work' },
      { workspace: fakeWorkspace, agent: { toolCallId: 'tc-filter-4' } },
    );

    const streamOpts = mockStream.mock.calls[0]![1];
    expect(streamOpts.prepareStep).toBeTypeOf('function');

    const allTools = {
      view: {},
      write_file: {},
      execute_command: {},
      task_write: {},
      task_check: {},
    };
    const result = streamOpts.prepareStep({ tools: allTools });

    // All tools should be visible
    expect(result.activeTools).toEqual(
      expect.arrayContaining(['view', 'write_file', 'execute_command', 'task_write', 'task_check']),
    );
    expect(result.activeTools).toHaveLength(5);
  });
});

describe('createSubagentTool forked subagent behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeParentAgent(text = 'forked result') {
    const parentStream = vi.fn().mockResolvedValue(createMockStreamResponse(text));
    const parentAgent = { stream: parentStream } as any;
    return { parentAgent, parentStream };
  }

  it('forks: clones the parent thread and streams on the parent agent when forked=true', async () => {
    const { parentAgent, parentStream } = makeParentAgent('forked output');
    const cloneThreadForFork = vi.fn().mockResolvedValue({ id: 'forked-thread-1', resourceId: 'parent-resource-1' });

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentModelId: () => 'openai/gpt-5.5',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    const harnessCtx: Partial<HarnessRequestContext> = {
      emitEvent: vi.fn(),
      threadId: 'parent-thread-1',
      resourceId: 'parent-resource-1',
    };
    requestContext.set('harness', harnessCtx);

    const input: { agentType: 'explore'; task: string; forked: boolean; modelId?: string } = {
      agentType: 'explore',
      task: 'Dig deeper',
      forked: true,
    };
    const result = await (tool as any).execute(input, { requestContext, agent: { toolCallId: 'tc-fork-1' } });

    expect(result.isError).toBe(false);

    // Parent thread is cloned with the parent's threadId.
    expect(cloneThreadForFork).toHaveBeenCalledTimes(1);
    expect(cloneThreadForFork).toHaveBeenCalledWith({
      sourceThreadId: 'parent-thread-1',
      resourceId: 'parent-resource-1',
      title: expect.stringContaining('Fork:'),
    });

    // Parent agent's stream is used — no fresh Agent is constructed for the fork.
    expect(parentStream).toHaveBeenCalledTimes(1);
    expect(mockStream).not.toHaveBeenCalled();

    const [taskArg, streamOpts] = parentStream.mock.calls[0]!;
    expect(taskArg).toContain('Dig deeper');
    expect(taskArg).toContain('Do not call the `subagent` tool');
    // Memory option points at the cloned thread so history is inherited
    // without polluting the parent thread.
    expect(streamOpts.memory).toEqual({ thread: 'forked-thread-1', resource: 'parent-resource-1' });
    // Forked runs need multiple steps so an accidental nested-subagent call can
    // consume the runtime stub and then produce a direct answer on the next step.
    expect(streamOpts.maxSteps).toBe(1000);

    expect(harnessCtx.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subagent_start',
        modelId: 'openai/gpt-5.5',
        forked: true,
      }),
    );

    // Subagent request context points at the fork (not null/'' like non-forked).
    const subagentHarness = streamOpts.requestContext.get('harness') as Partial<HarnessRequestContext>;
    expect(subagentHarness.threadId).toBe('forked-thread-1');
    expect(subagentHarness.resourceId).toBe('parent-resource-1');
  });

  it('forks: drains the parent save queue before cloning so the fork carries the latest turn', async () => {
    // Real regression: in TUI runs the parent's user message is still in the
    // in-flight SaveQueueManager (100ms debounce) when the subagent tool call
    // fires. Unless we flush first, `memory.cloneThread` reads an empty thread
    // and the fork starts without parent history.
    const { parentAgent, parentStream } = makeParentAgent('drained fork output');
    const flushOrder: string[] = [];
    const flushMessages = vi.fn(async () => {
      flushOrder.push('flush');
    });
    const cloneThreadForFork = vi.fn().mockImplementation(async () => {
      flushOrder.push('clone');
      return { id: 'forked-thread-drained', resourceId: 'parent-resource-1' };
    });

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    const harnessCtx: Partial<HarnessRequestContext> = {
      emitEvent: vi.fn(),
      threadId: 'parent-thread-drained',
      resourceId: 'parent-resource-1',
    };
    requestContext.set('harness', harnessCtx);

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Needs latest history', forked: true },
      { requestContext, agent: { toolCallId: 'tc-drain-1', flushMessages } },
    );

    expect(result.isError).toBe(false);
    expect(flushMessages).toHaveBeenCalledTimes(1);
    expect(cloneThreadForFork).toHaveBeenCalledTimes(1);
    // Flush must happen strictly before clone — otherwise the clone reads stale storage.
    expect(flushOrder).toEqual(['flush', 'clone']);
    expect(parentStream).toHaveBeenCalledTimes(1);
  });

  it('forks: flushMessages failures are swallowed and the clone still runs', async () => {
    // A flush failure (e.g. transient storage error) should never abort the
    // fork — the clone will just be missing the very latest turn, which is
    // better than failing the subagent call outright.
    const { parentAgent, parentStream } = makeParentAgent('flush-failure fork');
    const flushMessages = vi.fn().mockRejectedValue(new Error('storage unavailable'));
    const cloneThreadForFork = vi
      .fn()
      .mockResolvedValue({ id: 'forked-thread-after-flush-fail', resourceId: 'parent-resource-1' });

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    const harnessCtx: Partial<HarnessRequestContext> = {
      emitEvent: vi.fn(),
      threadId: 'parent-thread-flush-fail',
      resourceId: 'parent-resource-1',
    };
    requestContext.set('harness', harnessCtx);

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Flush can fail', forked: true },
      { requestContext, agent: { toolCallId: 'tc-flush-fail', flushMessages } },
    );

    expect(result.isError).toBe(false);
    expect(flushMessages).toHaveBeenCalledTimes(1);
    expect(cloneThreadForFork).toHaveBeenCalledTimes(1);
    expect(parentStream).toHaveBeenCalledTimes(1);
  });

  it('forks by default when the subagent definition sets forked=true', async () => {
    const { parentAgent, parentStream } = makeParentAgent('default fork');
    const cloneThreadForFork = vi.fn().mockResolvedValue({ id: 'forked-thread-default', resourceId: 'rid' });

    const subagentsWithDefault: HarnessSubagent[] = [
      {
        id: 'collab',
        name: 'Collab',
        description: 'Always runs as a fork.',
        instructions: 'You are a collab subagent.',
        forked: true,
      },
    ];

    const tool = createSubagentTool({
      subagents: subagentsWithDefault,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn(), threadId: 'p-thread', resourceId: 'rid' });

    const result = await (tool as any).execute(
      // Note: `forked` is omitted — should fall through to the definition default.
      { agentType: 'collab', task: 'Collaborate' },
      { requestContext, agent: { toolCallId: 'tc-fork-default' } },
    );

    expect(result.isError).toBe(false);
    expect(cloneThreadForFork).toHaveBeenCalledTimes(1);
    expect(parentStream).toHaveBeenCalledTimes(1);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('per-invocation forked=false overrides a definition default of forked=true', async () => {
    const { parentAgent, parentStream } = makeParentAgent('should not run');
    const cloneThreadForFork = vi.fn();

    const subagentsWithDefault: HarnessSubagent[] = [
      {
        id: 'collab',
        name: 'Collab',
        description: 'Defaults to fork.',
        instructions: 'Collab.',
        tools: { view: { id: 'view' } as any },
        forked: true,
      },
    ];

    mockStream.mockResolvedValue(createMockStreamResponse('non-forked result'));

    const tool = createSubagentTool({
      subagents: subagentsWithDefault,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn(), threadId: 'p-thread', resourceId: 'rid' });

    const result = await (tool as any).execute(
      { agentType: 'collab', task: 'Do it isolated', forked: false },
      { requestContext, agent: { toolCallId: 'tc-fork-override' } },
    );

    expect(result.isError).toBe(false);
    expect(cloneThreadForFork).not.toHaveBeenCalled();
    expect(parentStream).not.toHaveBeenCalled();
    // Falls back to the regular non-forked path, which constructs a fresh Agent.
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it('returns an error when forked=true but no parent agent is available', async () => {
    const cloneThreadForFork = vi.fn().mockResolvedValue({ id: 'forked-thread', resourceId: 'rid' });

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      // getParentAgent omitted — simulates a harness without a current agent.
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn(), threadId: 'p-thread', resourceId: 'rid' });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Fork', forked: true },
      { requestContext, agent: { toolCallId: 'tc-fork-no-parent' } },
    );

    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/parent agent/i);
    expect(cloneThreadForFork).not.toHaveBeenCalled();
  });

  it('returns an error when forked=true but there is no active parent thread', async () => {
    const { parentAgent } = makeParentAgent();
    const cloneThreadForFork = vi.fn();

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    // harnessCtx without threadId
    requestContext.set('harness', { emitEvent: vi.fn(), resourceId: 'rid' });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Fork', forked: true },
      { requestContext, agent: { toolCallId: 'tc-fork-no-thread' } },
    );

    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/parent thread/i);
    expect(cloneThreadForFork).not.toHaveBeenCalled();
  });

  it('returns an error when forked=true but cloneThreadForFork is not wired up (memory missing)', async () => {
    const { parentAgent } = makeParentAgent();

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      // cloneThreadForFork intentionally omitted to simulate no memory configured.
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn(), threadId: 'p-thread', resourceId: 'rid' });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Fork', forked: true },
      { requestContext, agent: { toolCallId: 'tc-fork-no-memory' } },
    );

    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/memory/i);
  });

  it('propagates a cloneThreadForFork failure as an error result (does not throw)', async () => {
    const { parentAgent, parentStream } = makeParentAgent();
    const cloneThreadForFork = vi.fn().mockRejectedValue(new Error('storage offline'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn(), threadId: 'p-thread', resourceId: 'rid' });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Fork', forked: true },
      { requestContext, agent: { toolCallId: 'tc-fork-clone-fail' } },
    );

    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/storage offline/);
    expect(parentStream).not.toHaveBeenCalled();
  });

  it('forks: inherits parent toolsets via getParentToolsets and patches `subagent` to a runtime no-op (preserving prompt-cache prefix)', async () => {
    // Forks must inherit harness-injected tools (`ask_user` / `submit_plan` /
    // user-configured harness tools) — the parent Agent's base config doesn't
    // carry them; they're injected per-stream by the harness.
    //
    // Stripping or rewriting `subagent` would change the tool list / schemas
    // the LLM sees vs. the parent and invalidate the prompt cache (which is
    // the entire reason forked mode exists). Instead we keep `subagent`
    // present with its id / description / inputSchema / providerOptions
    // unchanged, and only swap `execute` for a stub that refuses recursive
    // forks at runtime.
    const { parentAgent, parentStream } = makeParentAgent('with toolsets');
    const cloneThreadForFork = vi.fn().mockResolvedValue({ id: 'fork-with-toolsets', resourceId: 'rid' });

    const askUser = { id: 'ask_user', description: 'Ask user', execute: vi.fn() } as any;
    const submitPlan = { id: 'submit_plan', description: 'Submit plan', execute: vi.fn() } as any;
    const originalSubagentExecute = vi.fn();
    const inputSchemaSentinel = { type: 'object', properties: { agentType: { type: 'string' } } };
    const subagentTool = {
      id: 'subagent',
      description: 'Dispatch a subagent',
      inputSchema: inputSchemaSentinel,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      execute: originalSubagentExecute,
    } as any;
    const userTool = { id: 'view', description: 'View', execute: vi.fn() } as any;

    const getParentToolsets = vi.fn().mockResolvedValue({
      harnessBuiltIn: { ask_user: askUser, submit_plan: submitPlan, subagent: subagentTool },
      harness: { view: userTool },
    });

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
      getParentToolsets,
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn(), threadId: 'p-thread', resourceId: 'rid' });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Inherit but no recursion', forked: true },
      { requestContext, agent: { toolCallId: 'tc-fork-toolsets' } },
    );

    expect(result.isError).toBe(false);
    expect(getParentToolsets).toHaveBeenCalledTimes(1);
    const [forkRequestContext] = getParentToolsets.mock.calls[0]!;
    expect(forkRequestContext.get('harness')).toMatchObject({ threadId: 'fork-with-toolsets', resourceId: 'rid' });

    const [, streamOpts] = parentStream.mock.calls[0]!;
    expect(streamOpts.toolsets).toBeDefined();
    // ask_user / submit_plan / user tool come through untouched (same object identity).
    expect(streamOpts.toolsets.harnessBuiltIn.ask_user).toBe(askUser);
    expect(streamOpts.toolsets.harnessBuiltIn.submit_plan).toBe(submitPlan);
    expect(streamOpts.toolsets.harness.view).toBe(userTool);

    // `subagent` must STILL be present in the inherited toolset — removing it
    // would change the tool list the LLM sees and invalidate the cache prefix.
    const patchedSubagent = streamOpts.toolsets.harnessBuiltIn.subagent;
    expect(patchedSubagent).toBeDefined();

    // All prompt-shaping fields are preserved exactly so the request prefix
    // is byte-identical to the parent's.
    expect(patchedSubagent.id).toBe(subagentTool.id);
    expect(patchedSubagent.description).toBe(subagentTool.description);
    expect(patchedSubagent.inputSchema).toBe(inputSchemaSentinel);
    expect(patchedSubagent.providerOptions).toBe(subagentTool.providerOptions);

    // Only `execute` is swapped, and the original is NOT invoked.
    expect(patchedSubagent.execute).not.toBe(originalSubagentExecute);
    const stubResult = await patchedSubagent.execute({}, {});
    expect(stubResult.isError).toBe(true);
    expect(stubResult.content).toMatch(/maximum allowed subagent nesting level/i);
    expect(originalSubagentExecute).not.toHaveBeenCalled();

    // The patched copy must not mutate the parent's toolset object — the same
    // toolset is reused across requests, so any mutation would persist.
    expect(subagentTool.execute).toBe(originalSubagentExecute);
  });

  it('forks: omitting getParentToolsets keeps `toolsets` unset on the stream call (back-compat)', async () => {
    // If a harness doesn't wire getParentToolsets, the fork should still run
    // (just without inherited harness toolsets) — no breaking change.
    const { parentAgent, parentStream } = makeParentAgent('no toolsets wired');
    const cloneThreadForFork = vi.fn().mockResolvedValue({ id: 'fork-no-toolsets', resourceId: 'rid' });

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
      // getParentToolsets intentionally omitted.
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', { emitEvent: vi.fn(), threadId: 'p-thread', resourceId: 'rid' });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'No toolsets', forked: true },
      { requestContext, agent: { toolCallId: 'tc-fork-no-toolsets' } },
    );

    expect(result.isError).toBe(false);
    const [, streamOpts] = parentStream.mock.calls[0]!;
    expect(streamOpts.toolsets).toBeUndefined();
  });

  it('non-forked path is unchanged: strips threadId/resourceId and constructs a fresh Agent', async () => {
    // Sanity check that wiring fork helpers does NOT affect the default path.
    const { parentAgent, parentStream } = makeParentAgent();
    const cloneThreadForFork = vi.fn();

    mockStream.mockResolvedValue(createMockStreamResponse('isolated'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
      getParentAgent: () => parentAgent,
      cloneThreadForFork,
    });

    const requestContext = new RequestContext();
    requestContext.set('harness', {
      emitEvent: vi.fn(),
      threadId: 'p-thread',
      resourceId: 'rid',
    });

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Isolate' }, // no forked flag
      { requestContext, agent: { toolCallId: 'tc-non-fork' } },
    );

    expect(result.isError).toBe(false);
    expect(parentStream).not.toHaveBeenCalled();
    expect(cloneThreadForFork).not.toHaveBeenCalled();
    expect(mockStream).toHaveBeenCalledTimes(1);

    const streamOpts = mockStream.mock.calls[0]![1];
    const harness = streamOpts.requestContext.get('harness') as Partial<HarnessRequestContext>;
    expect(harness.threadId).toBeNull();
    expect(harness.resourceId).toBe('');
    // memory option is NOT set for non-forked runs
    expect(streamOpts.memory).toBeUndefined();
  });
});
