import { z } from 'zod';
import { createTool } from '@mastra/core/tools';

/**
 * Tool for executing web searches via the Octen API.
 * Requires OCTEN_API_KEY to be set in the environment.
 */
export const octenWebSearchTool = createTool({
  id: 'octen_web_search',
  description: 'Searches ranked web results for a given query using the Octen API, with optional filters and highlights.',
  inputSchema: z.object({
    query: z.string().describe('The search query.'),
    count: z.number().min(1).max(100).optional().describe('Number of results to return.'),
    include_domains: z.array(z.string()).optional().describe('A list of domains to specifically include in the search results.'),
    exclude_domains: z.array(z.string()).optional().describe('A list of domains to specifically exclude from the search results.'),
    include_text: z.array(z.string()).optional().describe('Strings that must appear in the result page text.'),
    exclude_text: z.array(z.string()).optional().describe('Strings that must not appear in the result page text.'),
    time_basis: z.enum(['published', 'crawled', 'auto']).optional().describe('Determines which time field is used for time filtering.'),
    start_time: z.string().optional().describe('Start time for filtering results. ISO 8601 format.'),
    end_time: z.string().optional().describe('End time for filtering results. ISO 8601 format.'),
    safesearch: z.enum(['off', 'strict']).optional().describe('Controls filtering of explicit/adult content.'),
  }),
  execute: async (input: any) => {
    const apiKey = process.env.OCTEN_API_KEY;
    if (!apiKey) {
      throw new Error('OCTEN_API_KEY environment variable is required to use octen_web_search.');
    }

    const response = await fetch('https://api.octen.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown Error');
      throw new Error(`Octen API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data;
  },
});
