import { wrapSchemaWithNullTransform } from '@mastra/schema-compat';
import type { SharedProviderOptions } from '../../llm/model/shared.types';
import { toStandardSchema } from '../../schema';
import { usesOpenAIStrictJsonSchema } from '../../stream/aisdk/v5/execute';

type StrictModel = Parameters<typeof usesOpenAIStrictJsonSchema>[0];

/**
 * Mirrors the check in `Agent.#execute`: OpenAI-style strict JSON schema models answer
 * omitted optional fields with `null`, so the live schema must map `null` back to `undefined`.
 */
export function needsNullToUndefined(
  model: StrictModel & { modelId?: string },
  providerOptions?: SharedProviderOptions,
) {
  return (
    model.provider.includes('openai') ||
    Boolean(model.modelId?.includes('openai')) ||
    usesOpenAIStrictJsonSchema(model, providerOptions)
  );
}

/** Builds a live standard schema from a persisted JSON Schema, applying the null transform when flagged. */
export function toLiveStructuredOutputSchema<T = unknown>(schema: unknown, nullToUndefined?: boolean) {
  const standard = toStandardSchema<any>(schema as any);
  return (nullToUndefined ? wrapSchemaWithNullTransform(standard) : standard) as ReturnType<typeof toStandardSchema<T>>;
}
