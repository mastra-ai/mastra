import type { WorkspaceFsListResponse } from '@mastra/client-js';

/** Root listing returned for the workspace, loaded non-recursively. */
export const rootListing: WorkspaceFsListResponse = {
  path: '.',
  entries: [
    { name: 'src', type: 'directory' },
    { name: 'README.md', type: 'file', size: 12 },
  ],
};

/** Children of the `src` folder, fetched lazily when it is expanded. */
export const srcListing: WorkspaceFsListResponse = {
  path: 'src',
  entries: [
    { name: 'components', type: 'directory' },
    { name: 'index.ts', type: 'file', size: 42 },
  ],
};

/** Root listing after a skill has been installed, adding the skills folder. */
export const rootListingWithSkill: WorkspaceFsListResponse = {
  path: '.',
  entries: [
    { name: '.agents', type: 'directory' },
    { name: 'src', type: 'directory' },
    { name: 'README.md', type: 'file', size: 12 },
  ],
};
