import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { createGatewayMock } from '@internal/test-utils';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent } from '../agent';

config();

const mock = createGatewayMock();

beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

describe('OpenAI reasoning summary streaming (e2e)', { timeout: 120_000 }, () => {
  it.skipIf(!process.env.OPENAI_API_KEY)('streams and persists reasoning summaries from gpt-5.4', async () => {
    const agent = new Agent({
      id: 'openai-reasoning-summaries-e2e-agent',
      name: 'OpenAI Reasoning Summaries E2E Agent',
      instructions: 'You are a concise assistant.',
      model: openai_v5('gpt-5.4'),
    });

    const response = await agent.stream(
      'Solve 27 * 14 carefully. Briefly explain the result after you finish thinking.',
      {
        providerOptions: {
          openai: {
            reasoningEffort: 'medium',
            reasoningSummary: 'detailed',
            include: ['reasoning.encrypted_content'],
          } as any,
        },
      },
    );

    const reasoningStarts: string[] = [];
    const reasoningEnds: string[] = [];
    const reasoningDeltas: Array<{ id: string; text: string }> = [];

    for await (const chunk of response.fullStream) {
      if (chunk.type === 'reasoning-start') {
        reasoningStarts.push(chunk.payload.id);
      }

      if (chunk.type === 'reasoning-delta') {
        reasoningDeltas.push({ id: chunk.payload.id, text: chunk.payload.text });
      }

      if (chunk.type === 'reasoning-end') {
        reasoningEnds.push(chunk.payload.id);
      }
    }

    const assistantMessages = response.messageList.get.all.db().filter(message => message.role === 'assistant');
    const reasoningParts = assistantMessages
      .flatMap(message => message.content.parts)
      .filter(part => part.type === 'reasoning');

    expect(reasoningStarts.length).toBeGreaterThan(0);
    expect(reasoningEnds.length).toBeGreaterThan(0);
    expect(reasoningDeltas.length).toBeGreaterThan(0);
    expect(reasoningDeltas.some(delta => delta.text.trim().length > 0)).toBe(true);

    expect(reasoningParts.length).toBeGreaterThan(0);

    for (const part of reasoningParts) {
      expect(part.providerMetadata?.openai?.itemId).toBeTruthy();
      expect(part.providerMetadata?.openai).toHaveProperty('reasoningEncryptedContent');
      expect(part.details.some(detail => detail.type === 'text' && detail.text.trim().length > 0)).toBe(true);
    }
  });
});
