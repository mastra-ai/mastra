import type { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { ModelRouterLanguageModel } from './router';
import type { MastraModelConfig, MastraLanguageModel, OpenAICompatibleConfig } from './shared.types';

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
  // If it's already a LanguageModel, return it
  if (typeof modelConfig === 'object' && 'specificationVersion' in modelConfig) {
    return modelConfig;
  }

  const gatewayRecord = mastra?.listGateways();
  const customGateways = gatewayRecord ? Object.values(gatewayRecord) : undefined;

  // If it's a string (magic string like "openai/gpt-4o") or OpenAICompatibleConfig, create ModelRouterLanguageModel
  if (typeof modelConfig === 'string' || isOpenAICompatibleObjectConfig(modelConfig)) {
    return new ModelRouterLanguageModel(modelConfig, customGateways);
  }

  // If it's a function, resolve it first
  if (typeof modelConfig === 'function') {
    const fromDynamic = await modelConfig({ requestContext, mastra });
    if (typeof fromDynamic === 'string' || isOpenAICompatibleObjectConfig(fromDynamic)) {
      return new ModelRouterLanguageModel(fromDynamic, customGateways);
    }
    return fromDynamic;
  }

  throw new Error('Invalid model configuration provided');
}
