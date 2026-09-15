import type { BuilderSettingsResponse } from '@mastra/client-js';

/**
 * `GET /api/editor/builder/settings` fixture. All agent features are off by
 * default; pass overrides to flip a specific feature (e.g. `browser`).
 */
export const buildBuilderSettings = (
  agentFeatures?: Partial<NonNullable<NonNullable<BuilderSettingsResponse['features']>['agent']>>,
): BuilderSettingsResponse => ({
  enabled: true,
  features: {
    agent: {
      tools: false,
      memory: false,
      workflows: false,
      agents: false,
      avatarUpload: false,
      skills: false,
      model: false,
      favorites: false,
      browser: false,
      ...agentFeatures,
    },
  },
});
