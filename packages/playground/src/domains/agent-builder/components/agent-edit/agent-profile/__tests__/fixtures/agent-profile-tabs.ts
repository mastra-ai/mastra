import type {
  BuilderAgentFeatures,
  BuilderAvailableModelsResponse,
  BuilderSettingsResponse,
  ChannelPlatformInfo,
  ListToolProvidersResponse,
  StoredSkillResponse,
} from '@mastra/client-js';

import type { AgentTool } from '../../../../../types/agent-tool';

export const allAgentFeatures: BuilderAgentFeatures = {
  tools: true,
  memory: true,
  workflows: true,
  agents: true,
  skills: true,
  avatarUpload: true,
  model: true,
  favorites: true,
  browser: false,
};

export const makeBuilderSettings = (
  agent: BuilderAgentFeatures = allAgentFeatures,
  modelPolicy: BuilderSettingsResponse['modelPolicy'] = { active: false },
): BuilderSettingsResponse => ({
  enabled: true,
  features: { agent },
  modelPolicy,
});

export const noToolProviders: ListToolProvidersResponse = { providers: [] };

export const noBuilderModels: BuilderAvailableModelsResponse = { providers: [] };

export const openaiBuilderModels: BuilderAvailableModelsResponse = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
      connected: true,
      models: ['gpt-5-mini'],
    },
  ],
};

export const slackConfigured: ChannelPlatformInfo[] = [{ id: 'slack', name: 'Slack', isConfigured: true }];

export const slackUnconfigured: ChannelPlatformInfo[] = [{ id: 'slack', name: 'Slack', isConfigured: false }];

export const nativeTool: AgentTool = { id: 'tool-a', name: 'tool-a', isChecked: false, type: 'tool' };

export const storedSkill: StoredSkillResponse = {
  id: 'skill-a',
  name: 'skill-a',
  status: 'published',
  instructions: 'Do the thing.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
