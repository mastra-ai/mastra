import { describe, expect, it } from 'vitest';

import { findFiles } from './find-files';

const paths = (query: string, files: string[], boost?: string[]) =>
  findFiles(files, query, { limit: 10, boost: boost && new Set(boost) }).matches.map(match => match.path);

describe('findFiles', () => {
  it('puts a file named like the query above files that only sit in a folder named like it', () => {
    expect(paths('agent', ['packages/agent-builder/README.md', 'packages/core/src/agent.ts'])).toEqual([
      'packages/core/src/agent.ts',
      'packages/agent-builder/README.md',
    ]);
  });

  it('finds a file by the initials of its words and marks the letters that matched', () => {
    const [match] = findFiles(['src/ui/WorkspaceViewerPanel.tsx', 'src/ui/Overview.tsx'], 'wvp', { limit: 10 }).matches;

    expect(match?.path).toBe('src/ui/WorkspaceViewerPanel.tsx');
    expect(match?.matched.map(at => match.path[at])).toEqual(['W', 'V', 'P']);
  });

  it('ignores case and spaces, and drops paths missing a typed character', () => {
    expect(paths('Agent TS', ['src/agent.ts', 'src/agent.md'])).toEqual(['src/agent.ts']);
  });

  it('counts every match while returning only the best few', () => {
    const files = Array.from({ length: 30 }, (_, i) => `src/file-${i}.ts`);

    const found = findFiles(files, 'file', { limit: 5 });

    expect(found.total).toBe(30);
    expect(found.matches).toHaveLength(5);
  });

  it('lifts the files the session changed over otherwise equal matches', () => {
    expect(paths('index', ['a/index.ts', 'b/index.ts'], ['b/index.ts'])).toEqual(['b/index.ts', 'a/index.ts']);
  });

  it('finds a path that grows longer once lowercased', () => {
    expect(findFiles(['src/İ.ts'], 's', { limit: 5 }).matches).toEqual([{ path: 'src/İ.ts', matched: [7] }]);
  });
});
