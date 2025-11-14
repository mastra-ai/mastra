import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const evaluateResultTool = createTool({
  id: 'evaluate-result',
  description: 'Evaluate if a search result is relevant to the research query',
  inputSchema: z.object({
    query: z.string().describe('The original research query'),
    result: z
      .object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      })
      .describe('The search result to evaluate'),
    existingUrls: z.array(z.string()).describe('URLs that have already been processed').optional(),
  }),
  execute: async (inputData, context) => {
    try {
      const { query, result, existingUrls = [] } = inputData;
      console.log('Evaluating result', { context });

      // Check if URL already exists (only if existingUrls was provided)
      if (existingUrls && existingUrls.includes(result.url)) {
        return {
          isRelevant: false,
          reason: 'URL already processed',
        };
      }

      const evaluationAgent = context?.mastra?.getAgent('evaluationAgent');

      if (!evaluationAgent) {
        return {
          isRelevant: false,
          reason: 'Evaluation agent not available',
        };
      }

      const response = await evaluationAgent.generate(
        [
          {
            role: 'user',
            content: `Evaluate whether this search result is relevant and will help answer the query: "${query}".

        Search result:
        Title: ${result.title}
        URL: ${result.url}
        Content snippet: ${result.content.substring(0, 500)}...

        Respond with a JSON object containing:
        - isRelevant: boolean indicating if the result is relevant
        - reason: brief explanation of your decision`,
          },
        ],
        {
          structuredOutput: {
            schema: z.object({
              isRelevant: z.boolean(),
              reason: z.string(),
            }),
          },
        },
      );

      return response.object;
    } catch (error) {
      console.error('Error evaluating result:', error);
      return {
        isRelevant: false,
        reason: 'Error in evaluation',
      };
    }
  },
});
