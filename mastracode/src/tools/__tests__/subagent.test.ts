import { RequestContext } from '@mastra/core/di';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to mock Agent before importing subagent.ts.
// vi.hoisted runs before vi.mock hoisting, so the variable is available.
const { mockStream, MockAgent } = vi.hoisted(() => {
  const mockStream = vi.fn();
  class MockAgent {
    stream = mockStream;
    constructor(_opts: any) {}
  }
  return { mockStream, MockAgent };
});

vi.mock('@mastra/core/agent', () => ({
  Agent: MockAgent,
}));

// Mock the subagent registry so tests don't depend on real definitions
vi.mock('../../agents/subagents/index.js', () => ({
  getSubagentIds: () => ['explore', 'plan', 'execute'],
  getSubagentDefinition: (id: string) => {
    const defs: Record<string, { id: string; name: string; instructions: string; allowedTools: string[] }> = {
      explore: {
        id: 'explore',
        name: 'Explore',
        instructions: 'You are an explorer.',
        allowedTools: ['view', 'search_content', 'find_files'],
      },
      plan: {
        id: 'plan',
        name: 'Plan',
        instructions: 'You are a planner.',
        allowedTools: ['view', 'search_content', 'find_files'],
      },
      execute: {
        id: 'execute',
        name: 'Execute',
        instructions: 'You are an executor.',
        allowedTools: ['view', 'search_content', 'find_files', 'string_replace_lsp', 'write_file', 'execute_command'],
      },
    };
    return defs[id];
  },
}));

import { createSubagentTool } from '../subagent.js';

/**
 * Helper to create a readable stream that yields the given chunks then closes.
 */
function createMockFullStream(chunks: Array<{ type: string; payload: Record<string, unknown> }>) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createMockStreamResponse(text: string, chunks?: Array<{ type: string; payload: Record<string, unknown> }>) {
  return {
    fullStream: createMockFullStream(chunks ?? [{ type: 'text-delta', payload: { text } }]),
    getFullOutput: vi.fn().mockResolvedValue({ text }),
  };
}

describe('createSubagentTool', () => {
  const dummyTools = {
    view: { id: 'view' },
    search_content: { id: 'search_content' },
    find_files: { id: 'find_files' },
  };

  const resolveModel = vi.fn().mockReturnValue({ modelId: 'test-model' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestContext forwarding', () => {
    it('forwards requestContext from parent tool context to subagent.stream()', async () => {
      mockStream.mockResolvedValue(createMockStreamResponse('result text'));

      const tool = createSubagentTool({ tools: dummyTools, resolveModel });

      // Build a requestContext with harness data, simulating what the parent agent provides
      const requestContext = new RequestContext();
      const harnessCtx: Partial<HarnessRequestContext> = {
        emitEvent: vi.fn(),
      };
      requestContext.set('harness', harnessCtx);
      requestContext.set('sandbox-allowed-paths', ['/some/path']);

      // Execute the tool with the requestContext
      const result = await (tool as any).execute(
        { agentType: 'explore', task: 'Find all usages of foo' },
        { requestContext, agent: { toolCallId: 'tc-1' } },
      );

      // Verify subagent.stream() was called with the same requestContext
      expect(mockStream).toHaveBeenCalledTimes(1);
      const streamCall = mockStream.mock.calls[0]!;
      expect(streamCall[1]).toMatchObject({
        requestContext,
      });
      // The exact same RequestContext instance should be forwarded
      expect(streamCall[1].requestContext).toBe(requestContext);
      expect(result.isError).toBe(false);
    });

    it('forwards requestContext even when harness context is not set', async () => {
      mockStream.mockResolvedValue(createMockStreamResponse('result text'));

      const tool = createSubagentTool({ tools: dummyTools, resolveModel });

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

    it('forwards default RequestContext when parent context has no explicit requestContext', async () => {
      mockStream.mockResolvedValue(createMockStreamResponse('result text'));

      const tool = createSubagentTool({ tools: dummyTools, resolveModel });

      // Execute without requestContext — core's createTool wrapper creates a default one
      const result = await (tool as any).execute(
        { agentType: 'explore', task: 'Explore something' },
        { agent: { toolCallId: 'tc-3' } },
      );

      expect(mockStream).toHaveBeenCalledTimes(1);
      const streamCall = mockStream.mock.calls[0]!;
      // The core creates a default RequestContext when none is provided
      expect(streamCall[1].requestContext).toBeInstanceOf(RequestContext);
      expect(result.isError).toBe(false);
    });

    it('forwards default RequestContext when context is undefined', async () => {
      mockStream.mockResolvedValue(createMockStreamResponse('result text'));

      const tool = createSubagentTool({ tools: dummyTools, resolveModel });

      // Execute with no context at all — core wraps with a default RequestContext
      const result = await (tool as any).execute({ agentType: 'explore', task: 'Explore something' }, undefined);

      expect(mockStream).toHaveBeenCalledTimes(1);
      const streamCall = mockStream.mock.calls[0]!;
      // The core creates a default RequestContext when none is provided
      expect(streamCall[1].requestContext).toBeInstanceOf(RequestContext);
      expect(result.isError).toBe(false);
    });
  });

  describe('stream options', () => {
    it('passes maxSteps and abortSignal alongside requestContext', async () => {
      const abortController = new AbortController();
      mockStream.mockResolvedValue(createMockStreamResponse('done'));

      const tool = createSubagentTool({ tools: dummyTools, resolveModel });

      const requestContext = new RequestContext();
      const harnessCtx: Partial<HarnessRequestContext> = {
        emitEvent: vi.fn(),
        abortSignal: abortController.signal,
      };
      requestContext.set('harness', harnessCtx);

      await (tool as any).execute(
        { agentType: 'explore', task: 'Do stuff' },
        { requestContext, agent: { toolCallId: 'tc-4' } },
      );

      expect(mockStream).toHaveBeenCalledTimes(1);
      const streamOpts = mockStream.mock.calls[0]![1];
      expect(streamOpts).toEqual({
        maxSteps: 50,
        abortSignal: abortController.signal,
        requestContext,
      });
    });
  });
});
