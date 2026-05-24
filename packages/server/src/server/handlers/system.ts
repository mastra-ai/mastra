import { readFileSync } from 'node:fs';

import { ObservabilityStorage } from '@mastra/core/storage';

import type { MastraPackage, SystemPackagesResponse } from '../schemas/system';
import {
  apiSchemaManifestResponseSchema,
  observabilityStorageCapabilitiesSchema,
  systemPackagesResponseSchema,
} from '../schemas/system';
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

function getObservabilityStorageCapabilities(
  observabilityStorage: unknown,
): SystemPackagesResponse['observabilityStorageCapabilities'] {
  const candidate = observabilityStorage as { getCapabilities?: () => unknown } | undefined;
  if (typeof candidate?.getCapabilities !== 'function') {
    return undefined;
  }

  let owner = Object.prototype.hasOwnProperty.call(candidate, 'getCapabilities')
    ? candidate
    : Object.getPrototypeOf(candidate);
  while (owner && owner !== Object.prototype && !Object.prototype.hasOwnProperty.call(owner, 'getCapabilities')) {
    owner = Object.getPrototypeOf(owner);
  }
  if (!owner || owner === Object.prototype || owner === ObservabilityStorage.prototype) {
    return undefined;
  }

  try {
    const result = observabilityStorageCapabilitiesSchema.safeParse(candidate.getCapabilities());
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

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
      const observabilityStorageCapabilities = getObservabilityStorageCapabilities(observabilityStorage);
      const observabilityEnabled = !!mastra.observability.getDefaultInstance();

      return {
        packages,
        isDev: process.env.MASTRA_DEV === 'true',
        cmsEnabled: !!mastra.getEditor(),
        observabilityEnabled,
        storageType,
        observabilityStorageType,
        observabilityRuntimeStrategy,
        ...(observabilityStorageCapabilities ? { observabilityStorageCapabilities } : {}),
      };
    } catch (error) {
      return handleError(error, 'Error getting system packages');
    }
  },
});
