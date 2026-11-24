import type {
  GetSystemPackagesResponse,
  ListPromptBlockVersionsResponse,
  PromptBlockVersionResponse,
  StoredPromptBlockResponse,
} from '@mastra/client-js';

export const cmsEnabledPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: true,
  observabilityEnabled: false,
};

export const cmsDisabledPackages: GetSystemPackagesResponse = { ...cmsEnabledPackages, cmsEnabled: false };

const version = (versionNumber: number): PromptBlockVersionResponse => ({
  id: `version-${versionNumber}`,
  blockId: 'tone-of-voice',
  versionNumber,
  name: 'Tone of voice',
  content: `Tone revision ${versionNumber}`,
  createdAt: `2026-11-0${versionNumber}T10:00:00.000Z`,
});

/** Newest first, as the page requests them. v2 is published and v3 is a draft. */
export const threePromptBlockVersions: ListPromptBlockVersionsResponse = {
  versions: [version(3), version(2), version(1)],
  total: 3,
  page: 0,
  perPage: 20,
  hasMore: false,
};

export const promptBlockWithTags = (versionTags: Record<string, string>): StoredPromptBlockResponse => ({
  id: 'tone-of-voice',
  status: 'published',
  activeVersionId: 'version-2',
  hasDraft: true,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-03T10:00:00.000Z',
  name: 'Tone of voice',
  content: 'Tone revision 3',
  metadata: { owner: 'support-team', versionTags },
});
