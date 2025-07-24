import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { sessionManager } from '../../lib/stage-hand';

export const pageExtractTool = createTool({
  id: 'web-extract',
  description: 'Extract data from a webpage using Stagehand',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to navigate to (optional if already on a page)'),
    instruction: z.string().describe('What to extract (e.g., "extract all product prices")'),
    schema: z.record(z.any()).optional().describe('Zod schema definition for data extraction'),
    useTextExtract: z
      .boolean()
      .optional()
      .describe('Set true for larger-scale extractions, false for small extractions'),
  }),
  outputSchema: z.any().describe('Extracted data according to schema'),
  execute: async ({ context }) => {
    // Create a default schema if none is provided
    const defaultSchema = {
      content: z.string(),
    };

    return await performWebExtraction(
      context.url,
      context.instruction,
      context.schema || defaultSchema,
      context.useTextExtract,
    );
  },
});

const performWebExtraction = async (
  url?: string,
  instruction?: string,
  schemaObj?: Record<string, any>,
  useTextExtract?: boolean,
) => {
  console.log(`Starting extraction${url ? ` for ${url}` : ''} with instruction: ${instruction}`);

  try {
    const stagehand = await sessionManager.ensureStagehand();
    const page = stagehand.page;

    try {
      // Navigate to the URL if provided
      if (url) {
        console.log(`Navigating to ${url}`);
        await page.goto(url);
        console.log(`Successfully navigated to ${url}`);
      }

      // Extract data
      if (instruction) {
        console.log(`Extracting with instruction: ${instruction}`);

        // Create a default schema if none is provided from Mastra Agent
        const finalSchemaObj = schemaObj || { content: z.string() };

        try {
          const schema = z.object(finalSchemaObj);

          const result = await page.extract({
            instruction,
            schema,
            useTextExtract,
          });

          console.log(`Extraction successful:`, result);
          return result;
        } catch (extractError) {
          console.error('Error during extraction:', extractError);
          throw extractError;
        }
      }

      return null;
    } catch (pageError) {
      console.error('Error in page operation:', pageError);
      throw pageError;
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Full stack trace for extraction error:`, error);
    throw new Error(`Stagehand extraction failed: ${errorMessage}`);
  }
};
