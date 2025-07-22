import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const extractLearningsTool = createTool({
  id: 'extract-learnings',
  description: 'Extract key learnings and follow-up questions from a search result',
  inputSchema: z.object({
    query: z.string().describe('The original research query'),
    result: z
      .object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      })
      .describe('The search result to process'),
  }),
  execute: async ({ context, mastra }) => {
    try {
      const { query, result } = context;

      const learningExtractionAgent = mastra!.getAgent('learningExtractionAgent');

      const response = await learningExtractionAgent.generate(
        [
          {
            role: 'user',
            content: `The user is researching "${query}".
            Extract a key learning and generate follow-up questions from this search result:

            Title: ${result.title}
            URL: ${result.url}
            Content: ${result.content.substring(0, 1500)}...

            Respond with a JSON object containing:
            - learning: string with the key insight from the content
            - followUpQuestions: array of up to 1 follow-up question for deeper research`,
          },
        ],
        {
          experimental_output: z.object({
            learning: z.string(),
            followUpQuestions: z.array(z.string()).max(1),
          }),
        },
      );

      console.log('Learning extraction response:', response.object);

      return response.object;
    } catch (error) {
      console.error('Error extracting learnings:', error);
      return {
        learning: 'Error extracting information',
        followUpQuestions: [],
      };
    }
  },
});
