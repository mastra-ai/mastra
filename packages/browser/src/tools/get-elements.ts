import { createTool } from '@mastra/core/tools';
import type { Tool, ToolExecutionContext } from '@mastra/core/tools';
import type { ToolContext } from './types';

export function getElementsTool(
  globalContext: ToolContext,
): Tool<undefined, undefined, ToolExecutionContext<undefined>> {
  return createTool({
    id: 'get-elements',
    description: 'Gets all xpath selectors for the current page',
    execute: async () => {
      try {
        if (!globalContext?.page) {
          return { message: 'Error: Page is not open, try the new-page tool first' };
        }

        const { outputString, selectorMap } = await globalContext.page.evaluate(() => {
          // @ts-ignore
          return window.collect(document.body);
        });

        return {
          outputString,
          selectorMap,
        };
      } catch (e) {
        if (e instanceof Error) {
          return { message: `Error: ${e.message}`, found: false };
        }
        return { message: 'An unknown error occurred', found: false };
      }
    },
  });
}
