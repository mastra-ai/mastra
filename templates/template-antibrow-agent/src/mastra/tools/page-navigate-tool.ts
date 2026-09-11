import { createTool } from '@mastra/core/tools';
import z from 'zod';
import { sessionManager } from '../../lib/antibrow';

export const pageNavigateTool = createTool({
  id: 'web-navigate',
  description:
    "Navigate to a URL in the agent's persistent browser profile. Cookies and storage " +
    'from earlier runs are still there, so pages behind a login open signed in.',
  inputSchema: z.object({
    url: z.string().describe('URL to navigate to'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    status: z.number().optional(),
    title: z.string().optional(),
    currentUrl: z.string().optional(),
  }),
  execute: async input => {
    try {
      const page = await sessionManager.ensurePage();
      const response = await page.goto(input.url, { waitUntil: 'load' });

      return {
        success: true,
        status: response?.status(),
        title: await page.title(),
        currentUrl: page.url(),
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Navigation failed: ${error.message}`,
      };
    }
  },
});
