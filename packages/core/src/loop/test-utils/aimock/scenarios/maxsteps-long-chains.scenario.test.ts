import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: very long tool chains capped by maxSteps', () => {
  const getMock = useLoopScenarioAimock();

  it('maxSteps caps a long tool chain and prevents runaway execution', async () => {
    let executionCount = 0;

    const incrementTool = createTool({
      id: 'increment',
      description: 'Increments a counter',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        executionCount++;
        return { count: executionCount };
      },
    });

    // Model always requests the tool, but maxSteps should cap it
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Keep incrementing',
      tools: { incrementTool },
      maxSteps: 5,
      fixtures: llm => {
        // Always call the increment tool
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_inc_1', name: 'increment', arguments: {} }],
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            toolCalls: [{ id: 'call_inc_more', name: 'increment', arguments: {} }],
          },
        );
      },
    });

    // The model would loop forever, but maxSteps caps it at exactly 5 model
    // requests (and therefore 5 tool executions). Asserting the exact count
    // means a regression that runs past the cap fails the test.
    expect(requests).toHaveLength(5);
    expect(executionCount).toBe(5);
  });

  it('stopWhen bounds an otherwise-infinite tool chain at the exact step', async () => {
    let executionCount = 0;

    const countingTool = createTool({
      id: 'counter',
      description: 'Counts up',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        executionCount++;
        return { count: executionCount };
      },
    });

    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Count to 3',
      tools: { countingTool },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        // Every turn: call the counter tool (never finish with text)
        llm.on(
          { endpoint: 'chat' },
          {
            toolCalls: [{ id: 'call_cnt', name: 'counter', arguments: {} }],
          },
        );
      },
    });

    // stepCountIs(3) halts the loop at exactly 3 model requests. Without the
    // stop condition this model would loop forever.
    expect(requests).toHaveLength(3);
    expect(executionCount).toBe(3);
  });

  it('model can finish naturally before maxSteps is reached', async () => {
    let executionCount = 0;

    const simpleTool = createTool({
      id: 'simple',
      description: 'A simple tool',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        executionCount++;
        return { done: true };
      },
    });

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Use the tool once',
      tools: { simpleTool },
      maxSteps: 20,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_simple', name: 'simple', arguments: {} }],
          },
        );
        // After tool result, return final text (no more tool calls)
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done after one tool call' });
      },
    });

    // Model finished naturally after 1 tool call, didn't need all 20 steps
    expect(executionCount).toBe(1);
    expect(await output.text).toContain('Done after one tool call');
  });
});
