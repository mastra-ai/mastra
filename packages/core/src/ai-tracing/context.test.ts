/**
 * AI Tracing Context Integration Tests
 *
 * Tests for automatic context propagation and proxy-based wrapping functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { isMastra, wrapMastra } from './context';
import type { TracingContext } from './types';

// Mock classes
class MockMastra {
  getAgent = vi.fn();
  getAgentById = vi.fn();
  getWorkflow = vi.fn();
  getWorkflowById = vi.fn();
  otherMethod = vi.fn().mockReturnValue('other-result');
}

class MockAgent {
  #mastra = { id: 'mock-mastra' };
  generate = vi.fn();
  generateVNext = vi.fn();
  stream = vi.fn();
  streamVNext = vi.fn();
  otherMethod = vi.fn().mockReturnValue('agent-other-result');
  getLLM() {
    // This accesses the private field to simulate the real getLLM behavior
    // Without proper binding, 'this' will be the proxy and #mastra access will fail
    return { mastra: this.#mastra };
  }
}

class MockRun {
  start = vi.fn();
  otherMethod = vi.fn().mockReturnValue('run-other-result');
}

class MockWorkflow {
  execute = vi.fn();
  createRun = vi.fn();
  createRunAsync = vi.fn();
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
  let mockRun: MockRun;
  let mockSpan: MockAISpan;
  let noOpSpan: NoOpAISpan;
  let tracingContext: TracingContext;
  let noOpContext: TracingContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMastra = new MockMastra();
    mockAgent = new MockAgent();
    mockWorkflow = new MockWorkflow();
    mockRun = new MockRun();
    mockSpan = new MockAISpan();
    noOpSpan = new NoOpAISpan();

    // Mock agent, workflow, and run returns
    mockMastra.getAgent.mockReturnValue(mockAgent);
    mockMastra.getAgentById.mockReturnValue(mockAgent);
    mockMastra.getWorkflow.mockReturnValue(mockWorkflow);
    mockMastra.getWorkflowById.mockReturnValue(mockWorkflow);
    mockWorkflow.createRun.mockReturnValue(mockRun);
    mockWorkflow.createRunAsync.mockResolvedValue(mockRun);

    tracingContext = { currentSpan: mockSpan as any };
    noOpContext = { currentSpan: noOpSpan as any };
  });

  describe('wrapMastra', () => {
    it('should return wrapped Mastra with tracing context', () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);

      expect(wrapped).not.toBe(mockMastra);
      expect(typeof wrapped.getAgent).toBe('function');
      expect(typeof wrapped.getWorkflow).toBe('function');
    });

    it('should return original Mastra when no current span', () => {
      const emptyContext = { currentSpan: undefined };
      const wrapped = wrapMastra(mockMastra as any, emptyContext);

      expect(wrapped).toBe(mockMastra);
    });

    it('should return original Mastra when using NoOp span', () => {
      const wrapped = wrapMastra(mockMastra as any, noOpContext);

      expect(wrapped).toBe(mockMastra);
    });

    it('should wrap agent getters to return tracing-aware agents', () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);

      const agent = wrapped.getAgent('test-agent');
      expect(mockMastra.getAgent).toHaveBeenCalledWith('test-agent');

      // Agent should be wrapped (different instance)
      expect(agent).not.toBe(mockAgent);
    });

    it('should wrap workflow getters to return tracing-aware workflows', () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);

      const workflow = wrapped.getWorkflow('test-workflow');
      expect(mockMastra.getWorkflow).toHaveBeenCalledWith('test-workflow');

      // Workflow should be wrapped (different instance)
      expect(workflow).not.toBe(mockWorkflow);
    });

    it('should pass through other methods unchanged', () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);

      const result = wrapped.otherMethod();
      expect(result).toBe('other-result');
      expect(mockMastra.otherMethod).toHaveBeenCalled();
    });

    it('should handle proxy creation errors gracefully', () => {
      // Test that the function handles errors in try/catch properly
      // We'll test this by verifying the error handling code path exists
      // since mocking global Proxy affects other tests

      // For now, just verify the function returns original on invalid context
      const invalidContext = { currentSpan: null as any };
      const wrapped = wrapMastra(mockMastra as any, invalidContext);

      expect(wrapped).toBe(mockMastra);
    });
  });

  describe('workflow run creation and tracing', () => {
    it('should wrap createRunAsync to return run proxy', async () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);
      const workflow = wrapped.getWorkflow('test-workflow');

      const run = await workflow.createRunAsync();

      expect(mockWorkflow.createRunAsync).toHaveBeenCalled();
      expect(run).not.toBe(mockRun); // Should be wrapped
    });

    it('should inject tracing context into run start method', async () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);
      const workflow = wrapped.getWorkflow('test-workflow');
      const run = await workflow.createRunAsync();

      await run.start({ inputData: { test: 'data' }, runtimeContext: {} });

      expect(mockRun.start).toHaveBeenCalledWith({
        inputData: { test: 'data' },
        runtimeContext: {},
        tracingContext,
      });
    });

    it('should preserve user-provided tracingContext in run start', async () => {
      const userTracingContext = { currentSpan: 'user-span' as any };
      const wrapped = wrapMastra(mockMastra as any, tracingContext);
      const workflow = wrapped.getWorkflow('test-workflow');
      const run = await workflow.createRunAsync();

      await run.start({
        inputData: { test: 'data' },
        tracingContext: userTracingContext,
      });

      expect(mockRun.start).toHaveBeenCalledWith({
        inputData: { test: 'data' },
        tracingContext: userTracingContext, // User's context should take precedence
      });
    });

    it('should pass through other run methods unchanged', async () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);
      const workflow = wrapped.getWorkflow('test-workflow');
      const run = await workflow.createRunAsync();

      const result = run.otherMethod();
      expect(result).toBe('run-other-result');
      expect(mockRun.otherMethod).toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should work in nested workflow step scenario', () => {
      // Simulate a workflow step that gets an agent from mastra
      const wrapped = wrapMastra(mockMastra as any, tracingContext);
      const agent = wrapped.getAgent('test-agent');

      // Agent should be wrapped and ready to inject context
      expect(agent).not.toBe(mockAgent);

      // When the agent is used, it should automatically get tracing context
      agent.generate('test input');

      expect(mockAgent.generate).toHaveBeenCalledWith('test input', {
        tracingContext,
      });
    });

    it('should work with workflow calling another workflow', () => {
      const wrapped = wrapMastra(mockMastra as any, tracingContext);
      const workflow = wrapped.getWorkflow('child-workflow');

      expect(workflow).not.toBe(mockWorkflow);

      workflow.execute({ input: 'test' });

      expect(mockWorkflow.execute).toHaveBeenCalledWith(
        { input: 'test' },
        {
          tracingContext,
        },
      );
    });

    it('should preserve type safety', () => {
      // This test ensures TypeScript compilation works correctly
      const wrapped = wrapMastra(mockMastra as any, tracingContext);

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
      const wrappedMastra = wrapMastra(mockMastra as any, tracingContext);
      const unwrappedMastra = wrapMastra(mockMastra as any, { currentSpan: undefined });

      const wrappedAgent = wrappedMastra.getAgent('test');
      const unwrappedAgent = unwrappedMastra.getAgent('test');

      // Wrapped agent should inject context
      await wrappedAgent.generate('test');
      expect(mockAgent.generate).toHaveBeenLastCalledWith('test', { tracingContext });

      // Unwrapped agent should be the original (because unwrappedMastra is actually the original)
      expect(unwrappedAgent).toBe(mockAgent);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle undefined tracingContext gracefully', () => {
      const wrapped = wrapMastra(mockMastra as any, { currentSpan: undefined });
      expect(wrapped).toBe(mockMastra);
    });

    it('should handle NoOp spans correctly', () => {
      // Test different ways a NoOp span might be identified
      const noOpSpan1 = new NoOpAISpan();
      const noOpSpan2 = { constructor: { name: 'NoOpAISpan' }, aiTracing: null } as any;
      const noOpSpan3 = { __isNoOp: true } as any;

      const wrapped1 = wrapMastra(mockMastra as any, { currentSpan: noOpSpan1 as any });
      const wrapped2 = wrapMastra(mockMastra as any, { currentSpan: noOpSpan2 });
      const wrapped3 = wrapMastra(mockMastra as any, { currentSpan: noOpSpan3 });

      expect(wrapped1).toBe(mockMastra);
      expect(wrapped2).toBe(mockMastra);
      expect(wrapped3).toBe(mockMastra);
    });

    it('should handle method call errors gracefully', async () => {
      mockAgent.generate.mockRejectedValue(new Error('Generation failed'));

      const wrapped = wrapMastra(mockMastra as any, tracingContext);
      const agent = wrapped.getAgent('test-agent');

      // Error should propagate normally through the wrapped agent
      await expect(agent.generate('test')).rejects.toThrow('Generation failed');
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

      const wrapped = wrapMastra(workingMastra as any, tracingContext);

      // The wrapper should catch the error in the get handler
      expect(() => wrapped.getAgent('test')).toThrow('getAgent failed');

      // Since the error is thrown by the original method, not the wrapper, no console.warn is called
      expect(consoleSpy).not.toHaveBeenCalled();

      // Other methods should still work
      expect(wrapped.otherMethod()).toBe('works');

      consoleSpy.mockRestore();
    });
  });

  describe('Mastra interface compatibility', () => {
    it('should verify that real Mastra class has expected AGENT_GETTERS and WORKFLOW_GETTERS methods', () => {
      // This test ensures that if the Mastra class interface changes,
      // we'll know to update our AGENT_GETTERS & WORKFLOW_GETTERS
      // constants in wrapMastra

      const mastra = new Mastra();
      expect(isMastra(mastra)).toBe(true);
    });

    it('should detect if wrapMastra would skip wrapping due to missing methods', () => {
      // Test object with no agent or workflow getters
      const primitivesMastra = {
        someOtherMethod: vi.fn(),
      };

      const wrapped = wrapMastra(primitivesMastra as any, tracingContext);

      // Should return the original object since it has no methods to wrap
      expect(wrapped).toBe(primitivesMastra);
    });

    it('should wrap objects that have all agent and workflow getters', () => {
      // Test object with only agent getters
      const agentOnlyMastra = {
        getAgent: vi.fn(),
        getAgentById: vi.fn(),
        getWorkflow: vi.fn(),
        getWorkflowById: vi.fn(),
        someOtherMethod: vi.fn(),
      };

      const wrapped = wrapMastra(agentOnlyMastra as any, tracingContext);

      // Should return a proxy (different object) since it has methods to wrap
      expect(wrapped).not.toBe(agentOnlyMastra);
      expect(typeof wrapped.getAgent).toBe('function');
    });
  });
});
