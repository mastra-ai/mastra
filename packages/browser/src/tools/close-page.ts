import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext, Tool } from '@mastra/core/tools';
import type { ToolContext } from './types';

export function closePageTool(globalContext: ToolContext): Tool<undefined, undefined, ToolExecutionContext<undefined>> {
  return createTool({
    id: 'close-page',
    description: 'Closes the currently open browser page',
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
