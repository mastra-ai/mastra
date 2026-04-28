/**
 * Workflow tests for DurableAgent
 *
 * These tests are specific to DurableAgent's getWorkflow() method which
 * InngestDurableAgent does not have (it uses a shared workflow instead).
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createSimpleMockModel } from '../mock-models';

export function createWorkflowTests(context: DurableAgentTestContext) {
  const { getPubSub, hasRunRegistry } = context;

  // Skip workflow tests if not using DurableAgent (indicated by hasRunRegistry)
  // InngestDurableAgent doesn't have getWorkflow() method
  if (!hasRunRegistry) {
    describe('getWorkflow', () => {
      it.skip('skipped - implementation uses shared workflow pattern', () => {});
    });
    return;
  }

  describe('getWorkflow', () => {
    it('should return the durable workflow', () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      // DurableAgent-specific: use direct instantiation
      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const workflow = agent.getWorkflow();

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('durable-agentic-loop');
    });

    it('should return the same workflow instance on multiple calls', () => {
      const mockModel = createSimpleMockModel();
      const pubsub = getPubSub();

      // DurableAgent-specific: use direct instantiation
      const agent = new DurableAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
        pubsub,
      });

      const workflow1 = agent.getWorkflow();
      const workflow2 = agent.getWorkflow();

      expect(workflow1).toBe(workflow2);
    });
  });
}
