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

/**
 * Transforms Mastra tools into the Live API function-tool shape and pairs each
 * with an execute adapter that works for both ToolAction and VercelTool.
 */
export const transformTools = (tools?: TTools) => {
  const liveTools: { liveTool: ToolDefinition; execute: OpenAIExecuteFunction }[] = [];
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

    const liveTool: ToolDefinition = {
      type: 'function',
      name,
      description: tool.description || `Tool: ${name}`,
      parameters,
    };

    if (tool.execute) {
      const executeAdapter = async (args: any) => {
        try {
          if (!tool.execute) {
            throw new Error(`Tool ${name} has no execute function`);
          }

          // Both ToolAction (createTool) and VercelTool take the input data as the
          // first argument, matching @mastra/core's ToolExecuteFunction(inputData, context).
          return await tool.execute(args, {
            toolCallId: 'unknown',
            messages: [],
          });
        } catch (error) {
          console.error(`Error executing tool ${name}:`, error);
          throw error;
        }
      };
      liveTools.push({ liveTool, execute: executeAdapter });
    } else {
      console.warn(`Tool ${name} has no execute function, skipping`);
    }
  }
  return liveTools;
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
