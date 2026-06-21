/**
 * AIMock Scenario: RequestContext Mutation Behavior
 *
 * Documents that requestContext mutations made by tools do NOT persist
 * between tool executions within the same agent run. Each tool execution
 * receives a fresh copy of the original requestContext passed to agent.stream().
 *
 * This is important behavior to document because it means:
 * - Tools cannot use requestContext to share state with each other
 * - Mutations are local to each tool execution
 * - The original requestContext remains unchanged throughout the run
 *
 * Asserts:
 * - Tool mutations do not persist to subsequent tool calls
 * - Each tool sees the original requestContext values
 * - The original requestContext object is not mutated
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: requestContext mutation behavior', () => {
  const getMock = useLoopScenarioAimock();

  it('tool mutations do not persist to subsequent tool calls', async () => {
    const step1Values: string[] = [];
    const step2Values: string[] = [];

    const mutateTool = createTool({
      id: 'mutate',
      description: 'Attempts to mutate the requestContext',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: async (input, context) => {
        // Read current value before mutation
        const before = (context?.requestContext?.get('counter') || 'none') as string;
        step1Values.push(before);

        // Attempt to mutate the context (this will NOT persist)
        context?.requestContext?.set('counter', input.value);

        return { success: true };
      },
    });

    const readTool = createTool({
      id: 'read',
      description: 'Reads the requestContext value',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      execute: async (_input, context) => {
        const value = (context?.requestContext?.get('counter') || 'none') as string;
        step2Values.push(value);
        return { value };
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('counter', 'initial');

    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'First mutate, then read the value.',
      tools: { mutate: mutateTool, read: readTool },
      stopWhen: stepCountIs(3),
      requestContext,
      fixtures: llm => {
        // Turn 1: call mutate tool (no tool result yet)
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_mutate', name: 'mutate', arguments: { value: 'step1-value' } },
            ],
          },
        );
        // Turn 2: call read tool (has tool result from mutate)
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_mutate' },
          {
            toolCalls: [{ id: 'call_read', name: 'read', arguments: {} }],
          },
        );
        // Turn 3: summarize (has tool result from read)
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_read' },
          { content: 'The counter remains initial because mutations do not persist.' },
        );
      },
    });

    // Step 1: mutate tool saw the initial value
    expect(step1Values).toEqual(['initial']);

    // Step 2: read tool STILL sees the initial value (mutation did NOT persist)
    expect(step2Values).toEqual(['initial']);

    // The original requestContext object was not mutated
    expect(requestContext.get('counter')).toBe('initial');

    // All three turns executed
    expect(requests).toHaveLength(3);
  });

  it('each sequential tool call sees the original requestContext', async () => {
    const mutations: string[] = [];

    const incrementTool = createTool({
      id: 'increment',
      description: 'Attempts to increment a counter in requestContext',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async (_input, context) => {
        const current = Number(context?.requestContext?.get('count') || '0');
        const next = current + 1;
        context?.requestContext?.set('count', String(next));
        mutations.push(`saw:${current},set:${next}`);
        return { count: next };
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('count', '0');

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Increment the counter three times.',
      tools: { increment: incrementTool },
      stopWhen: stepCountIs(4),
      requestContext,
      fixtures: llm => {
        // Turn 1: first increment call (no tool result yet)
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_inc_1', name: 'increment', arguments: {} }] },
        );
        // Turn 2: second increment call (has tool result from call_inc_1)
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_inc_1' },
          { toolCalls: [{ id: 'call_inc_2', name: 'increment', arguments: {} }] },
        );
        // Turn 3: third increment call (has tool result from call_inc_2)
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_inc_2' },
          { toolCalls: [{ id: 'call_inc_3', name: 'increment', arguments: {} }] },
        );
        // Turn 4: summarize (has tool result from call_inc_3)
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_inc_3' },
          { content: 'Each increment started from 0 because mutations do not persist.' },
        );
      },
    });

    // Each call saw the original value (0) and tried to increment to 1
    // Mutations did NOT accumulate across calls
    expect(mutations).toEqual([
      'saw:0,set:1',
      'saw:0,set:1',
      'saw:0,set:1',
    ]);

    // The original requestContext remains unchanged
    expect(requestContext.get('count')).toBe('0');
  });
});
