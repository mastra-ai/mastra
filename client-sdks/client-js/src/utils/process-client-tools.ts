import type { ToolsInput } from '@mastra/core/agent';
import { zodToJsonSchema } from './zod-to-json-schema';

/**
 * Processes client tools to serialize Zod schemas to JSON Schema format.
 *
 * This function handles both Vercel AI SDK tools and Mastra tools:
 * - Vercel AI SDK tools use the 'parameters' field (AI SDK v4)
 * - Mastra tools use 'inputSchema' and 'outputSchema' fields
 *
 * For each tool, this function converts any Zod schemas to plain JSON Schemas
 * that can be serialized and sent to LLM providers. If a schema is already a
 * plain JSON Schema object, it's passed through unchanged.
 *
 * @param clientTools - The client tools to process
 * @returns Processed tools with serialized schemas
 */
export function processClientTools(clientTools: ToolsInput | undefined): ToolsInput | undefined {
  if (!clientTools) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(clientTools).map(([key, value]) => {
      // Determine tool type by checking which schema field is present
      // Vercel AI SDK tools use 'parameters', Mastra tools use 'inputSchema'
      const hasParameters = 'parameters' in value;
      const hasInputSchema = 'inputSchema' in value;

      if (hasParameters && !hasInputSchema) {
        // This is a Vercel AI SDK tool with 'parameters' field
        const processedParameters = value.parameters ? zodToJsonSchema(value.parameters) : undefined;

        return [
          key,
          {
            ...value,
            parameters: processedParameters,
          },
        ];
      } else {
        // This is a Mastra tool with 'inputSchema' and/or 'outputSchema' fields
        const processedInputSchema = value.inputSchema ? zodToJsonSchema(value.inputSchema) : undefined;
        const processedOutputSchema = value.outputSchema ? zodToJsonSchema(value.outputSchema) : undefined;

        return [
          key,
          {
            ...value,
            inputSchema: processedInputSchema,
            outputSchema: processedOutputSchema,
          },
        ];
      }
    }),
  );
}
