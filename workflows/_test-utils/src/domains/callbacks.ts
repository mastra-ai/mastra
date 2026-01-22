/**
 * Callback tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createErrorModel } from '../mock-models';

export function createCallbackTests({ getPubSub, eventPropagationDelay }: DurableAgentTestContext) {
  describe('callbacks', () => {
    it('should invoke onFinish callback when streaming completes', async () => {
      const mockModel = createTextStreamModel('Complete response');
      let finishData: any = null;
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'finish-callback-agent',
        name: 'Finish Callback Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const { cleanup } = await agent.stream('Test', {
        onFinish: data => {
          finishData = data;
        },
      });

      // Wait for workflow to complete
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));

      cleanup();
    });

    it('should invoke onError callback when error occurs', async () => {
      const errorModel = createErrorModel('Simulated LLM error');
      let errorReceived: Error | null = null;
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'error-callback-agent',
        name: 'Error Callback Agent',
        instructions: 'Test',
        model: errorModel,
        pubsub,
      });

      const { cleanup } = await agent.stream('Test', {
        onError: error => {
          errorReceived = error;
        },
      });

      // Wait for error to propagate
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));

      cleanup();
    });

    it('should invoke onStepFinish callback after each step', async () => {
      const mockModel = createTextStreamModel('Step complete');
      const stepResults: any[] = [];
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'step-callback-agent',
        name: 'Step Callback Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const { cleanup } = await agent.stream('Test', {
        onStepFinish: result => {
          stepResults.push(result);
        },
      });

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));
      cleanup();
    });
  });

  describe('error handling', () => {
    it('should handle model throwing error during streaming', async () => {
      const errorModel = createErrorModel('Model initialization failed');
      let errorReceived: Error | null = null;
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'error-model-agent',
        name: 'Error Model Agent',
        instructions: 'Test',
        model: errorModel,
        pubsub,
      });

      const { cleanup } = await agent.stream('Test', {
        onError: error => {
          errorReceived = error;
        },
      });

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));

      cleanup();
    });

    it('should cleanup registry on error', async () => {
      const errorModel = createErrorModel('Cleanup test error');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'cleanup-error-agent',
        name: 'Cleanup Error Agent',
        instructions: 'Test',
        model: errorModel,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Test');

      // Run should be registered initially
      expect(agent.runRegistry.has(runId)).toBe(true);

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));

      // Manual cleanup should work
      cleanup();
      expect(agent.runRegistry.has(runId)).toBe(false);
    });
  });
}
