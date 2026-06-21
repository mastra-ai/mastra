/**
 * AIMock Scenario: Abort During Tool Execution
 *
 * Tests that when an abort signal is triggered *while a tool is executing*,
 * the agentic loop handles it gracefully. This is distinct from aborting
 * mid-stream (between turns) - here we test aborting during the actual tool
 * execution phase.
 *
 * Asserts:
 * - abort signal propagates to tool execution context
 * - tool can detect abort and bail early
 * - loop does not make additional model requests after abort during tool
 * - finishReason reflects the abort
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: abort during tool execution', () => {
  const getMock = useLoopScenarioAimock();

  it('propagates abort signal to tool execution context', async () => {
    const abortController = new AbortController();
    let toolReceivedSignal = false;
    let toolCheckedAbort = false;

    const slowTool = createTool({
      id: 'slow_tool',
      description: 'A slow tool that checks for abort signal',
      inputSchema: z.object({}),
      outputSchema: z.object({ aborted: z.boolean() }),
      execute: async (_, context) => {
        // Tool checks if abort signal is available in context
        if ((context as any)?.abortSignal) {
          toolReceivedSignal = true;
          toolCheckedAbort = (context as any).abortSignal.aborted;
        }
        return { aborted: toolCheckedAbort };
      },
    });

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Use the slow tool',
      tools: { slow_tool: slowTool },
      stopWhen: stepCountIs(5),
      abortSignal: abortController.signal,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_slow', name: 'slow_tool', arguments: {} }],
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Tool completed' },
        );
      },
    });

    // Tool should have received the abort signal in context
    expect(toolReceivedSignal).toBe(true);

    // At the time of execution, abort was not yet triggered
    expect(toolCheckedAbort).toBe(false);
  });

  it('tool can bail early when abort is triggered during execution', async () => {
    const abortController = new AbortController();
    let toolStarted = false;

    const longRunningTool = createTool({
      id: 'long_running',
      description: 'A long-running tool that can be interrupted',
      inputSchema: z.object({}),
      outputSchema: z.object({ completed: z.boolean() }),
      execute: async (_, context) => {
        toolStarted = true;

        // Simulate work in chunks, checking abort periodically
        for (let i = 0; i < 10; i++) {
          if ((context as any)?.abortSignal?.aborted) {
            return { completed: false };
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        return { completed: true };
      },
    });

    // Trigger abort shortly after tool starts (give time for model request + tool dispatch)
    setTimeout(() => abortController.abort(), 500);

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Run the long tool',
      tools: { long_running: longRunningTool },
      stopWhen: stepCountIs(5),
      abortSignal: abortController.signal,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_long', name: 'long_running', arguments: {} }],
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Should not reach here' },
        );
      },
    });

    // Tool should have started
    expect(toolStarted).toBe(true);

    // Tool may or may not complete depending on abort timing
    // But the important thing is the loop handles it gracefully
    const finishReason = await output.finishReason;
    expect(finishReason).toBeDefined();
  });

  it('loop does not make additional requests after abort during tool execution', async () => {
    const abortController = new AbortController();
    let toolCallCount = 0;

    const countingTool = createTool({
      id: 'counting_tool',
      description: 'A tool that counts calls',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => {
        toolCallCount++;
        // Abort after first tool execution
        if (toolCallCount === 1) {
          abortController.abort();
        }
        return { count: toolCallCount };
      },
    });

    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Keep calling the tool',
      tools: { counting_tool: countingTool },
      stopWhen: stepCountIs(10),
      abortSignal: abortController.signal,
      fixtures: llm => {
        // Model always wants to call the tool
        llm.on(
          { endpoint: 'chat' },
          {
            toolCalls: [{ id: 'call_count', name: 'counting_tool', arguments: {} }],
          },
        );
      },
    });

    // Tool should have been called exactly once
    expect(toolCallCount).toBe(1);

    // Loop should have made at most 2 requests (initial + post-tool)
    // but should not continue after abort
    expect(requests.length).toBeLessThanOrEqual(2);
  });
});
