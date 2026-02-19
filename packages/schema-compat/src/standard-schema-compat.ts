/**
 * Standard Schema compatibility utilities
 *
 * This module provides utilities to apply provider-specific schema transformations
 * to StandardSchemaWithJSON types, particularly for OpenAI compatibility.
 */

import { OpenAISchemaCompatLayer } from './provider-compats/openai';
import { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';
import { toStandardSchema } from './standard-schema/standard-schema';
import type { StandardSchemaWithJSON } from './standard-schema/standard-schema.types';
import type { ModelInformation } from './types';
import { isZodType } from './utils';

/**
 * Extracts the underlying Zod schema from a schema value.
 *
 * Handles both:
 * - Raw Zod schemas (z.object(...))
 * - StandardSchemaWithJSON wrappers that preserve Zod methods via prototype
 *
 * @param schema - The schema to extract from
 * @returns The underlying Zod schema, or null if not a Zod schema
 */
export function extractZodSchema(schema: unknown): unknown {
  if (!isZodType(schema)) {
    return null;
  }

  // Both raw Zod schemas and StandardSchemaWithJSON wrappers pass isZodType
  // check due to prototype chain preservation. We can treat them the same.
  return schema;
}

/**
 * Applies OpenAI schema compatibility transforms to a schema.
 *
 * For OpenAI models, converts `.optional()` fields to `.nullable().transform()`
 * to work around OpenAI's limitation with optional fields in structured outputs.
 *
 * @param schema - The schema to process (raw Zod or StandardSchemaWithJSON)
 * @param modelInfo - Information about the target model
 * @returns The processed schema as StandardSchemaWithJSON, or original if not applicable
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number().optional(), // Will be converted to .nullable().transform()
 * });
 *
 * const processed = applyOpenAICompatTransforms(schema, {
 *   provider: 'openai',
 *   modelId: 'gpt-4',
 *   supportsStructuredOutputs: false,
 * });
 * ```
 */
export function applyOpenAICompatTransforms<T>(schema: T, modelInfo: ModelInformation): T | StandardSchemaWithJSON {
  // Only apply to OpenAI models
  const isOpenAI = modelInfo.provider?.includes('openai') || modelInfo.modelId?.includes('openai');

  if (!isOpenAI) {
    return schema;
  }

  // Extract underlying Zod schema (works with both raw Zod and StandardSchemaWithJSON)
  const zodSchema = extractZodSchema(schema);
  if (!zodSchema) {
    // Not a Zod schema, return unchanged
    return schema;
  }

  // Create appropriate compat layer based on model type
  const isReasoningModel = /^o[1-5]/.test(modelInfo.modelId);
  const compatLayer = isReasoningModel
    ? new OpenAIReasoningSchemaCompatLayer(modelInfo)
    : new OpenAISchemaCompatLayer(modelInfo);

  if (!compatLayer.shouldApply()) {
    // Compat layer determined it's not needed
    return schema;
  }

  // Process the Zod schema with OpenAI-specific transforms
  // processZodType expects and returns a Zod schema
  const processedZodSchema = compatLayer.processZodType(zodSchema as any);

  // Re-wrap as StandardSchemaWithJSON and return
  // Type assertion is safe because we're returning StandardSchemaWithJSON
  return toStandardSchema(processedZodSchema) as any;
}

/**
 * Applies OpenAI compat transforms to all tools in a toolset.
 *
 * Processes each tool's inputSchema (if present) with OpenAI compatibility transforms.
 *
 * @param tools - The toolset to process
 * @param modelInfo - Information about the target model
 * @returns The processed toolset with transformed schemas
 *
 * @example
 * ```typescript
 * const tools = {
 *   getTodo: {
 *     inputSchema: z.object({
 *       id: z.string(),
 *       includeCompleted: z.boolean().optional(), // Will be transformed
 *     }),
 *     execute: async (input) => { ... },
 *   },
 * };
 *
 * const processed = applyOpenAICompatToTools(tools, {
 *   provider: 'openai',
 *   modelId: 'gpt-4',
 *   supportsStructuredOutputs: false,
 * });
 * ```
 */
export function applyOpenAICompatToTools<T extends Record<string, any>>(
  tools: T | undefined,
  modelInfo: ModelInformation,
): T | undefined {
  if (!tools) {
    return tools;
  }

  const transformedTools: Record<string, any> = {};

  for (const [name, tool] of Object.entries(tools)) {
    if (tool.inputSchema) {
      // Apply transforms to the tool's input schema
      const processedSchema = applyOpenAICompatTransforms(tool.inputSchema, modelInfo);

      transformedTools[name] = {
        ...tool,
        inputSchema: processedSchema,
      };
    } else {
      // No schema, pass through unchanged
      transformedTools[name] = tool;
    }
  }

  return transformedTools as T;
}
