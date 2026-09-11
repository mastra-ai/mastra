import { createTool } from '@mastra/core/tools';
import z from 'zod';
import { sessionManager } from '../../lib/antibrow';

export const pageFillTool = createTool({
  id: 'web-fill',
  description: 'Type text into an input on the current page',
  inputSchema: z.object({
    selector: z.string().describe('CSS selector of the input to fill'),
    text: z.string().describe('Text to type into it'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    characters: z.number().optional(),
  }),
  execute: async input => {
    try {
      const page = await sessionManager.ensurePage();
      await page.locator(input.selector).first().fill(input.text);

      return { success: true, characters: input.text.length };
    } catch (error: any) {
      return {
        success: false,
        message: `Fill failed: ${error.message}`,
      };
    }
  },
});
