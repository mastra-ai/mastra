import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import type { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { AISDKV5LanguageModel } from './aisdk/v5/model';
import { AISDKV6LanguageModel } from './aisdk/v6/model';
import { ModelRouterLanguageModel } from './router';
import type {
  MastraModelConfig,
  OpenAICompatibleConfig,
  MastraLanguageModel,
  MastraLegacyLanguageModel,
} from './shared.types';

/**
 * Type guard to check if a model config is an OpenAICompatibleConfig object
 * @internal
 */
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
  if (typeof modelConfig === 'object' && 'specificationVersion' in modelConfig) return false;
  // Check for OpenAICompatibleConfig - it should have either:
  // 1. 'id' field (but NOT 'model' - that's ModelWithRetries)
  // 2. Both 'providerId' and 'modelId' fields
  if (typeof modelConfig === 'object' && !('model' in modelConfig)) {
    if ('id' in modelConfig) return true;
    if ('providerId' in modelConfig && 'modelId' in modelConfig) return true;
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
export async function resolveModelConfig<TRequestContext extends Record<string, any> = Record<string, any>>(
  modelConfig:
    | MastraModelConfig
    | (({
        requestContext,
        mastra,
      }: {
        requestContext: RequestContext<TRequestContext>;
        mastra?: Mastra;
      }) => MastraModelConfig | Promise<MastraModelConfig>),
  requestContext: RequestContext<TRequestContext> = new RequestContext() as RequestContext<TRequestContext>,
  mastra?: Mastra,
): Promise<MastraLanguageModel | MastraLegacyLanguageModel> {
  // If it's a function, resolve it first
  if (typeof modelConfig === 'function') {
    modelConfig = await modelConfig({ requestContext, mastra });
  }

  // Filter out custom language model instances
  // TODO need a better trick, maybe symbol
  if (
    modelConfig instanceof ModelRouterLanguageModel ||
    modelConfig instanceof AISDKV5LanguageModel ||
    modelConfig instanceof AISDKV6LanguageModel
  ) {
    return modelConfig;
  }

  // If it's already a LanguageModel, wrap it with the appropriate wrapper
  if (typeof modelConfig === 'object' && 'specificationVersion' in modelConfig) {
    if (modelConfig.specificationVersion === 'v2') {
      return new AISDKV5LanguageModel(modelConfig as LanguageModelV2);
    }
    if (modelConfig.specificationVersion === 'v3') {
      return new AISDKV6LanguageModel(modelConfig as LanguageModelV3);
    }
    // V1 (legacy) models pass through without wrapping
    return modelConfig;
  }

  const gatewayRecord = mastra?.listGateways();
  const customGateways = gatewayRecord ? Object.values(gatewayRecord) : undefined;

  // If it's a string (magic string like "openai/gpt-4o") or OpenAICompatibleConfig, create ModelRouterLanguageModel
  if (typeof modelConfig === 'string' || isOpenAICompatibleObjectConfig(modelConfig)) {
    return new ModelRouterLanguageModel(modelConfig, customGateways);
  }

  throw new Error('Invalid model configuration provided');
}
