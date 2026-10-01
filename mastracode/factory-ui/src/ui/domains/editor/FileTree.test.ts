import { describe, expect, it } from 'vitest';

import type { EditorTreeEntry, ScmStatus } from '../../../api/types';
import { buildGitStatus } from './FileTree';

const scm = (overrides: Partial<ScmStatus>): ScmStatus => ({
  workspacePath: 'ws',
  available: true,
  staged: [],
  unstaged: [],
  ...overrides,
});

describe('buildGitStatus', () => {
  it('maps porcelain chars to Pierre statuses', () => {
    const status = buildGitStatus(
      [],
      scm({
        unstaged: [
          { path: 'a.ts', status: 'M' },
          { path: 'b.ts', status: '?' },
          { path: 'c.ts', status: 'D' },
        ],
        staged: [
          { path: 'd.ts', status: 'A' },
          { path: 'e.ts', status: 'R' },
        ],
      }),
    );
    expect(new Map(status.map(entry => [entry.path, entry.status]))).toEqual(
      new Map([
        ['a.ts', 'modified'],
        ['b.ts', 'untracked'],
        ['c.ts', 'deleted'],
        ['d.ts', 'added'],
        ['e.ts', 'renamed'],
      ]),
    );
  });

  it('marks ignored entries, with trailing slash for directories', () => {
    const entries: EditorTreeEntry[] = [
      { name: 'node_modules', path: 'node_modules', type: 'directory', ignored: true },
      { name: '.env', path: '.env', type: 'file', ignored: true },
      { name: 'index.ts', path: 'src/index.ts', type: 'file' },
    ];
    expect(buildGitStatus(entries, undefined)).toEqual([
      { path: 'node_modules/', status: 'ignored' },
      { path: '.env', status: 'ignored' },
    ]);
  });

  it('lets change statuses win over ignored and skips unknown chars', () => {
    const entries: EditorTreeEntry[] = [{ name: '.env', path: '.env', type: 'file', ignored: true }];
    const status = buildGitStatus(
      entries,
      scm({ unstaged: [{ path: '.env', status: 'M' }, { path: 'weird.ts', status: 'X' }] }),
    );
    expect(status).toEqual([{ path: '.env', status: 'modified' }]);
  });

  it('ignores scm payload when git is unavailable', () => {
    const status = buildGitStatus([], scm({ available: false, unstaged: [{ path: 'a.ts', status: 'M' }] }));
    expect(status).toEqual([]);
  });
});
