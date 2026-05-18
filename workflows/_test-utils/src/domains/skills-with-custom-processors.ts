/**
 * Skills with custom processors tests for DurableAgent
 *
 * Tests that workspace with skills is preserved when
 * custom input processors are also configured.
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createSkillsWithCustomProcessorsTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('skills with custom processors', () => {
    it('should preserve workspace in registry with skills configured', async () => {
      const mockModel = createTextStreamModel('Hello');

      const mockWorkspace = {
        id: 'skills-workspace',
        name: 'Skills Workspace',
        getToolsConfig: () => undefined,
      } as any;

      const agent = new Agent({
        id: 'skills-agent',
        name: 'Skills Agent',
        instructions: 'Test skills preservation',
        model: mockModel,
        workspace: mockWorkspace,
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      expect(result.registryEntry).toBeDefined();
      expect(result.registryEntry.workspace).toBe(mockWorkspace);
    });

    it('should preserve workspace alongside input processors', async () => {
      const mockModel = createTextStreamModel('Hello');

      const mockWorkspace = {
        id: 'skills-proc-workspace',
        name: 'Skills Processor Workspace',
        getToolsConfig: () => undefined,
      } as any;

      const mockProcessor = {
        id: 'custom-processor',
        processInput: async ({ messages }: any) => ({ messages }),
      };

      const agent = new Agent({
        id: 'skills-proc-agent',
        name: 'Skills Processor Agent',
        instructions: 'Test skills with processors',
        model: mockModel,
        workspace: mockWorkspace,
        inputProcessors: [mockProcessor],
      } as any);

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      expect(result.registryEntry).toBeDefined();
      expect(result.registryEntry.workspace).toBe(mockWorkspace);
    });
  });
}
