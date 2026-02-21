/**
 * Save and error handling tests for DurableAgent
 *
 * Tests error propagation through the DurableAgent stream
 * and that prepare() succeeds independently of model execution.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createErrorModel } from '../mock-models';

export function createSaveAndErrorsTests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;

  describe('save and error handling', () => {
    it('should complete stream with normal model', async () => {
      const mockModel = createTextStreamModel('Normal response');

      const agent = await createAgent({
        id: 'normal-stream-agent',
        instructions: 'Test normal streaming',
        model: mockModel,
      });

      const { runId, cleanup } = await agent.stream('Hello');

      expect(runId).toBeDefined();

      cleanup();
    });

    it('should prepare successfully even with error model', async () => {
      // Preparation doesn't execute the model, so this should work
      const mockModel = createErrorModel('Model failure');

      const agent = await createAgent({
        id: 'error-prepare-agent',
        instructions: 'Test error model prepare',
        model: mockModel,
      });

      const result = await agent.prepare('Hello');

      expect(result.runId).toBeDefined();
      expect(result.workflowInput).toBeDefined();
    });

    it('should handle error model via stream without crashing', async () => {
      const mockModel = createErrorModel('Simulated error');

      const agent = await createAgent({
        id: 'error-stream-agent',
        instructions: 'Test error streaming',
        model: mockModel,
      });

      const { cleanup } = await agent.stream('Hello', {
        onError: () => {
          // Error received — expected for error models
        },
      });

      // Wait for error to propagate
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay * 2));

      cleanup();
    });
  });
}
