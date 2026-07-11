import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: onStepFinish callback.
 *
 * The onStepFinish callback fires after each execution step, including
 * intermediate tool-call steps. This pins the callback invocation path,
 * ensuring step-level observability works correctly.
 */
describeForAllEngines(
  'AIMock loop scenario: onStepFinish callback',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('onStepFinish fires for each step including intermediate', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      const steps: any[] = [];

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool then finish.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        onStepFinish: (step: any) => {
          steps.push(step);
        },
        fixtures: llm => {
          // Step 1: tool call
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
          );
          // Step 2: finish
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      // Should have 2 steps (tool call + finish)
      expect(steps.length).toBeGreaterThanOrEqual(2);

      // First step should have tool calls
      expect(steps[0].toolCalls).toBeDefined();

      // Last step should have text
      expect(steps[steps.length - 1].text).toBeDefined();
    });

    it('onStepFinish receives step context', async () => {
      const stepsSeen: any[] = [];

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Test step context.',
        stopWhen: stepCountIs(2),
        onStepFinish: (step: any) => {
          stepsSeen.push(step);
        },
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Done.' });
        },
      });

      // Should have at least one step
      expect(stepsSeen.length).toBeGreaterThan(0);

      // Steps should have some context
      expect(stepsSeen[0]).toBeDefined();
    });
  },
  {},
);
