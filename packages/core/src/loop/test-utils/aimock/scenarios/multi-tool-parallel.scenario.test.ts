/**
 * AIMock Scenario: Parallel Tool Calls
 *
 * Tests the regression class where multiple tool calls in a single turn should
 * execute concurrently and all results should be properly collected and fed back
 * to the model in the next turn.
 *
 * This covers:
 * - Model emits 3 tool calls simultaneously
 * - Tools execute concurrently (not sequentially)
 * - All tool results are collected with correct tool_call_id mapping
 * - Next turn receives all results in the messages array
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines(
  'AIMock loop scenario: multi-tool parallel execution',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('executes multiple tool calls concurrently and collects all results', async () => {
      const executionTimestamps: number[] = [];

      const toolA = createTool({
        id: 'tool_a',
        description: 'Fetches user A data',
        inputSchema: z.object({ userId: z.string() }),
        outputSchema: z.object({ name: z.string(), role: z.string() }),
        execute: async ({ userId }: { userId: string }) => {
          executionTimestamps.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 50));
          return { name: `User ${userId}`, role: 'admin' };
        },
      });

      const toolB = createTool({
        id: 'tool_b',
        description: 'Fetches user B data',
        inputSchema: z.object({ userId: z.string() }),
        outputSchema: z.object({ name: z.string(), role: z.string() }),
        execute: async ({ userId }: { userId: string }) => {
          executionTimestamps.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 50));
          return { name: `User ${userId}`, role: 'user' };
        },
      });

      const toolC = createTool({
        id: 'tool_c',
        description: 'Fetches user C data',
        inputSchema: z.object({ userId: z.string() }),
        outputSchema: z.object({ name: z.string(), role: z.string() }),
        execute: async ({ userId }: { userId: string }) => {
          executionTimestamps.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 50));
          return { name: `User ${userId}`, role: 'guest' };
        },
      });

      const { requests, output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Fetch data for users alice, bob, and charlie in parallel',
        tools: { tool_a: toolA, tool_b: toolB, tool_c: toolC },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          // Turn 1: Model emits 3 parallel tool calls
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_a1', name: 'tool_a', arguments: { userId: 'alice' } },
                { id: 'call_b2', name: 'tool_b', arguments: { userId: 'bob' } },
                { id: 'call_c3', name: 'tool_c', arguments: { userId: 'charlie' } },
              ],
            },
          );
          // Turn 2: Model sees all 3 results and generates final response
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            { content: 'Retrieved data for alice (admin), bob (user), and charlie (guest).' },
          );
        },
      });

      const text = await output.text;

      // Verify all 3 tools were called
      const toolCalls = await output.toolCalls;
      expect(toolCalls).toHaveLength(3);

      // Verify tool call IDs are unique and correct
      const toolCallIds = toolCalls.map(tc => tc.payload.toolCallId).sort();
      expect(toolCallIds).toEqual(['call_a1', 'call_b2', 'call_c3']);

      // Verify all 3 tool results were collected
      const toolResults = await output.toolResults;
      expect(toolResults).toHaveLength(3);

      // Verify tool results have correct mapping to tool call IDs
      const resultMap = new Map(toolResults.map(tr => [tr.payload.toolCallId, tr.payload.result]));
      expect(resultMap.get('call_a1')).toEqual({ name: 'User alice', role: 'admin' });
      expect(resultMap.get('call_b2')).toEqual({ name: 'User bob', role: 'user' });
      expect(resultMap.get('call_c3')).toEqual({ name: 'User charlie', role: 'guest' });

      // Verify concurrent execution: all 3 tools should start within a narrow window
      // (if sequential with 50ms delays, timestamps would span 150ms+)
      expect(executionTimestamps).toHaveLength(3);
      const timeSpan = Math.max(...executionTimestamps) - Math.min(...executionTimestamps);
      expect(timeSpan).toBeLessThan(100); // Should start within 100ms of each other

      // Verify turn 2 request contains all 3 tool results in messages
      expect(requests).toHaveLength(2);
      const turn2Messages = requests[1]?.body?.messages ?? [];

      // Find tool result messages
      const toolResultMessages = turn2Messages.filter((msg: any) => msg.role === 'tool') as Array<{
        tool_call_id?: string;
        content?: unknown;
      }>;
      expect(toolResultMessages).toHaveLength(3);

      // Verify each tool result message has correct tool_call_id
      const toolCallIdsInMessages = toolResultMessages.map(msg => msg.tool_call_id).sort();
      expect(toolCallIdsInMessages).toEqual(['call_a1', 'call_b2', 'call_c3']);

      // Verify final response mentions all three users
      expect(text).toContain('alice');
      expect(text).toContain('bob');
      expect(text).toContain('charlie');
    });

    it('handles mixed success and failure in parallel tool calls', async () => {
      const toolSuccess = createTool({
        id: 'tool_success',
        description: 'Always succeeds',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ status: z.string(), value: z.string() }),
        execute: async ({ value }: { value: string }) => {
          return { status: 'success', value };
        },
      });

      const toolFail = createTool({
        id: 'tool_fail',
        description: 'Always throws',
        inputSchema: z.object({ value: z.string() }),
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      });

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call both tools',
        tools: { tool_success: toolSuccess, tool_fail: toolFail },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          // Turn 1: Model emits 2 parallel tool calls
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_success', name: 'tool_success', arguments: { value: 'good' } },
                { id: 'call_fail', name: 'tool_fail', arguments: { value: 'bad' } },
              ],
            },
          );
          // Turn 2: Model sees mixed results
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'One tool succeeded, one failed.' });
        },
      });

      // Verify both tool results were collected (even the failed one)
      expect(requests).toHaveLength(2);

      // Verify turn 2 has both tool results
      const turn2Messages = requests[1]?.body?.messages ?? [];
      const toolResultMessages = turn2Messages.filter((msg: any) => msg.role === 'tool');
      expect(toolResultMessages).toHaveLength(2);
    });
  },
  { skip: ['durable'] },
);
