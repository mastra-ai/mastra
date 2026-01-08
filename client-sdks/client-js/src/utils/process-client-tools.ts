import type { ToolsInput } from '@mastra/core/agent';
import { isVercelTool } from '@mastra/core/tools/is-vercel-tool';
import { zodToJsonSchema } from './zod-to-json-schema';

/**
 * Processes client tools to serialize Zod schemas to JSON Schema format.
 *
 * This function handles both Vercel tools (AI SDK tools) and Mastra tools,
 * converting their Zod schemas to plain JSON Schemas that can be sent over the network.
 * If a schema is already a plain JSON Schema object, it's passed through unchanged.
 *
 * @param clientTools - The client tools to process
 * @returns Processed tools with serialized schemas
 */
export function processClientTools(clientTools: ToolsInput | undefined): ToolsInput | undefined {
  if (!clientTools) {
    return undefined;
  }

  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[processClientTools] Processing client tools', {
      toolCount: Object.keys(clientTools).length,
      toolNames: Object.keys(clientTools),
    });
  }

  return Object.fromEntries(
    Object.entries(clientTools).map(([key, value]) => {
      if (isVercelTool(value)) {
        const processedParameters = value.parameters ? zodToJsonSchema(value.parameters) : undefined;

        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[processClientTools] Processed Vercel tool', {
            toolName: key,
            hadParameters: !!value.parameters,
            parametersType: value.parameters ? typeof value.parameters : 'undefined',
            processedParametersType: processedParameters ? typeof processedParameters : 'undefined',
          });
        }

        return [
          key,
          {
            ...value,
            parameters: processedParameters,
          },
        ];
      } else {
        const processedInputSchema = value.inputSchema ? zodToJsonSchema(value.inputSchema) : undefined;
        const processedOutputSchema = value.outputSchema ? zodToJsonSchema(value.outputSchema) : undefined;

        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[processClientTools] Processed Mastra tool', {
            toolName: key,
            hadInputSchema: !!value.inputSchema,
            hadOutputSchema: !!value.outputSchema,
            inputSchemaType: value.inputSchema ? typeof value.inputSchema : 'undefined',
            outputSchemaType: value.outputSchema ? typeof value.outputSchema : 'undefined',
            processedInputSchemaType: processedInputSchema ? typeof processedInputSchema : 'undefined',
            processedOutputSchemaType: processedOutputSchema ? typeof processedOutputSchema : 'undefined',
          });
        }

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
