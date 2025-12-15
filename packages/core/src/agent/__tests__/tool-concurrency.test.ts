import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { delay } from '../../utils';
import { Agent } from '../agent';

/**
 * Helper to verify tool execution order.
 * Returns event indices and flags to determine if execution was sequential or concurrent.
 * Sequential execution means tool1 must complete (result) or suspend/approval before tool2 starts.
 * When tools suspend, we need to resume to see tool2 execute.
 *
 * Note: Enable DEBUG_TOOL_CONCURRENCY=1 environment variable to see detailed debug logs
 * showing workflow creation, sequential execution checks, and event ordering.
 */
async function verifyToolExecutionOrder(
  agent: Agent,
  options?: { requireToolApproval?: boolean; toolCallConcurrency?: number },
) {
  const stream = await agent.stream('Use both tools', {
    memory: {
      thread: 'test-thread-concurrency',
      resource: 'user-test-concurrency',
    },
    maxSteps: 1,
    ...(options || {}),
  });

  const eventOrder: Array<{ type: string; toolCallId?: string; toolName?: string; timestamp: number }> = [];
  let tool1CallId = '';
  let tool2CallId = '';
  let tool1Suspended = false;
  let tool1RequestedApproval = false;
  let tool2RequestedApproval = false;
  let tool1Completed = false;
  let tool2Completed = false;

  // Collect events from initial stream
  for await (const chunk of stream.fullStream) {
    const timestamp = Date.now();
    if (
      chunk.type === 'tool-call' ||
      chunk.type === 'tool-call-suspended' ||
      chunk.type === 'tool-call-approval' ||
      chunk.type === 'tool-result'
    ) {
      const payload = (chunk.payload as any) || {};
      const toolCallId = payload.toolCallId;
      const toolName = payload.toolName;

      eventOrder.push({
        type: chunk.type,
        toolCallId,
        toolName,
        timestamp,
      });

      // Track tool call IDs for resuming
      if (toolName === 'tool-1' || toolCallId === 'call-1') {
        if (chunk.type === 'tool-call') {
          tool1CallId = toolCallId;
        }
        if (chunk.type === 'tool-call-suspended') {
          tool1Suspended = true;
          tool1CallId = toolCallId;
        }
        if (chunk.type === 'tool-call-approval') {
          tool1RequestedApproval = true;
          tool1CallId = toolCallId;
        }
        if (chunk.type === 'tool-result') {
          tool1Completed = true;
        }
      }
      if (toolName === 'tool-2' || toolCallId === 'call-2') {
        if (chunk.type === 'tool-call') {
          tool2CallId = toolCallId;
        }
        if (chunk.type === 'tool-call-approval') {
          tool2RequestedApproval = true;
          tool2CallId = toolCallId;
        }
        if (chunk.type === 'tool-result') {
          tool2Completed = true;
        }
      }

      if (tool1Completed && tool2Completed) {
        break;
      }
    }
  }

  // If tools suspended/required approval, resume to see execution
  if (tool1Suspended || tool1RequestedApproval || tool2RequestedApproval) {
    await delay(100);
    const resumeOptions = {
      runId: stream.runId,
      ...(options?.requireToolApproval !== undefined && { requireToolApproval: options.requireToolApproval }),
    };

    // Approve tool1 first if it needs approval
    if (tool1RequestedApproval && tool1CallId) {
      const resumeStream1 = await agent.approveToolCall({ ...resumeOptions, toolCallId: tool1CallId });
      for await (const chunk of resumeStream1.fullStream) {
        const timestamp = Date.now();
        if (
          chunk.type === 'tool-call' ||
          chunk.type === 'tool-call-suspended' ||
          chunk.type === 'tool-call-approval' ||
          chunk.type === 'tool-result'
        ) {
          const payload = (chunk.payload as any) || {};
          eventOrder.push({
            type: chunk.type,
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            timestamp,
          });
          if (payload.toolName === 'tool-1' && chunk.type === 'tool-result') {
            tool1Completed = true;
          } else if (payload.toolName === 'tool-2' && chunk.type === 'tool-result') {
            tool2Completed = true;
          }
          if (tool1Completed && tool2Completed) {
            break;
          }
          // Track tool2 if it gets approved during tool1's execution
          if (
            (payload.toolName === 'tool-2' || payload.toolCallId === 'call-2') &&
            chunk.type === 'tool-call-approval'
          ) {
            tool2RequestedApproval = true;
            tool2CallId = payload.toolCallId;
          }
        }
      }
    } else if (tool1Suspended && tool1CallId) {
      const resumeStream1 = await agent.resumeStream({ approved: true }, { ...resumeOptions, toolCallId: tool1CallId });
      for await (const chunk of resumeStream1.fullStream) {
        const timestamp = Date.now();
        if (
          chunk.type === 'tool-call' ||
          chunk.type === 'tool-call-suspended' ||
          chunk.type === 'tool-call-approval' ||
          chunk.type === 'tool-result'
        ) {
          const payload = (chunk.payload as any) || {};
          eventOrder.push({
            type: chunk.type,
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            timestamp,
          });
          if (payload.toolName === 'tool-1' && chunk.type === 'tool-result') {
            tool1Completed = true;
          } else if (payload.toolName === 'tool-2' && chunk.type === 'tool-result') {
            tool2Completed = true;
          }
          if (tool1Completed && tool2Completed) {
            break;
          }
        }
      }
    }

    // If tool2 also needs approval and we have its call ID, approve it
    if (tool2RequestedApproval && tool2CallId) {
      await delay(100);
      const resumeStream2 = await agent.approveToolCall({ ...resumeOptions, toolCallId: tool2CallId });
      for await (const chunk of resumeStream2.fullStream) {
        const timestamp = Date.now();
        if (
          chunk.type === 'tool-call' ||
          chunk.type === 'tool-call-suspended' ||
          chunk.type === 'tool-call-approval' ||
          chunk.type === 'tool-result'
        ) {
          const payload = (chunk.payload as any) || {};
          eventOrder.push({
            type: chunk.type,
            toolCallId: payload.toolCallId,
            toolName: payload.toolName,
            timestamp,
          });
        }
      }
    }
  }

  await delay(200);

  // Match by toolName primarily since toolCallId may be auto-generated
  const tool1CallIndex = eventOrder.findIndex(
    e => e.type === 'tool-call' && (e.toolName === 'tool-1' || e.toolCallId === 'call-1'),
  );
  const tool1SuspendedIndex = eventOrder.findIndex(
    e => e.type === 'tool-call-suspended' && (e.toolName === 'tool-1' || e.toolCallId === 'call-1'),
  );
  const tool1ApprovalIndex = eventOrder.findIndex(
    e => e.type === 'tool-call-approval' && (e.toolName === 'tool-1' || e.toolCallId === 'call-1'),
  );
  const tool1ResultIndex = eventOrder.findIndex(
    e => e.type === 'tool-result' && (e.toolName === 'tool-1' || e.toolCallId === 'call-1'),
  );
  const tool2CallIndex = eventOrder.findIndex(
    e => e.type === 'tool-call' && (e.toolName === 'tool-2' || e.toolCallId === 'call-2'),
  );
  const tool2ResultIndex = eventOrder.findIndex(
    e => e.type === 'tool-result' && (e.toolName === 'tool-2' || e.toolCallId === 'call-2'),
  );

  // Sequential execution is verified by checking EXECUTION order (tool-result events), not call order
  // With concurrency: 1, tool1 must complete execution before tool2 starts execution
  // Even if both tools are called before approval, they should execute sequentially
  // Sequential execution means: tool1 completes (result) before tool2 starts executing (result)
  const isSequential = tool1ResultIndex !== -1 && tool2ResultIndex !== -1 && tool1ResultIndex < tool2ResultIndex;

  // Fallback: If we don't have tool-result events, check if tool1 completes/suspends/approves before tool2 is called
  // This handles cases where tools might not emit result events (e.g., if they error or are interrupted)
  const tool1CompletesIndex =
    tool1SuspendedIndex !== -1
      ? tool1SuspendedIndex
      : tool1ApprovalIndex !== -1
        ? tool1ApprovalIndex
        : tool1ResultIndex;

  // If we have execution results, use those; otherwise fall back to call order
  const isSequentialByExecution =
    isSequential || (tool1CompletesIndex !== -1 && tool2CallIndex !== -1 && tool1CompletesIndex < tool2CallIndex);

  // Concurrent execution: both tools start around the same time (within 50ms)
  const isConcurrent =
    tool1CallIndex !== -1 &&
    tool2CallIndex !== -1 &&
    Math.abs(eventOrder[tool1CallIndex].timestamp - eventOrder[tool2CallIndex].timestamp) < 50;

  const result = {
    eventOrder,
    tool1CallIndex,
    tool1SuspendedIndex,
    tool1ApprovalIndex,
    tool1ResultIndex,
    tool2CallIndex,
    tool2ResultIndex,
    tool1CompletesIndex,
    isSequential: isSequentialByExecution,
    isConcurrent,
  };

  return result;
}

