import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../request-context';

// We need to mock Agent before importing tools.ts.
const { mockStream, MockAgent } = vi.hoisted(() => {
  const mockStream = vi.fn();
  class MockAgent {
    stream = mockStream;
    constructor(_opts: any) {}
  }
  return { mockStream, MockAgent };
});

vi.mock('../agent', () => ({
  Agent: MockAgent,
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
    maxSteps: 50,
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

  it('forwards the parent requestContext to subagent.stream()', async () => {
    mockStream.mockResolvedValue(createMockStreamResponse('result text'));

    const tool = createSubagentTool({
      subagents,
      resolveModel,
      fallbackModelId: 'test-model',
    });

    // Build a requestContext with harness data, simulating what the parent agent provides
    const requestContext = new RequestContext();
    const harnessCtx: Partial<HarnessRequestContext> = {
      emitEvent: vi.fn(),
    };
    requestContext.set('harness', harnessCtx);

    const result = await (tool as any).execute(
      { agentType: 'explore', task: 'Find all usages of foo' },
      { requestContext, agent: { toolCallId: 'tc-1' } },
    );

    expect(mockStream).toHaveBeenCalledTimes(1);
    const streamCall = mockStream.mock.calls[0]!;
    // The exact same RequestContext instance should be forwarded
    expect(streamCall[1].requestContext).toBe(requestContext);
    expect(result.isError).toBe(false);
  });

  it('forwards requestContext even when harness context is not set', async () => {
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
    expect(streamCall[1].requestContext).toBe(requestContext);
    // Verify the custom data is accessible through the forwarded context
    expect(streamCall[1].requestContext.get('custom-key')).toBe('custom-value');
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
    expect(streamOpts).toEqual({
      maxSteps: 50,
      stopWhen: undefined,
      abortSignal: abortController.signal,
      requireToolApproval: false,
      requestContext,
    });
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
