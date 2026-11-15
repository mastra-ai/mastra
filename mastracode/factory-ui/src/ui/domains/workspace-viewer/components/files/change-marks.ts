import type { WorkspaceChanges, WorkspaceChangeStatus } from '../../../../../api/types';
import { foldersAbove } from './folders-above';

export interface ChangeMarks {
  files: ReadonlyMap<string, WorkspaceChangeStatus>;
  folders: ReadonlySet<string>;
}

export const NO_CHANGE_MARKS: ChangeMarks = { files: new Map(), folders: new Set() };

export function changeMarks(changes: WorkspaceChanges): ChangeMarks {
  if (!changes.available) return NO_CHANGE_MARKS;
  const files = new Map<string, WorkspaceChangeStatus>();
  const folders = new Set<string>();
  for (const { path, status } of changes.changes) {
    files.set(path, status);
    for (const folder of foldersAbove(path)) folders.add(folder);
  }
  return { files, folders };
}
