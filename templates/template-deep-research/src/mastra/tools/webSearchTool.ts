import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import Exa from 'exa-js';
import 'dotenv/config';

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY);

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information on a specific query and return summarized content',
  inputSchema: z.object({
    query: z.string().describe('The search query to run'),
  }),
  execute: async ({ context, mastra }) => {
    console.log('Executing web search tool');
    const { query } = context;

    try {
      if (!process.env.EXA_API_KEY) {
        console.error('Error: EXA_API_KEY not found in environment variables');
        return { results: [], error: 'Missing API key' };
      }

      console.log(`Searching web for: "${query}"`);
      const { results } = await exa.searchAndContents(query, {
        livecrawl: 'always',
        numResults: 2,
      });

      if (!results || results.length === 0) {
        console.log('No search results found');
        return { results: [], error: 'No results found' };
      }

      console.log(`Found ${results.length} search results, summarizing content...`);

      // Get the summarization agent
      const summaryAgent = mastra!.getAgent('webSummarizationAgent');

      // Process each result with summarization
      const processedResults = [];
      for (const result of results) {
        try {
          // Skip if content is too short or missing
          if (!result.text || result.text.length < 100) {
            processedResults.push({
              title: result.title || '',
              url: result.url,
              content: result.text || 'No content available',
            });
            continue;
          }

          // Summarize the content
          const summaryResponse = await summaryAgent.generate([
            {
              role: 'user',
              content: `Please summarize the following web content for research query: "${query}"

Title: ${result.title || 'No title'}
URL: ${result.url}
Content: ${result.text.substring(0, 8000)}...

Provide a concise summary that captures the key information relevant to the research query.`,
            },
          ]);

          processedResults.push({
            title: result.title || '',
            url: result.url,
            content: summaryResponse.text,
          });

          console.log(`Summarized content for: ${result.title || result.url}`);
        } catch (summaryError) {
          console.error('Error summarizing content:', summaryError);
          // Fallback to truncated original content
          processedResults.push({
            title: result.title || '',
            url: result.url,
            content: result.text ? result.text.substring(0, 500) + '...' : 'Content unavailable',
          });
        }
      }

      return {
        results: processedResults,
      };
    } catch (error) {
      console.error('Error searching the web:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      return {
        results: [],
        error: errorMessage,
      };
    }
  },
});
