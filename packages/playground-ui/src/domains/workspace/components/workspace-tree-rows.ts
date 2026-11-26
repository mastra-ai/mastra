import type { WorkspaceFsListResponse } from '@mastra/client-js';
import { joinPath } from '../path';
import type { VirtualTreeRow } from '@/ds/components/VirtualTree/virtual-tree';

type WorkspaceEntry = WorkspaceFsListResponse['entries'][number];

export type WorkspaceEntryRow = VirtualTreeRow & {
  kind: 'entry';
  path: string;
  entry: WorkspaceEntry;
  loading: boolean;
};
type InputRow = VirtualTreeRow & { kind: 'input'; parent: string };
type ErrorRow = VirtualTreeRow & { kind: 'error'; error?: Error };
export type WorkspaceTreeRow = WorkspaceEntryRow | InputRow | ErrorRow;

export interface WorkspaceFolderListing {
  data?: WorkspaceEntry[];
  error?: Error;
  isLoading: boolean;
}

interface TreeState {
  open: ReadonlySet<string>;
  listings: ReadonlyMap<string, WorkspaceFolderListing>;
  creatingIn?: string;
}

export function buildWorkspaceTreeRows(root: WorkspaceEntry[], rootPath: string, state: TreeState) {
  const rows: WorkspaceTreeRow[] = [];

  const addLevel = (entries: WorkspaceEntry[], parent: string, level: number, failed?: { error?: Error }) => {
    const creating = state.creatingIn === parent;
    const offset = creating ? 1 : 0;
    const setSize = entries.length + offset + (failed ? 1 : 0);
    if (creating) rows.push({ kind: 'input', id: `${parent}/\0new`, parent, level, posInSet: 1, setSize });
    entries.forEach((entry, index) => {
      const path = joinPath(parent, entry.name);
      const place = { id: path, path, entry, level, posInSet: index + 1 + offset, setSize };
      if (entry.type !== 'directory') {
        rows.push({ kind: 'entry', ...place, loading: false });
        return;
      }
      const expanded = state.open.has(path);
      const listing = expanded ? state.listings.get(path) : undefined;
      rows.push({ kind: 'entry', ...place, expanded, loading: listing?.isLoading ?? false });
      if (!listing) return;
      const failed = !listing.data && !listing.isLoading ? { error: listing.error } : undefined;
      addLevel(listing.data ?? [], path, level + 1, failed);
    });
    if (failed) {
      rows.push({ kind: 'error', id: `${parent}/\0error`, error: failed.error, level, posInSet: setSize, setSize });
    }
  };

  addLevel(root, rootPath, 0);
  return rows;
}