describe('Tool Concurrency', () => {
  const mockMemory = new MockMemory();
  const mockStorage = new InMemoryStore();

  // Helper to create a mock model that triggers two tools
  function createMockModel() {
    return new MockLanguageModelV2({
      doStream: async () => {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'test-id', modelId: 'test-model', timestamp: new Date() },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'tool-1',
              input: '{"data":"test1"}',
            },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-2',
              toolName: 'tool-2',
              input: '{"data":"test2"}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
  }

  // Helper to create tool2 that completes normally
  function createNormalTool2() {
    return createTool({
      id: 'tool-2',
      description: 'Second tool that completes normally',
      inputSchema: z.object({ data: z.string() }),
      execute: async (inputData: { data: string }) => {
        await delay(50);
        return { result: `Tool 2 processed: ${inputData.data}` };
      },
    });
  }

  it('should execute tools sequentially when requireToolApproval global flag is set to true', async () => {
    const tool1 = createTool({
      id: 'tool-1',
      description: 'First tool',
      inputSchema: z.object({ data: z.string() }),
      execute: async (inputData: { data: string }) => {
        await delay(100); // Wait longer than tool2 to ensure tool1 completes first due to sequential execution
        return { result: `Tool 1 processed: ${inputData.data}` };
      },
    });

    const tool2 = createNormalTool2();
    const mockModel = createMockModel();

    const agentConfig = {
      id: 'require-approval-agent',
      name: 'Require Approval Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { tool1, tool2 },
      memory: mockMemory,
    };

    const mastra = new Mastra({
      agents: { agent: new Agent(agentConfig) },
      logger: false,
      storage: mockStorage,
    });

    const agent = mastra.getAgent('agent');

    const result = await verifyToolExecutionOrder(agent, { requireToolApproval: true });

    expect(result.tool1CallIndex).not.toBe(-1);
    expect(result.tool1ApprovalIndex).not.toBe(-1);
    expect(result.tool2CallIndex).not.toBe(-1);
    // Sequential execution: tool1 should complete before tool2 starts executing
    expect(result.isSequential).toBe(true);
    // Verify execution order (tool-result events) - tool1 completes before tool2
    expect(result.tool1ResultIndex).not.toBe(-1);
    expect(result.tool2ResultIndex).not.toBe(-1);
    expect(result.tool1ResultIndex).toBeLessThan(result.tool2ResultIndex);
  });

  it('should execute tools sequentially when a tool has requireApproval flag set to true', async () => {
    const tool1 = createTool({
      id: 'tool-1',
      description: 'First tool that requires approval',
      inputSchema: z.object({ data: z.string() }),
      requireApproval: true,
      execute: async (inputData: { data: string }) => {
        await delay(100); // Wait longer than tool2 to ensure tool1 completes first due to sequential execution
        return { result: `Tool 1 processed: ${inputData.data}` };
      },
    });

    const tool2 = createNormalTool2();
    const mockModel = createMockModel();

    const agentConfig = {
      id: 'tool-require-approval-agent',
      name: 'Tool Require Approval Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { tool1, tool2 },
      memory: mockMemory,
    };

    const mastra = new Mastra({
      agents: { agent: new Agent(agentConfig) },
      logger: false,
      storage: mockStorage,
    });

    const agent = mastra.getAgent('agent');

    const result = await verifyToolExecutionOrder(agent);

    expect(result.tool1CallIndex).not.toBe(-1);
    expect(result.tool1ApprovalIndex).not.toBe(-1);
    expect(result.tool2CallIndex).not.toBe(-1);
    // Sequential execution: tool1 should complete before tool2 starts executing
    expect(result.isSequential).toBe(true);
    // Verify execution order (tool-result events) - tool1 completes before tool2
    expect(result.tool1ResultIndex).not.toBe(-1);
    expect(result.tool2ResultIndex).not.toBe(-1);
    expect(result.tool1ResultIndex).toBeLessThan(result.tool2ResultIndex);
  });

  it('should execute tools sequentially when a tool has suspendSchema property set', async () => {
    let hasSuspended = false;

    const tool1 = createTool({
      id: 'tool-1',
      description: 'First tool that suspends',
      inputSchema: z.object({ data: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (_inputData: { data: string }, context?: any) => {
        const suspend = context?.agent?.suspend;
        if (!suspend) {
          throw new Error('Expected suspend to be provided in context');
        }
        await delay(100); // Wait longer than tool2 to ensure tool1 completes first due to sequential execution
        if (!hasSuspended) {
          hasSuspended = true;
          await suspend({ reason: 'Tool 1 needs approval' });
        }

        return { result: 'Tool 1 completed' };
      },
    });

    const tool2 = createNormalTool2();
    const mockModel = createMockModel();

    const agentConfig = {
      id: 'suspend-schema-agent',
      name: 'Suspend Schema Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { tool1, tool2 },
      memory: mockMemory,
    };

    const mastra = new Mastra({
      agents: { agent: new Agent(agentConfig) },
      logger: false,
      storage: mockStorage,
    });

    const agent = mastra.getAgent('agent');

    const result = await verifyToolExecutionOrder(agent);

    expect(result.tool1CallIndex).not.toBe(-1);
    expect(result.tool1SuspendedIndex).not.toBe(-1);
    expect(result.tool2CallIndex).not.toBe(-1);
    // Sequential execution: tool1 should complete before tool2 starts executing
    expect(result.isSequential).toBe(true);
    // Verify execution order (tool-result events) - tool1 completes before tool2
    expect(result.tool1ResultIndex).not.toBe(-1);
    expect(result.tool2ResultIndex).not.toBe(-1);
    expect(result.tool1ResultIndex).toBeLessThan(result.tool2ResultIndex);
  });

  it('should execute tools concurrently by default when none of the sequential conditions are met', async () => {
    const tool1 = createTool({
      id: 'tool-1',
      description: 'First tool',
      inputSchema: z.object({ data: z.string() }),
      execute: async (inputData: { data: string }) => {
        await delay(50);
        return { result: `Tool 1 processed: ${inputData.data}` };
      },
    });

    const tool2 = createNormalTool2();
    const mockModel = createMockModel();

    const agent = new Agent({
      id: 'concurrent-agent',
      name: 'Concurrent Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { tool1, tool2 },
      memory: mockMemory,
    });

    const result = await verifyToolExecutionOrder(agent);

    expect(result.tool1CallIndex).not.toBe(-1);
    expect(result.tool2CallIndex).not.toBe(-1);
    // Both tools should start around the same time (concurrent execution with default concurrency of 10)
    expect(result.isConcurrent).toBe(true);
    expect(result.tool1ResultIndex).not.toBe(-1);
    expect(result.tool2ResultIndex).not.toBe(-1);
  });

  it('should execute tools sequentially even when toolCallConcurrency is explicitly set, if sequential conditions are met', async () => {
    const tool1 = createTool({
      id: 'tool-1',
      description: 'First tool',
      inputSchema: z.object({ data: z.string() }),
      execute: async (inputData: { data: string }) => {
        await delay(100); // Wait longer than tool2 to ensure tool1 completes first due to sequential execution
        return { result: `Tool 1 processed: ${inputData.data}` };
      },
    });

    const tool2 = createNormalTool2();
    const mockModel = createMockModel();

    const agentConfig = {
      id: 'priority-sequential-agent',
      name: 'Priority Sequential Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { tool1, tool2 },
      memory: mockMemory,
    };

    const mastra = new Mastra({
      agents: { agent: new Agent(agentConfig) },
      logger: false,
      storage: mockStorage,
    });

    const agent = mastra.getAgent('agent');

    // Test with requireToolApproval: true - should force sequential (concurrency = 1) despite custom toolCallConcurrency
    const result = await verifyToolExecutionOrder(agent, {
      requireToolApproval: true,
      toolCallConcurrency: 5,
    });

    expect(result.tool1CallIndex).not.toBe(-1);
    expect(result.tool1ApprovalIndex).not.toBe(-1);
    expect(result.tool2CallIndex).not.toBe(-1);
    // Sequential execution should be enforced (concurrency = 1) despite custom toolCallConcurrency
    // Check execution order: tool1 should complete before tool2 starts executing
    expect(result.isSequential).toBe(true);
    // Verify execution order (tool-result events) - tool1 completes before tool2
    expect(result.tool1ResultIndex).not.toBe(-1);
    expect(result.tool2ResultIndex).not.toBe(-1);
    expect(result.tool1ResultIndex).toBeLessThan(result.tool2ResultIndex);
  });

  it('should handle invalid negative toolCallConcurrency by defaulting to 10 without error', async () => {
    const tool1 = createTool({
      id: 'tool-1',
      description: 'First tool',
      inputSchema: z.object({ data: z.string() }),
      execute: async (inputData: { data: string }) => {
        await delay(50);
        return { result: `Tool 1 processed: ${inputData.data}` };
      },
    });

    const tool2 = createNormalTool2();
    const mockModel = createMockModel();

    const agent = new Agent({
      id: 'invalid-concurrency-agent',
      name: 'Invalid Concurrency Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: { tool1, tool2 },
      memory: mockMemory,
    });

    // Should not throw an error and should default to 10 (concurrent execution)
    const result = await verifyToolExecutionOrder(agent, {
      toolCallConcurrency: -4, // Invalid negative value
    });

    expect(result.tool1CallIndex).not.toBe(-1);
    expect(result.tool2CallIndex).not.toBe(-1);
    // Should execute concurrently (defaults to 10 when invalid or <= 0)
    expect(result.isConcurrent).toBe(true);
    expect(result.tool1ResultIndex).not.toBe(-1);
    expect(result.tool2ResultIndex).not.toBe(-1);
  });
});
