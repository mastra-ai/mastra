import type { GetToolResponse } from '@mastra/client-js';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { z } from 'zod';
import { parseToolSchema } from '../utils/parse-tool-schema';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parsed schemas for a tool from the tools or agents API, plus the Zod schema the Playground form needs. */
export function useApiToolSchemas(tool: GetToolResponse) {
  const inputSchema = parseToolSchema(tool.inputSchema);
  return {
    inputSchema,
    outputSchema: parseToolSchema(tool.outputSchema),
    requestContextSchema: parseToolSchema(tool.requestContextSchema),
    zodInputSchema: isRecord(inputSchema) ? jsonSchemaToZodRuntime(inputSchema) : z.object({}),
  };
}
