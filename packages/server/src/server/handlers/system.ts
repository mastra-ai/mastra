import { readFileSync } from 'node:fs';

import type { MastraPackage } from '../schemas/system';
import { systemPackagesResponseSchema } from '../schemas/system';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

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
      const observabilityStorageType = storage?.stores?.observability?.constructor.name;

      const agentBuilder = mastra.getAgentBuilder?.();
      let agentBuilderEnabled = false;
      let agentBuilderConfig: {
        enabledSections: string[];
        marketplace: {
          enabled: boolean;
          showAgents: boolean;
          showSkills: boolean;
          allowStarring: boolean;
          allowSharing: boolean;
        };
        configure: {
          allowSkillCreation: boolean;
          allowAppearance: boolean;
          allowAvatarUpload: boolean;
        };
        recents: { maxItems: number };
        hasDefaultMemoryConfig: boolean;
      } | null = null;

      if (agentBuilder) {
        try {
          const { isEEEnabled, isDevEnvironment, isFeatureEnabled } = await import('@mastra/core/auth/ee');
          // Match the server boot gate: EE must be enabled. In dev/test, the
          // carve-out applies; in production we additionally require that the
          // license explicitly lists the agent-builder feature.
          agentBuilderEnabled = isEEEnabled() && (isDevEnvironment() || isFeatureEnabled('agent-builder'));
        } catch {
          agentBuilderEnabled = false;
        }
        if (agentBuilderEnabled) {
          agentBuilderConfig = {
            enabledSections: agentBuilder.getEnabledSections() as string[],
            marketplace: agentBuilder.getMarketplaceConfig(),
            configure: agentBuilder.getConfigureConfig(),
            recents: agentBuilder.getRecentsConfig(),
            hasDefaultMemoryConfig: agentBuilder.getDefaultMemoryConfig?.() != null,
          };
        }
      }

      return {
        packages,
        isDev: process.env.MASTRA_DEV === 'true',
        cmsEnabled: !!mastra.getEditor(),
        agentBuilderEnabled,
        agentBuilderConfig,
        storageType,
        observabilityStorageType,
      };
    } catch (error) {
      return handleError(error, 'Error getting system packages');
    }
  },
});
