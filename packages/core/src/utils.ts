import { createHash } from 'crypto';
import type { WritableStream } from 'stream/web';
import type { CoreMessage } from 'ai';
import jsonSchemaToZod from 'json-schema-to-zod';
import { z } from 'zod';
import type { MastraPrimitives } from './action';
import type { ToolsInput } from './agent';
import type { TracingContext } from './ai-tracing';
import type { IMastraLogger } from './logger';
import type { Mastra } from './mastra';
import type { AiMessageType, MastraLanguageModel, MastraMemory } from './memory';
import type { RuntimeContext } from './runtime-context';
import type { ChunkType } from './stream/types';
import type { CoreTool, VercelTool, VercelToolV5 } from './tools';
import { CoreToolBuilder } from './tools/tool-builder/builder';
import type { ToolToConvert } from './tools/tool-builder/builder';
import { isVercelTool } from './tools/toolchecks';

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export function generateEmptyFromSchema(schema: string) {
  try {
    const parsedSchema = JSON.parse(schema);
    if (!parsedSchema || parsedSchema.type !== 'object' || !parsedSchema.properties) return {};
    const obj: Record<string, any> = {};
    const TYPE_DEFAULTS = {
      string: '',
      array: [],
      object: {},
      number: 0,
      integer: 0,
      boolean: false,
    };
    for (const [key, prop] of Object.entries<any>(parsedSchema.properties)) {
      obj[key] = TYPE_DEFAULTS[prop.type as keyof typeof TYPE_DEFAULTS] ?? null;
    }
    return obj;
  } catch {
    return {};
  }
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

export interface ToolOptions {
  name: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  logger?: IMastraLogger;
  description?: string;
  mastra?: (Mastra & MastraPrimitives) | MastraPrimitives;
  runtimeContext: RuntimeContext;
  tracingContext: TracingContext;
  memory?: MastraMemory;
  agentName?: string;
  model?: MastraLanguageModel;
  writableStream?: WritableStream<ChunkType>;
}

/**
 * Checks if a value is a Zod type
 * @param value - The value to check
 * @returns True if the value is a Zod type, false otherwise
 */
export function isZodType(value: unknown): value is z.ZodType {
  // Check if it's a Zod schema by looking for common Zod properties and methods
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    'parse' in value &&
    typeof (value as any).parse === 'function' &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  );
}

// Helper function to create a deterministic hash
function createDeterministicId(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8); // Take first 8 characters for a shorter but still unique ID
}

/**
 * Sets the properties for a Vercel Tool, including an ID and inputSchema
 * @param tool - The tool to set the properties for
 * @returns The tool with the properties set
 */
function setVercelToolProperties(tool: VercelTool) {
  const inputSchema = convertVercelToolParameters(tool);
  const toolId = !('id' in tool)
    ? tool.description
      ? `tool-${createDeterministicId(tool.description)}`
      : `tool-${Math.random().toString(36).substring(2, 9)}`
    : tool.id;
  return {
    ...tool,
    id: toolId,
    inputSchema,
  };
}

/**
 * Ensures a tool has an ID and inputSchema by generating one if not present
 * @param tool - The tool to ensure has an ID and inputSchema
 * @returns The tool with an ID and inputSchema
 */
export function ensureToolProperties(tools: ToolsInput): ToolsInput {
  const toolsWithProperties = Object.keys(tools).reduce<ToolsInput>((acc, key) => {
    const tool = tools?.[key];
    if (tool) {
      if (isVercelTool(tool)) {
        acc[key] = setVercelToolProperties(tool) as VercelTool;
      } else {
        acc[key] = tool;
      }
    }
    return acc;
  }, {});

  return toolsWithProperties;
}

function convertVercelToolParameters(tool: VercelTool): z.ZodType {
  // If the tool is a Vercel Tool, check if the parameters are already a zod object
  // If not, convert the parameters to a zod object using jsonSchemaToZod
  const schema = tool.parameters ?? z.object({});
  return isZodType(schema) ? schema : resolveSerializedZodOutput(jsonSchemaToZod(schema));
}

/**
 * Converts a Vercel Tool or Mastra Tool into a CoreTool format
 * @param originalTool - The tool to convert (either VercelTool or ToolAction)
 * @param options - Tool options including Mastra-specific settings
 * @param logType - Type of tool to log (tool or toolset)
 * @returns A CoreTool that can be used by the system
 */
export function makeCoreTool(
  originalTool: ToolToConvert,
  options: ToolOptions,
  logType?: 'tool' | 'toolset' | 'client-tool',
): CoreTool {
  return new CoreToolBuilder({ originalTool, options, logType }).build();
}

export function makeCoreToolV5(
  originalTool: ToolToConvert,
  options: ToolOptions,
  logType?: 'tool' | 'toolset' | 'client-tool',
): VercelToolV5 {
  return new CoreToolBuilder({ originalTool, options, logType }).buildV5();
}

/**
 * Creates a proxy for a Mastra instance to handle deprecated properties
 * @param mastra - The Mastra instance to proxy
 * @param logger - The logger to use for warnings
 * @returns A proxy for the Mastra instance
 */
