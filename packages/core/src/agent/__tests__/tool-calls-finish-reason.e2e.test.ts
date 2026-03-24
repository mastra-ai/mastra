/**
 * E2E test: Verify that different LLM providers correctly continue the agent
 * loop when tool calls are present, regardless of the finishReason returned.
 *
 * Some models return finishReason: 'stop' even when tool calls are present.
 * The agent loop must continue processing tool results in all cases.
 */
import { anthropic } from '@ai-sdk/anthropic-v5';
import { google } from '@ai-sdk/google-v5';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { openai as openai_v6 } from '@ai-sdk/openai-v6';
import { createGatewayMock } from '@internal/test-utils';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { Agent } from '../agent';

config();

const mock = createGatewayMock();
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

const getWeather = createTool({
  id: 'getWeather',
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  execute: async ({ city }) => {
    return { city, temperature: 22, condition: 'sunny' };
  },
});

const getPopulation = createTool({
  id: 'getPopulation',
  description: 'Get the population of a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get population for'),
  }),
  execute: async ({ city }) => {
    return { city, population: 2_161_000 };
  },
});

const getTimezone = createTool({
  id: 'getTimezone',
  description: 'Get the timezone of a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get timezone for'),
  }),
  execute: async ({ city }) => {
    return { city, timezone: 'CET', utcOffset: '+01:00' };
  },
});

const getLanguage = createTool({
  id: 'getLanguage',
  description: 'Get the primary language spoken in a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get the language for'),
  }),
  execute: async ({ city }) => {
    return { city, language: 'French' };
  },
});

const getCurrency = createTool({
  id: 'getCurrency',
  description: 'Get the currency used in a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get the currency for'),
  }),
  execute: async ({ city }) => {
    return { city, currency: 'EUR', symbol: '€' };
  },
});

function createTestAgent(model: any) {
  return new Agent({
    id: 'tool-finish-reason-test-agent',
    name: 'Tool Finish Reason Test Agent',
    instructions:
      'You are a helpful assistant with access to city information tools. When asked about a city, first explain your plan for what you will look up, then call ALL 5 tools in parallel. Always call all 5 tools at once while also providing text explaining what you are doing.',
    model,
    tools: { getWeather, getPopulation, getTimezone, getLanguage, getCurrency },
  });
}

async function runToolCallTest(agent: Agent, modelName: string) {
  const response = await agent.stream(
    'I need a comprehensive city report for Paris. Look up everything: weather, population, timezone, language, and currency. Explain what you are about to do first, then call all 5 tools simultaneously.',
  );

  let toolCallCount = 0;
  let toolResultCount = 0;
  const finishReasons: string[] = [];

  for await (const chunk of response.fullStream) {
    if (chunk.type === 'tool-call') {
      toolCallCount++;
    }
    if (chunk.type === 'tool-result') {
      toolResultCount++;
    }
    if (chunk.type === 'step-finish') {
      const reason = (chunk as any).payload?.finishReason ?? (chunk as any).finishReason ?? 'unknown';
      finishReasons.push(reason);
    }
  }

  const text = await response.text;

  // Log what we observed for debugging
  console.log(
    `[${modelName}] toolCalls=${toolCallCount} toolResults=${toolResultCount} finishReasons=${JSON.stringify(finishReasons)} textLen=${text.length}`,
  );

  // All 5 tools should have been called and returned results
  expect(toolCallCount).toBe(5);
  expect(toolResultCount).toBe(5);

  // The agent loop must have completed at least 2 steps:
  // step 1: tool calls (finishReason may be 'tool-calls' or 'stop' depending on the model)
  // step 2: final text summary after processing tool results
  expect(finishReasons.length).toBeGreaterThanOrEqual(2);

  // The final response should reference the gathered data
  expect(text).toBeTruthy();
  expect(text.length).toBeGreaterThan(0);
}

describe('Tool calls with various LLM providers', { timeout: 120_000 }, () => {
  const models = [
    { name: 'openai/gpt-4o-mini (v5)', model: openai_v5('gpt-4o-mini'), envKey: 'OPENAI_API_KEY' },
    { name: 'openai/gpt-4o-mini (v6)', model: openai_v6('gpt-4o-mini'), envKey: 'OPENAI_API_KEY' },
    { name: 'openai/gpt-5.3-codex (v5)', model: openai_v5('gpt-5.3-codex'), envKey: 'OPENAI_API_KEY' },
    { name: 'openai/gpt-5.3-codex (v6)', model: openai_v6('gpt-5.3-codex'), envKey: 'OPENAI_API_KEY' },
    {
      name: 'anthropic/claude-haiku-4-5-20251001',
      model: anthropic('claude-haiku-4-5-20251001'),
      envKey: 'ANTHROPIC_API_KEY',
    },
    { name: 'google/gemini-2.5-flash', model: google('gemini-2.5-flash'), envKey: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  ];

  for (const { name, model, envKey } of models) {
    it.skipIf(!process.env[envKey])(
      `should continue after tool calls with ${name}`,
      async () => {
        const agent = createTestAgent(model);
        await runToolCallTest(agent, name);
      },
      60_000,
    );
  }
});
