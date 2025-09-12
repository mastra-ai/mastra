import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MastraModelGateway, type ProviderConfig } from '../src/llm/model/gateways/index.js';
import { ModelsDevGateway } from '../src/llm/model/gateways/models-dev.js';
import { NetlifyGateway } from '../src/llm/model/gateways/netlify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateProviderRegistry(gateways: MastraModelGateway[]) {
  const allProviders: Record<string, ProviderConfig> = {};
  const allModels: Record<string, string[]> = {};

  // Fetch from all gateways
  for (const gateway of gateways) {
    try {
      const providers = await gateway.fetchProviders();

      for (const [providerId, config] of Object.entries(providers)) {
        // The gateway's fetchProviders() method already includes the prefix in the provider IDs
        // so we just use them as-is
        allProviders[providerId] = config;
        allModels[providerId] = config.models;
      }
    } catch (error) {
      console.error(`Failed to fetch from gateway ${gateway.name}:`, error);
      throw error; // Fail the whole generation as requested
    }
  }

  // Generate the TypeScript file
  const output = `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 * Generated from model gateway providers
 */

/**
 * Provider configurations for OpenAI-compatible APIs
 */
export const PROVIDER_REGISTRY = ${JSON.stringify(allProviders, null, 2)} as const;

/**
 * Available models per provider
 */
export const PROVIDER_MODELS = ${JSON.stringify(allModels, null, 2)} as const;

/**
 * Type definitions for autocomplete support
 */
export type ProviderModels = typeof PROVIDER_MODELS;
export type Provider = keyof ProviderModels;
export type ModelForProvider<P extends Provider> = ProviderModels[P][number];

/**
 * OpenAI-compatible model ID type
 * Full provider/model paths (e.g., "openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022")
 */
export type OpenAICompatibleModelId = {[P in Provider]: \`\${P}/\${ModelForProvider<P>}\`}[Provider];


/**
 * Get provider configuration by provider ID
 */
export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY[providerId as keyof typeof PROVIDER_REGISTRY];
}

/**
 * Check if a provider is registered
 */
export function isProviderRegistered(providerId: string): boolean {
  return providerId in PROVIDER_REGISTRY;
}

/**
 * Get all registered provider IDs
 */
export function getRegisteredProviders(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  url: string;
  apiKeyEnvVar: string;
  apiKeyHeader?: string;
  name: string;
  models: readonly string[];
  docUrl?: string;
}

/**
 * Parse a model string to extract provider and model ID
 * Examples:
 *   "openai/gpt-4o" -> { provider: "openai", modelId: "gpt-4o" }
 *   "netlify/openai/gpt-4o" -> { provider: "netlify/openai", modelId: "gpt-4o" }
 *   "gpt-4o" -> { provider: null, modelId: "gpt-4o" }
 */
export function parseModelString(modelString: string): { provider: string | null; modelId: string } {
  const firstSlashIndex = modelString.indexOf('/');
  
  if (firstSlashIndex !== -1) {
    // Has at least one slash - extract everything before last slash as provider
    const lastSlashIndex = modelString.lastIndexOf('/');
    const provider = modelString.substring(0, lastSlashIndex);
    const modelId = modelString.substring(lastSlashIndex + 1);
    
    if (provider && modelId) {
      return {
        provider,
        modelId,
      };
    }
  }
  
  // No slash or invalid format
  return {
    provider: null,
    modelId: modelString,
  };
}

/**
 * Type guard to check if a string is a valid OpenAI-compatible model ID
 */
export function isValidModelId(modelId: string): modelId is OpenAICompatibleModelId {
  const { provider } = parseModelString(modelId);
  return provider !== null && isProviderRegistered(provider);
}
`;

  // Write the generated file
  const outputPath = path.join(__dirname, '..', 'src', 'llm', 'model', 'provider-registry.generated.ts');
  await fs.writeFile(outputPath, output, 'utf-8');

  console.log(`✅ Generated provider registry at: ${outputPath}`);
  console.log(`\nRegistered providers:`);

  for (const [providerId, config] of Object.entries(allProviders)) {
    console.log(`  - ${providerId}: ${config.name} (${config.models.length} models)`);
  }
}

// Main execution
async function main() {
  // Configure which gateways to use
  const gateways: MastraModelGateway[] = [new ModelsDevGateway(), new NetlifyGateway()];

  await generateProviderRegistry(gateways);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Failed to generate provider registry:', error);
    process.exit(1);
  });
}
