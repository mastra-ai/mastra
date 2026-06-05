import type {
  BuilderAvailableModelsResponse,
  BuilderSettingsResponse,
  GetAgentResponse,
  GetToolResponse,
  GetWorkflowResponse,
  ListStoredSkillsResponse,
} from '@mastra/client-js';

export const settingsAllFeatures: BuilderSettingsResponse = {
  enabled: true,
  features: {
    agent: {
      tools: true,
      agents: true,
      workflows: true,
      skills: true,
      memory: true,
      avatarUpload: true,
      model: true,
      favorites: true,
      browser: true,
    },
  },
};

export const settingsPartialFeatures: BuilderSettingsResponse = {
  enabled: true,
  features: {
    agent: {
      tools: true,
      agents: false,
      workflows: true,
      skills: false,
    },
  },
};

export const emptyAvailableModels: BuilderAvailableModelsResponse = {
  providers: [],
};

export const emptyAgents: Record<string, GetAgentResponse> = {};
export const emptyTools: Record<string, GetToolResponse> = {};
export const emptyWorkflows: Record<string, GetWorkflowResponse> = {};

export const emptyStoredSkills: ListStoredSkillsResponse = {
  skills: [],
  total: 0,
  page: 1,
  perPage: 50,
  hasMore: false,
};
