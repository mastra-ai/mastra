/**
 * @file Generate() approval path scenario test
 * @description Tests the non-streaming approval methods (approveToolCallGenerate, declineToolCallGenerate)
 *              using shared Mastra storage across multiple agent.generate() calls.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSharedAgent, useLoopScenarioAimock } from '../aimock-scenario';
import { createTool } from '../../../../tools';
import { MockMemory } from '../../../../memory';

describe('Generate() approval path scenario', () => {
  const getMock = useLoopScenarioAimock();

  it('should approve a tool call using approveToolCallGenerate()', async () => {
    const llm = getMock();
    let toolExecuted = false;

    const sensitiveTool = createTool({
      id: 'sensitive-op',
      description: 'Performs a sensitive operation requiring approval',
      inputSchema: z.object({
        action: z.string(),
      }),
      requireApproval: true,
      execute: async ({ action }) => {
        toolExecuted = true;
        return { performed: action, success: true };
      },
    });

    // Set up fixtures for the generate() calls
    llm.onMessage(/execute/i, {
      toolCalls: [
        {
          id: 'call-1',
          name: 'sensitive-op',
          arguments: { action: 'action-123' },
        },
      ],
    });

    const { agent } = await createSharedAgent(llm, {
      tools: { sensitiveTool },
      memory: new MockMemory(),
    });

    // First generate() call - tool suspends for approval
    const result1 = await agent.generate('Execute action-123', {
      requireToolApproval: true,
    });

    // Check suspension state
    expect(result1.finishReason).toBe('suspended');
    expect(result1.suspendPayload).toBeDefined();
    expect(result1.suspendPayload!.toolName).toBe('sensitive-op');
    expect(toolExecuted).toBe(false);

    // Get the runId and toolCallId
    const toolCallId = result1.suspendPayload!.toolCallId;
    const runId = result1.runId!;

    // Approve using generate() path
    const result2 = await agent.approveToolCallGenerate({ runId, toolCallId });

    // Verify the tool was executed and approved
    expect(toolExecuted).toBe(true);
    const toolResults = result2.toolResults;
    expect(toolResults).toBeDefined();
    const toolCall = toolResults?.find((r: any) => r.payload.toolName === 'sensitive-op');
    expect(toolCall).toBeDefined();
    expect(toolCall?.payload.result).toEqual({
      performed: 'action-123',
      success: true,
    });
  });

  it('should decline a tool call using declineToolCallGenerate()', async () => {
    const llm = getMock();
    let toolExecuted = false;

    const dangerousTool = createTool({
      id: 'dangerous-op',
      description: 'Performs a dangerous operation requiring approval',
      inputSchema: z.object({
        target: z.string(),
      }),
      requireApproval: true,
      execute: async ({ target }) => {
        toolExecuted = true;
        return { destroyed: target };
      },
    });

    // Set up fixtures for the generate() calls
    llm.onMessage(/destroy/i, {
      toolCalls: [
        {
          id: 'call-2',
          name: 'dangerous-op',
          arguments: { target: 'target-alpha' },
        },
      ],
    });

    const { agent } = await createSharedAgent(llm, {
      tools: { dangerousTool },
      memory: new MockMemory(),
    });

    // First generate() call - tool suspends for approval
    const result1 = await agent.generate('Destroy target-alpha', {
      requireToolApproval: true,
    });

    // Check suspension state
    expect(result1.finishReason).toBe('suspended');
    expect(result1.suspendPayload).toBeDefined();
    expect(result1.suspendPayload!.toolName).toBe('dangerous-op');
    expect(toolExecuted).toBe(false);

    // Get the runId and toolCallId
    const toolCallId = result1.suspendPayload!.toolCallId;
    const runId = result1.runId!;

    // Decline using generate() path
    const result2 = await agent.declineToolCallGenerate({ runId, toolCallId });

    // Verify the tool was NOT executed
    expect(toolExecuted).toBe(false);

    // When declined, the result should indicate the tool was not run
    // (the exact behavior may vary - just verify tool wasn't executed)
    expect(result2).toBeDefined();
  });

  it('should handle multiple sequential approval decisions', async () => {
    const llm = getMock();
    const executionLog: number[] = [];

    const counterTool = createTool({
      id: 'counter-tool',
      description: 'Increments a counter (requires approval)',
      inputSchema: z.object({
        value: z.number(),
      }),
      requireApproval: true,
      execute: async ({ value }) => {
        executionLog.push(value);
        return { incremented: value + 1 };
      },
    });

    // Set up fixtures for the generate() calls
    llm.onMessage(/increment 5/i, {
      toolCalls: [
        {
          id: 'call-3',
          name: 'counter-tool',
          arguments: { value: 5 },
        },
      ],
    });
    llm.onMessage(/increment 10/i, {
      toolCalls: [
        {
          id: 'call-4',
          name: 'counter-tool',
          arguments: { value: 10 },
        },
      ],
    });
    llm.onMessage(/increment 20/i, {
      toolCalls: [
        {
          id: 'call-5',
          name: 'counter-tool',
          arguments: { value: 20 },
        },
      ],
    });

    const { agent } = await createSharedAgent(llm, {
      tools: { counterTool },
      memory: new MockMemory(),
    });

    // First call - approve
    const result1 = await agent.generate('Increment 5', {
      requireToolApproval: true,
    });
    expect(result1.finishReason).toBe('suspended');
    const result2 = await agent.approveToolCallGenerate({
      runId: result1.runId!,
      toolCallId: result1.suspendPayload!.toolCallId,
    });
    expect(executionLog).toEqual([5]);

    // Second call - decline
    const result3 = await agent.generate('Increment 10', {
      requireToolApproval: true,
    });
    expect(result3.finishReason).toBe('suspended');
    const result4 = await agent.declineToolCallGenerate({
      runId: result3.runId!,
      toolCallId: result3.suspendPayload!.toolCallId,
    });
    expect(executionLog).toEqual([5]); // No change

    // Third call - approve again
    const result5 = await agent.generate('Increment 20', {
      requireToolApproval: true,
    });
    expect(result5.finishReason).toBe('suspended');
    const result6 = await agent.approveToolCallGenerate({
      runId: result5.runId!,
      toolCallId: result5.suspendPayload!.toolCallId,
    });
    expect(executionLog).toEqual([5, 20]);
  });
});
