import type { BuilderAgentFeatures, BuilderSettingsResponse } from '@mastra/client-js';

const ALL_FEATURES_ON: BuilderAgentFeatures = {
  tools: true,
  memory: true,
  workflows: true,
  agents: true,
  avatarUpload: true,
  skills: true,
  model: true,
  favorites: true,
  browser: true,
};

/**
 * Build a typed `GET /editor/builder/settings` response. Defaults to a fully
 * enabled builder with every agent feature on, an active model policy, and an
 * explicit picker allowlist. Override any slice for a given scenario.
 */
export const buildBuilderSettings = (overrides: Partial<BuilderSettingsResponse> = {}): BuilderSettingsResponse => ({
  enabled: true,
  features: { agent: { ...ALL_FEATURES_ON } },
  modelPolicy: {
    active: true,
    allowed: [{ provider: 'openai', modelId: 'gpt-4o' }],
    default: { provider: 'openai', modelId: 'gpt-4o' },
  },
  picker: {
    visibleTools: ['tool-a', 'tool-b'],
    visibleAgents: ['agent-a'],
    visibleWorkflows: ['workflow-a', 'workflow-b'],
  },
  ...overrides,
});
