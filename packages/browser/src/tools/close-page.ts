import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ToolContext } from './types';

const inputSchema = z.object({});

export function closePageTool(globalContext: ToolContext): Tool<typeof inputSchema> {
  return createTool({
    id: 'close-page',
    description: 'Closes the currently open browser page',
    inputSchema,
    execute: async ({ mastra }) => {
      try {
        if (!globalContext?.page) {
          return { message: 'No page is currently open' };
        }

        mastra?.logger?.debug('[browser] close page');
        await globalContext.page.close();
        return { message: 'Page closed successfully' };
      } catch (e) {
        if (e instanceof Error) {
          return { message: `Error closing page: ${e.message}` };
        }
        return { message: 'An unknown error occurred while closing the page' };
      }
    },
  });
}
