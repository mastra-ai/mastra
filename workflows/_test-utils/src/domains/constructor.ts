/**
 * Constructor tests for DurableAgent
 *
 * Note: Some tests check DurableAgent-specific properties like runRegistry
 * and are skipped for other implementations.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createSimpleMockModel } from '../mock-models';

export function createConstructorTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('agent creation', () => {
    it('should create agent with id and name', async () => {
      const mockModel = createSimpleMockModel();

      const agent = await createAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test assistant',
        model: mockModel,
      });

      // id and name should be available (id may have suffix for uniqueness)
      expect(agent.id).toContain('test-agent');
      expect(agent.name).toContain('Test Agent');
    });

    it('should use agent id as name when name is not provided', async () => {
      const mockModel = createSimpleMockModel();

      const agent = await createAgent({
        id: 'my-agent-id',
        instructions: 'You are a test assistant',
        model: mockModel,
      });

      // Name should contain the id (may have suffix)
      expect(agent.name).toContain('my-agent-id');
    });
  });
}
