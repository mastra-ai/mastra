import type { WorkspaceChanges, WorkspaceDiff } from '../../../../../../api/types';

export const workspaceChangesFixture = {
  workspacePath: '/home/user/project',
  available: true,
  changes: [
    { path: 'src/edited.ts', status: 'modified' },
    { path: 'src/new.ts', status: 'untracked' },
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
