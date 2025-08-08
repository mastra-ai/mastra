import { Readable } from 'stream';
import type { ToolsInput } from '@mastra/core/agent';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type GeminiExecuteFunction = (args: any) => Promise<any>;

/**
 * Gemini Live API tool definition structure
 */
type GeminiToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
};

type TTools = ToolsInput;

/**
 * Transform Mastra tools to Gemini Live API format
 * Adapted from OpenAI Realtime API implementation
 */
export const transformTools = (tools?: TTools) => {
  const geminiTools: { geminiTool: GeminiToolDefinition; execute: GeminiExecuteFunction }[] = [];

  for (const [name, tool] of Object.entries(tools || {})) {
    let parameters: { [key: string]: any };

    // Handle Mastra tools with inputSchema
    if ('inputSchema' in tool && tool.inputSchema) {
      if (isZodObject(tool.inputSchema)) {
        parameters = zodToJsonSchema(tool.inputSchema);
        // Clean up schema for Gemini compatibility
        parameters = cleanSchemaForGemini(parameters);
      } else {
        parameters = cleanSchemaForGemini(tool.inputSchema);
      }
    }
    // Handle legacy tools with parameters
    else if ('parameters' in tool) {
      if (isZodObject(tool.parameters)) {
        parameters = zodToJsonSchema(tool.parameters);
        parameters = cleanSchemaForGemini(parameters);
      } else {
        parameters = cleanSchemaForGemini(tool.parameters);
      }
    }
    // Handle tools without schema (optional inputSchema)
    else {
      parameters = {
        type: 'object',
        properties: {},
      };
    }

    const geminiTool: GeminiToolDefinition = {
      name,
      description: tool.description || `Tool: ${name}`,
      parameters: parameters as { type: 'object'; properties: Record<string, any>; required?: string[] },
    };

    if (tool.execute) {
      // Create an adapter function that works with both Mastra tools and legacy tools
      const executeAdapter = async (args: any) => {
        try {
          if (!tool.execute) {
            throw new Error(`Tool ${name} has no execute function`);
          }

          // For Mastra tools with inputSchema, the first argument is a context object with the args in a 'context' property
          if ('inputSchema' in tool) {
            return await tool.execute({ context: args });
          }
          // For legacy tools, pass args directly with options
          else {
            // Create a minimal ToolExecutionOptions object with required properties
            const options = {
              toolCallId: 'unknown',
              messages: [],
            };
            return await tool.execute(args, options);
          }
        } catch (error) {
          console.error(`Error executing tool ${name}:`, error);
          throw error;
        }
      };

      geminiTools.push({ geminiTool, execute: executeAdapter });
    } else {
      console.warn(`Tool ${name} has no execute function, skipping`);
    }
  }

  return geminiTools;
};

/**
 * Clean JSON Schema for Gemini Live API compatibility
 * Removes properties that Gemini doesn't accept
 */
export const cleanSchemaForGemini = (schema: any): any => {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const cleaned = { ...schema };

  // Remove properties that Gemini Live API doesn't accept
  delete cleaned.$schema;
  delete cleaned.additionalProperties;
  delete cleaned.definitions;
  delete cleaned.$id;
  delete cleaned.$ref;
  delete cleaned.examples;
  delete cleaned.default;

  // Ensure required structure for Gemini tools
  if (!cleaned.type) {
    cleaned.type = 'object';
  }
  if (!cleaned.properties) {
    cleaned.properties = {};
  }

  // Recursively clean nested objects
  if (cleaned.properties && typeof cleaned.properties === 'object') {
    cleaned.properties = Object.entries(cleaned.properties).reduce((acc, [key, value]) => {
      acc[key] = cleanSchemaForGemini(value);
      return acc;
    }, {} as any);
  }

  // Clean array items
  if (cleaned.items) {
    cleaned.items = cleanSchemaForGemini(cleaned.items);
  }

  // Clean nested schemas
  if (cleaned.allOf && Array.isArray(cleaned.allOf)) {
    cleaned.allOf = cleaned.allOf.map(cleanSchemaForGemini);
  }
  if (cleaned.anyOf && Array.isArray(cleaned.anyOf)) {
    cleaned.anyOf = cleaned.anyOf.map(cleanSchemaForGemini);
  }
  if (cleaned.oneOf && Array.isArray(cleaned.oneOf)) {
    cleaned.oneOf = cleaned.oneOf.map(cleanSchemaForGemini);
  }

  return cleaned;
};

/**
 * Check if input is a readable stream
 */
export const isReadableStream = (obj: unknown) => {
  return (
    obj &&
    obj instanceof Readable &&
    typeof obj.read === 'function' &&
    typeof obj.pipe === 'function' &&
    obj.readable === true
  );
};

/**
 * Check if schema is a Zod object
 */
function isZodObject(schema: unknown) {
  return (
    !!schema &&
    typeof schema === 'object' &&
    '_def' in schema &&
    schema._def &&
    typeof schema._def === 'object' &&
    'typeName' in schema._def &&
    schema._def.typeName === 'ZodObject'
  );
}