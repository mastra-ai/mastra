import { Readable } from 'node:stream';
import type { ToolsInput } from '@internal/voice';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
 * Transforms a Mastra tools record into Inworld realtime tool definitions.
 * Inworld's realtime tool schema matches OpenAI's GA shape
 * (`{ type: 'function', name, description, parameters }`), so the transformation
 * is provider-agnostic. Execution itself goes through the Mastra tool's own
 * `execute` (called in `handleFunctionCall`), so no adapter is built here.
 */
export const transformTools = (tools?: TTools): ToolDefinition[] => {
  const inworldTools: ToolDefinition[] = [];
  for (const [name, tool] of Object.entries(tools || {})) {
    let parameters: { [key: string]: any };

    if ('inputSchema' in tool && tool.inputSchema) {
      parameters = isZodObject(tool.inputSchema)
        ? zodSchemaToJson(tool.inputSchema)
        : (tool.inputSchema as Record<string, unknown>);
    } else if ('parameters' in tool && tool.parameters) {
      parameters = isZodObject(tool.parameters)
        ? zodSchemaToJson(tool.parameters)
        : (tool.parameters as Record<string, unknown>);
    } else {
      // Zero-arg tool: advertise an empty-object schema so the server knows
      // the tool exists. `handleFunctionCall` already treats empty/missing
      // `arguments` as `{}`, so the round-trip works.
      parameters = { type: 'object', properties: {}, additionalProperties: false };
    }

    if (!tool.execute) {
      console.warn(`Tool ${name} has no execute function, skipping`);
      continue;
    }

    inworldTools.push({
      type: 'function',
      name,
      description: tool.description || `Tool: ${name}`,
      parameters,
    });
  }
  return inworldTools;
};

/**
 * Recursively merge `source` into `target`. Plain objects compose; arrays and
 * primitives in `source` replace whatever's in `target`. Used to merge the
 * typed `session` field and the untyped `providerData` escape hatch into
 * per-call `session.update` payloads without clobbering nested fields like
 * `audio.output.voice`.
 */
export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

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
