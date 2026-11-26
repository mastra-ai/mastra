import type { WorkspaceChange } from '../../../../../api/types';

/** Past this many files the overview draws one tile per file instead of a row each. */
export const FILE_ROWS_LIMIT = 6;

const MOSAIC_ROWS = 2;
const TILE_SIZE = 10;
const TILE_GAP = 3;
const LIGHTEST_TILE = 0.36;
const DARKEST_TILE = 0.94;

export type ChangeTone = 'conflict' | 'addition' | 'deletion' | 'unsized';

export function changeLines({ additions, deletions }: WorkspaceChange): number {
  return (additions ?? 0) + (deletions ?? 0);
}

export function changeTone(change: WorkspaceChange): ChangeTone {
  if (change.status === 'conflicted') return 'conflict';
  if (change.additions === undefined && change.deletions === undefined) return 'unsized';
  return (change.deletions ?? 0) > (change.additions ?? 0) ? 'deletion' : 'addition';
}

/** Conflicts lead: they are what blocks the branch. */
export function overviewOrder(changes: readonly WorkspaceChange[]): WorkspaceChange[] {
  return [
    ...changes.filter(change => change.status === 'conflicted'),
    ...changes.filter(change => change.status !== 'conflicted'),
  ];
}

export function conflictCount(changes: readonly WorkspaceChange[]): number {
  return changes.filter(change => change.status === 'conflicted').length;
}

export function splitPath(path: string): { name: string; directory: string } {
  const slash = path.lastIndexOf('/');
  return slash === -1
    ? { name: path, directory: '' }
    : { name: path.slice(slash + 1), directory: path.slice(0, slash) };
}

export function mosaicCapacity(width: number): number {
  return Math.max(1, Math.floor((width + TILE_GAP) / (TILE_SIZE + TILE_GAP))) * MOSAIC_ROWS;
}

/** Log scale, so one huge file does not wash every other tile out to the lightest shade. */
export function tileOpacity(lines: number, largest: number): number {
  if (largest <= 0) return LIGHTEST_TILE;
  const share = Math.log1p(lines) / Math.log1p(largest);
  return LIGHTEST_TILE + (DARKEST_TILE - LIGHTEST_TILE) * share;
}

export function additionShare({ additions = 0, deletions = 0 }: WorkspaceChange): number | undefined {
  const lines = additions + deletions;
  return lines === 0 ? undefined : additions / lines;
}
