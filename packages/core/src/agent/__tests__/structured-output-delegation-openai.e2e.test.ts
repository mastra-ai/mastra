import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, hasRealApiKey, setupDummyApiKeys } from '@internal/test-utils';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { getSingleDummyResponseModel } from './mock-model';

config();

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai']);

const mock = createGatewayMock();
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

describe('OpenAI structured output delegation', () => {
  it.skipIf(!hasRealApiKey('openai'))(
    'should allow structured output when a parent agent exposes a sub-agent as a tool',
    async () => {
      const subAgent = new Agent({
        id: 'research-agent',
        name: 'Research Agent',
        instructions: 'You are a concise research agent.',
        model: getSingleDummyResponseModel('v2'),
      });

      const orchestrator = new Agent({
        id: 'orchestrator-agent',
        name: 'Orchestrator Agent',
        instructions:
          'You can delegate to the research agent when useful. Always return a concise answer that matches the schema.',
        model: openai_v5('gpt-4o-mini'),
        agents: { researchAgent: subAgent },
      });

      const result = await orchestrator.generate('Return a short structured summary about TypeScript.', {
        structuredOutput: {
          schema: z.object({
            summary: z.string(),
            delegated: z.boolean().optional(),
          }),
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.object).toBeDefined();
      expect(result.object.summary).toEqual(expect.any(String));
    },
    120_000,
  );
});
