import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: stop conditions in long/looping tool runs.
 *
 * The model is scripted to emit a tool call on *every* turn (it never stops on
 * its own). The loop must halt at `stopWhen: stepCountIs(N)` rather than loop
 * forever. We assert the loop made exactly the bounded number of model
 * requests.
 */
describeForAllEngines('AIMock loop scenario: stop condition in a long loop', engine => {
  const getMock = useLoopScenarioAimock();

  it('halts a never-finishing tool loop at the stopWhen boundary', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter by one.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ticked: z.boolean() }),
      execute: async () => ({ ticked: true }),
    });

    const maxSteps = 3;

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Keep ticking forever.',
      tools: { tick: tickTool },
      stopWhen: stepCountIs(maxSteps),
      fixtures: llm => {
        // Every chat turn (regardless of tool-result state) emits another tool
        // call, so the model never produces a terminal text response. Only
        // stopWhen can end the loop.
        llm.on(
          { endpoint: 'chat' },
          {
            toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }],
          },
        );
      },
    });

    // stepCountIs(maxSteps) bounds the loop to exactly `maxSteps` model turns.
    expect(requests).toHaveLength(maxSteps);
  });

  it('stops as soon as the model finishes, before the step bound', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter by one.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ticked: z.boolean() }),
      execute: async () => ({ ticked: true }),
    });

    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tick once then finish.',
      tools: { tick: tickTool },
      // High bound: the model, not stopWhen, should end the loop.
      stopWhen: stepCountIs(10),
      fixtures: llm => {
        // Turn 1: one tool call.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
        );
        // Turn 2: the model finishes with text -> no further turns.
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Ticked once. Done.' });
      },
    });

    // Exactly two turns: the tool call and the terminal text. The loop did not
    // run up to the step bound.
    expect(requests).toHaveLength(2);
    expect(await output.text).toContain('Done');
  });

  it('honors a custom stopWhen predicate over accumulated steps', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter by one.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ticked: z.boolean() }),
      execute: async () => ({ ticked: true }),
    });

    const stopAfter = 2;
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Keep ticking forever.',
      tools: { tick: tickTool },
      // Custom predicate: stop once we have accumulated `stopAfter` steps.
      stopWhen: ({ steps }: { steps: unknown[] }) => steps.length >= stopAfter,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] });
      },
    });

    // The predicate fires after `stopAfter` steps, bounding the request count.
    expect(requests).toHaveLength(stopAfter);
  });
});
