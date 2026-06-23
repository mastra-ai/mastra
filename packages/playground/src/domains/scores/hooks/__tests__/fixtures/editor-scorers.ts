import type {
  ActivateScorerVersionResponse,
  CompareScorerVersionsResponse,
  DeleteScorerVersionResponse,
  ListScorerVersionsResponse,
  ListStoredScorersResponse,
  ScorerVersionResponse,
  StoredScorerResponse,
} from '@mastra/client-js';

export const SCORER_ID = 'scorer-1';
export const SCORER_VERSION_ID = 'scorer-version-1';

export const makeStoredScorer = (overrides: Partial<StoredScorerResponse> = {}): StoredScorerResponse => ({
  id: overrides.id ?? SCORER_ID,
  status: overrides.status ?? 'draft',
  activeVersionId: overrides.activeVersionId ?? SCORER_VERSION_ID,
  authorId: overrides.authorId ?? 'user-1',
  metadata: overrides.metadata ?? { domain: 'editor' },
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  name: overrides.name ?? 'Answer Quality',
  description: overrides.description ?? 'Scores whether an answer is useful',
  type: overrides.type ?? 'llm-judge',
  model: overrides.model ?? { provider: 'openai', name: 'gpt-4o-mini' },
  instructions: overrides.instructions ?? 'Score the answer for helpfulness.',
  scoreRange: overrides.scoreRange ?? { min: 0, max: 1 },
  presetConfig: overrides.presetConfig ?? { rubric: 'quality' },
  defaultSampling: overrides.defaultSampling ?? { type: 'none' },
});

export const makeStoredScorersList = (scorerDefinitions: StoredScorerResponse[]): ListStoredScorersResponse => ({
  scorerDefinitions,
  total: scorerDefinitions.length,
  page: 1,
  perPage: 50,
  hasMore: false,
});

export const makeScorerVersion = (overrides: Partial<ScorerVersionResponse> = {}): ScorerVersionResponse => ({
  id: overrides.id ?? SCORER_VERSION_ID,
  scorerDefinitionId: overrides.scorerDefinitionId ?? SCORER_ID,
  versionNumber: overrides.versionNumber ?? 1,
  name: overrides.name ?? 'Answer Quality',
  description: overrides.description ?? 'Scores whether an answer is useful',
  type: overrides.type ?? 'llm-judge',
  model: overrides.model ?? { provider: 'openai', name: 'gpt-4o-mini' },
  instructions: overrides.instructions ?? 'Score the answer for helpfulness.',
  scoreRange: overrides.scoreRange ?? { min: 0, max: 1 },
  presetConfig: overrides.presetConfig ?? { rubric: 'quality' },
  defaultSampling: overrides.defaultSampling ?? { type: 'none' },
  changedFields: overrides.changedFields ?? ['instructions'],
  changeMessage: overrides.changeMessage ?? 'Initial scorer version',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
});

export const makeScorerVersionsList = (versions: ScorerVersionResponse[]): ListScorerVersionsResponse => ({
  versions,
  total: versions.length,
  page: 1,
  perPage: 50,
  hasMore: false,
});

export const activatedScorerVersion: ActivateScorerVersionResponse = {
  success: true,
  message: 'Scorer version activated',
  activeVersionId: 'scorer-version-2',
};

export const deletedScorerVersion: DeleteScorerVersionResponse = {
  success: true,
  message: 'Scorer version deleted',
};

export const scorerVersionCompare: CompareScorerVersionsResponse = {
  fromVersion: makeScorerVersion(),
  toVersion: makeScorerVersion({ id: 'scorer-version-2', versionNumber: 2, instructions: 'Score for quality and safety.' }),
  diffs: [
    {
      field: 'instructions',
      previousValue: 'Score the answer for helpfulness.',
      currentValue: 'Score for quality and safety.',
      changeType: 'modified',
    },
  ],
};
