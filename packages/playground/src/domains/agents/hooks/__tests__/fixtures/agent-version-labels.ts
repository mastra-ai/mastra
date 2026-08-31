import type {
  ActivateAgentVersionResponse,
  AgentVersionLabel,
  DeleteAgentVersionLabelResponse,
  GetAgentResponse,
  ListAgentVersionLabelsResponse,
  StoredAgentResponse,
  VersionLabelApiError,
} from '@mastra/client-js';

export const cachedResolvedAgent: GetAgentResponse = {
  id: 'agent-1',
  name: 'Versioned agent',
  instructions: 'Use the selected release channel.',
  tools: {},
  workflows: {},
  agents: {},
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  modelVersion: 'v2',
  modelList: undefined,
  defaultOptions: {},
  defaultGenerateOptionsLegacy: {},
  defaultStreamOptionsLegacy: {},
  source: 'stored',
};

export const cachedStoredAgent: StoredAgentResponse = {
  id: 'agent-1',
  status: 'published',
  activeVersionId: 'version-10',
  createdAt: '2026-08-30T11:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
  name: 'Versioned agent',
  instructions: 'Use the selected release channel.',
  model: { provider: 'openai', name: 'gpt-4o-mini' },
};

export const productionLabel: AgentVersionLabel = {
  name: 'production',
  kind: 'production',
  versionId: 'version-10',
  versionNumber: 10,
};

export const previewLabel: AgentVersionLabel = {
  name: 'preview',
  kind: 'custom',
  versionId: 'version-12',
  versionNumber: 12,
  revisionToken: 'revision-preview-1',
  updatedAt: '2026-08-30T12:00:00.000Z',
};

export const latestLabel: AgentVersionLabel = {
  name: 'latest',
  kind: 'latest',
  versionId: 'version-12',
  versionNumber: 12,
};

export const firstLabelPage: ListAgentVersionLabelsResponse = {
  labels: [productionLabel, previewLabel],
  pagination: {
    total: 3,
    page: 0,
    perPage: 2,
    hasMore: true,
  },
};

export const secondLabelPageWithDuplicate: ListAgentVersionLabelsResponse = {
  labels: [previewLabel, latestLabel],
  pagination: {
    total: 3,
    page: 1,
    perPage: 2,
    hasMore: false,
  },
};

export const setPreviewLabelResponse: AgentVersionLabel = {
  ...previewLabel,
  revisionToken: 'revision-preview-2',
};

export const deletePreviewLabelResponse: DeleteAgentVersionLabelResponse = {
  success: true,
  deleted: true,
};

export const activateVersionResponse: ActivateAgentVersionResponse = {
  success: true,
  message: 'Version activated',
  activeVersionId: 'version-12',
};

export const unsupportedVersionLabelsError: VersionLabelApiError = {
  error: {
    code: 'VERSION_LABELS_UNSUPPORTED',
    message: 'Version labels are unsupported by this storage adapter',
  },
};

export const labelMoveConflictError: VersionLabelApiError = {
  error: {
    code: 'LABEL_MOVE_CONFLICT',
    message: 'The label moved after it was read',
    details: {
      currentVersionId: 'version-11',
      currentRevisionToken: 'revision-preview-2',
    },
  },
};

export const versionNotFoundError: VersionLabelApiError = {
  error: {
    code: 'VERSION_NOT_FOUND',
    message: 'The selected version no longer exists',
  },
};

export const entityNotFoundError: VersionLabelApiError = {
  error: {
    code: 'ENTITY_NOT_FOUND',
    message: 'The selected agent no longer exists or is inaccessible',
  },
};

export const labelNotFoundError: VersionLabelApiError = {
  error: {
    code: 'LABEL_NOT_FOUND',
    message: 'The selected label no longer exists',
  },
};
