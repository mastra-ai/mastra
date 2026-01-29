import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Input schema for the close tool.
 */
export const closeInputSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe('Optional reason for closing the browser (for logging purposes)'),
});

/**
 * Output schema for the close tool.
 */
export const closeOutputSchema = z.object({
  success: z.boolean().describe('Whether the browser was closed successfully'),
  message: z.string().describe('Status message'),
});

export type CloseInput = z.infer<typeof closeInputSchema>;
export type CloseOutput = z.infer<typeof closeOutputSchema>;

/**
 * Creates a close tool that closes the browser session.
 *
 * Use this tool when you've completed your browser automation tasks
 * and want to clean up resources.
 *
 * @param closeBrowser - Async function that closes the browser
 * @returns A Mastra tool for closing the browser
 */
export function createCloseTool(closeBrowser: () => Promise<void>) {
  return createTool({
    id: 'browser_close',
    description:
      'Close the browser session and release resources. Use this when you have completed all browser tasks.',
    inputSchema: closeInputSchema,
    outputSchema: closeOutputSchema,
    execute: async (input): Promise<CloseOutput> => {
      try {
        if (input.reason) {
          console.log(`[browser_close] Closing browser: ${input.reason}`);
        }

        await closeBrowser();

        return {
          success: true,
          message: 'Browser closed successfully',
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[browser_close] Error closing browser:', errorMessage);

        return {
          success: false,
          message: `Failed to close browser: ${errorMessage}`,
        };
      }
    },
  });
}
