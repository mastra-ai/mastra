import { readFileSync } from 'node:fs';

import type { MastraPackage } from '../schemas/system';
import { apiSchemaManifestResponseSchema, systemPackagesResponseSchema } from '../schemas/system';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

const SOURCE_PROVIDER_CAPABILITIES_TIMEOUT_MS = 3000;

/**
 * Default path of liveKitConnectionRoute() from @mastra/livekit — the exact route Studio's
 * voice call posts to. Change it in lockstep with that default and with Studio's
 * use-voice-call hook.
 */
const LIVEKIT_CONNECTION_DETAILS_PATH = '/voice/livekit/connection-details';

async function getSourceProviderCapabilities(
  getCapabilities: () => Promise<{
    canWrite: boolean;
    canOpenChangeRequest: boolean;
    reason?: string;
  }>,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getCapabilities(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Source provider capabilities timed out')),
          SOURCE_PROVIDER_CAPABILITIES_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function getEditorSourceCapabilities(editor: {
  getSource?: () => 'code' | 'db' | undefined;
  getSourceControlProvider?: () =>
    | {
        id: string;
        displayName: string;
        getCapabilities: () => Promise<{
          canWrite: boolean;
          canOpenChangeRequest: boolean;
          reason?: string;
        }>;
      }
    | undefined;
}) {
  const editorSource = editor.getSource?.();
  if (!editorSource) return undefined;

  if (editorSource === 'db') {
    return {
      source: editorSource,
      storage: 'database' as const,
      canSave: true,
      canOpenChangeRequest: false,
    };
  }

  const configuredProvider = editor.getSourceControlProvider?.();
  if (configuredProvider) {
    const provider = {
      id: configuredProvider.id,
      displayName: configuredProvider.displayName,
    };
    try {
      const capabilities = await getSourceProviderCapabilities(() => configuredProvider.getCapabilities());
      return {
        source: editorSource,
        storage: 'source-provider' as const,
        provider,
        canSave: capabilities.canWrite,
        canOpenChangeRequest: capabilities.canOpenChangeRequest,
        unavailableReason: capabilities.canWrite ? undefined : capabilities.reason,
      };
    } catch {
      return {
        source: editorSource,
        storage: 'source-provider' as const,
        provider,
        canSave: false,
        canOpenChangeRequest: false,
        unavailableReason: 'Unable to load source provider capabilities.',
      };
    }
  }

  const sourceProvider = process.env.MASTRA_SOURCE_PROVIDER;

  if (sourceProvider) {
    return {
      source: editorSource,
      storage: 'source-provider' as const,
      provider: {
        id: sourceProvider,
        displayName: process.env.MASTRA_SOURCE_PROVIDER_NAME || sourceProvider,
      },
      canSave: process.env.MASTRA_SOURCE_STORAGE_CAN_WRITE !== 'false',
      canOpenChangeRequest: process.env.MASTRA_SOURCE_STORAGE_CAN_OPEN_CHANGE_REQUEST === 'true',
    };
  }

  const isHosted =
    process.env.MASTRA_DEPLOYMENT_ID || process.env.MASTRA_CLOUD_API_ENDPOINT || process.env.MASTRA_PLATFORM_PROJECT_ID;

  if (isHosted) {
    return {
      source: editorSource,
      storage: 'unavailable' as const,
      canSave: false,
      canOpenChangeRequest: false,
      unavailableReason: 'Code-source editing requires a source provider in hosted Studio.',
    };
  }

  return {
    source: editorSource,
    storage: 'filesystem' as const,
    canSave: true,
    canOpenChangeRequest: false,
  };
}

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
  summary: 'Get installed Mastra packages and Studio capabilities',
  description: 'Returns installed Mastra packages and runtime capabilities used by Studio',
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
      const observabilityStorageFeatures = observabilityStorage?.getFeatures?.();
      const observabilityStorageCapabilities = observabilityStorageFeatures?.some(
        feature => feature === 'metrics' || feature === 'logs',
      )
        ? {
            metrics: observabilityStorageFeatures.includes('metrics'),
            logs: observabilityStorageFeatures.includes('logs'),
          }
        : undefined;
      const observabilityRuntimeStrategy = observabilityStorage?.runtimeTracingStrategy;
      const observabilityEnabled = !!mastra.observability.getDefaultInstance();

      const editor = mastra.getEditor();
      const editorSource = editor?.getSource?.();
      const editorSourceCapabilities = editor ? await getEditorSourceCapabilities(editor) : undefined;
      const liveKitConnectionRouteEnabled =
        mastra
          .getServer()
          ?.apiRoutes?.some(route => route.method === 'POST' && route.path === LIVEKIT_CONNECTION_DETAILS_PATH) ??
        false;

      return {
        packages,
        isDev: process.env.MASTRA_DEV === 'true',
        cmsEnabled: !!editor,
        liveKitConnectionRouteEnabled,
        editorSource,
        editorSourceCapabilities,
        observabilityEnabled,
        storageType,
        observabilityStorageType,
        ...(observabilityStorageCapabilities ? { observabilityStorageCapabilities } : {}),
        observabilityRuntimeStrategy,
      };
    } catch (error) {
      return handleError(error, 'Error getting system packages');
    }
  },
});
