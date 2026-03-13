import { createTool } from '@mastra/core/tools';
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
  execute: async input => {
    try {
      const stagehand = await sessionManager.ensureStagehand();
      const page = stagehand.context.pages()[0]; // Use the first page in the context

      if (!page) {
        return {
          success: false,
          message: 'No pages available in browser context',
        };
      }

      // Navigate to the URL
      await page.goto(input.url);

      // Get page title and current URL
      const title = await page.evaluate(() => document.title);
      const currentUrl = await page.evaluate(() => window.location.href);

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
