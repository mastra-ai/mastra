import type { ListAgentVersionsResponse } from '@mastra/client-js';

import type { AuthCapabilities } from '@/domains/auth/types';

export const VERSION_CONTROLS_AGENT_ID = 'version-controls-agent';
export const OLDER_VERSION_ID = 'version-1';
export const PRODUCTION_VERSION_ID = 'version-2';
export const NEWER_VERSION_ID = 'version-3';
export const PAGINATED_PRODUCTION_VERSION_ID = 'version-5';
export const PAGINATED_OLDER_VERSION_ID = 'version-4';

export const versionControlsPublisherCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'publisher-1' },
  capabilities: {
    user: true,
    session: true,
    sso: false,
    rbac: true,
    acl: false,
  },
  access: {
    roles: ['publisher'],
    permissions: [
      `stored-agents:read:${VERSION_CONTROLS_AGENT_ID}`,
      `stored-agents:publish:${VERSION_CONTROLS_AGENT_ID}`,
    ],
  },
} satisfies AuthCapabilities;

type AgentVersion = ListAgentVersionsResponse['versions'][number];

function createVersion(id: string, versionNumber: number): AgentVersion {
  return {
    id,
    agentId: VERSION_CONTROLS_AGENT_ID,
    versionNumber,
    name: 'Release assistant',
    instructions: 'Help operators prepare a release.',
    model: { provider: 'openai', name: 'gpt-4o-mini' },
    changeMessage: `Release snapshot ${versionNumber}`,
    createdAt: `2026-08-2${versionNumber}T12:00:00.000Z`,
    labels: [],
  };
}

export const versionControlsHistory: ListAgentVersionsResponse = {
  versions: [
    createVersion(NEWER_VERSION_ID, 3),
    createVersion(PRODUCTION_VERSION_ID, 2),
    createVersion(OLDER_VERSION_ID, 1),
  ],
  total: 3,
  page: 1,
  perPage: 20,
  hasMore: false,
};

const paginatedVersionControlsHistory = Array.from({ length: 25 }, (_, index) => {
  const versionNumber = 25 - index;
  return {
    ...createVersion(`version-${versionNumber}`, versionNumber),
    createdAt: `2026-08-30T12:${String(versionNumber).padStart(2, '0')}:00.000Z`,
    labels: versionNumber === 5 ? ['production'] : [],
  };
});

export const firstVersionControlsPage: ListAgentVersionsResponse = {
  versions: paginatedVersionControlsHistory.slice(0, 20),
  total: 25,
  page: 0,
  perPage: 20,
  hasMore: true,
};

export const secondVersionControlsPage: ListAgentVersionsResponse = {
  versions: paginatedVersionControlsHistory.slice(20),
  total: 25,
  page: 1,
  perPage: 20,
  hasMore: false,
};
