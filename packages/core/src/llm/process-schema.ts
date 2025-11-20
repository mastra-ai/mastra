import {
  OpenAISchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  AnthropicSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  MetaSchemaCompatLayer,
  type ModelInformation,
} from '@mastra/schema-compat';
import { RequestContext } from '../request-context';
import type { OutputSchema } from '../stream/base/schema';
import { resolveModelConfig } from './model/resolve-model';
import type { MastraModelConfig } from './model/shared.types';

/**
 * Process a Zod schema for compatibility with a specific model.
 *
 * This utility automatically applies the appropriate schema transformations
 * for the specified model to ensure compatibility with its structured output requirements.
 *
 * Particularly useful for OpenAI models with strict mode, which require all properties
 * to be in the `required` array. This function converts `.optional().nullable()`
 * to just `.nullable()` to satisfy that requirement.
 *
 * @param modelConfig - The model configuration (string like 'openai/gpt-4o-mini', or config object)
 * @param schema - The Zod schema to process
 * @returns The processed Zod schema with compatibility transformations applied
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { Agent, processSchema } from '@mastra/core';
 *
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number().optional().nullable() // Would cause issues with OpenAI strict mode
 * });
 *
 * const agent = new Agent({
 *   name: 'Assistant',
 *   model: 'openai/gpt-4o-mini'
 * });
 *
 * // Use processSchema to fix compatibility issues
 * const result = await agent.generate("Extract user info", {
 *   structuredOutput: {
 *     schema: processSchema('openai/gpt-4o-mini', schema)
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Using with config object
 * const result = await agent.generate("Extract info", {
 *   structuredOutput: {
 *     schema: processSchema({ id: 'openai/gpt-4o-mini', apiKey: '...' }, schema)
 *   }
 * });
 * ```
 */
export async function processSchema<T extends OutputSchema>(modelConfig: MastraModelConfig, schema: T): Promise<T> {
  const resolvedModel = await resolveModelConfig(modelConfig, new RequestContext());

  const modelInfo: ModelInformation = {
    provider: resolvedModel.provider,
    modelId: resolvedModel.modelId,
    supportsStructuredOutputs: false,
  };

  // Create all compat layers and find the first one that applies
  const compatLayers = [
    new OpenAIReasoningSchemaCompatLayer(modelInfo),
    new OpenAISchemaCompatLayer(modelInfo),
    new AnthropicSchemaCompatLayer(modelInfo),
    new GoogleSchemaCompatLayer(modelInfo),
    new DeepSeekSchemaCompatLayer(modelInfo),
    new MetaSchemaCompatLayer(modelInfo),
  ];

  // Find the first compat layer that should apply
  for (const layer of compatLayers) {
    if (layer.shouldApply()) {
      return layer.processZodType(schema as any) as T;
    }
  }

  // No compat layer needed, return original schema
  return schema;
}
