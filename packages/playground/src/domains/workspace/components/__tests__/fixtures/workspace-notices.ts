import type { SkillMetadata, WorkspaceFsListResponse } from '@mastra/client-js';

export const installedSkillsListing: WorkspaceFsListResponse = {
  path: '.agents/skills',
  entries: [
    { name: 'find-skills', type: 'directory' },
    { name: 'review', type: 'directory' },
    { name: 'README.md', type: 'file', size: 12 },
  ],
};

export const findSkills: SkillMetadata = {
  name: 'find-skills',
  description: 'Finds skills',
  path: '.agents/skills/find-skills',
};

export const review: SkillMetadata = {
  name: 'review',
  description: 'Reviews code',
  path: './.agents/skills/review/',
};
