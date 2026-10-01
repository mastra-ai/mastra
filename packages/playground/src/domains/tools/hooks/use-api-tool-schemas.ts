import type { GetToolResponse } from '@mastra/client-js';
import { parseToolSchema } from '../utils/parse-tool-schema';
import { toZodInputSchema } from '../utils/to-zod-input-schema';

/** Parsed schemas for a tool from the tools or agents API, plus the Zod schema the Playground form needs. */
export function useApiToolSchemas(tool: GetToolResponse) {
  const inputSchema = parseToolSchema(tool.inputSchema);
  return {
    inputSchema,
    outputSchema: parseToolSchema(tool.outputSchema),
    requestContextSchema: parseToolSchema(tool.requestContextSchema),
    zodInputSchema: toZodInputSchema(inputSchema),
  };
}
