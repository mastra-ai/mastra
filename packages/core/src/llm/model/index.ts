export * from './model';
export { ModelRouterLanguageModel } from './router';
export {
  type ModelRouterModelId,
  type Provider,
  type ModelForProvider,
  type AttachmentCapabilities,
  modelSupportsAttachments,
  modelSupportsStructuredOutput,
  modelSupportsTemperature,
} from './provider-registry.js';
export { resolveModelConfig, isOpenAICompatibleObjectConfig } from './resolve-model';
export { resolveModelAuth, type ResolveModelAuthArgs } from './model-auth-resolver';
export type { GatewayAuthRequest, GatewayAuthResult } from './gateways/base';
export {
  ModelRouterEmbeddingModel,
  type EmbeddingModelId,
  EMBEDDING_MODELS,
  type EmbeddingModelInfo,
} from './embedding-router';
