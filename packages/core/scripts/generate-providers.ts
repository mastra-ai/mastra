import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MastraModelGateway, ProviderConfig } from '../src/llm/model/gateways/index.js';
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
        allProviders[providerId] = config;
        allModels[providerId] = config.models;
      }
    } catch (error) {
      console.error(`Failed to fetch from gateway ${gateway.name}:`, error);
      throw error; // Fail the whole generation as requested
    }
  }

  // 1. Write JSON file
  const registryData = {
    providers: allProviders,
    models: allModels,
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
  };

  const jsonPath = path.join(__dirname, '..', 'src', 'llm', 'model', 'provider-registry.json');
  await fs.writeFile(jsonPath, JSON.stringify(registryData, null, 2), 'utf-8');

  console.info(`✅ Generated provider registry JSON at: ${jsonPath}`);

  // 2. Generate .d.ts file with type-only declarations
  // We generate the literal type from the JSON data structure
  const providerModelsEntries = Object.entries(allModels)
    .map(([provider, models]) => {
      const modelsList = models.map(m => `'${m}'`);

      // Only quote provider key if it contains special characters (like dashes)
      const needsQuotes = /[^a-zA-Z0-9_$]/.test(provider);
      const providerKey = needsQuotes ? `'${provider}'` : provider;

      // Format array based on length (prettier printWidth: 120)
      const singleLine = `  readonly ${providerKey}: readonly [${modelsList.join(', ')}];`;

      // If single line exceeds 120 chars, format as multi-line
      if (singleLine.length > 120) {
        const formattedModels = modelsList.map(m => `    ${m},`).join('\n');
        return `  readonly ${providerKey}: readonly [\n${formattedModels}\n  ];`;
      }

      return singleLine;
    })
    .join('\n');

  const typeContent = `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 * Generated from model gateway providers
 * Generated at: ${new Date().toISOString()}
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

  const typesPath = path.join(__dirname, '..', 'src', 'llm', 'model', 'provider-types.generated.d.ts');
  await fs.writeFile(typesPath, typeContent, 'utf-8');

  console.info(`✅ Generated provider types at: ${typesPath}`);
  console.info(`\nRegistered providers:`);

  for (const [providerId, config] of Object.entries(allProviders)) {
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
