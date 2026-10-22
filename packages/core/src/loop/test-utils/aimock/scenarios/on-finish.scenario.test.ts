import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import type { LLMStepResult, MastraOnFinishCallbackArgs, ToolResultChunk } from '../../../../stream/types';
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
        onFinish: (result: MastraOnFinishCallbackArgs) => {
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
      let resultSteps: LLMStepResult[] | undefined;
      let toolResults: ToolResultChunk[] | undefined;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Simple test.',
        stopWhen: stepCountIs(1),
        onFinish: (result: MastraOnFinishCallbackArgs) => {
          resultText = result.text;
          resultSteps = result.steps;
          toolResults = result.toolResults;
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Test response.' });
        },
      });

      expect(resultText).toBe('Test response.');
      expect(resultSteps).toHaveLength(1);
      expect(resultSteps![0].text).toBe('Test response.');
      expect(toolResults).toEqual([]);
      expect(resultSteps![0].toolResults).toEqual([]);
    });

    // The public callback must expose tool-result chunks on every engine (#27428).
    it('onFinish fires after tool execution', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({ amount: z.number() }),
        outputSchema: z.object({ count: z.number() }),
        execute: async ({ amount }) => ({ count: amount }),
      });

      let toolResults: ToolResultChunk[] | undefined;
      let steps: LLMStepResult[] | undefined;
      let runId: string | undefined;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        onFinish: (result: MastraOnFinishCallbackArgs) => {
          toolResults = result.toolResults;
          steps = result.steps;
          runId = result.runId;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: { amount: 2 } }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      expect(toolResults).toHaveLength(1);
      const expectedResult = {
        type: 'tool-result',
        runId,
        from: 'AGENT',
        payload: {
          toolCallId: 'call_tick',
          toolName: 'tick',
          args: { amount: 2 },
          result: { count: 2 },
        },
      };
      expect(toolResults![0]).toMatchObject(expectedResult);
      expect(steps![0].toolResults).toHaveLength(1);
      expect(steps![0].toolResults[0]).toMatchObject(expectedResult);
      expect(steps![1].toolResults).toEqual([]);
    });
  },
  {},
);
