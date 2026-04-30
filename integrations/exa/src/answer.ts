import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getExaClient } from './client.js';
import type { ExaClient, ExaClientOptions } from './client.js';

const inputSchema = z.object({
  query: z.string().describe('The question to answer'),
  text: z.boolean().optional().describe('Include full page text in citation results (default false)'),
  systemPrompt: z.string().optional().describe('Optional system prompt to guide the answer style'),
  userLocation: z.string().optional().describe('Two-letter ISO country code used to localize results'),
});

const citationSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  text: z.string().optional(),
});

const outputSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  requestId: z.string().optional(),
  costDollars: z
    .object({
      total: z.number(),
    })
    .passthrough()
    .optional(),
});

export function createExaAnswerTool(config?: ExaClientOptions) {
  let client: ExaClient | null = null;

  function getClient(): ExaClient {
    if (!client) {
      client = getExaClient(config);
    }
    return client;
  }

  return createTool({
    id: 'exa-answer',
    description:
      'Generate a synthesized answer to a question using Exa AI, grounded in real-time web search citations. Returns the answer text alongside the source documents that support it. Best for direct question answering and fact-finding.',
    inputSchema,
    outputSchema,
    execute: async input => {
      const exa = getClient();

      const response = await exa.answer(input.query, {
        text: input.text,
        systemPrompt: input.systemPrompt,
        userLocation: input.userLocation,
      });

      const answerText = typeof response.answer === 'string' ? response.answer : JSON.stringify(response.answer);

      return {
        answer: answerText,
        citations: (response.citations ?? []).map((c: any) => ({
          id: c.id,
          url: c.url,
          title: c.title ?? null,
          publishedDate: c.publishedDate || undefined,
          author: c.author || undefined,
          text: c.text || undefined,
        })),
        requestId: response.requestId,
        costDollars: response.costDollars,
      };
    },
  });
}