export function createMastraProxy({ mastra, logger }: { mastra: Mastra; logger: IMastraLogger }) {
  return new Proxy(mastra, {
    get(target, prop) {
      const hasProp = Reflect.has(target, prop);

      if (hasProp) {
        const value = Reflect.get(target, prop);
        const isFunction = typeof value === 'function';
        if (isFunction) {
          return value.bind(target);
        }
        return value;
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

export function checkEvalStorageFields(traceObject: any, logger?: IMastraLogger) {
  const missingFields = [];
  if (!traceObject.input) missingFields.push('input');
  if (!traceObject.output) missingFields.push('output');
  if (!traceObject.agentName) missingFields.push('agent_name');
  if (!traceObject.metricName) missingFields.push('metric_name');
  if (!traceObject.instructions) missingFields.push('instructions');
  if (!traceObject.globalRunId) missingFields.push('global_run_id');
  if (!traceObject.runId) missingFields.push('run_id');

  if (missingFields.length > 0) {
    if (logger) {
      logger.warn('Skipping evaluation storage due to missing required fields', {
        missingFields,
        runId: traceObject.runId,
        agentName: traceObject.agentName,
      });
    } else {
      console.warn('Skipping evaluation storage due to missing required fields', {
        missingFields,
        runId: traceObject.runId,
        agentName: traceObject.agentName,
      });
    }
    return false;
  }

  return true;
}

// lifted from https://github.com/vercel/ai/blob/main/packages/ai/core/prompt/detect-prompt-type.ts#L27
function detectSingleMessageCharacteristics(
  message: any,
): 'has-ui-specific-parts' | 'has-core-specific-parts' | 'message' | 'other' {
  if (
    typeof message === 'object' &&
    message !== null &&
    (message.role === 'function' || // UI-only role
      message.role === 'data' || // UI-only role
      'toolInvocations' in message || // UI-specific field
      'parts' in message || // UI-specific field
      'experimental_attachments' in message)
  ) {
    return 'has-ui-specific-parts';
  } else if (
    typeof message === 'object' &&
    message !== null &&
    'content' in message &&
    (Array.isArray(message.content) || // Core messages can have array content
      'experimental_providerMetadata' in message ||
      'providerOptions' in message)
  ) {
    return 'has-core-specific-parts';
  } else if (
    typeof message === 'object' &&
    message !== null &&
    'role' in message &&
    'content' in message &&
    typeof message.content === 'string' &&
    ['system', 'user', 'assistant', 'tool'].includes(message.role)
  ) {
    return 'message';
  } else {
    return 'other';
  }
}

export function isUiMessage(message: CoreMessage | AiMessageType): message is AiMessageType {
  return detectSingleMessageCharacteristics(message) === `has-ui-specific-parts`;
}
export function isCoreMessage(message: CoreMessage | AiMessageType): message is CoreMessage {
  return [`has-core-specific-parts`, `message`].includes(detectSingleMessageCharacteristics(message));
}

/** Represents a validated SQL identifier (e.g., table or column name). */
type SqlIdentifier = string & { __brand: 'SqlIdentifier' };
/** Represents a validated dot-separated SQL field key. */
type FieldKey = string & { __brand: 'FieldKey' };

const SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Parses and returns a valid SQL identifier (such as a table or column name).
 * The identifier must:
 *   - Start with a letter (a-z, A-Z) or underscore (_)
 *   - Contain only letters, numbers, or underscores
 *   - Be at most 63 characters long
 *
 * @param name - The identifier string to parse.
 * @param kind - Optional label for error messages (e.g., 'table name').
 * @returns The validated identifier as a branded type.
 * @throws {Error} If the identifier does not conform to SQL naming rules.
 *
 * @example
 * const id = parseSqlIdentifier('my_table'); // Ok
 * parseSqlIdentifier('123table'); // Throws error
 */
export function parseSqlIdentifier(name: string, kind = 'identifier'): SqlIdentifier {
  if (!SQL_IDENTIFIER_PATTERN.test(name) || name.length > 63) {
    throw new Error(
      `Invalid ${kind}: ${name}. Must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 63 characters long.`,
    );
  }
  return name as SqlIdentifier;
}

/**
 * Parses and returns a valid dot-separated SQL field key (e.g., 'user.profile.name').
 * Each segment must:
 *   - Start with a letter (a-z, A-Z) or underscore (_)
 *   - Contain only letters, numbers, or underscores
 *   - Be at most 63 characters long
 *
 * @param key - The dot-separated field key string to parse.
 * @returns The validated field key as a branded type.
 * @throws {Error} If any segment of the key is invalid.
 *
 * @example
 * const key = parseFieldKey('user_profile.name'); // Ok
 * parseFieldKey('user..name'); // Throws error
 * parseFieldKey('user.123name'); // Throws error
 */
export function parseFieldKey(key: string): FieldKey {
  if (!key) throw new Error('Field key cannot be empty');
  const segments = key.split('.');
  for (const segment of segments) {
    if (!SQL_IDENTIFIER_PATTERN.test(segment) || segment.length > 63) {
      throw new Error(`Invalid field key segment: ${segment} in ${key}`);
    }
  }
  return key as FieldKey;
}

/**
 * Performs a fetch request with automatic retries using exponential backoff
 * @param url The URL to fetch from
 * @param options Standard fetch options
 * @param maxRetries Maximum number of retry attempts
 * @param validateResponse Optional function to validate the response beyond HTTP status
 * @returns The fetch Response if successful
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
): Promise<Response> {
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`Request failed with status: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount++;

      if (retryCount >= maxRetries) {
        break;
      }

      const delay = Math.min(1000 * Math.pow(2, retryCount) * 1000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Request failed after multiple retry attempts');
}
