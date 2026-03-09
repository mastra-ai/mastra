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
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import z from 'zod';
import { createTool } from '../../tools';
import { Agent } from '../agent';

config();

const weatherTool = createTool({
  id: 'getWeather',
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    city: z.string().describe('The city to get weather for'),
  }),
  execute: async ({ city }) => {
    return { city, temperature: 22, condition: 'sunny' };
  },
});

function createTestAgent(model: any) {
  return new Agent({
    id: 'tool-finish-reason-test-agent',
    name: 'Tool Finish Reason Test Agent',
    instructions:
      'You are a helpful assistant. When asked about the weather, use the getWeather tool. After getting the result, summarize it briefly.',
    model,
    tools: { getWeather: weatherTool },
  });
}

async function runToolCallTest(agent: Agent) {
  const response = await agent.stream('What is the weather in Paris?');

  let hasToolCall = false;
  let hasToolResult = false;

  for await (const chunk of response.fullStream) {
    if (chunk.type === 'tool-call') {
      hasToolCall = true;
    }
    if (chunk.type === 'tool-result') {
      hasToolResult = true;
    }
  }

  const text = await response.text;

  // The agent must have called the tool and received results
  expect(hasToolCall).toBe(true);
  expect(hasToolResult).toBe(true);

  // The final response should reference the weather data
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
    { name: 'google/gemini-2.0-flash', model: google('gemini-2.0-flash'), envKey: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  ];

  for (const { name, model, envKey } of models) {
    it.skipIf(!process.env[envKey])(
      `should continue after tool calls with ${name}`,
      async () => {
        const agent = createTestAgent(model);
        await runToolCallTest(agent);
      },
      60_000,
    );
  }
});
