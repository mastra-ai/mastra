import type { ListStoredSkillsResponse, StoredSkillResponse } from '@mastra/client-js';

export const makeStoredSkill = (overrides: Partial<StoredSkillResponse> = {}): StoredSkillResponse => ({
  id: overrides.id ?? 'skill-1',
  status: overrides.status ?? 'active',
  name: overrides.name ?? 'My Skill',
  description: overrides.description ?? 'A useful skill',
  instructions: overrides.instructions ?? 'Do useful things.',
  visibility: overrides.visibility ?? 'private',
  authorId: overrides.authorId ?? 'user-1',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const emptyStoredSkills: ListStoredSkillsResponse = {
  skills: [],
  total: 0,
  page: 1,
  perPage: 50,
  hasMore: false,
};

export const oneStoredSkill: ListStoredSkillsResponse = {
  skills: [makeStoredSkill()],
  total: 1,
  page: 1,
  perPage: 50,
  hasMore: false,
};
