import type { BuilderSettingsResponse } from '@mastra/client-js';

export const builderSettingsWithPolicy: BuilderSettingsResponse = {
  enabled: true,
  features: {
    agent: {
      tools: true,
      agents: false,
      workflows: true,
      scorers: true,
      skills: true,
      memory: false,
      variables: true,
      favorites: true,
      avatarUpload: false,
      browser: true,
      model: true,
    },
  },
  configuration: {
    agent: {
      browser: { enabled: true },
    },
  },
  modelPolicy: { active: false },
  picker: {
    visibleTools: ['weatherTool'],
    visibleAgents: null,
    visibleWorkflows: [],
  },
  modelPolicyWarnings: ['Unknown picker id: missingWorkflow'],
};

export const disabledBuilderSettings: BuilderSettingsResponse = {
  enabled: false,
  modelPolicy: { active: false },
};
