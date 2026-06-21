import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Scenario: Suspended tool snapshot integrity
 *
 * Tests that when a tool is suspended, its state (arguments, tool name, metadata)
 * is correctly preserved and can be accurately retrieved for resumption.
 *
 * This validates:
 * - Suspended tool arguments are preserved exactly as passed
 * - Tool name and call ID survive suspension/resumption cycle
 * - Multiple suspended tools maintain independent state
 * - Resume data is correctly associated with the right tool call
 *
 * Regression classes:
 * - Snapshot corruption: suspended tool loses its arguments
 * - ID mismatch: resume data applied to wrong tool call
 * - State leakage: one suspended tool's data affects another
 */
describe('AIMock loop scenario: suspended tool snapshot integrity', () => {
  const getMock = useLoopScenarioAimock();

  it('preserves suspended tool arguments exactly', async () => {
    let receivedArgs: any = null;

    const complexTool = createTool({
      id: 'complex-op',
      description: 'Performs a complex operation with multiple parameters',
      inputSchema: z.object({
        name: z.string(),
        count: z.number(),
        nested: z.object({
          flag: z.boolean(),
          items: z.array(z.string()),
        }),
      }),
      suspendSchema: z.object({
        message: z.string(),
      }),
      resumeSchema: z.object({
        approved: z.boolean(),
      }),
      execute: async (inputData, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({
            message: `Confirm: ${inputData.name} (${inputData.count} items)`,
          });
        }
        receivedArgs = inputData;
        return { success: true, processed: inputData.name };
      },
    });

    const sharedMemory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      tools: { complexTool },
      memory: sharedMemory,
    });

    const threadId = 'snapshot-integrity-thread';
    const resourceId = 'test-resource';

    // Suspend with complex arguments
    const originalArgs = {
      name: 'test-operation',
      count: 42,
      nested: {
        flag: true,
        items: ['alpha', 'beta', 'gamma'],
      },
    };

    const { output, chunks } = await runLoopScenario({
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Execute complex operation',
      memory: sharedMemory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.onMessage(/execute|complex/i, {
          toolCalls: [
            {
              id: 'call-complex-1',
              name: 'complex-op',
              arguments: originalArgs,
            },
          ],
        });
      },
      collectChunks: true,
    });

    // Find suspended tool
    const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
    expect(suspendedChunks.length).toBeGreaterThan(0);

    const suspendedToolCallId = (suspendedChunks[0] as any).payload.toolCallId;
    expect(suspendedToolCallId).toBe('call-complex-1');

    // Resume with approval
    const resumeResult = await shared.agent.resumeStream(
      { approved: true },
      { runId: output.runId, toolCallId: suspendedToolCallId },
    );

    for await (const _chunk of resumeResult.fullStream) {
      // drain
    }

    // Verify arguments were preserved exactly
    expect(receivedArgs).toBeDefined();
    expect(receivedArgs.name).toBe('test-operation');
    expect(receivedArgs.count).toBe(42);
    expect(receivedArgs.nested.flag).toBe(true);
    expect(receivedArgs.nested.items).toEqual(['alpha', 'beta', 'gamma']);

    // Verify tool executed successfully
    const toolResults = await resumeResult.toolResults;
    const complexResult = toolResults?.find((r: any) => r.payload.toolName === 'complex-op');
    expect(complexResult).toBeDefined();
    const result = complexResult?.payload.result as { success: boolean; processed: string };
    expect(result.success).toBe(true);
    expect(result.processed).toBe('test-operation');
  });

  it('maintains independent state for multiple suspended tools', async () => {
    const executionLog: { toolName: string; args: any; resumeData: any }[] = [];

    const toolA = createTool({
      id: 'tool-a',
      description: 'Tool A',
      inputSchema: z.object({
        valueA: z.string(),
      }),
      suspendSchema: z.object({
        message: z.string(),
      }),
      resumeSchema: z.object({
        approvedA: z.boolean(),
      }),
      execute: async (inputData, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({
            message: `Approve Tool A with value: ${inputData.valueA}`,
          });
        }
        executionLog.push({
          toolName: 'tool-a',
          args: inputData,
          resumeData: context.agent.resumeData,
        });
        return { tool: 'A', value: inputData.valueA };
      },
    });

    const toolB = createTool({
      id: 'tool-b',
      description: 'Tool B',
      inputSchema: z.object({
        valueB: z.string(),
      }),
      suspendSchema: z.object({
        message: z.string(),
      }),
      resumeSchema: z.object({
        approvedB: z.boolean(),
      }),
      execute: async (inputData, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({
            message: `Approve Tool B with value: ${inputData.valueB}`,
          });
        }
        executionLog.push({
          toolName: 'tool-b',
          args: inputData,
          resumeData: context.agent.resumeData,
        });
        return { tool: 'B', value: inputData.valueB };
      },
    });

    const sharedMemory = new MockMemory();
    const shared = await createSharedAgent(getMock(), {
      tools: { toolA, toolB },
      memory: sharedMemory,
    });

    const threadId = 'multi-suspend-thread';
    const resourceId = 'test-resource';

    // Suspend both tools
    const { output, chunks } = await runLoopScenario({
      llm: getMock(),
      sharedAgent: shared,
      prompt: 'Execute both tools',
      memory: sharedMemory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.onMessage(/execute|both/i, {
          toolCalls: [
            {
              id: 'call-a-1',
              name: 'tool-a',
              arguments: { valueA: 'alpha-value' },
            },
            {
              id: 'call-b-1',
              name: 'tool-b',
              arguments: { valueB: 'beta-value' },
            },
          ],
        });
      },
      collectChunks: true,
    });

    // Find both suspended tools
    const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
    expect(suspendedChunks.length).toBe(2);

    const toolACallId = suspendedChunks.find(c => (c as any).payload.toolName === 'tool-a');
    const toolBCallId = suspendedChunks.find(c => (c as any).payload.toolName === 'tool-b');

    expect(toolACallId).toBeDefined();
    expect(toolBCallId).toBeDefined();

    // Resume Tool A first
    const resumeA = await shared.agent.resumeStream(
      { approvedA: true },
      { runId: output.runId, toolCallId: (toolACallId as any).payload.toolCallId },
    );

    for await (const _chunk of resumeA.fullStream) {
      // drain
    }

    // Resume Tool B second
    const resumeB = await shared.agent.resumeStream(
      { approvedB: true },
      { runId: output.runId, toolCallId: (toolBCallId as any).payload.toolCallId },
    );

    for await (const _chunk of resumeB.fullStream) {
      // drain
    }

    // Verify both tools executed with correct independent state
    expect(executionLog.length).toBe(2);

    const toolAExecution = executionLog.find(e => e.toolName === 'tool-a');
    const toolBExecution = executionLog.find(e => e.toolName === 'tool-b');

    expect(toolAExecution).toBeDefined();
    expect(toolAExecution!.args.valueA).toBe('alpha-value');
    expect(toolAExecution!.resumeData).toEqual({ approvedA: true });

    expect(toolBExecution).toBeDefined();
    expect(toolBExecution!.args.valueB).toBe('beta-value');
    expect(toolBExecution!.resumeData).toEqual({ approvedB: true });

    // Verify no state leakage between tools
    expect(toolAExecution!.args).not.toHaveProperty('valueB');
    expect(toolBExecution!.args).not.toHaveProperty('valueA');
    expect(toolAExecution!.resumeData).not.toHaveProperty('approvedB');
    expect(toolBExecution!.resumeData).not.toHaveProperty('approvedA');
  });
});
