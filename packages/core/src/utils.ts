import jsonSchemaToZod from 'json-schema-to-zod';
import { z } from 'zod';
import type { ZodObject } from 'zod';
import type { MastraPrimitives } from './action';
import type { Logger } from './logger';
import type { Mastra } from './mastra';
import type { MastraMemory } from './memory';
import { Tool } from './tools';
import type { CoreTool, ToolAction, VercelTool } from './tools';

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function jsonSchemaPropertiesToTSTypes(value: any): z.ZodTypeAny {
  if (!value.type) {
    return z.object({});
  }

  let zodType;
  switch (value.type) {
    case 'string':
      zodType = z
        .string()
        .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
      break;
    case 'number':
      zodType = z
        .number()
        .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
      break;
    case 'integer':
      zodType = z
        .number()
        .int()
        .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
      break;
    case 'boolean':
      zodType = z
        .boolean()
        .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
      break;
    case 'array':
      zodType = z
        .array(jsonSchemaPropertiesToTSTypes(value.items))
        .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
      break;
    case 'object':
      zodType = jsonSchemaToModel(value).describe(
        (value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''),
      );
      break;
    case 'null':
      zodType = z.null().describe(value.description || '');
      break;
    default:
      throw new Error(`Unsupported JSON schema type: ${value.type}`);
  }

  return zodType;
}

export function jsonSchemaToModel(jsonSchema: Record<string, any>): ZodObject<any> {
  const properties = jsonSchema.properties;
  const requiredFields = jsonSchema.required || [];
  if (!properties) {
    return z.object({});
  }

  const zodSchema: Record<string, any> = {};
  for (const [key, _] of Object.entries(properties)) {
    const value = _ as any;
    let zodType;
    if (value.anyOf) {
      const anyOfTypes = value.anyOf.map((schema: any) => jsonSchemaPropertiesToTSTypes(schema));
      zodType = z
        .union(anyOfTypes)
        .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
    } else if (value.allOf) {
      const allOfTypes = value.allOf.map((schema: any) => jsonSchemaPropertiesToTSTypes(schema));
      zodType = z
        .intersection(
          allOfTypes[0],
          allOfTypes.slice(1).reduce((acc: z.ZodTypeAny, schema: z.ZodTypeAny) => acc.and(schema), allOfTypes[0]),
        )
        .describe((value.description || '') + (value.examples ? `\nExamples: ${value.examples.join(', ')}` : ''));
    } else {
      if (!value.type) {
        value.type = 'string';
      }
      zodType = jsonSchemaPropertiesToTSTypes(value);
    }

    if (value.description) {
      zodType = zodType.describe(value.description);
    }

    if (requiredFields.includes(key)) {
      zodSchema[key] = zodType;
    } else {
      zodSchema[key] = zodType.nullable().optional();
    }
  }

  return z.object(zodSchema);
}

/**
 * Deep merges two objects, recursively merging nested objects and arrays
 */
export function deepMerge<T extends object = object>(target: T, source: Partial<T>): T {
  const output = { ...target };

  if (!source) return output;

  Object.keys(source).forEach(key => {
    const targetValue = output[key as keyof T];
    const sourceValue = source[key as keyof T];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      (output as any)[key] = sourceValue;
    } else if (
      sourceValue instanceof Object &&
      targetValue instanceof Object &&
      !Array.isArray(sourceValue) &&
      !Array.isArray(targetValue)
    ) {
      (output as any)[key] = deepMerge(targetValue, sourceValue as T);
    } else if (sourceValue !== undefined) {
      (output as any)[key] = sourceValue;
    }
  });

  return output;
}

export interface TagMaskOptions {
  /** Called when masking begins */
  onStart?: () => void;
  /** Called when masking ends */
  onEnd?: () => void;
  /** Called for each chunk that is masked */
  onMask?: (chunk: string) => void;
}

/**
 * Transforms a stream by masking content between XML tags.
 * @param stream Input stream to transform
 * @param tag Tag name to mask between (e.g. for <foo>...</foo>, use 'foo')
 * @param options Optional configuration for masking behavior
 */
