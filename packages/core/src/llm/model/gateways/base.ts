/**
 * Base class for model gateway providers
 * Gateways fetch provider configurations and build URLs for model access
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import type { ProviderOptions } from '../provider-options.js';

export interface ProviderConfig {
  url?: string;
  apiKeyHeader?: string;
  apiKeyEnvVar: string | string[];
  name: string;
  models: string[];
  docUrl?: string; // Optional documentation URL
  gateway: string;
}

/**
 * Union type for language models that can be returned by gateways.
 * Supports both AI SDK v5 (LanguageModelV2) and v6 (LanguageModelV3).
 */
export type GatewayLanguageModel = LanguageModelV2 | LanguageModelV3;

export abstract class MastraModelGateway {
  /**
   * Unique identifier for the gateway
   * This ID is used as the prefix for all providers from this gateway (e.g., "netlify/anthropic")
   * Exception: models.dev is a provider registry and doesn't use a prefix
   */
  abstract readonly id: string;

  /**
   * Name of the gateway provider
   */
  abstract readonly name: string;

  /**
   * Get the gateway ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Fetch provider configurations from the gateway
   * Should return providers in the standard format
   */
  abstract fetchProviders(): Promise<Record<string, ProviderConfig>>;

  /**
   * Build the URL for a specific model/provider combination
   * @param modelId Full model ID (e.g., "openai/gpt-4o" or "netlify/openai/gpt-4o")
   * @param envVars Environment variables available
   * @returns URL string if this gateway can handle the model, false otherwise
   */
  abstract buildUrl(modelId: string, envVars: Record<string, string>): string | undefined | Promise<string | undefined>;

  abstract getApiKey(modelId: string): Promise<string>;

  /**
   * Resolve a language model from the gateway.
   * Supports returning either LanguageModelV2 (AI SDK v5) or LanguageModelV3 (AI SDK v6).
   * @param args.modelId - The model identifier
   * @param args.providerId - The provider identifier
   * @param args.apiKey - API key for authentication
   * @param args.headers - Optional HTTP headers
   * @param args.providerOptions - Optional provider-specific options (e.g., reasoning settings, token limits)
   */
  abstract resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
    providerOptions?: ProviderOptions;
  }): Promise<GatewayLanguageModel> | GatewayLanguageModel;
}
