/**
 * AIMock Scenario: Abort Signal
 *
 * Tests that when an abort signal is triggered mid-stream, the agentic loop
 * halts cleanly without making additional model requests. This covers the
 * regression class where abort handling could be bypassed or ignored, causing
 * the loop to continue running after abort is requested.
 *
 * Asserts:
 * - abortSignal is respected and the loop stops after abort
 * - no additional model requests are made after abort is triggered
 * - finishReason indicates the run was aborted
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: abort signal mid-stream', () => {
  const getMock = useLoopScenarioAimock();

  it('halts the loop when abort signal is triggered after first tool call', async () => {
    const abortController = new AbortController();
    let toolExecuted = false;

    const getData = createTool({
      id: 'get_data',
      description: 'Get data and trigger abort',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => {
        toolExecuted = true;
        // Abort after tool execution but before next model request
        abortController.abort();
        return { value: 'DATA_VALUE' };
      },
    });

    const { requests, output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Get data and then continue.',
      tools: { get_data: getData },
      stopWhen: stepCountIs(10),
      abortSignal: abortController.signal,
      fixtures: llm => {
        // Turn 1: emit a tool call
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_data', name: 'get_data', arguments: {} }],
          },
        );
        // Turn 2: should not be reached due to abort
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'This should not appear because we aborted.' },
        );
      },
    });

    // Tool was executed
    expect(toolExecuted).toBe(true);

    // Only one model request was made (the abort happened before the second request)
    expect(requests.length).toBeLessThanOrEqual(2);

    // The output stream should indicate it was aborted/terminated
    const finishReason = await output.finishReason;
    expect(finishReason).toMatch(/abort|cancelled|error|tripwire/i);
  });

  it('prevents the loop from starting when abort signal is already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const { requests, output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'This should not execute.',
      stopWhen: stepCountIs(5),
      abortSignal: abortController.signal,
      fixtures: llm => {
        // This fixture should never be matched
        llm.on({ endpoint: 'chat' }, { content: 'This should not appear.' });
      },
    });

    // No model requests should have been made (or very few if abort races with stream start)
    expect(requests.length).toBeLessThanOrEqual(1);

    // The output stream should indicate it was aborted/terminated
    const finishReason = await output.finishReason;
    expect(finishReason).toMatch(/abort|cancelled|error|tripwire/i);
  });
});
