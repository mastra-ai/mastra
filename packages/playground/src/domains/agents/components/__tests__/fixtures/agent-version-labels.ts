import type {
  ActivateAgentVersionResponse,
  AgentVersionLabel,
  DeleteAgentVersionLabelResponse,
  GetSystemPackagesResponse,
  ListAgentVersionLabelsResponse,
  ListAgentVersionsResponse,
  VersionLabelApiError,
} from '@mastra/client-js';

import type { AuthCapabilities } from '@/domains/auth/types';

export const AGENT_VERSION_LABELS_AGENT_ID = 'agent-version-labels';
export const LABELED_VERSION_ID = 'version-3';

type AgentVersionListItem = ListAgentVersionsResponse['versions'][number];

function createVersion({
  id,
  versionNumber,
  labels,
}: {
  id: string;
  versionNumber: number;
  labels: string[];
}): AgentVersionListItem {
  return {
    id,
    agentId: AGENT_VERSION_LABELS_AGENT_ID,
    versionNumber,
    name: 'Release assistant',
    instructions: 'Help operators prepare a release.',
    model: { provider: 'openai', name: 'gpt-4o-mini' },
    changeMessage: `Release snapshot ${versionNumber}`,
    createdAt: `2026-08-${20 + versionNumber}T12:00:00.000Z`,
    labels,
  };
}

export const unorderedVersionLabels: ListAgentVersionsResponse = {
  versions: [
    createVersion({
      id: LABELED_VERSION_ID,
      versionNumber: 3,
      labels: ['zeta', 'latest', 'production', 'alpha'],
    }),
    createVersion({ id: 'version-2', versionNumber: 2, labels: ['preview'] }),
  ],
  total: 2,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const overflowingVersionLabels: ListAgentVersionsResponse = {
  versions: [
    createVersion({
      id: LABELED_VERSION_ID,
      versionNumber: 3,
      labels: ['zulu', 'latest', 'gamma', 'beta', 'production', 'alpha'],
    }),
  ],
  total: 1,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const duplicateVersionLabels: ListAgentVersionsResponse = {
  versions: [
    createVersion({
      id: LABELED_VERSION_ID,
      versionNumber: 3,
      labels: ['latest', 'alpha', 'production', 'beta', 'alpha', 'latest', 'production'],
    }),
  ],
  total: 1,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const unlabeledVersionHistory: ListAgentVersionsResponse = {
  versions: [createVersion({ id: LABELED_VERSION_ID, versionNumber: 3, labels: [] })],
  total: 1,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const customOnlyOverflowVersionLabels: ListAgentVersionsResponse = {
  versions: [
    createVersion({
      id: LABELED_VERSION_ID,
      versionNumber: 3,
      labels: ['echo', 'delta', 'charlie', 'bravo', 'alpha'],
    }),
  ],
  total: 1,
  page: 1,
  perPage: 20,
  hasMore: false,
};

const baseSystemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: true,
  observabilityEnabled: false,
};

export const unsupportedVersionLabelPackages: GetSystemPackagesResponse = baseSystemPackages;

export const readableVersionLabelPackages: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  storageCapabilities: {
    versionLabels: {
      entityTypes: {
        agent: {
          read: true,
          write: false,
          compareAndSwap: false,
          retentionProtection: true,
        },
      },
    },
  },
};

export const mutableVersionLabelPackages: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  storageCapabilities: {
    versionLabels: {
      entityTypes: {
        agent: {
          read: true,
          write: true,
          compareAndSwap: true,
          retentionProtection: true,
        },
      },
    },
  },
};

export const sourceProviderVersionLabelPackages: GetSystemPackagesResponse = {
  ...mutableVersionLabelPackages,
  editorSourceCapabilities: {
    source: 'code',
    storage: 'source-provider',
    provider: { id: 'github', displayName: 'GitHub' },
    canSave: true,
    canOpenChangeRequest: true,
  },
};

export const versionLabelReaderCapabilities: AuthCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'reader-1' },
  capabilities: {
    user: true,
    session: true,
    sso: false,
    rbac: true,
    acl: false,
  },
  access: {
    roles: ['reader'],
    permissions: [`stored-agents:read:${AGENT_VERSION_LABELS_AGENT_ID}`],
  },
};

export const versionLabelNonReaderCapabilities: AuthCapabilities = {
  ...versionLabelReaderCapabilities,
  access: {
    roles: ['executor'],
    permissions: [`agents:execute:${AGENT_VERSION_LABELS_AGENT_ID}`],
  },
};

export const versionLabelPublisherCapabilities: AuthCapabilities = {
  ...versionLabelReaderCapabilities,
  user: { id: 'publisher-1' },
  access: {
    roles: ['publisher'],
    permissions: [
      `stored-agents:read:${AGENT_VERSION_LABELS_AGENT_ID}`,
      `stored-agents:publish:${AGENT_VERSION_LABELS_AGENT_ID}`,
    ],
  },
};

export const mutationVersionHistory: ListAgentVersionsResponse = {
  versions: [
    createVersion({ id: 'version-3', versionNumber: 3, labels: ['latest'] }),
    createVersion({ id: 'version-2', versionNumber: 2, labels: ['production'] }),
    createVersion({ id: 'version-1', versionNumber: 1, labels: ['preview'] }),
  ],
  total: 3,
  page: 1,
  perPage: 20,
  hasMore: false,
};

