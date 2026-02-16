/**
 * Working memory context tests for DurableAgent
 *
 * Tests that memory options (thread + resource) are properly
 * propagated and that tools work alongside memory config.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createWorkingMemoryContextTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('working memory context propagation', () => {
    it('should propagate thread and resource in prepare', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'wm-context-agent',
        instructions: 'Test working memory context',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'wm-thread-1',
          resource: 'wm-user-1',
        },
      });

      expect(result.workflowInput.state.threadId).toBe('wm-thread-1');
      expect(result.workflowInput.state.resourceId).toBe('wm-user-1');
    });

    it('should exclude thread/resource when no memory options', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'wm-no-context-agent',
        instructions: 'Test without memory context',
        model: mockModel,
      });

      const result = await agent.prepare('Hello');

      expect(result.workflowInput.state.threadId).toBeUndefined();
      expect(result.workflowInput.state.resourceId).toBeUndefined();
    });

    it('should serialize custom tools alongside memory options', async () => {
      const mockModel = createTextStreamModel('Hello');

      const customTool = createTool({
        id: 'custom-wm-tool',
        description: 'A custom tool',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => `Result: ${query}`,
      });

      const agent = await createAgent({
        id: 'wm-tools-agent',
        instructions: 'Test tools with memory',
        model: mockModel,
        tools: { customTool },
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'tools-thread',
          resource: 'tools-user',
        },
      });

      // Both tools and memory should be serialized
      expect(result.workflowInput.toolsMetadata).toBeDefined();
      expect(result.workflowInput.toolsMetadata.length).toBeGreaterThan(0);
      expect(result.workflowInput.state.threadId).toBe('tools-thread');
      expect(result.workflowInput.state.resourceId).toBe('tools-user');
    });
  });
}
