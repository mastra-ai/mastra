import type { WorkspaceChanges, WorkspaceFilesListing } from '../../../../../../api/types';

export const WORKSPACE = 'session-1';
export const THREAD = 'thread-1';

/** A session whose environment holds three repositories under one workspace root. */
export const multiRepositoryChanges: WorkspaceChanges = {
  workspacePath: WORKSPACE,
  available: true,
  additions: 9,
  deletions: 2,
  changes: [
    { path: 'mastra/src/agent.ts', status: 'modified', additions: 4, deletions: 1 },
    { path: 'mastra/README.md', status: 'modified', additions: 2, deletions: 1 },
    { path: 'platform/proof.txt', status: 'untracked', additions: 3, deletions: 0 },
  ],
  repositories: [
    {
      slug: 'mastra-ai/mastra',
      prefix: 'mastra/',
      available: true,
      additions: 6,
      deletions: 2,
      changes: [
        { path: 'mastra/src/agent.ts', status: 'modified', additions: 4, deletions: 1 },
        { path: 'mastra/README.md', status: 'modified', additions: 2, deletions: 1 },
      ],
    },
    {
      slug: 'mastra-ai/platform',
      prefix: 'platform/',
      available: true,
      additions: 3,
      deletions: 0,
      changes: [{ path: 'platform/proof.txt', status: 'untracked', additions: 3, deletions: 0 }],
    },
    {
      slug: 'mastra-ai/mastra-website',
      prefix: 'mastra-website/',
      available: true,
      additions: 0,
      deletions: 0,
      changes: [],
    },
  ],
};

export const multiRepositoryFiles: WorkspaceFilesListing = {
  workspacePath: WORKSPACE,
  threadId: THREAD,
  files: [
    { path: 'mastra/src/agent.ts' },
    { path: 'platform/proof.txt' },
    { path: 'mastra-website/proof.txt' },
    { path: '.artifacts/report.md' },
  ],
  repositories: [
    { slug: 'mastra-ai/mastra', prefix: 'mastra/' },
    { slug: 'mastra-ai/platform', prefix: 'platform/' },
    { slug: 'mastra-ai/mastra-website', prefix: 'mastra-website/' },
  ],
};

/** A one-repository session: no `repositories` key, paths relative to the checkout. */
export const singleRepositoryChanges: WorkspaceChanges = {
  workspacePath: WORKSPACE,
  available: true,
  additions: 4,
  deletions: 1,
  changes: [
    { path: 'src/agent.ts', status: 'modified', additions: 4, deletions: 1 },
    { path: 'README.md', status: 'untracked', additions: 0, deletions: 0 },
  ],
};

export const singleRepositoryFiles: WorkspaceFilesListing = {
  workspacePath: WORKSPACE,
  threadId: THREAD,
  files: [{ path: 'src/agent.ts' }, { path: 'README.md' }, { path: '.artifacts/report.md' }],
};