export async function* maskStreamTags(
  stream: AsyncIterable<string>,
  tag: string,
  options: TagMaskOptions = {},
): AsyncIterable<string> {
  const { onStart, onEnd, onMask } = options;
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;

  let buffer = '';
  let fullContent = '';
  let isMasking = false;
  let isBuffering = false;

  // used for checking in chunks that include tags or partial tags + some other non-tag text
  // eg: "o <tag_name" or "name> w", can trim before-start to get "<tag_name" or after-end to get "name>"
  const trimOutsideDelimiter = (text: string, delimiter: string, trim: 'before-start' | 'after-end') => {
    if (!text.includes(delimiter)) {
      return text;
    }

    const parts = text.split(delimiter);

    if (trim === `before-start`) {
      return `${delimiter}${parts[1]}`;
    }

    return `${parts[0]}${delimiter}`;
  };

  // Helper to check if text starts with pattern (ignoring whitespace)
  // When checking partial tags: startsWith(buffer, openTag) checks if buffer could be start of tag
  // When checking full tags: startsWith(chunk, openTag) checks if chunk starts with full tag
  const startsWith = (text: string, pattern: string) => {
    // check start of opening tag
    if (pattern.includes(openTag.substring(0, 3))) {
      // our pattern for checking the start is always based on xml-like tags
      // if the pattern looks like our opening tag and the pattern also includes
      // some other chunked text before it, we just wanted to check the xml part of the pattern
      pattern = trimOutsideDelimiter(pattern, `<`, `before-start`);
    }

    return text.trim().startsWith(pattern.trim());
  };

  for await (const chunk of stream) {
    fullContent += chunk;

    if (isBuffering) buffer += chunk;

    const chunkHasTag = startsWith(chunk, openTag);
    const bufferHasTag = !chunkHasTag && isBuffering && startsWith(openTag, buffer);

    let toYieldBeforeMaskedStartTag = ``;
    // Check if we should start masking chunks
    if (!isMasking && (chunkHasTag || bufferHasTag)) {
      isMasking = true;
      isBuffering = false;

      // check if the buffered text includes text before the start tag. ex "o <tag_name", "o" should be yielded and not masked
      const taggedTextToMask = trimOutsideDelimiter(buffer, `<`, `before-start`);
      if (taggedTextToMask !== buffer.trim()) {
        toYieldBeforeMaskedStartTag = buffer.replace(taggedTextToMask, ``);
      }

      buffer = '';
      onStart?.();
    }

    // Check if we should start buffering (looks like part of the opening tag but it's not the full <tag> yet eg <ta - could be <table> but we don't know yet)
    if (!isMasking && !isBuffering && startsWith(openTag, chunk) && chunk.trim() !== '') {
      isBuffering = true;
      buffer += chunk;
      continue;
    }

    // We're buffering, need to check again if our buffer has deviated from the opening <tag> eg <tag2>
    if (isBuffering && buffer && !startsWith(openTag, buffer)) {
      yield buffer;
      buffer = '';
      isBuffering = false;
      continue;
    }

    // Check if we should stop masking chunks (since the content includes the closing </tag>)
    if (isMasking && fullContent.includes(closeTag)) {
      onMask?.(chunk);
      onEnd?.();
      isMasking = false;
      const lastFullContent = fullContent;
      fullContent = ``; // reset to handle streams with multiple full tags that have text inbetween

      // check to see if we have a partial chunk outside the close tag. if we do we need to yield it so it isn't swallowed with the masked text
      const textUntilEndTag = trimOutsideDelimiter(lastFullContent, closeTag, 'after-end');
      if (textUntilEndTag !== lastFullContent) {
        yield lastFullContent.replace(textUntilEndTag, ``);
      }

      continue;
    }

    // We're currently masking chunks inside a <tag>
    if (isMasking) {
      onMask?.(chunk);
      // in the case that there was a chunk that included a tag to mask and some other text, ex "o <tag_name" we need to still yield the
      // text before the tag ("o ") so it's not swallowed with the masked text
      if (toYieldBeforeMaskedStartTag) {
        yield toYieldBeforeMaskedStartTag;
      }
      continue;
    }

    // default yield the chunk
    yield chunk;
  }
}

/**
 * Resolve serialized zod output - This function takes the string output ot the `jsonSchemaToZod` function
 * and instantiates the zod object correctly.
 *
 * @param schema - serialized zod object
 * @returns resolved zod object
 */
export function resolveSerializedZodOutput(schema: string): z.ZodType {
  // Creates and immediately executes a new function that takes 'z' as a parameter
  // The function body is a string that returns the serialized zod schema
  // When executed with the 'z' parameter, it reconstructs the zod schema in the current context
  return Function('z', `"use strict";return (${schema});`)(z);
}

/**
 * Checks if a tool is a Vercel Tool
 * @param tool - The tool to check
 * @returns True if the tool is a Vercel Tool, false otherwise
 */
export function isVercelTool(tool?: ToolToConvert): tool is VercelTool {
  // Checks if this tool is not an instance of Tool
  return !(tool instanceof Tool);
}

interface ToolOptions {
  name: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  logger: Logger;
  description?: string;
  mastra?: (Mastra & MastraPrimitives) | MastraPrimitives;
  memory?: MastraMemory;
  agentName?: string;
}

type ToolToConvert = VercelTool | ToolAction<any, any, any, any>;

