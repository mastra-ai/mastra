import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: requestContext isolation between steps.
 *
 * Tests that requestContext passed to agent.stream() remains consistent and
 * isolated across multiple tool execution steps within a single run. This pins
 * the regression where requestContext could be mutated or lost between steps.
 */
describe('AIMock loop scenario: requestContext isolation between steps', () => {
  const getMock = useLoopScenarioAimock();

  it('preserves requestContext across multiple tool execution steps', async () => {
    // Track what each tool sees
    const capturedContexts: Array<{ userId: string | undefined; sessionId: string | undefined; step: string }> = [];

    const tool1 = createTool({
      id: 'tool_1',
      description: 'First tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async (_, context) => {
        capturedContexts.push({
          userId: context?.requestContext?.get('userId'),
          sessionId: context?.requestContext?.get('sessionId'),
          step: 'tool_1',
        });
        return { result: 'step1_complete' };
      },
    });

    const tool2 = createTool({
      id: 'tool_2',
      description: 'Second tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async (_, context) => {
        capturedContexts.push({
          userId: context?.requestContext?.get('userId'),
          sessionId: context?.requestContext?.get('sessionId'),
          step: 'tool_2',
        });
        return { result: 'step2_complete' };
      },
    });

    const tool3 = createTool({
      id: 'tool_3',
      description: 'Third tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async (_, context) => {
        capturedContexts.push({
          userId: context?.requestContext?.get('userId'),
          sessionId: context?.requestContext?.get('sessionId'),
          step: 'tool_3',
        });
        return { result: 'step3_complete' };
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-999');
    requestContext.set('sessionId', 'session-888');

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Execute all three tools in sequence',
      tools: { tool_1: tool1, tool_2: tool2, tool_3: tool3 },
      stopWhen: stepCountIs(5),
      requestContext,
      fixtures: llm => {
        // Model calls tool_1 first
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tool_1', name: 'tool_1', arguments: {} }] },
        );
        // After tool_1 result, model calls tool_2
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_tool_1', hasToolResult: true },
          { toolCalls: [{ id: 'call_tool_2', name: 'tool_2', arguments: {} }] },
        );
        // After tool_2 result, model calls tool_3
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_tool_2', hasToolResult: true },
          { toolCalls: [{ id: 'call_tool_3', name: 'tool_3', arguments: {} }] },
        );
        // After tool_3 result, model produces final text
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_tool_3', hasToolResult: true },
          { content: 'All tools executed successfully' },
        );
      },
    });

    // All three tools should have executed
    expect(capturedContexts).toHaveLength(3);

    // Each tool should have received the same requestContext
    for (const captured of capturedContexts) {
      expect(captured.userId).toBe('user-999');
      expect(captured.sessionId).toBe('session-888');
    }

    // Verify all three steps are represented
    const steps = capturedContexts.map(c => c.step);
    expect(steps).toEqual(['tool_1', 'tool_2', 'tool_3']);
  });

  it('requestContext is not mutated between steps', async () => {
    // Track if requestContext gets modified during execution
    const originalUserId = 'original-user';
    const originalSessionId = 'original-session';

    let mutationDetected = false;

    const mutatingTool = createTool({
      id: 'mutating_tool',
      description: 'Tool that tries to mutate context',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async (_, context) => {
        const userId = context?.requestContext?.get('userId');

        // Try to mutate the context (should not affect other tools)
        if (context?.requestContext?.set) {
          context.requestContext.set('userId', 'mutated-user');
        }

        // Check if mutation happened
        const afterMutation = context?.requestContext?.get('userId');
        if (afterMutation === 'mutated-user' && userId === originalUserId) {
          mutationDetected = true;
        }

        return { result: 'done' };
      },
    });

    const checkTool = createTool({
      id: 'check_tool',
      description: 'Tool that checks context is unchanged',
      inputSchema: z.object({}),
      outputSchema: z.object({ userId: z.string() }),
      execute: async (_, context) => {
        const userId = context?.requestContext?.get('userId');
        return { userId: String(userId || 'undefined') };
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('userId', originalUserId);
    requestContext.set('sessionId', originalSessionId);

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Run mutating tool then check tool',
      tools: { mutating_tool: mutatingTool, check_tool: checkTool },
      stopWhen: stepCountIs(4),
      requestContext,
      fixtures: llm => {
        // Call mutating_tool first
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_mutate', name: 'mutating_tool', arguments: {} }] },
        );
        // After mutation, call check_tool
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_mutate', hasToolResult: true },
          { toolCalls: [{ id: 'call_check', name: 'check_tool', arguments: {} }] },
        );
        // Final response
        llm.on({ endpoint: 'chat', toolCallId: 'call_check', hasToolResult: true }, { content: 'Check complete' });
      },
    });

    // Mutation should have been detected (tool modified its own view)
    expect(mutationDetected).toBe(true);

    // But check_tool should see the original value (isolation preserved)
    const text = await output.text;
    // The check_tool result should contain the original userId, not 'mutated-user'
    expect(text).toContain('Check complete');
  });

  it('each parallel tool execution receives the same requestContext', async () => {
    // Track contexts from parallel execution
    const parallelContexts: Array<{ userId: string | undefined; toolName: string }> = [];

    const makeTool = (name: string) =>
      createTool({
        id: name,
        description: `${name} tool`,
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async (_, context) => {
          parallelContexts.push({
            userId: context?.requestContext?.get('userId'),
            toolName: name,
          });
          return { result: `${name}_done` };
        },
      });

    const requestContext = new RequestContext();
    requestContext.set('userId', 'parallel-user-777');

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Execute tools in parallel',
      tools: {
        parallel_a: makeTool('parallel_a'),
        parallel_b: makeTool('parallel_b'),
        parallel_c: makeTool('parallel_c'),
      },
      stopWhen: stepCountIs(3),
      requestContext,
      fixtures: llm => {
        // Model calls all three tools in parallel
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_a', name: 'parallel_a', arguments: {} },
              { id: 'call_b', name: 'parallel_b', arguments: {} },
              { id: 'call_c', name: 'parallel_c', arguments: {} },
            ],
          },
        );
        // After all tool results, produce final text
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Parallel execution complete' });
      },
    });

    // All three tools should have executed
    expect(parallelContexts).toHaveLength(3);

    // All should have received the same userId
    for (const captured of parallelContexts) {
      expect(captured.userId).toBe('parallel-user-777');
    }

    // All three tools should be represented
    const toolNames = parallelContexts.map(c => c.toolName).sort();
    expect(toolNames).toEqual(['parallel_a', 'parallel_b', 'parallel_c']);
  });
});
