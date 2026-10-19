import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: onFinish callback.
 *
 * The onFinish callback fires when execution completes. This pins the callback
 * invocation path, ensuring final result observability works correctly.
 */
describeForAllEngines(
  'AIMock loop scenario: onFinish callback',
  engine => {
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
        engine,
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
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      expect(finishCalled).toBe(true);
      expect(finishResult.text).toBe('Done.');
      expect(finishResult.finishReason).toBe('stop');
      expect(finishResult.steps).toHaveLength(2);
    });

    it('onFinish receives text and steps', async () => {
      let resultText: string | undefined;
      let resultSteps: any[] | undefined;

      await runLoopScenario({
        engine,
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

      expect(resultText).toBe('Test response.');
      expect(resultSteps).toHaveLength(1);
      expect(resultSteps![0].text).toBe('Test response.');
    });

    // Durable and evented hand onFinish raw tool-result payloads instead of chunks (#27428).
    const itFailsOnDurableToolResults = engine === 'durable' || engine === 'evented' ? it.fails : it;

    itFailsOnDurableToolResults('onFinish fires after tool execution', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      let toolResults: any[] | undefined;

      await runLoopScenario({
        engine,
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
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      expect(toolResults).toHaveLength(1);
      expect(toolResults![0].type).toBe('tool-result');
      expect(toolResults![0].payload.toolName).toBe('tick');
      expect(toolResults![0].payload.result).toEqual({ count: 1 });
    });
  },
  {},
);
