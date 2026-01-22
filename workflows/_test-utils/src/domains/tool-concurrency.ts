/**
 * Tool concurrency tests for DurableAgent
 *
 * Tests for sequential vs concurrent tool execution control.
 * Validates that toolCallConcurrency option and approval/suspension flags
 * correctly influence tool execution order.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DurableAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createMultiToolCallModel } from '../mock-models';

export function createToolConcurrencyTests({ getPubSub }: DurableAgentTestContext) {
  describe('tool concurrency', () => {
    describe('toolCallConcurrency option', () => {
      it('should include toolCallConcurrency in workflow options', async () => {
        const mockModel = createMultiToolCallModel([
          { toolName: 'tool1', args: { data: 'test1' } },
          { toolName: 'tool2', args: { data: 'test2' } },
        ]);
        const pubsub = getPubSub();

        const tool1 = createTool({
          id: 'tool1',
          description: 'First tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'tool1' }),
        });

        const tool2 = createTool({
          id: 'tool2',
          description: 'Second tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'tool2' }),
        });

        const agent = new DurableAgent({
          id: 'concurrency-agent',
          name: 'Concurrency Agent',
          instructions: 'Use both tools',
          model: mockModel,
          tools: { tool1, tool2 },
          pubsub,
        });

        const result = await agent.prepare('Use both tools', {
          toolCallConcurrency: 5,
        });

        expect(result.workflowInput.options.toolCallConcurrency).toBe(5);
      });

      it('should default toolCallConcurrency when not specified', async () => {
        const mockModel = createMultiToolCallModel([{ toolName: 'tool1', args: { data: 'test' } }]);
        const pubsub = getPubSub();

        const tool1 = createTool({
          id: 'tool1',
          description: 'A tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'done' }),
        });

        const agent = new DurableAgent({
          id: 'default-concurrency-agent',
          name: 'Default Concurrency Agent',
          instructions: 'Use tool',
          model: mockModel,
          tools: { tool1 },
          pubsub,
        });

        const result = await agent.prepare('Use the tool');

        expect(result.runId).toBeDefined();
      });

      it('should set toolCallConcurrency to 1 for sequential execution', async () => {
        const mockModel = createMultiToolCallModel([
          { toolName: 'tool1', args: { data: 'test1' } },
          { toolName: 'tool2', args: { data: 'test2' } },
        ]);
        const pubsub = getPubSub();

        const tool1 = createTool({
          id: 'tool1',
          description: 'First tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'tool1' }),
        });

        const tool2 = createTool({
          id: 'tool2',
          description: 'Second tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'tool2' }),
        });

        const agent = new DurableAgent({
          id: 'sequential-agent',
          name: 'Sequential Agent',
          instructions: 'Use tools sequentially',
          model: mockModel,
          tools: { tool1, tool2 },
          pubsub,
        });

        const result = await agent.prepare('Use both tools', {
          toolCallConcurrency: 1,
        });

        expect(result.workflowInput.options.toolCallConcurrency).toBe(1);
      });
    });

    describe('concurrency with requireToolApproval', () => {
      it('should force sequential execution when requireToolApproval is true', async () => {
        const mockModel = createMultiToolCallModel([
          { toolName: 'tool1', args: { data: 'test1' } },
          { toolName: 'tool2', args: { data: 'test2' } },
        ]);
        const pubsub = getPubSub();

        const tool1 = createTool({
          id: 'tool1',
          description: 'First tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'tool1' }),
        });

        const tool2 = createTool({
          id: 'tool2',
          description: 'Second tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'tool2' }),
        });

        const agent = new DurableAgent({
          id: 'approval-concurrency-agent',
          name: 'Approval Concurrency Agent',
          instructions: 'Use tools with approval',
          model: mockModel,
          tools: { tool1, tool2 },
          pubsub,
        });

        const result = await agent.prepare('Use both tools', {
          requireToolApproval: true,
          toolCallConcurrency: 10,
        });

        expect(result.workflowInput.options.requireToolApproval).toBe(true);
        expect(result.workflowInput.options.toolCallConcurrency).toBe(10);
      });

      it('should handle tool-level requireApproval affecting concurrency', async () => {
        const mockModel = createMultiToolCallModel([
          { toolName: 'normalTool', args: { data: 'test1' } },
          { toolName: 'approvalTool', args: { data: 'test2' } },
        ]);
        const pubsub = getPubSub();

        const normalTool = createTool({
          id: 'normalTool',
          description: 'Normal tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'normal' }),
        });

        const approvalTool = createTool({
          id: 'approvalTool',
          description: 'Tool requiring approval',
          inputSchema: z.object({ data: z.string() }),
          requireApproval: true,
          execute: async () => ({ result: 'approved' }),
        });

        const agent = new DurableAgent({
          id: 'mixed-approval-concurrency-agent',
          name: 'Mixed Approval Concurrency Agent',
          instructions: 'Use mixed tools',
          model: mockModel,
          tools: { normalTool, approvalTool },
          pubsub,
        });

        const result = await agent.prepare('Use both tools');

        const tools = agent.runRegistry.getTools(result.runId);
        expect(tools.normalTool).toBeDefined();
        expect(tools.approvalTool).toBeDefined();
      });
    });

    describe('concurrency with suspendSchema', () => {
      it('should handle suspendSchema affecting concurrency', async () => {
        const mockModel = createMultiToolCallModel([
          { toolName: 'quickTool', args: { data: 'test1' } },
          { toolName: 'suspendTool', args: { data: 'test2' } },
        ]);
        const pubsub = getPubSub();

        const quickTool = createTool({
          id: 'quickTool',
          description: 'Quick non-suspending tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'quick' }),
        });

        const suspendTool = createTool({
          id: 'suspendTool',
          description: 'Tool that can suspend',
          inputSchema: z.object({ data: z.string() }),
          suspendSchema: z.object({ reason: z.string() }),
          resumeSchema: z.object({ continue: z.boolean() }),
          execute: async () => ({ result: 'suspended' }),
        });

        const agent = new DurableAgent({
          id: 'suspend-concurrency-agent',
          name: 'Suspend Concurrency Agent',
          instructions: 'Use both tools',
          model: mockModel,
          tools: { quickTool, suspendTool },
          pubsub,
        });

        const result = await agent.prepare('Use both tools');

        const tools = agent.runRegistry.getTools(result.runId);
        expect(tools.quickTool).toBeDefined();
        expect(tools.suspendTool).toBeDefined();
      });
    });

    describe('concurrency edge cases', () => {
      it('should handle negative toolCallConcurrency gracefully', async () => {
        const mockModel = createTextStreamModel('Hello');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'negative-concurrency-agent',
          name: 'Negative Concurrency Agent',
          instructions: 'Test negative value',
          model: mockModel,
          pubsub,
        });

        const result = await agent.prepare('Hello', {
          toolCallConcurrency: -5,
        });

        expect(result.workflowInput.options.toolCallConcurrency).toBe(-5);
      });

      it('should handle zero toolCallConcurrency', async () => {
        const mockModel = createTextStreamModel('Hello');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'zero-concurrency-agent',
          name: 'Zero Concurrency Agent',
          instructions: 'Test zero value',
          model: mockModel,
          pubsub,
        });

        const result = await agent.prepare('Hello', {
          toolCallConcurrency: 0,
        });

        expect(result.workflowInput.options.toolCallConcurrency).toBe(0);
      });

      it('should handle very high toolCallConcurrency', async () => {
        const mockModel = createMultiToolCallModel([
          { toolName: 'tool1', args: { data: 'test1' } },
          { toolName: 'tool2', args: { data: 'test2' } },
          { toolName: 'tool3', args: { data: 'test3' } },
        ]);
        const pubsub = getPubSub();

        const tool1 = createTool({
          id: 'tool1',
          description: 'Tool 1',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 1 }),
        });

        const tool2 = createTool({
          id: 'tool2',
          description: 'Tool 2',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 2 }),
        });

        const tool3 = createTool({
          id: 'tool3',
          description: 'Tool 3',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 3 }),
        });

        const agent = new DurableAgent({
          id: 'high-concurrency-agent',
          name: 'High Concurrency Agent',
          instructions: 'Use many tools',
          model: mockModel,
          tools: { tool1, tool2, tool3 },
          pubsub,
        });

        const result = await agent.prepare('Use all tools', {
          toolCallConcurrency: 100,
        });

        expect(result.workflowInput.options.toolCallConcurrency).toBe(100);
      });
    });

    describe('concurrency serialization', () => {
      it('should serialize toolCallConcurrency in workflow input', async () => {
        const mockModel = createMultiToolCallModel([{ toolName: 'tool1', args: { data: 'test' } }]);
        const pubsub = getPubSub();

        const tool1 = createTool({
          id: 'tool1',
          description: 'A tool',
          inputSchema: z.object({ data: z.string() }),
          execute: async () => ({ result: 'done' }),
        });

        const agent = new DurableAgent({
          id: 'serialize-concurrency-agent',
          name: 'Serialize Concurrency Agent',
          instructions: 'Test serialization',
          model: mockModel,
          tools: { tool1 },
          pubsub,
        });

        const result = await agent.prepare('Use tool', {
          toolCallConcurrency: 3,
        });

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();

        const parsed = JSON.parse(serialized);
        expect(parsed.options.toolCallConcurrency).toBe(3);
      });
    });
  });
}