interface LogOptions {
  agentName?: string;
  toolName: string;
  tool?: ToolToConvert;
  type?: 'tool' | 'toolset';
}

interface LogMessageOptions {
  start: string;
  error: string;
}

function createLogMessageOptions({ agentName, toolName, tool, type }: LogOptions): LogMessageOptions {
  // If no agent name, use default format
  if (!agentName) {
    return {
      start: `Executing tool ${toolName}`,
      error: `Failed tool execution`,
    };
  }

  const prefix = `[Agent:${agentName}]`;
  const vercelPrefix = isVercelTool(tool) ? 'Vercel ' : '';
  const toolType = type === 'toolset' ? 'toolset' : 'tool';

  return {
    start: `${prefix} - Executing ${vercelPrefix}${toolType} ${toolName}`,
    error: `${prefix} - Failed ${vercelPrefix}${toolType} execution`,
  };
}

function createExecute(tool: ToolToConvert, options: ToolOptions, logType?: 'tool' | 'toolset') {
  const { logger, ...rest } = options;

  const { start, error } = createLogMessageOptions({
    agentName: options.agentName,
    toolName: options.name,
    tool,
    type: logType,
  });

  const execFunction = async (args: any, execOptions: any) => {
    if (isVercelTool(tool)) {
      return tool?.execute?.(args, execOptions) ?? undefined;
    }
    return (
      tool?.execute?.(
        {
          context: args,
          threadId: options.threadId,
          resourceId: options.resourceId,
          mastra: options.mastra,
          memory: options.memory,
          runId: options.runId,
        },
        execOptions,
      ) ?? undefined
    );
  };

  return async (args: any, execOptions?: any) => {
    try {
      logger.debug(start, { ...rest, args });
      return await execFunction(args, execOptions);
    } catch (err) {
      logger.error(error, { ...rest, error: err, args });
      throw err;
    }
  };
}

/**
 * Converts a Vercel Tool or Mastra Tool into a CoreTool format
 * @param tool - The tool to convert (either VercelTool or ToolAction)
 * @param options - Tool options including Mastra-specific settings
 * @param logType - Type of tool to log (tool or toolset)
 * @returns A CoreTool that can be used by the system
 */
export function makeCoreTool(tool: ToolToConvert, options: ToolOptions, logType?: 'tool' | 'toolset'): CoreTool {
  // Helper to get parameters based on tool type
  const getParameters = () => {
    if (isVercelTool(tool)) {
      // If the tool is a Vercel Tool, check if the parameters are already a zod object
      // If not, convert the parameters to a zod object using jsonSchemaToZod
      return tool.parameters instanceof z.ZodType
        ? tool.parameters
        : resolveSerializedZodOutput(jsonSchemaToZod(tool.parameters));
    }
    // If the tool is a Mastra Tool, return the inputSchema
    return tool.inputSchema;
  };

  return {
    description: tool.description!,
    parameters: getParameters(),
    execute: tool.execute ? createExecute(tool, { ...options, description: tool.description }, logType) : undefined,
  };
}

/**
 * Creates a proxy for a Mastra instance to handle deprecated properties
 * @param mastra - The Mastra instance to proxy
 * @param logger - The logger to use for warnings
 * @returns A proxy for the Mastra instance
 */
export function createMastraProxy({ mastra, logger }: { mastra: Mastra; logger: Logger }) {
  return new Proxy(mastra, {
    get(target, prop) {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop);
      }

      if (prop === 'logger') {
        logger.warn(`Please use 'getLogger' instead, logger is deprecated`);
        return Reflect.apply(target.getLogger, target, []);
      }

      if (prop === 'telemetry') {
        logger.warn(`Please use 'getTelemetry' instead, telemetry is deprecated`);
        return Reflect.apply(target.getTelemetry, target, []);
      }

      if (prop === 'storage') {
        logger.warn(`Please use 'getStorage' instead, storage is deprecated`);
        return Reflect.get(target, 'storage');
      }

      if (prop === 'agents') {
        logger.warn(`Please use 'getAgents' instead, agents is deprecated`);
        return Reflect.apply(target.getAgents, target, []);
      }

      if (prop === 'tts') {
        logger.warn(`Please use 'getTTS' instead, tts is deprecated`);
        return Reflect.apply(target.getTTS, target, []);
      }

      if (prop === 'vectors') {
        logger.warn(`Please use 'getVectors' instead, vectors is deprecated`);
        return Reflect.apply(target.getVectors, target, []);
      }

      if (prop === 'memory') {
        logger.warn(`Please use 'getMemory' instead, memory is deprecated`);
        return Reflect.get(target, 'memory');
      }

      return Reflect.get(target, prop);
    },
  });
}
