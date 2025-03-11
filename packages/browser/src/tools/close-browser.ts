import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ToolContext } from './types';

const inputSchema = z.object({});

export function closeBrowserTool(globalContext: ToolContext): Tool<typeof inputSchema> {
  return createTool({
    id: 'close-browser',
    description: 'Closes the browser instance completely',
    inputSchema,
    execute: async ({ mastra }) => {
      try {
        if (!globalContext?.browser) {
          return { message: 'No browser is currently open' };
        }

        mastra?.logger?.debug('[browser] close browser');
        await globalContext.context?.close();
        await globalContext.browser?.close();
        globalContext.context = null;
        globalContext.browser = null;
        globalContext.page = null;

        return { message: 'Browser closed successfully' };
      } catch (e) {
        if (e instanceof Error) {
          return { message: `Error closing page: ${e.message}` };
        }
        return { message: 'An unknown error occurred while closing the page' };
      }
    },
  });
}
