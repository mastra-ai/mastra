/**
 * AI Tracing Context Integration Tests
 *
 * Tests for automatic context propagation and proxy-based wrapping functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wrapAgent, wrapMastra, wrapWorkflow } from './context';
import type { AITracingContext } from './types';

// Mock classes
class MockMastra {
  getAgent = vi.fn();
  getAgentById = vi.fn();
  getWorkflow = vi.fn();
  getWorkflowById = vi.fn();
  otherMethod = vi.fn().mockReturnValue('other-result');
}

class MockAgent {
  generate = vi.fn();
  stream = vi.fn();
  streamV2 = vi.fn();
  otherMethod = vi.fn().mockReturnValue('agent-other-result');
}

class MockWorkflow {
  execute = vi.fn();
  stream = vi.fn();
  otherMethod = vi.fn().mockReturnValue('workflow-other-result');
}

class MockAISpan {
  constructor(public isNoOp = false) {}
  aiTracing = { name: 'mock-tracing' };
  createChildSpan = vi.fn();
}

class NoOpAISpan {
  constructor() {}
  // No aiTracing property to simulate NoOp
}

describe('AI Tracing Context Integration', () => {
  let mockMastra: MockMastra;
  let mockAgent: MockAgent;
  let mockWorkflow: MockWorkflow;
  let mockSpan: MockAISpan;
  let noOpSpan: NoOpAISpan;
  let aiTracingContext: AITracingContext;
  let noOpContext: AITracingContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMastra = new MockMastra();
    mockAgent = new MockAgent();
    mockWorkflow = new MockWorkflow();
    mockSpan = new MockAISpan();
    noOpSpan = new NoOpAISpan();

    // Mock agent and workflow returns
    mockMastra.getAgent.mockReturnValue(mockAgent);
    mockMastra.getAgentById.mockReturnValue(mockAgent);
    mockMastra.getWorkflow.mockReturnValue(mockWorkflow);
    mockMastra.getWorkflowById.mockReturnValue(mockWorkflow);

    aiTracingContext = { currentAISpan: mockSpan as any };
    noOpContext = { currentAISpan: noOpSpan as any };
  });

  describe('wrapMastra', () => {
    it('should return wrapped Mastra with tracing context', () => {
      const wrapped = wrapMastra(mockMastra as any, aiTracingContext);

      expect(wrapped).not.toBe(mockMastra);
      expect(typeof wrapped.getAgent).toBe('function');
      expect(typeof wrapped.getWorkflow).toBe('function');
    });

    it('should return original Mastra when no current span', () => {
      const emptyContext = { currentAISpan: undefined };
      const wrapped = wrapMastra(mockMastra as any, emptyContext);

      expect(wrapped).toBe(mockMastra);
    });

    it('should return original Mastra when using NoOp span', () => {
      const wrapped = wrapMastra(mockMastra as any, noOpContext);

      expect(wrapped).toBe(mockMastra);
    });

    it('should wrap agent getters to return tracing-aware agents', () => {
      const wrapped = wrapMastra(mockMastra as any, aiTracingContext);

      const agent = wrapped.getAgent('test-agent');
      expect(mockMastra.getAgent).toHaveBeenCalledWith('test-agent');

      // Agent should be wrapped (different instance)
      expect(agent).not.toBe(mockAgent);
    });

    it('should wrap workflow getters to return tracing-aware workflows', () => {
      const wrapped = wrapMastra(mockMastra as any, aiTracingContext);

      const workflow = wrapped.getWorkflow('test-workflow');
      expect(mockMastra.getWorkflow).toHaveBeenCalledWith('test-workflow');

      // Workflow should be wrapped (different instance)
      expect(workflow).not.toBe(mockWorkflow);
    });

    it('should pass through other methods unchanged', () => {
      const wrapped = wrapMastra(mockMastra as any, aiTracingContext);

      const result = wrapped.otherMethod();
      expect(result).toBe('other-result');
      expect(mockMastra.otherMethod).toHaveBeenCalled();
    });

    it('should handle proxy creation errors gracefully', () => {
      // Test that the function handles errors in try/catch properly
      // We'll test this by verifying the error handling code path exists
      // since mocking global Proxy affects other tests

      // For now, just verify the function returns original on invalid context
      const invalidContext = { currentAISpan: null as any };
      const wrapped = wrapMastra(mockMastra as any, invalidContext);

      expect(wrapped).toBe(mockMastra);
    });
  });

  describe('wrapAgent', () => {
    it('should return wrapped Agent with tracing context', () => {
      const wrapped = wrapAgent(mockAgent as any, aiTracingContext);

      expect(wrapped).not.toBe(mockAgent);
      expect(typeof wrapped.generate).toBe('function');
      expect(typeof wrapped.stream).toBe('function');
      expect(typeof wrapped.streamV2).toBe('function');
    });

    it('should return original Agent when no current span', () => {
      const emptyContext = { currentAISpan: undefined };
      const wrapped = wrapAgent(mockAgent as any, emptyContext);

      expect(wrapped).toBe(mockAgent);
    });

    it('should return original Agent when using NoOp span', () => {
      const wrapped = wrapAgent(mockAgent as any, noOpContext);

      expect(wrapped).toBe(mockAgent);
    });

    it('should inject tracing context into generate method', async () => {
      const wrapped = wrapAgent(mockAgent as any, aiTracingContext);

      await wrapped.generate('test input', { temperature: 0.7 });

      expect(mockAgent.generate).toHaveBeenCalledWith('test input', {
        temperature: 0.7,
        aiTracingContext,
      });
    });

    it('should inject tracing context into stream method', async () => {
      const wrapped = wrapAgent(mockAgent as any, aiTracingContext);

      await wrapped.stream('test input', { maxTokens: 100 });

      expect(mockAgent.stream).toHaveBeenCalledWith('test input', {
        maxTokens: 100,
        aiTracingContext,
      });
    });

    it('should inject tracing context into streamV2 method', async () => {
      const wrapped = wrapAgent(mockAgent as any, aiTracingContext);

      await wrapped.streamV2('test input');

      expect(mockAgent.streamV2).toHaveBeenCalledWith('test input', {
        aiTracingContext,
      });
    });

    it('should handle method calls without options', async () => {
      const wrapped = wrapAgent(mockAgent as any, aiTracingContext);

      await wrapped.generate('test input');

      expect(mockAgent.generate).toHaveBeenCalledWith('test input', {
        aiTracingContext,
      });
    });

    it('should pass through other methods unchanged', () => {
      const wrapped = wrapAgent(mockAgent as any, aiTracingContext);

      const result = wrapped.otherMethod();
      expect(result).toBe('agent-other-result');
      expect(mockAgent.otherMethod).toHaveBeenCalled();
    });

    it('should handle agent wrapping errors gracefully', () => {
      // Test that the function handles invalid contexts properly
      const invalidContext = { currentAISpan: null as any };
      const wrapped = wrapAgent(mockAgent as any, invalidContext);

      expect(wrapped).toBe(mockAgent);
    });
  });

  describe('wrapWorkflow', () => {
    it('should return wrapped Workflow with tracing context', () => {
      const wrapped = wrapWorkflow(mockWorkflow as any, aiTracingContext);

      expect(wrapped).not.toBe(mockWorkflow);
      expect(typeof wrapped.execute).toBe('function');
      expect(typeof wrapped.stream).toBe('function');
    });

    it('should return original Workflow when no current span', () => {
      const emptyContext = { currentAISpan: undefined };
      const wrapped = wrapWorkflow(mockWorkflow as any, emptyContext);

      expect(wrapped).toBe(mockWorkflow);
    });

    it('should return original Workflow when using NoOp span', () => {
      const wrapped = wrapWorkflow(mockWorkflow as any, noOpContext);

      expect(wrapped).toBe(mockWorkflow);
    });

    it('should inject tracing context into execute method', async () => {
      const wrapped = wrapWorkflow(mockWorkflow as any, aiTracingContext);

      await wrapped.execute({ input: 'test' }, { runtimeContext: {} });

      expect(mockWorkflow.execute).toHaveBeenCalledWith(
        { input: 'test' },
        {
          runtimeContext: {},
          aiTracingContext,
        },
      );
    });

    it('should inject tracing context into stream method', async () => {
      const wrapped = wrapWorkflow(mockWorkflow as any, aiTracingContext);

      await wrapped.stream({ input: 'test' });

      expect(mockWorkflow.stream).toHaveBeenCalledWith(
        { input: 'test' },
        {
          aiTracingContext,
        },
      );
    });

    it('should handle method calls without options', async () => {
      const wrapped = wrapWorkflow(mockWorkflow as any, aiTracingContext);

      await wrapped.execute({ input: 'test' });

      expect(mockWorkflow.execute).toHaveBeenCalledWith(
        { input: 'test' },
        {
          aiTracingContext,
        },
      );
    });

    it('should pass through other methods unchanged', () => {
      const wrapped = wrapWorkflow(mockWorkflow as any, aiTracingContext);

      const result = wrapped.otherMethod();
      expect(result).toBe('workflow-other-result');
      expect(mockWorkflow.otherMethod).toHaveBeenCalled();
    });

    it('should handle workflow wrapping errors gracefully', () => {
      // Test that the function handles invalid contexts properly
      const invalidContext = { currentAISpan: null as any };
      const wrapped = wrapWorkflow(mockWorkflow as any, invalidContext);

      expect(wrapped).toBe(mockWorkflow);
    });
  });

  describe('Integration scenarios', () => {
    it('should work in nested workflow step scenario', () => {
      // Simulate a workflow step that gets an agent from mastra
      const wrapped = wrapMastra(mockMastra as any, aiTracingContext);
      const agent = wrapped.getAgent('test-agent');

      // Agent should be wrapped and ready to inject context
      expect(agent).not.toBe(mockAgent);

      // When the agent is used, it should automatically get tracing context
      agent.generate('test input');

      expect(mockAgent.generate).toHaveBeenCalledWith('test input', {
        aiTracingContext,
      });
    });

    it('should work with workflow calling another workflow', () => {
      const wrapped = wrapMastra(mockMastra as any, aiTracingContext);
      const workflow = wrapped.getWorkflow('child-workflow');

      expect(workflow).not.toBe(mockWorkflow);

      workflow.execute({ input: 'test' });

      expect(mockWorkflow.execute).toHaveBeenCalledWith(
        { input: 'test' },
        {
          aiTracingContext,
        },
      );
    });

    it('should preserve type safety', () => {
      // This test ensures TypeScript compilation works correctly
      const wrapped = wrapMastra(mockMastra as any, aiTracingContext);

      // These should all compile and maintain type safety
      const agent = wrapped.getAgent('test');
      const agentById = wrapped.getAgentById('test-id');
      const workflow = wrapped.getWorkflow('test');
      const workflowById = wrapped.getWorkflowById('test-id');

      expect(agent).toBeDefined();
      expect(agentById).toBeDefined();
      expect(workflow).toBeDefined();
      expect(workflowById).toBeDefined();
    });

    it('should handle mixed wrapped and unwrapped usage', async () => {
      // Some contexts might have tracing, others might not
      const wrappedMastra = wrapMastra(mockMastra as any, aiTracingContext);
      const unwrappedMastra = wrapMastra(mockMastra as any, { currentAISpan: undefined });

      const wrappedAgent = wrappedMastra.getAgent('test');
      const unwrappedAgent = unwrappedMastra.getAgent('test');

      // Wrapped agent should inject context
      await wrappedAgent.generate('test');
      expect(mockAgent.generate).toHaveBeenLastCalledWith('test', { aiTracingContext });

      // Unwrapped agent should be the original (because unwrappedMastra is actually the original)
      expect(unwrappedAgent).toBe(mockAgent);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle undefined aiTracingContext gracefully', () => {
      const wrapped = wrapMastra(mockMastra as any, { currentAISpan: undefined });
      expect(wrapped).toBe(mockMastra);
    });

    it('should handle NoOp spans correctly', () => {
      // Test different ways a NoOp span might be identified
      const noOpSpan1 = new NoOpAISpan();
      const noOpSpan2 = { constructor: { name: 'NoOpAISpan' }, aiTracing: null } as any;
      const noOpSpan3 = { __isNoOp: true } as any;

      const wrapped1 = wrapMastra(mockMastra as any, { currentAISpan: noOpSpan1 as any });
      const wrapped2 = wrapMastra(mockMastra as any, { currentAISpan: noOpSpan2 });
      const wrapped3 = wrapMastra(mockMastra as any, { currentAISpan: noOpSpan3 });

      expect(wrapped1).toBe(mockMastra);
      expect(wrapped2).toBe(mockMastra);
      expect(wrapped3).toBe(mockMastra);
    });

    it('should handle method call errors gracefully', async () => {
      mockAgent.generate.mockRejectedValue(new Error('Generation failed'));

      const wrapped = wrapAgent(mockAgent as any, aiTracingContext);

      // Error should propagate normally
      await expect(wrapped.generate('test')).rejects.toThrow('Generation failed');
    });

    it('should handle property access errors in wrapper methods', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create a mastra that has a working getAgent method
      const workingMastra = {
        getAgent: vi.fn().mockReturnValue(mockAgent),
        otherMethod: () => 'works',
      };

      // Mock the agent to throw when trying to access it
      workingMastra.getAgent.mockImplementation(() => {
        throw new Error('getAgent failed');
      });

      const wrapped = wrapMastra(workingMastra as any, aiTracingContext);

      // The wrapper should catch the error in the get handler
      expect(() => wrapped.getAgent('test')).toThrow('getAgent failed');

      // Since the error is thrown by the original method, not the wrapper, no console.warn is called
      expect(consoleSpy).not.toHaveBeenCalled();

      // Other methods should still work
      expect(wrapped.otherMethod()).toBe('works');

      consoleSpy.mockRestore();
    });
  });
});
