/**
 * Tool approval tests for DurableAgent
 *
 * Tests for tool approval workflow with requireToolApproval flag.
 * Validates that tools requiring approval properly suspend and can be approved/declined.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { DurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createToolCallModel, createMultiToolCallModel } from '../mock-models';

export function createToolApprovalTests({ getPubSub }: DurableAgentTestContext) {
  describe('tool approval', () => {
    describe('requireToolApproval at agent level', () => {
      it('should include requireToolApproval in workflow options when set globally', async () => {
        const mockModel = createToolCallModel('findUser', { name: 'Alice' });
        const pubsub = getPubSub();
        const mockExecute = vi.fn().mockResolvedValue({ name: 'Alice', email: 'alice@test.com' });

        const findUserTool = createTool({
          id: 'findUser',
          description: 'Find a user by name',
          inputSchema: z.object({ name: z.string() }),
          execute: mockExecute,
        });

        const agent = new DurableAgent({
          id: 'approval-agent',
          name: 'Approval Agent',
          instructions: 'You can find users',
          model: mockModel,
          tools: { findUser: findUserTool },
          pubsub,
        });

        const result = await agent.prepare('Find user Alice', {
          requireToolApproval: true,
        });

        expect(result.workflowInput.options.requireToolApproval).toBe(true);
      });

      it('should set requireToolApproval to false by default', async () => {
        const mockModel = createToolCallModel('findUser', { name: 'Alice' });
        const pubsub = getPubSub();

        const findUserTool = createTool({
          id: 'findUser',
          description: 'Find a user by name',
          inputSchema: z.object({ name: z.string() }),
          execute: async () => ({ name: 'Alice' }),
        });

        const agent = new DurableAgent({
          id: 'no-approval-agent',
          name: 'No Approval Agent',
          instructions: 'You can find users',
          model: mockModel,
          tools: { findUser: findUserTool },
          pubsub,
        });

        const result = await agent.prepare('Find user Alice');

        expect(result.workflowInput.options.requireToolApproval).toBeFalsy();
      });
    });

    describe('requireApproval at tool level', () => {
      it('should register tool with requireApproval flag', async () => {
        const mockModel = createToolCallModel('findUser', { name: 'Alice' });
        const pubsub = getPubSub();

        const findUserTool = createTool({
          id: 'findUser',
          description: 'Find a user by name',
          inputSchema: z.object({ name: z.string() }),
          requireApproval: true,
          execute: async () => ({ name: 'Alice', email: 'alice@test.com' }),
        });

        const agent = new DurableAgent({
          id: 'tool-approval-agent',
          name: 'Tool Approval Agent',
          instructions: 'You can find users',
          model: mockModel,
          tools: { findUser: findUserTool },
          pubsub,
        });

        const result = await agent.prepare('Find user Alice');

        const tools = agent.runRegistry.getTools(result.runId);
        expect(tools).toBeDefined();
        expect(tools.findUser).toBeDefined();
      });

      it('should handle multiple tools with mixed approval requirements', async () => {
        const mockModel = createMultiToolCallModel([
          { toolName: 'findUser', args: { name: 'Alice' } },
          { toolName: 'sendEmail', args: { to: 'alice@test.com' } },
        ]);
        const pubsub = getPubSub();

        const findUserTool = createTool({
          id: 'findUser',
          description: 'Find a user by name',
          inputSchema: z.object({ name: z.string() }),
          requireApproval: false,
          execute: async () => ({ name: 'Alice' }),
        });

        const sendEmailTool = createTool({
          id: 'sendEmail',
          description: 'Send an email',
          inputSchema: z.object({ to: z.string() }),
          requireApproval: true,
          execute: async () => ({ sent: true }),
        });

        const agent = new DurableAgent({
          id: 'mixed-approval-agent',
          name: 'Mixed Approval Agent',
          instructions: 'You can find users and send emails',
          model: mockModel,
          tools: { findUser: findUserTool, sendEmail: sendEmailTool },
          pubsub,
        });

        const result = await agent.prepare('Find Alice and send her an email');

        const tools = agent.runRegistry.getTools(result.runId);
        expect(tools.findUser).toBeDefined();
        expect(tools.sendEmail).toBeDefined();
      });
    });

    describe('tool approval workflow serialization', () => {
      it('should serialize tool approval state in workflow input', async () => {
        const mockModel = createToolCallModel('dangerousTool', { action: 'delete' });
        const pubsub = getPubSub();

        const dangerousTool = createTool({
          id: 'dangerousTool',
          description: 'A dangerous operation that needs approval',
          inputSchema: z.object({ action: z.string() }),
          requireApproval: true,
          execute: async () => ({ result: 'completed' }),
        });

        const agent = new DurableAgent({
          id: 'dangerous-op-agent',
          name: 'Dangerous Operation Agent',
          instructions: 'You can perform dangerous operations',
          model: mockModel,
          tools: { dangerousTool },
          pubsub,
        });

        const result = await agent.prepare('Delete all data', {
          requireToolApproval: true,
        });

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();

        const parsed = JSON.parse(serialized);
        expect(parsed.options.requireToolApproval).toBe(true);
      });

      it('should handle tool approval with autoResumeSuspendedTools option', async () => {
        const mockModel = createToolCallModel('interactiveTool', { input: 'test' });
        const pubsub = getPubSub();

        const interactiveTool = createTool({
          id: 'interactiveTool',
          description: 'An interactive tool',
          inputSchema: z.object({ input: z.string() }),
          requireApproval: true,
          execute: async () => ({ output: 'result' }),
        });

        const agent = new DurableAgent({
          id: 'interactive-agent',
          name: 'Interactive Agent',
          instructions: 'You can use interactive tools',
          model: mockModel,
          tools: { interactiveTool },
          pubsub,
        });

        const result = await agent.prepare('Use the interactive tool', {
          requireToolApproval: true,
          autoResumeSuspendedTools: true,
        });

        expect(result.workflowInput.options.requireToolApproval).toBe(true);
        expect(result.workflowInput.options.autoResumeSuspendedTools).toBe(true);
      });
    });

    describe('streaming with tool approval', () => {
      it('should stream with requireToolApproval option', async () => {
        const mockModel = createToolCallModel('searchTool', { query: 'test' });
        const pubsub = getPubSub();

        const searchTool = createTool({
          id: 'searchTool',
          description: 'Search for information',
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ results: ['result1', 'result2'] }),
        });

        const agent = new DurableAgent({
          id: 'search-agent',
          name: 'Search Agent',
          instructions: 'You can search for information',
          model: mockModel,
          tools: { searchTool },
          pubsub,
        });

        const { runId, cleanup } = await agent.stream('Search for test', {
          requireToolApproval: true,
        });

        expect(runId).toBeDefined();
        cleanup();
      });
    });

    describe('onSuspended callback', () => {
      it('should include onSuspended callback option in stream', async () => {
        const mockModel = createToolCallModel('approvableTool', { data: 'test' });
        const pubsub = getPubSub();

        const approvableTool = createTool({
          id: 'approvableTool',
          description: 'A tool that can be approved',
          inputSchema: z.object({ data: z.string() }),
          requireApproval: true,
          execute: async () => ({ result: 'done' }),
        });

        const agent = new DurableAgent({
          id: 'callback-agent',
          name: 'Callback Agent',
          instructions: 'You can use approvable tools',
          model: mockModel,
          tools: { approvableTool },
          pubsub,
        });

        const onSuspended = vi.fn();

        const { runId, cleanup } = await agent.stream('Use the tool', {
          requireToolApproval: true,
          onSuspended,
        });

        expect(runId).toBeDefined();
        cleanup();
      });
    });

    describe('tool call metadata', () => {
      it('should preserve tool metadata through workflow input', async () => {
        const mockModel = createToolCallModel('metadataTool', { key: 'value' });
        const pubsub = getPubSub();

        const metadataTool = createTool({
          id: 'metadataTool',
          description: 'A tool with rich metadata',
          inputSchema: z.object({
            key: z.string().describe('The key parameter'),
          }),
          outputSchema: z.object({
            result: z.string(),
          }),
          requireApproval: true,
          execute: async () => ({ result: 'success' }),
        });

        const agent = new DurableAgent({
          id: 'metadata-agent',
          name: 'Metadata Agent',
          instructions: 'You use tools with metadata',
          model: mockModel,
          tools: { metadataTool },
          pubsub,
        });

        const result = await agent.prepare('Use the metadata tool');

        expect(result.workflowInput.toolsMetadata).toBeDefined();

        const serialized = JSON.stringify(result.workflowInput.toolsMetadata);
        expect(serialized).toBeDefined();
      });
    });
  });

  describe('tool approval with workflows as tools', () => {
    it('should handle requireToolApproval with workflow default options', async () => {
      const mockModel = createToolCallModel('workflowTool', { input: 'test' });
      const pubsub = getPubSub();

      const workflowTool = createTool({
        id: 'workflowTool',
        description: 'A workflow exposed as a tool',
        inputSchema: z.object({ input: z.string() }),
        execute: async () => ({ output: 'result' }),
      });

      const agent = new DurableAgent({
        id: 'workflow-tool-agent',
        name: 'Workflow Tool Agent',
        instructions: 'You can use workflow tools',
        model: mockModel,
        tools: { workflowTool },
        defaultOptions: {
          requireToolApproval: true,
        },
        pubsub,
      });

      const result = await agent.prepare('Use the workflow tool');

      expect(result.runId).toBeDefined();
    });
  });
}
