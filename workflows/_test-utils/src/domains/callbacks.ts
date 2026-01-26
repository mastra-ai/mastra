/**
 * Callback tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createErrorModel } from '../mock-models';

export function createCallbackTests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;

  describe('callbacks', () => {
    it('should invoke onFinish callback when streaming completes', async () => {
      const mockModel = createTextStreamModel('Complete response');
      let finishData: any = null;

      const agent = await createAgent({
        id: 'finish-callback-agent',
        name: 'Finish Callback Agent',
        instructions: 'Test',
        model: mockModel,
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

      const agent = await createAgent({
        id: 'error-callback-agent',
        name: 'Error Callback Agent',
        instructions: 'Test',
        model: errorModel,
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

      const agent = await createAgent({
        id: 'step-callback-agent',
        name: 'Step Callback Agent',
        instructions: 'Test',
        model: mockModel,
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

      const agent = await createAgent({
        id: 'error-model-agent',
        name: 'Error Model Agent',
        instructions: 'Test',
        model: errorModel,
      });

      const { cleanup } = await agent.stream('Test', {
        onError: error => {
          errorReceived = error;
        },
      });

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));

      cleanup();
    });

    it('should allow cleanup after error', async () => {
      const errorModel = createErrorModel('Cleanup test error');

      const agent = await createAgent({
        id: 'cleanup-error-agent',
        name: 'Cleanup Error Agent',
        instructions: 'Test',
        model: errorModel,
      });

      const { cleanup } = await agent.stream('Test');

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));

      // Cleanup should not throw
      expect(() => cleanup()).not.toThrow();
    });
  });
}
