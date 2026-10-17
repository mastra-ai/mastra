/**
 * AIMock Scenario: Result object
 *
 * Verifies the stream output's resolved result properties (usage, totalUsage,
 * finishReason, response, request, warnings, steps, toolCalls, toolResults)
 * reflect what the provider actually sent across a two-step tool loop.
 */

import { jsonSchema, stepCountIs } from '@internal/ai-v7';
import { it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

const tools = {
  get_weather: {
    description: 'Get the weather for a city',
    inputSchema: jsonSchema<{ city: string }>({
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    }),
    execute: async ({ city }: { city: string }) => ({ city, forecast: 'sunny' }),
  },
};

describeForAllEngines('AIMock loop scenario: result object', engine => {
  const getMock = useLoopScenarioAimock();

  it('resolves usage, finish reason, response, request, steps and tool results from the provider', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is the weather in Paris?',
      tools,
      stopWhen: stepCountIs(3),
      modelSettings: { temperature: 0.3 },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_weather', name: 'get_weather', arguments: JSON.stringify({ city: 'Paris' }) }],
            id: 'chatcmpl-step-1',
            model: 'gpt-4o-mini-step-1',
            usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
          },
        );
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_weather', hasToolResult: true },
          {
            content: 'It is sunny in Paris.',
            id: 'chatcmpl-step-2',
            model: 'gpt-4o-mini-step-2',
            usage: { prompt_tokens: 23, completion_tokens: 5, total_tokens: 28 },
          },
        );
      },
    });

    expect(await output.text).toBe('It is sunny in Paris.');
    expect(await output.finishReason).toBe('stop');

    // usage and totalUsage both sum every step; per-step usage lives on steps[n]
    expect(await output.usage).toMatchObject({ inputTokens: 34, outputTokens: 12, totalTokens: 46 });
    expect(await output.totalUsage).toMatchObject({ inputTokens: 34, outputTokens: 12, totalTokens: 46 });

    const response = await output.response;
    expect(response.id).toBe('chatcmpl-step-2');
    expect(response.modelId).toBe('gpt-4o-mini-step-2');

    // Durable engines keep the model request out of their event stream by design.
    if (engine === 'normal' || engine === 'fs') {
      const request = await output.request;
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      expect(body).toMatchObject({ temperature: 0.3 });
    }

    const steps = await output.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0]!.finishReason).toBe('tool-calls');
    expect(steps[0]!.usage).toMatchObject({ inputTokens: 11, outputTokens: 7, totalTokens: 18 });
    expect(steps[0]!.response.id).toBe('chatcmpl-step-1');
    expect(steps[0]!.toolCalls.map(c => c.payload.toolName)).toEqual(['get_weather']);
    expect(steps[1]!.finishReason).toBe('stop');
    expect(steps[1]!.text).toBe('It is sunny in Paris.');

    const toolCalls = steps.flatMap(s => s.toolCalls);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.payload).toMatchObject({
      toolCallId: 'call_weather',
      toolName: 'get_weather',
      args: { city: 'Paris' },
    });

    const toolResults = await output.toolResults;
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]!.payload).toMatchObject({
      toolCallId: 'call_weather',
      toolName: 'get_weather',
      result: { city: 'Paris', forecast: 'sunny' },
    });
  });

  it('surfaces provider warnings for unsupported settings', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello.',
      stopWhen: stepCountIs(1),
      modelSettings: { topK: 5 },
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Hi.' });
      },
    });

    expect(await output.text).toBe('Hi.');
    const warnings = await output.warnings;
    expect(warnings).toEqual(expect.arrayContaining([expect.objectContaining({ feature: 'topK' })]));
  });
});
