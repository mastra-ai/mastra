/**
 * Workspace tests for DurableAgent
 *
 * These tests verify that workspace is properly stored in the registry
 * and passed to tool execution context.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createToolCallThenTextModel } from '../mock-models';

export function createWorkspaceTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('workspace support', () => {
    it('should store workspace in registry during preparation', async () => {
      // Create a minimal workspace mock
      // No filesystem property - avoids createWorkspaceTools adding tools
      const mockWorkspace = {
        id: 'test-workspace',
        name: 'Test Workspace',
        getToolsConfig: () => undefined,
      } as any;

      const mockModel = createTextStreamModel('Hello');

      const agent = new Agent({
        id: 'workspace-prep-agent',
        name: 'Workspace Prep Agent',
        instructions: 'Test workspace',
        model: mockModel,
        workspace: mockWorkspace,
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      // Registry entry should have workspace
      expect(result.registryEntry).toBeDefined();
      expect(result.registryEntry.workspace).toBe(mockWorkspace);
    });

    it('should pass workspace to tool execution context', async () => {
      // Create a minimal workspace mock without filesystem
      // This prevents auto-generated workspace tools from being added
      const mockWorkspace = {
        id: 'test-workspace',
        name: 'Test Workspace',
        // No filesystem - avoids createWorkspaceTools adding tools
        getToolsConfig: () => undefined,
      } as any;

      let receivedWorkspace: any = null;

      const workspaceTool = createTool({
        id: 'workspace-test-tool',
        description: 'A tool that checks for workspace',
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }, options) => {
          receivedWorkspace = options?.workspace;
          return `Processed: ${value}`;
        },
      });

      // Create a model that calls the tool, then outputs text
      // Use same pattern as the passing test
      const mockModel = createToolCallThenTextModel('workspaceTestTool', { value: 'test' }, 'Done processing');

      const agent = new Agent({
        id: 'workspace-tool-agent',
        name: 'Workspace Tool Agent',
        instructions: 'Use the workspace test tool',
        model: mockModel,
        tools: { workspaceTestTool: workspaceTool },
        workspace: mockWorkspace,
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const { output, cleanup } = await durableAgent.stream('Test workspace tool');

      // Wait for output to be consumed
      let text = '';
      for await (const chunk of output.textStream) {
        text += chunk;
      }

      cleanup();

      // The tool should have received the workspace
      expect(receivedWorkspace).toBe(mockWorkspace);
    });

    it('should work without workspace configured', async () => {
      const mockModel = createTextStreamModel('Hello without workspace');

      const agent = new Agent({
        id: 'no-workspace-agent',
        name: 'No Workspace Agent',
        instructions: 'Test without workspace',
        model: mockModel,
        // No workspace configured
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      // Registry entry should have undefined workspace
      expect(result.registryEntry).toBeDefined();
      expect(result.registryEntry.workspace).toBeUndefined();
    });

    it('should pass undefined workspace to tools when not configured', async () => {
      let receivedWorkspace: any = 'not-called';

      const testTool = createTool({
        id: 'workspace-check-tool',
        description: 'A tool that checks workspace value',
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }, options) => {
          receivedWorkspace = options?.workspace;
          return `Value: ${value}`;
        },
      });

      // Create a model that calls the tool, then outputs text
      const mockModel = createToolCallThenTextModel('workspaceCheckTool', { value: 'test' }, 'Done');

      const agent = new Agent({
        id: 'no-workspace-tool-agent',
        name: 'No Workspace Tool Agent',
        instructions: 'Use the tool',
        model: mockModel,
        tools: { workspaceCheckTool: testTool },
        // No workspace configured
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const { output, cleanup } = await durableAgent.stream('Test tool');

      let text = '';
      for await (const chunk of output.textStream) {
        text += chunk;
      }

      cleanup();

      // The tool should have received undefined workspace
      expect(receivedWorkspace).toBeUndefined();
    });
  });
}