const createPaginatedVersion = (versionNumber: number, labels: string[] = []): AgentVersionListItem => ({
  id: `version-${versionNumber}`,
  agentId: AGENT_VERSION_LABELS_AGENT_ID,
  versionNumber,
  name: 'Release assistant',
  instructions: 'Help operators prepare a release.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
  changeMessage: `Release snapshot ${versionNumber}`,
  createdAt: `2026-08-30T12:${String(versionNumber).padStart(2, '0')}:00.000Z`,
  labels,
});

const paginatedVersionHistory = Array.from({ length: 25 }, (_, index) => {
  const versionNumber = 25 - index;
  const labels = versionNumber === 25 ? ['latest'] : versionNumber === 5 ? ['production'] : [];
  return createPaginatedVersion(versionNumber, labels);
});

export const firstMutationVersionPage: ListAgentVersionsResponse = {
  versions: paginatedVersionHistory.slice(0, 20),
  total: 25,
  page: 0,
  perPage: 20,
  hasMore: true,
};

export const secondMutationVersionPage: ListAgentVersionsResponse = {
  versions: paginatedVersionHistory.slice(20),
  total: 25,
  page: 1,
  perPage: 20,
  hasMore: false,
};

export const concurrentSecondMutationVersionPage: ListAgentVersionsResponse = {
  ...secondMutationVersionPage,
  versions: secondMutationVersionPage.versions.map(version => ({
    ...version,
    labels: version.versionNumber === 1 ? ['production'] : version.labels.filter(label => label !== 'production'),
  })),
};

export const mutableManagerVersionLabels: ListAgentVersionLabelsResponse = {
  labels: [
    {
      name: 'latest',
      kind: 'latest',
      versionId: 'version-3',
      versionNumber: 3,
    },
    {
      name: 'preview',
      kind: 'custom',
      versionId: 'version-1',
      versionNumber: 1,
      revisionToken: 'preview-revision-1',
      updatedAt: '2026-08-30T12:00:00.000Z',
    },
    {
      name: 'production',
      kind: 'production',
      versionId: 'version-2',
      versionNumber: 2,
    },
  ],
  pagination: {
    total: 3,
    page: 0,
    perPage: 50,
    hasMore: false,
  },
};

export const movedPreviewVersionLabels: ListAgentVersionLabelsResponse = {
  ...mutableManagerVersionLabels,
  labels: mutableManagerVersionLabels.labels.map(label =>
    label.name === 'preview'
      ? {
          ...label,
          versionId: 'version-2',
          versionNumber: 2,
          revisionToken: 'preview-revision-2',
        }
      : label,
  ),
};

export const recreatedPreviewVersionLabels: ListAgentVersionLabelsResponse = {
  ...mutableManagerVersionLabels,
  labels: mutableManagerVersionLabels.labels.map(label =>
    label.name === 'preview'
      ? {
          ...label,
          versionId: 'version-3',
          versionNumber: 3,
          revisionToken: 'preview-recreated-revision',
        }
      : label,
  ),
};

export const createdPrLabel: AgentVersionLabel = {
  name: 'pr-101',
  kind: 'custom',
  versionId: 'version-3',
  versionNumber: 3,
  revisionToken: 'pr-101-revision-1',
  updatedAt: '2026-08-30T13:00:00.000Z',
};

export const deletedPreviewLabel: DeleteAgentVersionLabelResponse = {
  success: true,
  deleted: true,
};

export const activatedVersionThree: ActivateAgentVersionResponse = {
  success: true,
  message: 'Version 3 is now active',
  activeVersionId: 'version-3',
};

export const managerVersionLabels: ListAgentVersionLabelsResponse = {
  labels: [
    {
      name: 'latest',
      kind: 'latest',
      versionId: LABELED_VERSION_ID,
      versionNumber: 3,
    },
    {
      name: 'preview',
      kind: 'custom',
      versionId: 'version-2-with-an-immutable-identifier',
      versionNumber: 2,
      revisionToken: 'preview-revision-1',
      updatedAt: '2026-08-30T12:00:00.000Z',
    },
    {
      name: 'alpha',
      kind: 'custom',
      versionId: '1234567890123',
      versionNumber: 1,
    },
    {
      name: 'production',
      kind: 'production',
      versionId: LABELED_VERSION_ID,
      versionNumber: 3,
    },
  ],
  pagination: {
    total: 4,
    page: 0,
    perPage: 50,
    hasMore: false,
  },
};

export const emptyManagerVersionLabels: ListAgentVersionLabelsResponse = {
  labels: [],
  pagination: {
    total: 0,
    page: 0,
    perPage: 50,
    hasMore: false,
  },
};

export const managerVersionLabelsError: VersionLabelApiError = {
  error: {
    code: 'VERSION_LABEL_INTEGRITY_ERROR',
    message: 'Version labels could not be read safely',
  },
};

export const managerAgentMissingError: VersionLabelApiError = {
  error: {
    code: 'ENTITY_NOT_FOUND',
    message: 'The agent no longer exists or is inaccessible',
  },
};
