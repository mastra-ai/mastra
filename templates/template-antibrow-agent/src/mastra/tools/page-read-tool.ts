import { createTool } from '@mastra/core/tools';
import z from 'zod';
import { sessionManager } from '../../lib/antibrow';

const READ_LIMIT = 4000;

export const pageReadTool = createTool({
  id: 'web-read',
  description:
    'Read the visible text of the current page, or of one element when a CSS selector ' +
    'is given. Truncated, so a long page cannot fill the context window.',
  inputSchema: z.object({
    selector: z.string().optional().describe('CSS selector to read; omit for the whole page'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    text: z.string().optional(),
    truncated: z.boolean().optional(),
    currentUrl: z.string().optional(),
  }),
  execute: async input => {
    try {
      const page = await sessionManager.ensurePage();
      const text = await page.locator(input.selector ?? 'body').first().innerText();

      return {
        success: true,
        text: text.slice(0, READ_LIMIT),
        truncated: text.length > READ_LIMIT,
        currentUrl: page.url(),
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Read failed: ${error.message}`,
      };
    }
  },
});
