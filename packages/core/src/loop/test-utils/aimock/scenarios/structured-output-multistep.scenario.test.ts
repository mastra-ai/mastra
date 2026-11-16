import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { createRecordingModel, textOnlyTape, toolCallTape } from '../parity';

// #25075: a Zod schema must survive the JSON boundary between durable steps.
describeForAllEngines('AIMock loop scenario: structured answer after a lookup', engine => {
  const getMock = useLoopScenarioAimock();
  it('keeps the nested answer schema on the second model request', async () => {
    const answer = { forecast: { city: 'Paris', temperature: 20 } };
    const model = createRecordingModel({
      tapes: [toolCallTape('weather', {}, 'forecast'), textOnlyTape(JSON.stringify(answer))],
    });
    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      model: () => model.model,
      prompt: 'Look up the weather in Paris, then return the forecast.',
      maxSteps: 2,
      collectChunks: true,
      structuredOutput: {
        jsonPromptInjection: false,
        schema: z.object({ forecast: z.object({ city: z.string(), temperature: z.number() }) }),
      },
      tools: {
        weather: createTool({
          id: 'weather',
          description: 'Look up the weather.',
          inputSchema: z.object({}),
          execute: async () => answer.forecast,
        }),
      },
      fixtures: () => {},
    });
    expect(await output.object).toEqual(answer);
    expect(model.requests).toHaveLength(2);
    for (const request of model.requests) {
      expect(request.responseFormat).toMatchObject({
        type: 'json',
        schema: {
          type: 'object',
          required: ['forecast'],
          properties: {
            forecast: {
              type: 'object',
              required: ['city', 'temperature'],
              properties: { city: { type: 'string' }, temperature: { type: 'number' } },
            },
          },
        },
      });
    }
    expect(chunks.filter(chunk => chunk.type === 'object-result')).toHaveLength(1);
    expect(model.requests[1]!.prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'tool',
          content: expect.arrayContaining([expect.objectContaining({ toolCallId: 'forecast', type: 'tool-result' })]),
        }),
      ]),
    );
  });
});
