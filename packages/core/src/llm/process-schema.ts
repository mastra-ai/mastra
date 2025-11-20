import {
  OpenAISchemaCompatLayer,
  OpenAIReasoningSchemaCompatLayer,
  AnthropicSchemaCompatLayer,
  GoogleSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  MetaSchemaCompatLayer,
} from '@mastra/schema-compat';
import type { ModelInformation } from '@mastra/schema-compat';
import type { OutputSchema } from '../stream/base/schema';

/**
 * Schema compatibility utilities for transforming Zod schemas to work with specific model providers.
 *
 * Use these utilities to transform your schemas before passing them to agent methods.
 * This ensures the same schema can be used for both backend generation and frontend validation.
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { processSchema } from '@mastra/core';
 *
 * // Define your schema once
 * const userSchema = z.object({
 *   name: z.string(),
 *   age: z.number().optional(), // Would cause issues with OpenAI strict mode
 * });
 *
 * // Transform it for OpenAI
 * const openaiSchema = processSchema.openai(userSchema);
 *
 * // Use in agent
 * const result = await agent.generate("Extract user info", {
 *   structuredOutput: { schema: openaiSchema }
 * });
 *
 * // Use the same transformed schema on frontend for validation
 * const validatedData = openaiSchema.parse(result.object);
 * ```
 */
export const processSchema = {
  /**
   * Transform schema for OpenAI models with strict mode.
   *
   * Converts `.optional()` fields to `.nullable()` to ensure all properties
   * are in the required array, which is required by OpenAI's strict mode.
   *
   * @param schema - The Zod schema to transform
   * @returns Transformed schema compatible with OpenAI strict mode
   */
  openai: <T extends OutputSchema>(schema: T): T => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'gpt-4o',
      supportsStructuredOutputs: false,
    };
    const layer = new OpenAISchemaCompatLayer(modelInfo);
    return layer.processZodType(schema as any) as T;
  },

  /**
   * Transform schema for OpenAI reasoning models (o1, o3, o4).
   *
   * Applies the same transformations as `openai()` but for reasoning models.
   *
   * @param schema - The Zod schema to transform
   * @returns Transformed schema compatible with OpenAI reasoning models
   */
  openaiReasoning: <T extends OutputSchema>(schema: T): T => {
    const modelInfo: ModelInformation = {
      provider: 'openai',
      modelId: 'o1',
      supportsStructuredOutputs: false,
    };
    const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);
    return layer.processZodType(schema as any) as T;
  },

  /**
   * Transform schema for Anthropic models.
   *
   * @param schema - The Zod schema to transform
   * @returns Transformed schema compatible with Anthropic models
   */
  anthropic: <T extends OutputSchema>(schema: T): T => {
    const modelInfo: ModelInformation = {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      supportsStructuredOutputs: false,
    };
    const layer = new AnthropicSchemaCompatLayer(modelInfo);
    return layer.processZodType(schema as any) as T;
  },

  /**
   * Transform schema for Google models.
   *
   * @param schema - The Zod schema to transform
   * @returns Transformed schema compatible with Google models
   */
  google: <T extends OutputSchema>(schema: T): T => {
    const modelInfo: ModelInformation = {
      provider: 'google',
      modelId: 'gemini-2.0-flash-exp',
      supportsStructuredOutputs: false,
    };
    const layer = new GoogleSchemaCompatLayer(modelInfo);
    return layer.processZodType(schema as any) as T;
  },

  /**
   * Transform schema for DeepSeek models.
   *
   * @param schema - The Zod schema to transform
   * @returns Transformed schema compatible with DeepSeek models
   */
  deepseek: <T extends OutputSchema>(schema: T): T => {
    const modelInfo: ModelInformation = {
      provider: 'deepseek',
      modelId: 'deepseek-chat',
      supportsStructuredOutputs: false,
    };
    const layer = new DeepSeekSchemaCompatLayer(modelInfo);
    return layer.processZodType(schema as any) as T;
  },

  /**
   * Transform schema for Meta models.
   *
   * @param schema - The Zod schema to transform
   * @returns Transformed schema compatible with Meta models
   */
  meta: <T extends OutputSchema>(schema: T): T => {
    const modelInfo: ModelInformation = {
      provider: 'meta',
      modelId: 'llama-3.3-70b-instruct',
      supportsStructuredOutputs: false,
    };
    const layer = new MetaSchemaCompatLayer(modelInfo);
    return layer.processZodType(schema as any) as T;
  },
};
