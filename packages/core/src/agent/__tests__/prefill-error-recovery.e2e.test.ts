/**
 * E2E test: Verify that PrefillErrorHandler recovers from a real Anthropic
 * "assistant message prefill" rejection.
 *
 * Sends a conversation that ends with an assistant message directly to the
 * agent (no memory). Anthropic rejects the request because the last message
 * is an assistant message (interpreted as prefill). An explicit
 * PrefillErrorHandler appends a system-reminder continue message and retries.
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/13969
 */
import { anthropic } from '@ai-sdk/anthropic-v5';
import { createGatewayMock } from '@internal/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrefillErrorHandler } from '../../processors/prefill-error-handler';
import { Agent } from '../agent';

const mock = createGatewayMock();
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

/**
 * A conversation that ends with an assistant message.
 * When sent to Anthropic without a trailing user message, this triggers:
 *   "This model does not support assistant message prefill."
 */
const ASSISTANT_ENDING_MESSAGES = [
  { role: 'user' as const, content: 'What is 2 + 2?' },
  { role: 'assistant' as const, content: 'The answer is 4.' },
];

function createAgent() {
  return new Agent({
    id: 'prefill-e2e-test-agent',
    name: 'Prefill E2E Test Agent',
    instructions: 'You are a helpful assistant. Reply briefly.',
    model: anthropic('claude-opus-4-6'),
    errorProcessors: [new PrefillErrorHandler()],
  });
}

describe('PrefillErrorHandler E2E with Anthropic', { timeout: 60_000 }, () => {
  it.skipIf(!process.env.ANTHROPIC_API_KEY)(
    'generate() recovers from prefill error when messages end with assistant turn',
    async () => {
      const agent = createAgent();

      // Passing messages ending with an assistant turn should trigger the
      // Anthropic prefill error. PrefillErrorHandler should recover.
      const result = await agent.generate(ASSISTANT_ENDING_MESSAGES);

      expect(result.text).toBeTruthy();
      expect(result.text.length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!process.env.ANTHROPIC_API_KEY)(
    'stream() recovers from prefill error when messages end with assistant turn',
    async () => {
      const agent = createAgent();

      const response = await agent.stream(ASSISTANT_ENDING_MESSAGES);

      // Consume the stream
      let text = '';
      for await (const chunk of response.textStream) {
        text += chunk;
      }

      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    },
  );
});
