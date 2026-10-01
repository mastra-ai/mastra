import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react';
import type { GitStatusEntry } from '@pierre/trees';
import { useEffect, useMemo, useRef } from 'react';

import type { EditorTreeEntry, ScmStatus } from '../../../api/types';
import type { AgentActivity } from './use-agent-activity';

interface FileTreeProps {
  entries: EditorTreeEntry[];
  activePath: string | null;
  onOpen(path: string): void;
  /** Live agent file activity — rows the agent is touching get a decoration. */
  activity?: AgentActivity;
  /** Git staging state — files with changes get status colors, à la VS Code. */
  scm?: ScmStatus;
}

/**
 * Convert flat `/web/workspace/tree` entries into Pierre's path format:
 * directories end with `/`, files do not. Sorted directories-first,
 * then lexically — Pierre expects presorted or sorts internally.
 */
function entriesToPaths(entries: EditorTreeEntry[]): readonly string[] {
  const out: string[] = [];
  for (const entry of entries) {
    out.push(entry.type === 'directory' && !entry.path.endsWith('/') ? `${entry.path}/` : entry.path);
  }
  return out;
}

/** Map a git porcelain status char (M, A, D, R, C, U, ?) to Pierre's GitStatus. */
function porcelainToGitStatus(status: string): GitStatusEntry['status'] | null {
  switch (status) {
    case 'M':
    case 'U':
    case 'C':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case '?':
      return 'untracked';
    default:
      return null;
  }
}

/**
 * Merge SCM staging state + gitignored tree entries into Pierre's git-status
 * list. Change statuses win over `ignored` when both apply (they shouldn't).
 */
export function buildGitStatus(entries: EditorTreeEntry[], scm: ScmStatus | undefined): GitStatusEntry[] {
  const byPath = new Map<string, GitStatusEntry['status']>();
  for (const entry of entries) {
    if (entry.ignored) {
      byPath.set(entry.type === 'directory' ? `${entry.path}/` : entry.path, 'ignored');
    }
  }
  if (scm?.available) {
    for (const change of [...scm.unstaged, ...scm.staged]) {
      const status = porcelainToGitStatus(change.status);
      if (status) byPath.set(change.path, status);
    }
  }
  return [...byPath.entries()].map(([path, status]) => ({ path, status }));
}

/**
 * Pierre @trees-based file tree. The model owns rendering, virtualization,
 * selection, and expansion; we drive it with the workspace entry list and
 * observe selection changes to open files in the editor.
 */
export function FileTree({ entries, activePath, onOpen, activity, scm }: FileTreeProps) {
  // Stable refs let the model's callbacks read the latest values without
  // re-creating the model on every render.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const activityRef = useRef(activity);
  activityRef.current = activity;

  const paths = useMemo(() => entriesToPaths(entries), [entries]);
  const gitStatus = useMemo(() => buildGitStatus(entries, scm), [entries, scm]);

  // Only pass the initial path list to `useFileTree` so we control resets
  // manually — otherwise recreating the model wipes expansion state.
  const initialPathsRef = useRef(paths);
  const initialGitStatusRef = useRef(gitStatus);

  const { model } = useFileTree({
    paths: initialPathsRef.current,
    initialExpansion: 'closed',
    density: 'compact',
    gitStatus: initialGitStatusRef.current,
    onSelectionChange: selected => {
      const first = selected[0];
      if (first && !first.endsWith('/')) onOpenRef.current(first);
    },
    renderRowDecoration: ({ item }) => {
      const current = activityRef.current;
      if (!current) return null;
      if (item.kind === 'file' && current.isActiveFile(item.path)) {
        return {
          text: '●',
          title: 'Agent editing this file',
          parts: [{ text: '●', color: 'var(--color-notice-success)' }],
        };
      }
      if (item.kind === 'directory') {
        const dir = item.path.endsWith('/') ? item.path.slice(0, -1) : item.path;
        if (current.isActiveDir(dir)) {
          return {
            text: '●',
            title: 'Agent working inside this folder',
            parts: [{ text: '●', color: 'var(--color-notice-success)' }],
          };
        }
      }
      return null;
    },
  });

  // Sync path list after mount when the workspace entries change.
  useEffect(() => {
    if (paths === initialPathsRef.current) return;
    model.resetPaths(paths);
  }, [paths, model]);

  // Sync git status (staging changes + ignored entries) after mount.
  useEffect(() => {
    if (gitStatus === initialGitStatusRef.current) return;
    model.setGitStatus(gitStatus);
  }, [gitStatus, model]);

  // Keep the active file focused so keyboard navigation feels anchored.
  useEffect(() => {
    if (!activePath) return;
    model.focusPath(activePath);
    model.scrollToPath(activePath, { offset: 'nearest' });
  }, [activePath, model]);

  return <PierreFileTree model={model} className="h-full min-h-0 w-full" />;
}
