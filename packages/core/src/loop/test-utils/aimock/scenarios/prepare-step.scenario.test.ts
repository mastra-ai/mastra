import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: prepareStep per-step overrides reach the model request.
 *
 * `prepareStep` runs before each loop step and can change which tools are active
 * for that step. Here step 0 exposes only `tool_a` and step 1 exposes only
 * `tool_b`. We drive a 2-step loop (turn 1 calls tool_a, turn 2 finishes) and
 * assert each request's tool list reflects the per-step override. A regression
 * where prepareStep's activeTools is ignored or applied to the wrong step is
 * caught here.
 */
describeForAllEngines('AIMock loop scenario: prepareStep per-step overrides', engine => {
  const getMock = useLoopScenarioAimock();

  it('applies per-step activeTools to each request', async () => {
    const toolA = createTool({
      id: 'tool_a',
      description: 'Tool A, only active on step 0.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });
    const toolB = createTool({
      id: 'tool_b',
      description: 'Tool B, only active on step 1.',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use the right tool for each step.',
      tools: { tool_a: toolA, tool_b: toolB },
      stopWhen: stepCountIs(3),
      prepareStep: ({ stepNumber }: { stepNumber: number }) => ({
        activeTools: stepNumber === 0 ? ['tool_a'] : ['tool_b'],
      }),
      fixtures: llm => {
        // Step 0: call tool_a. Step 1: receive the result and finish.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_a', name: 'tool_a', arguments: {} }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(requests).toHaveLength(2);

    const toolNames = (req: number) =>
      ((requests[req]?.body as any)?.tools ?? []).map((t: any) => t.function?.name ?? t.name);

    // Step 0 request exposes only tool_a.
    expect(toolNames(0)).toContain('tool_a');
    expect(toolNames(0)).not.toContain('tool_b');

    // Step 1 request exposes only tool_b (the per-step override changed).
    expect(toolNames(1)).toContain('tool_b');
    expect(toolNames(1)).not.toContain('tool_a');
  });
});
