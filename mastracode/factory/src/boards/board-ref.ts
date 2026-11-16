import type { BoardRegistry, InstalledBoard } from './registry.js';

/** A board as its id and the name the UI and the work-item header show: `Open source (work)`. */
function describe(board: InstalledBoard): string {
  return `${board.name} (${board.id})`;
}

/**
 * The board someone named, by its id or by the name the UI shows it under.
 *
 * A card stores a board's id, and a project can rename a board without changing that id
 * (`factory.upsertBoard` replaces a stored board's name; its key never changes), so a person or an
 * agent reads "Open source (work)" in the work-item header and may name either half. An id is
 * exact, so it wins; a name resolves only when one board carries it, because a project can store
 * two boards under the same name.
 */
export function resolveBoardRef(boards: BoardRegistry, ref: string): InstalledBoard {
  const trimmed = ref.trim();
  const byId = boards.get(trimmed);
  if (byId) return byId;

  const wanted = trimmed.toLowerCase();
  const matches = [...boards.values()].filter(board => board.name.trim().toLowerCase() === wanted);
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new Error(
      `"${trimmed}" matches more than one board; use its id instead: ${matches.map(describe).join(', ')}.`,
    );
  }

  const installed = [...boards.values()].map(describe);
  throw new Error(
    `No board is named "${trimmed}" in this Factory. It has: ${installed.length > 0 ? installed.join(', ') : 'no boards'}.`,
  );
}
