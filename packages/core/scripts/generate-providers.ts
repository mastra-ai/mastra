import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MastraModelGateway, ProviderConfig } from '../src/llm/model/gateways/index.js';
import { ModelsDevGateway } from '../src/llm/model/gateways/models-dev.js';
import { NetlifyGateway } from '../src/llm/model/gateways/netlify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fetch provider data from all configured gateways
 * @param gateways - Array of gateway instances to fetch from
 * @param maxRetries - Maximum number of retries per gateway (default: 3)
 * @returns Object containing providers and models
 */
export async function fetchProvidersFromGateways(
  gateways: MastraModelGateway[],
  maxRetries = 3,
): Promise<{ providers: Record<string, ProviderConfig>; models: Record<string, string[]> }> {
  const allProviders: Record<string, ProviderConfig> = {};
  const allModels: Record<string, string[]> = {};

  for (const gateway of gateways) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.debug(`Fetching from gateway ${gateway.name} (attempt ${attempt}/${maxRetries})...`);
        const providers = await gateway.fetchProviders();

        for (const [providerId, config] of Object.entries(providers)) {
          allProviders[providerId] = config;
          // Sort models alphabetically for consistent ordering
          allModels[providerId] = config.models.sort();
        }

        console.debug(`✅ Successfully fetched from gateway ${gateway.name}`);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.debug(`❌ Failed to fetch from gateway ${gateway.name} (attempt ${attempt}/${maxRetries}):`, error);

        if (attempt === maxRetries) {
          console.error(`Failed to fetch from gateway ${gateway.name} after ${maxRetries} attempts:`, lastError);
          throw lastError;
        }

        // Wait before retrying (exponential backoff: 1s, 2s, 4s)
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.debug(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { providers: allProviders, models: allModels };
}

/**
 * Generate the content for the .d.ts type file
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
 * @param models - Model mappings
 */
export async function writeRegistryFiles(
  jsonPath: string,
  typesPath: string,
  providers: Record<string, ProviderConfig>,
  models: Record<string, string[]>,
): Promise<void> {
  // 1. Write JSON file
  const registryData = {
    providers,
    models,
    version: '1.0.0',
  };

  await fs.writeFile(jsonPath, JSON.stringify(registryData, null, 2), 'utf-8');
  console.debug(`✅ Generated provider registry JSON at: ${jsonPath}`);

  // 2. Write .d.ts file
  const typeContent = generateTypesContent(models);
  await fs.writeFile(typesPath, typeContent, 'utf-8');
  console.debug(`✅ Generated provider types at: ${typesPath}`);
}

async function generateProviderRegistry(gateways: MastraModelGateway[]) {
  // Fetch providers from all gateways
  const { providers, models } = await fetchProvidersFromGateways(gateways);

  // Write registry files to disk
  const outputDir = path.join(__dirname, '..', 'src', 'llm', 'model');
  const jsonPath = path.join(outputDir, 'provider-registry.json');
  const typesPath = path.join(outputDir, 'provider-types.generated.d.ts');
  await writeRegistryFiles(jsonPath, typesPath, providers, models);

  // Log summary
  console.info(`\nRegistered providers:`);
  for (const [providerId, config] of Object.entries(providers)) {
    console.info(`  - ${providerId}: ${config.name} (${config.models.length} models)`);
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
