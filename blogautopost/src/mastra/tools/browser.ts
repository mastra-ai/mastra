import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { mcpConfiguration } from '../mcp';

/**
 * Browser tool that allows the agent to browse the web
 * This leverages Playwright MCP integration to perform browser operations
 */
export const browserTool = createTool({
  id: 'browserTool',
  description: 'Browser tool that allows the agent to browse the web and extract content. Provides functionality to visit URLs, search for information, and extract text content from web pages.',
  inputSchema: z.object({
    url: z.string().describe('The URL to navigate to'),
    selector: z.string().optional().describe('Optional CSS selector to extract specific elements from the page'),
    action: z.enum(['navigate', 'extract', 'search']).default('navigate')
      .describe('Action to perform: navigate (just visit the page), extract (get content from the page), search (search for information)'),
  }),
  outputSchema: z.object({
    content: z.string().describe('The content extracted from the page'),
    title: z.string().optional().describe('The page title if available'),
    url: z.string().describe('The final URL after any redirects'),
  }),
  execute: async ({ context }) => {
    // To be implemented once we set up the Mastra agent
    // For now we'll return a placeholder response
    return {
      content: `Visited ${context.url}`,
      url: context.url,
      title: 'Page Title'
    };
  },
}); 