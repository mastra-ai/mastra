import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { createTool } from '../tools';
import { Agent } from './index';

config();

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai']);

const mock = createGatewayMock({
  transformRequest: ({ url, body }) => {
    let serialized = JSON.stringify(body);

    serialized = serialized.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '00000000-0000-0000-0000-000000000000',
    );
    serialized = serialized.replace(/"toolCallId":"[a-zA-Z0-9_-]+"/g, '"toolCallId":"NORMALIZED"');
    serialized = serialized.replace(/\\"toolCallId\\":\\"[a-zA-Z0-9_-]+\\"/g, '\\"toolCallId\\":\\"NORMALIZED\\"');
    serialized = serialized.replace(/"call_id":"call_[a-zA-Z0-9]+"/g, '"call_id":"call_NORMALIZED"');
    serialized = serialized.replace(/\\"call_id\\":\\"call_[a-zA-Z0-9]+\\"/g, '\\"call_id\\":\\"call_NORMALIZED\\"');
    serialized = serialized.replace(/"id":"fc_[a-zA-Z0-9]+"/g, '"id":"fc_NORMALIZED"');

    return { url, body: JSON.parse(serialized) };
  },
});
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

// Real-provider recording: checks that OpenAI strict structured output accepts the
// optional -> nullable schema rewrite. Kept as a recording on purpose; it moves to the
// real-provider re-record tier in #28459. Everything else from this file now lives in
// aimock scenarios (see #27423).
describe('test schema compat structured output', () => {
  it('should convert optional fields to nullable for openai and succeed without error', async () => {
    const weatherInfo = createTool({
      id: 'weather-info',
      description: 'Fetches the current weather information for a given city',
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async inputData => {
        return {
          city: inputData.city,
          weather: 'sunny',
          temperature_celsius: 19,
          temperature_fahrenheit: 66,
          humidity: 50,
          wind: '10 mph',
        };
      },
    });

    const weatherAgent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions:
        'You are a weather agent. When asked about weather in any city, use the weather info tool with the city name as the input.',
      description: 'An agent that can help you get the weather for a given city.',
      model: 'openai/gpt-4o',
      tools: {
        weatherInfo,
      },
    });

    const mastra = new Mastra({
      agents: { weatherAgent },
      logger: false,
    });
    const agent = mastra.getAgent('weatherAgent');

    const schema = z.object({
      weather: z.string(),
      temperature: z.number(),
      humidity: z.number(),
      // Optional should be transformed to nullable and then the data set to undefined
      windSpeed: z.string().optional(),
      // Optional.nullable should be transformed to nullable and then the data set to undefined
      barometricPressure: z.number().optional().nullable(),
      // Nullable should not change and be able to return a nullable value from openAI
      precipitation: z.number().nullable(),
    });

    const result = await agent.generate(
      'What is the weather in London? You can omit wind speed, precipitation, and barometric pressure.',
      {
        structuredOutput: {
          schema,
        },
      },
    );

    expect(result.error).toBeUndefined();

    const resultObject = await result.object;

    expect(resultObject).toMatchObject({
      weather: expect.any(String),
      temperature: expect.any(Number),
      humidity: expect.any(Number),
      // .optional().nullable() fields: compat layer transforms null → undefined
      barometricPressure: undefined,
      // .nullable() (without .optional()) stays null
      precipitation: null,
    });
    expect(resultObject?.windSpeed === undefined || typeof resultObject?.windSpeed === 'string').toBe(true);
  });
});
