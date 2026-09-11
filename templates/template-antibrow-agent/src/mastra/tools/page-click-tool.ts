import { createTool } from '@mastra/core/tools';
import z from 'zod';
import { sessionManager } from '../../lib/antibrow';

export const pageClickTool = createTool({
  id: 'web-click',
  description: 'Click an element on the current page and report the URL it landed on',
  inputSchema: z.object({
    selector: z.string().describe('CSS selector of the element to click'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    currentUrl: z.string().optional(),
  }),
  execute: async input => {
    try {
      const page = await sessionManager.ensurePage();
      await page.locator(input.selector).first().click();

      return { success: true, currentUrl: page.url() };
    } catch (error: any) {
      return {
        success: false,
        message: `Click failed: ${error.message}`,
      };
    }
  },
});
