import { Readable } from 'node:stream';
import type { ToolsInput } from '@mastra/core/agent';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type InworldExecuteFunction = (args: any) => Promise<any>;

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
 * Transforms a Mastra tools record into Inworld realtime tool definitions plus
 * adapter execute functions. Inworld's realtime tool schema matches OpenAI's
 * GA shape (`{type:'function', name, description, parameters}`), so the
 * transformation is provider-agnostic.
 */
export const transformTools = (tools?: TTools) => {
  const inworldTools: { inworldTool: ToolDefinition; execute: InworldExecuteFunction }[] = [];
  for (const [name, tool] of Object.entries(tools || {})) {
    let parameters: { [key: string]: any };

    if ('inputSchema' in tool && tool.inputSchema) {
      if (isZodObject(tool.inputSchema)) {
        parameters = zodSchemaToJson(tool.inputSchema);
      } else {
        parameters = tool.inputSchema as Record<string, unknown>;
      }
    } else if ('parameters' in tool) {
      if (isZodObject(tool.parameters)) {
        parameters = zodSchemaToJson(tool.parameters);
      } else {
        parameters = tool.parameters as Record<string, unknown>;
      }
    } else {
      console.warn(`Tool ${name} has neither inputSchema nor parameters, skipping`);
      continue;
    }
    const inworldTool: ToolDefinition = {
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

          const options = {
            toolCallId: 'unknown',
            messages: [],
          };
          return await tool.execute(args, options);
        } catch (error) {
          console.error(`Error executing tool ${name}:`, error);
          throw error;
        }
      };
      inworldTools.push({ inworldTool, execute: executeAdapter });
    } else {
      console.warn(`Tool ${name} has no execute function, skipping`);
    }
  }
  return inworldTools;
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

/**
 * Convert a Zod schema (v3 or v4) to a JSON schema. Zod v4 ships its own
 * `toJSONSchema()` method; v3 relies on the `zod-to-json-schema` package.
 */
function zodSchemaToJson(schema: any): Record<string, unknown> {
  if (typeof schema?.toJSONSchema === 'function') {
    const json = schema.toJSONSchema();
    delete json.$schema;
    return json;
  }
  const json = zodToJsonSchema(schema);
  delete json.$schema;
  return json;
}

function isZodObject(schema: unknown) {
  if (!schema || typeof schema !== 'object' || !('_def' in schema)) return false;
  const def = (schema as { _def?: Record<string, unknown> })._def;
  if (!def || typeof def !== 'object') return false;
  // Zod v3: _def.typeName === 'ZodObject'. Zod v4: _def.type === 'object'.
  return ('typeName' in def && def.typeName === 'ZodObject') || ('type' in def && def.type === 'object');
}
