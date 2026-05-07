import { readFileSync } from 'node:fs';

import type { MastraPackage } from '../schemas/system';
import { apiSchemaManifestResponseSchema, systemPackagesResponseSchema } from '../schemas/system';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

export const GET_API_SCHEMA_ROUTE = createRoute({
  method: 'GET',
  path: '/system/api-schema',
  responseType: 'json',
  responseSchema: apiSchemaManifestResponseSchema,
  summary: 'Get API schema manifest',
  description: 'Returns the route-contract-derived API schema manifest for the machine-readable CLI',
  tags: ['System'],
  requiresAuth: true,
  handler: async () => {
    // Dynamic import to avoid circular dependency issues
    const { buildApiSchemaManifest } = await import('../server-adapter/api-schema-manifest');
    return buildApiSchemaManifest();
  },
});

export const GET_SYSTEM_PACKAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/system/packages',
  responseType: 'json',
  responseSchema: systemPackagesResponseSchema,
  summary: 'Get installed Mastra packages',
  description: 'Returns a list of all installed Mastra packages and their versions from the project',
  tags: ['System'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const packagesFilePath = process.env.MASTRA_PACKAGES_FILE;

      let packages: MastraPackage[] = [];

      if (packagesFilePath) {
        try {
          const fileContent = readFileSync(packagesFilePath, 'utf-8');
          packages = JSON.parse(fileContent);
        } catch {
          packages = [];
        }
      }

      const storage = mastra.getStorage();
      const storageType = storage?.name;
      const observabilityStorage = storage?.stores?.observability;
      const observabilityStorageType = observabilityStorage?.constructor.name;
      const observabilityRuntimeStrategy = observabilityStorage?.runtimeTracingStrategy;
      const observabilityEnabled = !!mastra.observability.getDefaultInstance();

      return {
        packages,
        isDev: process.env.MASTRA_DEV === 'true',
        cmsEnabled: !!mastra.getEditor(),
        observabilityEnabled,
        storageType,
        observabilityStorageType,
        observabilityRuntimeStrategy,
      };
    } catch (error) {
      return handleError(error, 'Error getting system packages');
    }
  },
});
