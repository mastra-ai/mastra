import type { VirtualTreeRow } from '@mastra/playground-ui/components/VirtualTree';
import type { WorkspaceTreeEntry, WorkspaceTreeListing } from '../../../../../api/types';
import { foldersAbove } from './folders-above';

export type BrowserEntryRow = VirtualTreeRow & { kind: 'entry'; entry: WorkspaceTreeEntry };
type MessageRow = VirtualTreeRow & { kind: 'loading' | 'error' | 'empty'; message?: string };
export type BrowserRow = BrowserEntryRow | MessageRow;

export interface BrowserFolderListing {
  data?: WorkspaceTreeListing;
  error?: Error;
  isLoading: boolean;
}

interface BrowserTreeState {
  open: Record<string, boolean>;
  listings: ReadonlyMap<string, BrowserFolderListing>;
  showHidden: boolean;
}

/** Dotfiles and dot-folders, hidden unless the viewer asks for them. */
export function isHidden(entry: WorkspaceTreeEntry): boolean {
  return entry.name.startsWith('.');
}

const isHiddenPath = (path: string) => path.split('/').some(segment => segment.startsWith('.'));

export function isOpenAndShown(path: string, { open, showHidden }: Omit<BrowserTreeState, 'listings'>) {
  if (!open[path]) return false;
  if (!showHidden && isHiddenPath(path)) return false;
  return foldersAbove(path).every(folder => open[folder]);
}

export function buildBrowserRows(root: WorkspaceTreeEntry[], state: BrowserTreeState) {
  const rows: BrowserRow[] = [];

  const addLevel = (entries: WorkspaceTreeEntry[], level: number) => {
    entries.forEach((entry, index) => {
      const isFolder = entry.type === 'directory' && entry.linkedPath === undefined;
      const expanded = isFolder ? (state.open[entry.path] ?? false) : undefined;
      rows.push({
        kind: 'entry',
        id: entry.path,
        entry,
        expanded,
        level,
        posInSet: index + 1,
        setSize: entries.length,
      });
      if (expanded) addChildren(entry.path, level + 1);
    });
  };

  const addChildren = (path: string, level: number) => {
    const place = { level, posInSet: 1, setSize: 1 };
    const listing = state.listings.get(path);
    if (!listing || listing.isLoading) return rows.push({ kind: 'loading', id: `${path}/\0loading`, ...place });
    if (listing.error)
      return rows.push({ kind: 'error', id: `${path}/\0error`, message: listing.error.message, ...place });
    const children = (listing.data?.entries ?? []).filter(item => state.showHidden || !isHidden(item));
    if (children.length === 0) return rows.push({ kind: 'empty', id: `${path}/\0empty`, ...place });
    addLevel(children, level);
  };

  addLevel(root, 0);
  return rows;
}
