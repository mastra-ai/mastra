import type { LanguageModelV4 } from '@ai-sdk/provider';
import type { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { AISDKV7LanguageModel } from './aisdk/v7/model';
import { ModelRouterLanguageModel } from './router';
import type {
  IdentifiedModelConfig,
  MastraModelConfig,
  OpenAICompatibleConfig,
  MastraLanguageModel,
} from './shared.types';

/**
 * Type guard to check if a model config is an OpenAICompatibleConfig object
 * @internal
 */
/** Whether a model config is a `{ model, id }` labeled model. */
function isIdentifiedModelConfig(modelConfig: unknown): modelConfig is IdentifiedModelConfig {
  return (
    modelConfig !== null &&
    typeof modelConfig === 'object' &&
    !('specificationVersion' in modelConfig) &&
    'model' in modelConfig &&
    'id' in modelConfig &&
    typeof modelConfig.id === 'string' &&
    Boolean(modelConfig.model)
  );
}

export function isOpenAICompatibleObjectConfig(
  modelConfig:
    | MastraModelConfig
    | (({
        requestContext,
        mastra,
      }: {
        requestContext: RequestContext;
        mastra?: Mastra;
      }) => MastraModelConfig | Promise<MastraModelConfig>),
): modelConfig is OpenAICompatibleConfig {
  if (modelConfig === null || typeof modelConfig !== 'object') return false;
  if ('specificationVersion' in modelConfig) return false;
  // Check for OpenAICompatibleConfig - it should have either:
  // 1. 'id' field (but NOT 'model' - that's ModelWithRetries)
  // 2. Both 'providerId' and 'modelId' fields
  if (!('model' in modelConfig)) {
    if ('providerId' in modelConfig && 'modelId' in modelConfig) {
      return typeof modelConfig.providerId === 'string' && typeof modelConfig.modelId === 'string';
    }
    if ('id' in modelConfig) return typeof modelConfig.id === 'string';
  }
  return false;
}

/**
 * Resolves a model configuration to a LanguageModel instance.
 * Supports:
 * - Magic strings like "openai/gpt-4o"
 * - Config objects like { id: "openai/gpt-4o", apiKey: "..." }
 * - Direct LanguageModel instances
 * - Dynamic functions that return any of the above
 *
 * @param modelConfig The model configuration
 * @param requestContext Optional request context for dynamic resolution
 * @param mastra Optional Mastra instance for dynamic resolution
 * @returns A resolved LanguageModel instance
 *
 * @example
 * ```typescript
 * // String resolution
 * const model = await resolveModelConfig("openai/gpt-4o");
 *
 * // Config object resolution
 * const model = await resolveModelConfig({
 *   id: "openai/gpt-4o",
 *   apiKey: "sk-..."
 * });
 *
 * // Dynamic resolution
 * const model = await resolveModelConfig(
 *   ({ requestContext }) => requestContext.get("preferredModel")
 * );
 * ```
 */
export async function resolveModelConfig(
  modelConfig:
    | MastraModelConfig
    | (({
        requestContext,
        mastra,
      }: {
        requestContext: RequestContext;
        mastra?: Mastra;
      }) => MastraModelConfig | Promise<MastraModelConfig>),
  requestContext: RequestContext = new RequestContext(),
  mastra?: Mastra,
): Promise<MastraLanguageModel> {
  // If it's a function, resolve it first
  if (typeof modelConfig === 'function') {
    modelConfig = await modelConfig({ requestContext, mastra });
  }

  if (isIdentifiedModelConfig(modelConfig)) {
    const resolved = await resolveModelConfig(modelConfig.model, requestContext, mastra);
    resolved.id = modelConfig.id;
    return resolved;
  }

  // Filter out custom language model instances
  // TODO need a better trick, maybe symbol
  if (
    modelConfig instanceof ModelRouterLanguageModel ||
    modelConfig instanceof AISDKV7LanguageModel
  ) {
    return modelConfig;
  }

  // If it's already a LanguageModel, wrap it with the appropriate wrapper
  if (modelConfig !== null && typeof modelConfig === 'object' && 'specificationVersion' in modelConfig) {
    const version = (modelConfig as { specificationVersion: string }).specificationVersion;
    if (version === 'v4') {
      return new AISDKV7LanguageModel(modelConfig as LanguageModelV4);
    }
    throw new Error(
      `Language models with specificationVersion "${version}" are not supported. Mastra requires AI SDK v7 providers (specificationVersion "v4"): upgrade your @ai-sdk/* provider package, or use a Mastra model router string such as "openai/gpt-5-mini".`,
    );
  }

  const gatewayRecord = mastra?.listGateways();
  const customGateways = gatewayRecord ? Object.values(gatewayRecord) : undefined;

  // If it's a string (magic string like "openai/gpt-4o") or OpenAICompatibleConfig, create ModelRouterLanguageModel
  if (typeof modelConfig === 'string' || isOpenAICompatibleObjectConfig(modelConfig)) {
    return new ModelRouterLanguageModel(modelConfig, customGateways);
  }

  throw new Error('Invalid model configuration provided');
}
