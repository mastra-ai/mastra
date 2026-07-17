import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

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
describeForAllEngines(
  'AIMock loop scenario: suspended tool snapshot integrity',
  engine => {
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
        engine,
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
        engine,
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
        engine,
      });

      const threadId = 'multi-suspend-thread';
      const resourceId = 'test-resource';

      // Suspend both tools
      const { output, chunks } = await runLoopScenario({
        engine,
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

      // Both tools are called in the same turn.
      //
      // Suspension halts the step at the first suspending tool; tool-a suspends
      // and tool-b does not run yet.
      const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');

      expect(suspendedChunks.length).toBe(1);

      const toolACallId = suspendedChunks.find(c => (c as any).payload.toolName === 'tool-a');
      expect(toolACallId).toBeDefined();

      // Resume Tool A. This executes tool-a, then runs tool-b, which suspends.
      const resumeA = await shared.agent.resumeStream(
        { approvedA: true },
        { runId: output.runId, toolCallId: (toolACallId as any).payload.toolCallId },
      );

      const resumeAChunks: any[] = [];
      for await (const chunk of resumeA.fullStream) {
        resumeAChunks.push(chunk);
      }

      // Tool B should now have suspended.
      const toolBCallId = resumeAChunks
        .filter(c => c.type === 'tool-call-suspended')
        .find(c => (c as any).payload.toolName === 'tool-b');
      expect(toolBCallId).toBeDefined();

      // Resume Tool B second.
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

    it('suspends parallel tool calls one at a time across resume turns', async () => {
      const suspendOrder: string[] = [];
      const executionOrder: string[] = [];

      const makeSuspendingTool = (id: string, valueKey: string, approveKey: string) =>
        createTool({
          id,
          description: `Suspending tool ${id}`,
          inputSchema: z.object({ [valueKey]: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ [approveKey]: z.boolean() }),
          execute: async (inputData, context) => {
            if (!context?.agent?.resumeData) {
              suspendOrder.push(id);
              return await context?.agent?.suspend({ message: `Approve ${id}` });
            }
            executionOrder.push(id);
            return { tool: id, value: (inputData as any)[valueKey] };
          },
        });

      const toolX = makeSuspendingTool('tool-x', 'valueX', 'approvedX');
      const toolY = makeSuspendingTool('tool-y', 'valueY', 'approvedY');

      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { toolX, toolY },
        memory: sharedMemory,
        engine,
      });

      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Run both tools in parallel',
        memory: sharedMemory,
        threadId: 'parallel-suspend-thread',
        resourceId: 'parallel-resource',
        fixtures: llm => {
          llm.onMessage(/parallel|both/i, {
            toolCalls: [
              { id: 'call-x-1', name: 'tool-x', arguments: { valueX: 'x-value' } },
              { id: 'call-y-1', name: 'tool-y', arguments: { valueY: 'y-value' } },
            ],
          });
        },
        collectChunks: true,
      });

      // Both tool calls are issued in the same turn.
      const toolCallChunks = chunks!.filter(c => c.type === 'tool-call');
      expect(toolCallChunks.length).toBe(2);

      const allSuspended = chunks!.filter(c => c.type === 'tool-call-suspended');

      // Only the first tool suspends; the batch halts.
      expect(allSuspended.length).toBe(1);
      const firstToolName = (allSuspended[0] as any).payload.toolName;

      // Resume the first suspended tool; the second tool then runs and suspends.
      const resumeFirst = await shared.agent.resumeStream(
        firstToolName === 'tool-x' ? { approvedX: true } : { approvedY: true },
        { runId: output.runId, toolCallId: (allSuspended[0] as any).payload.toolCallId },
      );

      const resumeFirstChunks: any[] = [];
      for await (const chunk of resumeFirst.fullStream) {
        resumeFirstChunks.push(chunk);
      }

      const secondSuspended = resumeFirstChunks.filter(c => c.type === 'tool-call-suspended');
      expect(secondSuspended.length).toBe(1);
      const secondToolName = (secondSuspended[0] as any).payload.toolName;

      expect([firstToolName, secondToolName].sort()).toEqual(['tool-x', 'tool-y']);

      // Resume the second suspended tool to completion.
      const resumeSecond = await shared.agent.resumeStream(
        secondToolName === 'tool-x' ? { approvedX: true } : { approvedY: true },
        { runId: output.runId, toolCallId: (secondSuspended[0] as any).payload.toolCallId },
      );
      for await (const _chunk of resumeSecond.fullStream) {
        // drain
      }

      expect(new Set(suspendOrder)).toEqual(new Set(['tool-x', 'tool-y']));
      expect(executionOrder).toEqual([firstToolName, secondToolName]);
    });
  },
  { skip: ['fs'] },
);
