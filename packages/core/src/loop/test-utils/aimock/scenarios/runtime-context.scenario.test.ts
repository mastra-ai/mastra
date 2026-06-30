/**
 * AIMock Scenario: Runtime Context (requestContext) Passthrough
 *
 * Tests that requestContext is properly passed through to tools during execution.
 * This covers the regression class where context could be lost or corrupted
 * during the agent loop, causing tools to receive undefined or stale context.
 *
 * Asserts:
 * - requestContext is available in tool execute function
 * - requestContext values match what was passed to agent.stream()
 * - Multiple tools in the same run receive the same requestContext
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: runtime context passthrough', engine => {
  const getMock = useLoopScenarioAimock();

  it('passes requestContext to tool execute function', async () => {
    let capturedUserId: string | undefined;
    let capturedRole: string | undefined;

    const getUserData = createTool({
      id: 'get_user_data',
      description: 'Get user data based on request context',
      inputSchema: z.object({}),
      outputSchema: z.object({ userId: z.string(), role: z.string() }),
      execute: async (input, context) => {
        // Extract from requestContext
        capturedUserId = context?.requestContext?.get('userId');
        capturedRole = context?.requestContext?.get('role');
        return {
          userId: capturedUserId || 'unknown',
          role: capturedRole || 'unknown',
        };
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-123');
    requestContext.set('role', 'admin');

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Get my user data.',
      tools: { get_user_data: getUserData },
      stopWhen: stepCountIs(2),
      requestContext,
      fixtures: llm => {
        // Turn 1: emit a tool call
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_user', name: 'get_user_data', arguments: {} }],
          },
        );
        // Turn 2: summarize the result
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Your user ID is user-123 and your role is admin.' },
        );
      },
    });

    // Tool received the correct requestContext values
    expect(capturedUserId).toBe('user-123');
    expect(capturedRole).toBe('admin');

    // Tool result was passed back to the model
    expect(requests).toHaveLength(2);
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find((msg: any) => msg.role === 'tool') as { content?: string };
    expect(toolMessage?.content).toContain('user-123');
    expect(toolMessage?.content).toContain('admin');

    // Final output contains the expected values
    const finalText = await output.text;
    expect(finalText).toContain('user-123');
    expect(finalText).toContain('admin');
  });

  it('passes the same requestContext to multiple tools in one run', async () => {
    const capturedContexts: Map<string, string | undefined>[] = [];

    const toolA = createTool({
      id: 'tool_a',
      description: 'First tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async (input, context) => {
        const ctx = new Map<string, string | undefined>();
        ctx.set('userId', context?.requestContext?.get('userId'));
        ctx.set('sessionId', context?.requestContext?.get('sessionId'));
        capturedContexts.push(ctx);
        return { result: 'A' };
      },
    });

    const toolB = createTool({
      id: 'tool_b',
      description: 'Second tool',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async (input, context) => {
        const ctx = new Map<string, string | undefined>();
        ctx.set('userId', context?.requestContext?.get('userId'));
        ctx.set('sessionId', context?.requestContext?.get('sessionId'));
        capturedContexts.push(ctx);
        return { result: 'B' };
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-456');
    requestContext.set('sessionId', 'session-789');

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Call both tools.',
      tools: { tool_a: toolA, tool_b: toolB },
      stopWhen: stepCountIs(2),
      requestContext,
      fixtures: llm => {
        // Turn 1: emit two parallel tool calls
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              { id: 'call_a', name: 'tool_a', arguments: {} },
              { id: 'call_b', name: 'tool_b', arguments: {} },
            ],
          },
        );
        // Turn 2: summarize
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Both tools completed.' });
      },
    });

    // Both tools were executed
    expect(capturedContexts).toHaveLength(2);

    // Both tools received the same requestContext
    expect(capturedContexts[0].get('userId')).toBe('user-456');
    expect(capturedContexts[0].get('sessionId')).toBe('session-789');
    expect(capturedContexts[1].get('userId')).toBe('user-456');
    expect(capturedContexts[1].get('sessionId')).toBe('session-789');
  });
});
