import type {
  ActivateAgentVersionResponse,
  ListAgentVersionsResponse,
  StoredAgentResponse,
  VersionLabelApiError,
} from '@mastra/client-js';

/**
 * Minimal stored-agent record returned by `POST /stored/agents` when Studio
 * creates the first override for a code-defined agent. Only the required shape
 * of `StoredAgentResponse` is populated — the create mutation's onSuccess
 * handler only reads `id`.
 */
export const createdCodeAgent: StoredAgentResponse = {
  id: 'code-override-editable',
  status: 'draft',
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
  name: 'Code Override Editable',
  instructions: 'Original code instructions for editable override agent.',
  model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
};

/** Existing server state observed immediately before moving production. */
export const publishedCodeAgent: StoredAgentResponse = {
  ...createdCodeAgent,
  status: 'published',
  activeVersionId: 'version-active',
};

export const activatedVersion: ActivateAgentVersionResponse = {
  success: true,
  message: 'Version activated',
  activeVersionId: 'version-target',
};

export const productionMoveConflict: VersionLabelApiError = {
  error: {
    code: 'LABEL_MOVE_CONFLICT',
    message: 'Production changed after it was read.',
    details: {
      label: 'production',
      expectedActiveVersionId: 'version-active',
      currentActiveVersionId: 'version-concurrent',
    },
  },
};

/** No override has been saved yet for a code-defined agent. */
export const noAgentVersions: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 0,
  perPage: 20,
  hasMore: false,
};

/** The first override version, created by the save and left unpublished. */
export const oneUnpublishedAgentVersion: ListAgentVersionsResponse = {
  ...noAgentVersions,
  versions: [
    {
      id: 'version-1',
      agentId: 'code-override-editable',
      versionNumber: 1,
      name: 'Code Override Editable',
      instructions: 'User edited prompt',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      createdAt: '2026-06-16T00:00:01.000Z',
    },
  ],
  total: 1,
};

/** A newer draft exists while production still points at `version-active`. */
export const latestDraftAgentVersion: ListAgentVersionsResponse = {
  ...oneUnpublishedAgentVersion,
  versions: [
    {
      ...oneUnpublishedAgentVersion.versions[0],
      id: 'version-target',
      versionNumber: 2,
      createdAt: '2026-06-16T00:00:02.000Z',
    },
  ],
};
