import { readFileSync } from 'node:fs';
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ToolContext } from './types';

const inputSchema = z.object({});

export function newPageTool(
  {
    domUtilsPath,
  }: {
    domUtilsPath: string;
  },
  globalContext: ToolContext,
): Tool<typeof inputSchema> {
  const domUtils = readFileSync(domUtilsPath, 'utf-8');

  return createTool({
    id: 'new-page',
    description: 'Opens a new page in the browser',
    inputSchema,
    execute: async ({ mastra }) => {
      try {
        if (!globalContext.context) {
          return { message: 'Error: Browser is not open, try the launch-browser tool first.' };
        }

        mastra?.logger?.debug('[browser] open new page');
        const page = await globalContext.context.newPage();
        mastra?.logger?.debug(`[browser] adding init script ${domUtilsPath}`);
        await page.addInitScript({
          content: domUtils,
        });
        globalContext.page = page;
        return { message: 'New page is open' };
      } catch (e) {
        if (e instanceof Error) {
          return { message: `Error: ${e.message}` };
        }
        return { message: 'Error' };
      }
    },
  });
}
