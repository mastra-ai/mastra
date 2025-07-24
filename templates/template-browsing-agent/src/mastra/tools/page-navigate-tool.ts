import { createTool } from '@mastra/core';
import z from 'zod';
import { sessionManager } from '../../lib/stage-hand';

export const pageNavigateTool = createTool({
  id: 'web-navigate',
  description: 'Navigate to a URL in the browser',
  inputSchema: z.object({
    url: z.string().describe('URL to navigate to'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    title: z.string().optional(),
    currentUrl: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const stagehand = await sessionManager.ensureStagehand();

      // Navigate to the URL
      await stagehand.page.goto(context.url);

      // Get page title and current URL
      const title = await stagehand.page.evaluate(() => document.title);
      const currentUrl = await stagehand.page.evaluate(() => window.location.href);

      return {
        success: true,
        title,
        currentUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Navigation failed: ${error.message}`,
      };
    }
  },
});
