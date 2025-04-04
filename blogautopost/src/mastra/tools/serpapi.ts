import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import axios from 'axios';

/**
 * A tool that allows searching the web using SerpAPI
 */
export const serpApiTool = createTool({
  id: 'serpApiTool',
  description: 'Search the web using SerpAPI to find information. This tool can perform Google searches and return relevant results and snippets.',
  inputSchema: z.object({
    query: z.string().describe('The search query to execute'),
    numResults: z.number().default(5).describe('Number of results to return'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string().describe('Title of the result'),
      link: z.string().describe('URL of the result'),
      snippet: z.string().describe('Short description or snippet from the result'),
    })),
    query: z.string().describe('The search query that was executed'),
  }),
  execute: async ({ context }) => {
    const { query, numResults = 5 } = context;
    
    const apiKey = process.env.SERPAPI_API_KEY || '';
    
    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY is not defined in the environment variables');
    }
    
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: apiKey,
          engine: 'google',
          num: numResults,
        },
      });
      
      const data = response.data;
      
      const formattedResults = data.organic_results.slice(0, numResults).map((result: any) => ({
        title: result.title || '',
        link: result.link || '',
        snippet: result.snippet || '',
      }));
      
      return {
        results: formattedResults,
        query,
      };
    } catch (error) {
      throw new Error(`Error performing search: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
