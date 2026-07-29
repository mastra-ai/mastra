import type { WorkspaceChanges, WorkspaceDiff } from '../../../../../../api/types';

export const workspaceChangesFixture = {
  workspacePath: '/home/user/project',
  available: true,
  additions: 8,
  deletions: 1,
  changes: [
    { path: 'src/edited.ts', status: 'modified', additions: 3, deletions: 1 },
    { path: 'src/new.ts', status: 'untracked', additions: 5, deletions: 0 },
  ],
} satisfies WorkspaceChanges;

export const workspaceDiffFixture = {
  workspacePath: '/home/user/project',
  path: 'src/edited.ts',
  patch: [
    'diff --git a/src/edited.ts b/src/edited.ts',
    '--- a/src/edited.ts',
    '+++ b/src/edited.ts',
    '@@ -1 +1 @@',
    '-old value',
    '+new value',
  ].join('\n'),
  truncated: false,
} satisfies WorkspaceDiff;
