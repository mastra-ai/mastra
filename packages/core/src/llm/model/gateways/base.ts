/**
 * Base class for model gateway providers
 * Gateways fetch provider configurations and build URLs for model access
 */

export interface ProviderConfig {
  url: string;
  apiKeyEnvVar: string;
  apiKeyHeader?: string;
  name: string;
  models: string[];
}

export abstract class MastraModelGateway {
  /**
   * Name of the gateway provider
   */
  abstract readonly name: string;

  /**
   * Optional prefix for provider IDs
   * If set, all providers from this gateway will be prefixed (e.g., "netlify/openai")
   * Registry gateways (like models.dev) typically don't have a prefix
   */
  abstract readonly prefix?: string;

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
  abstract buildUrl(modelId: string, envVars: Record<string, string>): string | false;

  /**
   * Build headers for the request
   * Optional - only needed if the gateway requires special headers
   */
  buildHeaders?(modelId: string, envVars: Record<string, string>): Record<string, string>;
}
