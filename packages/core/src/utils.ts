import { z } from 'zod';
import type { ZodObject } from 'zod';

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
      zodSchema[key] = zodType.nullable();
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

  // Helper to check if text starts with pattern (ignoring whitespace)
  // When checking partial tags: startsWith(buffer, openTag) checks if buffer could be start of tag
  // When checking full tags: startsWith(chunk, openTag) checks if chunk starts with full tag
  const startsWith = (text: string, pattern: string) => text.trim().startsWith(pattern.trim());

  for await (const chunk of stream) {
    fullContent += chunk;

    if (isBuffering) buffer += chunk;

    const chunkHasTag = startsWith(chunk, openTag);
    const bufferHasTag = !chunkHasTag && isBuffering && startsWith(openTag, buffer);

    // Check if we should start masking chunks
    if (!isMasking && (chunkHasTag || bufferHasTag)) {
      isMasking = true;
      isBuffering = false;
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
    if (isMasking && fullContent.trim().includes(closeTag)) {
      onMask?.(chunk);
      onEnd?.();
      isMasking = false;
      continue;
    }

    // We're currently masking chunks inside a <tag>
    if (isMasking) {
      onMask?.(chunk);
      continue;
    }

    // default yield the chunk
    yield chunk;
  }
}
