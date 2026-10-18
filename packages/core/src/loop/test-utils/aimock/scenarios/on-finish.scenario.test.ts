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

      // Finish callback should have been called
      expect(finishCalled).toBe(true);

      // Should have received result
      expect(finishResult).toBeDefined();
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
      let toolCalls: any[] | undefined;
      let steps: any[] | undefined;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        onFinish: (result: any) => {
          toolResults = result.toolResults;
          toolCalls = result.toolCalls;
          steps = result.steps;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      // Should have received tool results
      expect(toolResults).toBeDefined();
      expect(Array.isArray(toolResults)).toBe(true);
      expect(toolResults!.length).toBeGreaterThan(0);

      // Every engine exposes tool results/calls as stream chunks (#27428).
      const resultChunk = {
        type: 'tool-result',
        payload: expect.objectContaining({ toolCallId: 'call_tick', toolName: 'tick', result: { count: 1 } }),
      };
      const callChunk = {
        type: 'tool-call',
        payload: expect.objectContaining({ toolCallId: 'call_tick', toolName: 'tick' }),
      };
      expect(toolResults).toEqual([expect.objectContaining(resultChunk)]);
      expect(toolCalls).toEqual([expect.objectContaining(callChunk)]);
      expect(steps!.flatMap(s => s.toolResults)).toEqual([expect.objectContaining(resultChunk)]);
      expect(steps!.flatMap(s => s.toolCalls)).toEqual([expect.objectContaining(callChunk)]);
    });

    it('onFinish toolResults omit failed tool calls', async () => {
      const boomTool = createTool({
        id: 'boom',
        description: 'Always fails.',
        inputSchema: z.object({}),
        execute: async () => {
          throw new Error('boom failed');
        },
      });

      let finishResult: any;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool.',
        tools: { boom: boomTool },
        stopWhen: stepCountIs(3),
        onFinish: (result: any) => {
          finishResult = result;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_boom', name: 'boom', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      expect(finishResult).toBeDefined();
      expect(finishResult.toolResults).toEqual([]);
      expect(finishResult.toolCalls).toEqual([
        expect.objectContaining({ type: 'tool-call', payload: expect.objectContaining({ toolName: 'boom' }) }),
      ]);
    });
  },
  {},
);
