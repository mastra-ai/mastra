import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: maxSteps and stop condition edge cases.
 *
 * The loop should correctly handle boundary conditions around maxSteps,
 * including exact matches, early termination, and composition with other
 * stop conditions. This pins the step counting and termination logic.
 */
describeForAllEngines(
  'AIMock loop scenario: maxSteps edge cases',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('stops exactly at maxSteps boundary', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      const maxSteps = 3;

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Keep ticking.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(maxSteps),
        fixtures: llm => {
          // Model always calls tool, never finishes on its own
          llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] });
        },
      });

      // Should stop at exactly maxSteps
      expect(requests).toHaveLength(maxSteps);
    });

    it('stopWhen can stop before maxSteps', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      let stepCount = 0;

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Keep ticking.',
        tools: { tick: tickTool },
        stopWhen: () => {
          stepCount++;
          return stepCount >= 2;
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] });
        },
      });

      // Should stop at step 2, not continue
      expect(requests).toHaveLength(2);
    });

    it('model can finish before maxSteps', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      const { requests, output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Tick once then finish.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(10),
        fixtures: llm => {
          // First call tool, then finish
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick_1', name: 'tick', arguments: {} }] },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done after one tick.' });
        },
      });

      // Should stop after 2 requests (tool call + finish), not 10
      expect(requests).toHaveLength(2);

      // Output should contain the final text
      const text = await output.text;
      expect(text).toContain('Done');
    });

    it('maxSteps=1 allows exactly one model call', async () => {
      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Answer quickly.',
        stopWhen: stepCountIs(1),
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Quick answer.' });
        },
      });

      // Should make exactly one request
      expect(requests).toHaveLength(1);
    });

    it('multiple stopWhen conditions use OR logic', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      let condition1Count = 0;
      let condition2Count = 0;

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Keep ticking.',
        tools: { tick: tickTool },
        stopWhen: [
          () => {
            condition1Count++;
            return condition1Count >= 5; // Would stop at 5
          },
          () => {
            condition2Count++;
            return condition2Count >= 2; // Should stop at 2 (earlier)
          },
        ],
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] });
        },
      });

      // Should stop at 2 (the earlier condition)
      expect(requests).toHaveLength(2);
    });
  },
);
