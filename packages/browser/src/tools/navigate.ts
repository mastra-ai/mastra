import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ToolContext } from './types';

const inputSchema = z.object({
  url: z.string().url(),
});

const outputSchema = z.object({
  message: z.string(),
});

export function navigateTool(globalContext: ToolContext): Tool<typeof inputSchema, typeof outputSchema> {
  return createTool({
    id: 'navigate-tool',
    description: 'Navigates to a website',
    inputSchema,
    outputSchema,
    execute: async ({ context, mastra }) => {
      try {
        if (!globalContext.page) {
          return { message: 'Error: no page is currently open' };
        }

        mastra?.logger?.debug(`[browser] navigating to ${context.url}`);
        await globalContext.page.goto(context.url, {
          waitUntil: 'domcontentloaded',
        });
        return { message: `Navigated to page ${context.url}` };
      } catch (e) {
        if (e instanceof Error) {
          return { message: `Error: ${e.message}` };
        }
        return { message: 'Error' };
      }
    },
  });
}
