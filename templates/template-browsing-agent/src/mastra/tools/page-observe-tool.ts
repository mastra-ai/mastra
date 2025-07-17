import { createTool } from '@mastra/core';
import z from 'zod';
import { sessionManager } from '../../lib/stage-hand';

export const pageObserveTool = createTool({
  id: 'web-observe',
  description: 'Observe elements on a webpage using Stagehand to plan actions',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to navigate to (optional if already on a page)'),
    instruction: z.string().describe('What to observe (e.g., "find the sign in button")'),
  }),
  outputSchema: z.array(z.any()).describe('Array of observable actions'),
  execute: async ({ context }) => {
    return await performWebObservation(context.url, context.instruction);
  },
});

const performWebObservation = async (url?: string, instruction?: string) => {
  console.log(`Starting observation${url ? ` for ${url}` : ''} with instruction: ${instruction}`);

  try {
    const stagehand = await sessionManager.ensureStagehand();
    if (!stagehand) {
      console.error('Failed to get Stagehand instance');
      throw new Error('Failed to get Stagehand instance');
    }

    const page = stagehand.page;
    if (!page) {
      console.error('Page not available');
      throw new Error('Page not available');
    }

    try {
      // Navigate to the URL if provided
      if (url) {
        console.log(`Navigating to ${url}`);
        await page.goto(url);
        console.log(`Successfully navigated to ${url}`);
      }

      // Observe the page
      if (instruction) {
        console.log(`Observing with instruction: ${instruction}`);
        try {
          const actions = await page.observe(instruction);
          console.log(`Observation successful, found ${actions.length} actions`);
          return actions;
        } catch (observeError) {
          console.error('Error during observation:', observeError);
          throw observeError;
        }
      }

      return [];
    } catch (pageError) {
      console.error('Error in page operation:', pageError);
      throw pageError;
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Stagehand observation failed: ${errorMessage}`);
  }
};
