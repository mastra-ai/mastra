import { Readable } from 'node:stream';
import type { ToolsInput } from '@internal/voice';
import { standardSchemaToJSONSchema, toStandardSchema } from '@mastra/schema-compat/schema';

export type OpenAIExecuteFunction = (args: any) => Promise<any>;
type ToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    [key: string]: any;
  };
};

type TTools = ToolsInput;
export const transformTools = (tools?: TTools) => {
  const openaiTools: { openaiTool: ToolDefinition; execute: OpenAIExecuteFunction }[] = [];
  for (const [name, tool] of Object.entries(tools || {})) {
    let parameters: { [key: string]: any };

    if ('inputSchema' in tool && tool.inputSchema) {
      parameters = toToolParameters(tool.inputSchema);
    } else if ('parameters' in tool) {
      parameters = toToolParameters(tool.parameters);
    } else {
      console.warn(`Tool ${name} has neither inputSchema nor parameters, skipping`);
      continue;
    }
    const openaiTool: ToolDefinition = {
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
            return await tool.execute(
              { context: args },
              {
                toolCallId: 'unknown',
                messages: [],
              },
            );
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

function toToolParameters(schema: unknown): { [key: string]: any } {
  const parameters = standardSchemaToJSONSchema(toStandardSchema(schema as never), { io: 'input' }) as {
    [key: string]: any;
  };
  delete parameters.$schema;
  return parameters;
}
