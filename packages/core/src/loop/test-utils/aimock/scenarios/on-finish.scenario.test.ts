import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: onFinish callback.
 *
 * The onFinish callback fires when execution completes. This pins the callback
 * invocation path, ensuring final result observability works correctly.
 */
describe('AIMock loop scenario: onFinish callback', () => {
  const getMock = useLoopScenarioAimock();

  it('onFinish fires when execution completes', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 1 }),
    });

    let finishCalled = false;
    let finishResult: any;

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Call tool then finish.',
      tools: { tick: tickTool },
      stopWhen: stepCountIs(3),
      onFinish: (result: any) => {
        finishCalled = true;
        finishResult = result;
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Done.' },
        );
      },
    });

    // Finish callback should have been called
    expect(finishCalled).toBe(true);

    // Should have received result
    expect(finishResult).toBeDefined();
  });

  it('onFinish receives text and steps', async () => {
    let resultText: string | undefined;
    let resultSteps: any[] | undefined;

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Simple test.',
      stopWhen: stepCountIs(1),
      onFinish: (result: any) => {
        resultText = result.text;
        resultSteps = result.steps;
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Test response.' });
      },
    });

    // Should have received text
    expect(resultText).toBeDefined();

    // Should have received steps
    expect(resultSteps).toBeDefined();
    expect(Array.isArray(resultSteps)).toBe(true);
  });

  it('onFinish fires after tool execution', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 1 }),
    });

    let toolResults: any[] | undefined;

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Call tool.',
      tools: { tick: tickTool },
      stopWhen: stepCountIs(3),
      onFinish: (result: any) => {
        toolResults = result.toolResults;
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Done.' },
        );
      },
    });

    // Should have received tool results
    expect(toolResults).toBeDefined();
    expect(Array.isArray(toolResults)).toBe(true);
    expect(toolResults!.length).toBeGreaterThan(0);
  });
});
