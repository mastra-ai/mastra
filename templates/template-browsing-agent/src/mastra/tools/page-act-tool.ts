import { createTool } from '@mastra/core';
import z from 'zod';
import { sessionManager } from '../../lib/stage-hand';

export const pageActTool = createTool({
  id: 'web-act',
  description: 'Take an action on a webpage using Stagehand',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to navigate to (optional if already on a page)'),
    action: z.string().describe('Action to perform (e.g., "click sign in button", "type hello in search field")'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return await performWebAction(context.url, context.action);
  },
});

const performWebAction = async (url?: string, action?: string) => {
  const stagehand = await sessionManager.ensureStagehand();
  const page = stagehand.page;

  try {
    // Navigate to the URL if provided
    if (url) {
      await page.goto(url);
    }

    // Perform the action
    if (action) {
      await page.act(action);
    }

    return {
      success: true,
      message: `Successfully performed: ${action}`,
    };
  } catch (error: any) {
    throw new Error(`Web action failed: ${error.message}`);
  }
};
