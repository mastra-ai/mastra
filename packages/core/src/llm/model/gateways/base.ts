/**
 * Base class for model gateway providers
 * Gateways fetch provider configurations and build URLs for model access
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';

export interface ProviderConfig {
  url?: string;
  apiKeyHeader?: string;
  apiKeyEnvVar: string | string[];
  name: string;
  models: string[];
  docUrl?: string; // Optional documentation URL
  gateway: string;
}

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

  abstract resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> | LanguageModelV2;
}
