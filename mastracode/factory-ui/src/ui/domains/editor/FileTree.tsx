import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react';
import { useEffect, useMemo, useRef } from 'react';

import type { EditorTreeEntry } from '../../../api/types';
import type { AgentActivity } from './use-agent-activity';

interface FileTreeProps {
  entries: EditorTreeEntry[];
  activePath: string | null;
  onOpen(path: string): void;
  /** Live agent file activity — rows the agent is touching get a decoration. */
  activity?: AgentActivity;
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

/**
 * Pierre @trees-based file tree. The model owns rendering, virtualization,
 * selection, and expansion; we drive it with the workspace entry list and
 * observe selection changes to open files in the editor.
 */
export function FileTree({ entries, activePath, onOpen, activity }: FileTreeProps) {
  // Stable refs let the model's callbacks read the latest values without
  // re-creating the model on every render.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const activityRef = useRef(activity);
  activityRef.current = activity;

  const paths = useMemo(() => entriesToPaths(entries), [entries]);

  // Only pass the initial path list to `useFileTree` so we control resets
  // manually — otherwise recreating the model wipes expansion state.
  const initialPathsRef = useRef(paths);

  const { model } = useFileTree({
    paths: initialPathsRef.current,
    initialExpansion: 'closed',
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

  // Keep the active file focused so keyboard navigation feels anchored.
  useEffect(() => {
    if (!activePath) return;
    model.focusPath(activePath);
    model.scrollToPath(activePath, { offset: 'nearest' });
  }, [activePath, model]);

  return <PierreFileTree model={model} className="h-full min-h-0 w-full" />;
}
