/**
 * Shared provider registry generation logic
 * Used by both the CLI generation script and runtime refresh
 */

import fs from 'fs/promises';
import path from 'path';
import type { MastraModelGateway, ProviderConfig } from './gateways/base.js';

/**
 * Write a file atomically using the write-to-temp-then-rename pattern.
 * This prevents file corruption when multiple processes write to the same file concurrently.
 *
 * The rename operation is atomic on POSIX systems when source and destination
 * are on the same filesystem.
 *
 * @param filePath - The target file path
 * @param content - The content to write
 * @param encoding - The encoding to use (default: 'utf-8')
 */
export async function atomicWriteFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf-8',
): Promise<void> {
  // Create a unique temp file name using PID, timestamp, and random suffix to avoid collisions
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`;

  try {
    // Write to temp file first
    await fs.writeFile(tempPath, content, encoding);

    // Atomically rename temp file to target path
    // This is atomic on POSIX when both paths are on the same filesystem
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

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

        // models.dev is a provider registry, not a true gateway - don't prefix its providers
        const isProviderRegistry = gateway.id === 'models.dev';

        for (const [providerId, config] of Object.entries(providers)) {
          // For true gateways, use gateway.id as prefix (e.g., "netlify/anthropic")
          // Special case: if providerId matches gateway.id, it's a unified gateway (e.g., netlify returning {netlify: {...}})
          // In this case, use just the gateway ID to avoid duplication (netlify, not netlify/netlify)
          const typeProviderId = isProviderRegistry
            ? providerId
            : providerId === gateway.id
              ? gateway.id
              : `${gateway.id}/${providerId}`;

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

  // 1. Write JSON file atomically to prevent corruption from concurrent writes
  const registryData = {
    providers,
    models,
    version: '1.0.0',
  };

  await atomicWriteFile(jsonPath, JSON.stringify(registryData, null, 2), 'utf-8');

  // 2. Generate .d.ts file with type-only declarations (also atomic)
  const typeContent = generateTypesContent(models);
  await atomicWriteFile(typesPath, typeContent, 'utf-8');
}
