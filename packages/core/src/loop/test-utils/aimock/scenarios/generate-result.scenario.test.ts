import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { createSharedAgent, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: the non-streaming (`generate`) result object.
 *
 * A two-step tool loop through agent.generate() must resolve text, steps with
 * tool calls/results, response messages, the request body and response info.
 */
describe('AIMock loop scenario: generate() result', () => {
  const getMock = useLoopScenarioAimock();

  it('resolves text, steps, response messages, request and response', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_weather', name: 'get_weather', arguments: { city: 'Paris' } }], id: 'chatcmpl-gen-1' },
    );
    llm.on(
      { endpoint: 'chat', toolCallId: 'call_weather', hasToolResult: true },
      { content: 'It is sunny in Paris.', id: 'chatcmpl-gen-2' },
    );

    const get_weather = createTool({
      id: 'get_weather',
      description: 'Get the weather for a city.',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, forecast: 'sunny' }),
    });

    const { agent } = await createSharedAgent(llm, { tools: { get_weather } });
    const result = await agent.generate('What is the weather in Paris?', {
      modelSettings: { temperature: 0.2 },
    });

    expect(result.text).toBe('It is sunny in Paris.');
    expect(result.finishReason).toBe('stop');

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.toolCalls).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          toolCallId: 'call_weather',
          toolName: 'get_weather',
          args: { city: 'Paris' },
        }),
      }),
    ]);
    expect(result.steps[0]?.toolResults).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ toolCallId: 'call_weather', result: { city: 'Paris', forecast: 'sunny' } }),
      }),
    ]);

    const messages = result.response.messages ?? [];
    expect(messages.map((m: any) => m.role)).toEqual(['assistant', 'tool', 'assistant']);
    expect(JSON.stringify(messages.at(-1))).toContain('It is sunny in Paris.');

    const body = typeof result.request.body === 'string' ? JSON.parse(result.request.body) : result.request.body;
    expect(body).toMatchObject({ temperature: 0.2 });

    expect(result.response.id).toBe('chatcmpl-gen-2');
    expect(result.response.modelId).toBeTruthy();
  });
});
