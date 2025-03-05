import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext, Tool } from '@mastra/core/tools';
import type { ToolContext } from './types';

export function closeBrowserTool(
  globalContext: ToolContext,
): Tool<undefined, undefined, ToolExecutionContext<undefined>> {
  return createTool({
    id: 'close-browser',
    description: 'Closes the browser instance completely',
    execute: async ({ mastra }) => {
      try {
        if (!globalContext?.browser) {
          return { message: 'No browser is currently open' };
        }

        mastra?.logger?.debug('[browser] close browser');
        await globalContext.browser.close();
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
