import { Readable } from 'stream';
import type { ToolsInput } from '@mastra/core/agent';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type OpenAIExecuteFunction = (args: any) => Promise<any>;

type TTools = ToolsInput;
export const transformTools = (tools?: TTools) => {
  const openaiTools = [];
  for (const [name, tool] of Object.entries(tools || {})) {
    let parameters: { [key: string]: any };

    if ('inputSchema' in tool && tool.inputSchema) {
      if (isZodObject(tool.inputSchema)) {
        parameters = zodToJsonSchema(tool.inputSchema);
        delete parameters.$schema;
      } else {
        parameters = tool.inputSchema;
      }
    } else if ('parameters' in tool) {
      if (isZodObject(tool.parameters)) {
        parameters = zodToJsonSchema(tool.parameters);
        delete parameters.$schema;
      } else {
        parameters = tool.parameters;
      }
    } else {
      console.warn(`Tool ${name} has neither inputSchema nor parameters, skipping`);
      continue;
    }
    const openaiTool = {
      type: 'function',
      name,
      description: tool.description || `Tool: ${name}`,
      parameters,
    };

    if (tool.execute) {
      // Create an adapter function that works with both ToolAction and VercelTool execute functions
      const executeAdapter = async (args: any) => {
        try {
          if (!tool.execute) {
            throw new Error(`Tool ${name} has no execute function`);
          }

          // For ToolAction, the first argument is a context object with the args in a 'context' property
          if ('inputSchema' in tool) {
            return await tool.execute({ context: args });
          }
          // For VercelTool, pass args directly
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
      openaiTools.push({ openaiTool, execute: executeAdapter });
    } else {
      console.warn(`Tool ${name} has no execute function, skipping`);
    }
  }
  return openaiTools;
};

export const isReadableStream = (obj: unknown) => {
  return (
    obj &&
    obj instanceof Readable &&
    typeof obj.read === 'function' &&
    typeof obj.pipe === 'function' &&
    obj.readable === true
  );
};

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
