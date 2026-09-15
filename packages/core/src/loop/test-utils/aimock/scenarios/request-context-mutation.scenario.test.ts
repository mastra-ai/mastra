/**
 * AIMock Scenario: RequestContext Mutation Behavior
 *
 * Documents how requestContext mutations made by tools behave across
 * tool executions within the same agent run. Tools share the same
 * RequestContext reference across engines, so mutations persist between
 * tool calls.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: requestContext mutation behavior', engine => {
  const getMock = useLoopScenarioAimock();

  it('tool mutations are visible to subsequent tool calls', async () => {
    const step1Values: string[] = [];
    const step2Values: string[] = [];

    const mutateTool = createTool({
      id: 'mutate',
      description: 'Mutates the requestContext',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ success: z.boolean() }),
      execute: async (input, context) => {
        const before = (context?.requestContext?.get('counter') || 'none') as string;
        step1Values.push(before);
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

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'First mutate, then read the value.',
      tools: { mutate: mutateTool, read: readTool },
      stopWhen: stepCountIs(3),
      requestContext,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_mutate', name: 'mutate', arguments: { value: 'step1-value' } }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_mutate' },
          { toolCalls: [{ id: 'call_read', name: 'read', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_read' }, { content: 'Done.' });
      },
    });

    // Step 1: mutate tool always sees the initial value
    expect(step1Values).toEqual(['initial']);

    // Shared reference — read tool sees the mutated value
    expect(step2Values).toEqual(['step1-value']);
    expect(requestContext.get('counter')).toBe('step1-value');

    expect(requests).toHaveLength(3);
  });

  it('sequential tool calls see accumulated mutations', async () => {
    const mutations: string[] = [];

    const incrementTool = createTool({
      id: 'increment',
      description: 'Increments a counter in requestContext',
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

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Increment the counter three times.',
      tools: { increment: incrementTool },
      stopWhen: stepCountIs(4),
      requestContext,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_inc_1', name: 'increment', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_inc_1' },
          { toolCalls: [{ id: 'call_inc_2', name: 'increment', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_inc_2' },
          { toolCalls: [{ id: 'call_inc_3', name: 'increment', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_inc_3' }, { content: 'Done.' });
      },
    });

    // Mutations accumulate (shared reference)
    expect(mutations).toEqual(['saw:0,set:1', 'saw:1,set:2', 'saw:2,set:3']);
    expect(requestContext.get('count')).toBe('3');
  });
});
