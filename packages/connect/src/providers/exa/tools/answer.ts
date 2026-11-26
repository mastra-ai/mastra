// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const answerInputSchema = z.object({
  query: z.string().trim().min(1).describe('The question to answer. Example: "What is the capital of France?"'),
  text: z.boolean().optional().describe('If true, each citation object includes the full page text.'),
});

const CitationSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  url: z.string().nullish(),
  text: z.string().nullish(),
});

export const answerOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer, may contain markdown.'),
  citations: z.array(CitationSchema).describe('Citations backing the answer.'),
});

const ProviderCitationSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  url: z.string().nullish(),
  text: z.string().nullish(),
});

const ProviderResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(ProviderCitationSchema).optional(),
});

export function answerTool(proxy: PlatformProxy) {
  return createTool({
    id: 'exa_answer',
    description: 'Generate an AI answer to a question, backed by live web citations.',
    inputSchema: answerInputSchema,
    outputSchema: answerOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof answerOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        query: input.query,
      };

      if (input.text !== undefined) {
        requestBody['text'] = input.text;
      }

      const config: PlatformProxyRequest = {
        // https://docs.exa.ai/reference
        endpoint: '/answer',
        data: requestBody,
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        answer: providerResponse.answer,
        citations: providerResponse.citations || [],
      };
    },
  });
}
