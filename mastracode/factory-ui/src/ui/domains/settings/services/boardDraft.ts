import { BOARD_IDENTIFIER_RE, MAX_BOARD_IDENTIFIER_LENGTH } from '@mastra/factory/rules/validation';

import type { StoredBoardInfo, StoredPhaseInfo } from '../../../../api/types';
import { settingsSectionPath } from '../settingsSections';

/** A board as the editor holds it: everything a save sends except the key and the revision. */
export interface BoardDraft {
  name: string;
  description: string | null;
  phases: StoredPhaseInfo[];
}

export function draftOf(board: Pick<StoredBoardInfo, 'name' | 'description' | 'phases'>): BoardDraft {
  return { name: board.name, description: board.description ?? null, phases: board.phases };
}

/** A key for a name: lower case, with every run of other characters as one hyphen. */
export function keyFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, MAX_BOARD_IDENTIFIER_LENGTH)
    .replace(/-+$/, '');
}

/** Why the server would refuse this key, if it would. */
export function keyProblem(key: string, taken: readonly string[] = []): string | undefined {
  if (key === '') return 'Enter a key.';
  if (key.length > MAX_BOARD_IDENTIFIER_LENGTH) return `Use at most ${MAX_BOARD_IDENTIFIER_LENGTH} characters.`;
  if (!BOARD_IDENTIFIER_RE.test(key))
    return 'Use letters, digits, hyphens and underscores, starting with a letter or digit.';
  if (taken.includes(key)) return 'This key is already in use.';
  return undefined;
}

/** The board a new one starts from: cards wait in Backlog, an agent works them in Doing, and they end in Done. */
export function starterBoard(): BoardDraft {
  return {
    name: '',
    description: null,
    phases: [
      { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
      { key: 'doing', name: 'Doing', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
      { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
    ],
  };
}

/** Settings → Boards, on one board's editor or on the new-board form. */
export function boardSettingsPath(factoryId: string, target: { board: string } | { new: true }): string {
  const query = 'board' in target ? `board=${encodeURIComponent(target.board)}` : 'new=1';
  return `${settingsSectionPath(factoryId, 'board')}?${query}`;
}
