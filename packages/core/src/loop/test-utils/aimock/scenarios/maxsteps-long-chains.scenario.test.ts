import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
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
            toolCalls: [
              { id: 'call_inc_1', name: 'increment', arguments: {} },
            ],
          },
        );
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            toolCalls: [
              { id: 'call_inc_more', name: 'increment', arguments: {} },
            ],
          },
        );
      },
    });

    // Should stop at maxSteps (5), not run indefinitely
    expect(executionCount).toBeLessThanOrEqual(5);
    expect(requests.length).toBeLessThanOrEqual(5);
  });

  it('stopWhen and maxSteps can both bound execution', async () => {
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
      maxSteps: 10,
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        // Every turn: call the counter tool (never finish with text)
        llm.on(
          { endpoint: 'chat' },
          {
            toolCalls: [
              { id: 'call_cnt', name: 'counter', arguments: {} },
            ],
          },
        );
      },
    });

    // Both stopWhen and maxSteps can bound execution - whichever triggers first
    expect(executionCount).toBeLessThanOrEqual(10);
    expect(requests.length).toBeLessThanOrEqual(10);
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
            toolCalls: [
              { id: 'call_simple', name: 'simple', arguments: {} },
            ],
          },
        );
        // After tool result, return final text (no more tool calls)
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          { content: 'Done after one tool call' },
        );
      },
    });

    // Model finished naturally after 1 tool call, didn't need all 20 steps
    expect(executionCount).toBe(1);
    expect(await output.text).toContain('Done after one tool call');
  });
});
