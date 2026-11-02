import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { SpanType } from '../../../../observability';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { captureOutcomeEvents as capture } from '../outcome-test-utils';

const tick = createTool({
  id: 'tick',
  description: 'Tick',
  inputSchema: z.object({}),
  execute: async () => ({ ok: true }),
});

describeForAllEngines('model generation span links to the provider response', engine => {
  const getMock = useLoopScenarioAimock();

  // Durable engines end the MODEL_GENERATION span from saved state in a later step.
  it('records the responseId and responseModel of the last step, as the caller sees on response', async () => {
    const { observability, ended } = capture();
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      observability,
      prompt: 'Call tick, then answer.',
      tools: { tick },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    const response = await output.response;
    expect(response.id).toEqual(expect.any(String));
    expect(response.modelId).toEqual(expect.any(String));

    await expect.poll(() => ended(SpanType.MODEL_GENERATION).length).toBe(1);
    expect(ended(SpanType.MODEL_GENERATION)[0]?.attributes).toMatchObject({
      responseId: response.id,
      responseModel: response.modelId,
    });
  });
});
