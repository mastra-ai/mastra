import type {
  BuilderSettingsResponse,
  ChannelPlatformInfo,
  ListStoredWorkspacesResponse,
  StoredAgentResponse,
} from '@mastra/client-js';

import type { AuthCapabilities, CurrentUser } from '@/domains/auth/types';

export const TEST_AGENT_ID = 'agent_test';

/**
 * `GET /api/editor/builder/settings` fixture. All agent features are off by
 * default so the wizard resolves the minimal onboarding tree
 * (ready > identity > instructions > library > [integrations] > end).
 */
export const buildBuilderSettings = (overrides?: Partial<BuilderSettingsResponse>): BuilderSettingsResponse => ({
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
    },
  },
  ...overrides,
});

export const buildStoredAgent = (overrides?: Partial<StoredAgentResponse>): StoredAgentResponse => ({
  id: TEST_AGENT_ID,
  status: 'draft',
  visibility: 'private',
  authorId: 'user-1',
  createdAt: '2026-04-29T10:00:00.000Z',
  updatedAt: '2026-04-29T10:00:00.000Z',
  name: 'Test agent',
  description: 'A test agent',
  instructions: 'Be helpful.',
  model: { provider: 'openai', name: 'test-model' },
  ...overrides,
});

/** Authenticated, RBAC off — all permission checks pass. */
export const authCapabilities: AuthCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: false, sso: false, rbac: false, acl: false },
  access: null,
};

export const currentUser: CurrentUser = { id: 'user-1' };

export const emptyWorkspaces: ListStoredWorkspacesResponse = {
  workspaces: [],
  total: 0,
  page: 1,
  perPage: 50,
  hasMore: false,
};

export const noPlatforms: ChannelPlatformInfo[] = [];

/** A configured integration keeps the `integrations` step after `library`. */
export const configuredSlackPlatform: ChannelPlatformInfo[] = [{ id: 'slack', name: 'Slack', isConfigured: true }];
