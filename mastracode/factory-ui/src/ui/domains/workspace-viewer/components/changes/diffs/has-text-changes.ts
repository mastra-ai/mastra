import type { WorkspaceChange } from '../../../../../../api/types';

export function hasTextChanges(change: WorkspaceChange): boolean {
  return !change.binary && (change.additions === undefined || change.additions + (change.deletions ?? 0) > 0);
}
