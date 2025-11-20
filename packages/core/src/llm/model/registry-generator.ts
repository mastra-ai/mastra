/**
 * Shared provider registry generation logic
 * Used by both the CLI generation script and runtime refresh
 */

import fs from 'fs/promises';
import path from 'path';
import type { MastraModelGateway, ProviderConfig } from './gateways/base.js';

/**
 * Fetch providers from all gateways with retry logic
 * @param gateways - Array of gateway instances to fetch from
 * @returns Object containing providers and models records
 */
export async function fetchProvidersFromGateways(
  gateways: MastraModelGateway[],
): Promise<{ providers: Record<string, ProviderConfig>; models: Record<string, string[]> }> {
  const allProviders: Record<string, ProviderConfig> = {};
  const allModels: Record<string, string[]> = {};

  const maxRetries = 3;

  for (const gateway of gateways) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const providers = await gateway.fetchProviders();
        const gatewayPrefix = gateway.prefix;

        for (const [providerId, config] of Object.entries(providers)) {
          // If gateway has a prefix, prepend it to the provider ID for type generation
          // This creates paths like: prefix/provider/model
          const typeProviderId = gatewayPrefix ? `${gatewayPrefix}/${providerId}` : providerId;

          allProviders[typeProviderId] = config;
          // Sort models alphabetically for consistent ordering
          allModels[typeProviderId] = config.models.sort();
        }

        lastError = null;
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // If all retries failed, throw the last error
    if (lastError) {
      throw lastError;
    }
  }

  return { providers: allProviders, models: allModels };
}

/**
 * Generate TypeScript type definitions content
 * @param models - Record of provider IDs to model arrays
 * @returns Generated TypeScript type definitions as a string
 */
export function generateTypesContent(models: Record<string, string[]>): string {
  const providerModelsEntries = Object.entries(models)
    .map(([provider, modelList]) => {
      const modelsList = modelList.map(m => `'${m}'`);

      // Only quote provider key if it contains special characters (like dashes)
      const needsQuotes = /[^a-zA-Z0-9_$]/.test(provider);
      const providerKey = needsQuotes ? `'${provider}'` : provider;

      // Format array based on length (prettier printWidth: 120)
      const singleLine = `  readonly ${providerKey}: readonly [${modelsList.join(', ')}];`;

      // If single line exceeds 120 chars, format as multi-line
      if (singleLine.length > 120) {
        const formattedModels = modelList.map(m => `    '${m}',`).join('\n');
        return `  readonly ${providerKey}: readonly [\n${formattedModels}\n  ];`;
      }

      return singleLine;
    })
    .join('\n');

  return `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 * Generated from model gateway providers
 */

/**
 * Provider models mapping type
 * This is derived from the JSON data and provides type-safe access
 */
export type ProviderModelsMap = {
${providerModelsEntries}
};

/**
 * Union type of all registered provider IDs
 */
export type Provider = keyof ProviderModelsMap;

/**
 * Provider models mapping interface
 */
export interface ProviderModels {
  [key: string]: string[];
}

/**
 * OpenAI-compatible model ID type
 * Dynamically derived from ProviderModelsMap
 * Full provider/model paths (e.g., "openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022")
 */
export type ModelRouterModelId =
  | {
      [P in Provider]: \`\${P}/\${ProviderModelsMap[P][number]}\`;
    }[Provider]
  | (string & {});

/**
 * Extract the model part from a ModelRouterModelId for a specific provider
 * Dynamically derived from ProviderModelsMap
 * Example: ModelForProvider<'openai'> = 'gpt-4o' | 'gpt-4-turbo' | ...
 */
export type ModelForProvider<P extends Provider> = ProviderModelsMap[P][number];
`;
}

/**
 * Write registry files to disk (JSON and .d.ts)
 * @param jsonPath - Path to write the JSON file
 * @param typesPath - Path to write the .d.ts file
 * @param providers - Provider configurations
 * @param models - Model lists by provider
 */
export async function writeRegistryFiles(
  jsonPath: string,
  typesPath: string,
  providers: Record<string, ProviderConfig>,
  models: Record<string, string[]>,
): Promise<void> {
  // 0. Ensure directories exist
  const jsonDir = path.dirname(jsonPath);
  const typesDir = path.dirname(typesPath);
  await fs.mkdir(jsonDir, { recursive: true });
  await fs.mkdir(typesDir, { recursive: true });

  // 1. Write JSON file
  const registryData = {
    providers,
    models,
    version: '1.0.0',
  };

  await fs.writeFile(jsonPath, JSON.stringify(registryData, null, 2), 'utf-8');

  // 2. Generate .d.ts file with type-only declarations
  const typeContent = generateTypesContent(models);
  await fs.writeFile(typesPath, typeContent, 'utf-8');
}
