import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import { createGatewayMock } from '@internal/test-utils';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent } from '../agent';

config();

const mock = createGatewayMock();
const openai_v5 = createOpenAIV5({ apiKey: process.env.OPENAI_API_KEY });

beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

describe('OpenAI reasoning summary streaming (e2e)', { timeout: 120_000 }, () => {
  it.skipIf(!process.env.OPENAI_API_KEY)(
    'streams and persists reasoning summaries from gpt-5.4 with per-id chunk integrity',
    async () => {
      const agent = new Agent({
        id: 'openai-reasoning-summaries-e2e-agent',
        name: 'OpenAI Reasoning Summaries E2E Agent',
        instructions: 'You are a concise assistant.',
        model: openai_v5('gpt-5.4'),
      });

      const response = await agent.stream(
        'Solve 27 * 14 carefully. Show a concise final answer after reasoning. If you produce reasoning summaries, keep them detailed.',
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

      const deltasById = new Map<string, string[]>();
      for (const delta of reasoningDeltas) {
        const existing = deltasById.get(delta.id) ?? [];
        existing.push(delta.text);
        deltasById.set(delta.id, existing);
      }

      const startCounts = new Map<string, number>();
      for (const id of reasoningStarts) {
        startCounts.set(id, (startCounts.get(id) ?? 0) + 1);
      }

      const endCounts = new Map<string, number>();
      for (const id of reasoningEnds) {
        endCounts.set(id, (endCounts.get(id) ?? 0) + 1);
      }

      const assistantMessages = response.messageList.get.all.db().filter(message => message.role === 'assistant');
      const allParts = assistantMessages.flatMap(message => message.content.parts);
      const reasoningParts = allParts.filter(part => part.type === 'reasoning');
      const textParts = allParts.filter(part => part.type === 'text');

      expect(reasoningStarts.length).toBeGreaterThan(0);
      expect(reasoningEnds.length).toBeGreaterThan(0);
      expect(reasoningDeltas.length).toBeGreaterThan(0);
      expect(reasoningDeltas.some(delta => delta.text.trim().length > 0)).toBe(true);
      expect(deltasById.size).toBeGreaterThan(0);

      expect([...startCounts.keys()].sort()).toEqual([...endCounts.keys()].sort());

      for (const [id, count] of startCounts) {
        expect(count).toBe(1);
        expect(endCounts.get(id)).toBe(1);
        expect((deltasById.get(id) ?? []).join('').trim().length).toBeGreaterThan(0);
      }

      expect(reasoningParts.length).toBe(deltasById.size);
      expect(textParts.some(part => part.text.trim().length > 0)).toBe(true);

      for (const part of reasoningParts) {
        expect(part.providerMetadata?.openai?.itemId).toBeTruthy();
        expect(part.providerMetadata?.openai).toHaveProperty('reasoningEncryptedContent');
        expect(part.details.some(detail => detail.type === 'text' && detail.text.trim().length > 0)).toBe(true);
      }
    },
  );
});
