import { openai } from '@ai-sdk/openai';
import { openai as openaiV5 } from '@ai-sdk/openai-v5';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Mastra } from '../../mastra';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai']);

const mock = createGatewayMock();
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

export function imagePromptTest({ version }: { version: 'v1' | 'v2' }) {
  const openaiModel = version === 'v1' ? openai('gpt-4o') : openaiV5('gpt-4o');

  describe('image prompt test', () => {
    it(
      'should download assets from messages',
      {
        timeout: 100000,
        retry: 3,
      },
      async () => {
        const agent = new Agent({
          id: 'llmPrompt-agent',
          name: 'LLM Prompt Agent',
          instructions: 'test agent',
          model: openaiModel,
        });

        let result;

        if (version === 'v1') {
          result = await agent.generateLegacy([
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
                  mimeType: 'image/png',
                },
                {
                  type: 'text',
                  text: 'What is the photo?',
                },
              ],
            },
          ]);
        } else {
          result = await agent.generate([
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
                  mimeType: 'image/png',
                },
                {
                  type: 'text',
                  text: 'What is the photo?',
                },
              ],
            },
          ]);
        }

        expect(result.text.toLowerCase()).toContain('google');
      },
    );
  });
}

imagePromptTest({ version: 'v1' });
imagePromptTest({ version: 'v2' });

/**
 * Durable leg: pins that image parts in the user message survive durable
 * serialization (prepareForDurableExecution → workflowInput) and reach the
 * provider intact.
 *
 * Only runs in record-capable modes: the durable engine always streams at the
 * provider boundary (DurableAgent.generate() is stream-based), but this file's
 * cassette was recorded via non-streaming generate(), so the durable request
 * cannot replay against it. Run with LLM_TEST_MODE=record (or update/live) and
 * a real OPENAI_API_KEY to exercise or re-record this leg.
 */
describe('image prompt test (durable)', () => {
  it.skipIf(!['record', 'update', 'live'].includes(MODE))(
    'should download assets from messages via the durable engine',
    {
      timeout: 100000,
      retry: 3,
    },
    async () => {
      const agent = new Agent({
        id: 'llmPrompt-agent-durable',
        name: 'LLM Prompt Agent (durable)',
        instructions: 'test agent',
        model: openaiV5('gpt-4o'),
      });

      const durableAgent = createDurableAgent({ agent });
      new Mastra({ agents: { [agent.id]: durableAgent as any }, logger: false });

      const result = await durableAgent.generate([
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
              mimeType: 'image/png',
            },
            {
              type: 'text',
              text: 'What is the photo?',
            },
          ],
        },
      ]);

      expect(result.text.toLowerCase()).toContain('google');
    },
  );
});
