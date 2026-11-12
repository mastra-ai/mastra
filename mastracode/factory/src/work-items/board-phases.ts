/**
 * What one board view shows: for each phase of the board, the cards a reader lists and how many
 * match. The phases route answers with it, and the browser's tests run it in place of the server,
 * so it reads plain values only.
 */

import { boardForWorkItem } from '../boards/semantics.js';
import type { BoardPhasesQuery, BoardPhasesResponse } from '../routes/contracts.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardFacts } from './card-facts.js';
import { hasEveryLabel } from './card-labels.js';
import { BOARD_PERSON_FIELDS, matchesPeople } from './card-people.js';
import { matchesSourceFilters } from './card-source-filters.js';
import { relatedCardsIn } from './list-related-cards.js';
import { hasEveryWord, searchWords } from './search-words.js';

/** The board whose phases are read: its id and its phases in declaration order. */
export interface PhasesBoard {
  id: string;
  phases: readonly string[];
}

/** The view, as the phases route parses it. `cards` is the route's own: bodies are not computed here. */
export type BoardPhasesView = Omit<BoardPhasesQuery, 'board' | 'cards'>;

export interface BoardPhases {
  /** The answer, without what only the route knows: session states and card bodies. */
  body: Pick<BoardPhasesResponse, 'phases' | 'related' | 'boardTotal' | 'matchingTotal'>;
  /** Every card `body` names, the listed ones first. */
  named: Card[];
}

/** A card in one phase. */
interface Placed {
  card: Card;
  /** When the card last entered the phase; when it was created, for a card the phase holds without an entry. */
  at: string;
  /** Who made that entry. */
  by: string | undefined;
}

interface PhaseCards {
  phase: string;
  /** Latest entry first. */
  recent: Placed[];
  newest?: Placed[];
  oldest?: Placed[];
}

interface BoardIndex {
  /** The board's cards, each once. */
  cards: Card[];
  phases: PhaseCards[];
  /** A card once for each phase it is listed under beyond its first. */
  repeats: Card[];
}

// One index per list version and board: `listShared` returns the same array until a card changes.
const boardsByList = new WeakMap<readonly Card[], Map<string, BoardIndex>>();

/** The phases that list the card: each of the board's phases it is in, or the first one when it is in none. */
function cardPhases(card: Card, phases: readonly string[]): readonly string[] {
  const held = phases.filter(phase => card.stages.includes(phase));
  return held.length > 0 ? held : phases.slice(0, 1);
}

function placed(card: Card, phase: string): Placed {
  let latest: Card['stageHistory'][number] | undefined;
  for (const entry of card.stageHistory) {
    if (entry.stage === phase && (!latest || entry.enteredAt > latest.enteredAt)) latest = entry;
  }
  return { card, at: latest?.enteredAt ?? card.createdAt.toISOString(), by: latest?.by };
}

function descending(left: string, right: string): number {
  return left < right ? 1 : left > right ? -1 : 0;
}

// Cards that entered at the same instant keep one order on every read.
function byRecent(left: Placed, right: Placed): number {
  return descending(left.at, right.at) || descending(left.card.id, right.card.id);
}

function byCreation(direction: 1 | -1): (left: Placed, right: Placed) => number {
  return (left, right) =>
    direction * (left.card.createdAt.getTime() - right.card.createdAt.getTime()) ||
    descending(left.card.id, right.card.id);
}

function boardIndex(list: readonly Card[], board: PhasesBoard): BoardIndex {
  let boards = boardsByList.get(list);
  if (!boards) boardsByList.set(list, (boards = new Map()));
  // The phases are part of the key: an edited board keeps its id.
  const key = [board.id, ...board.phases].join('\n');
  let index = boards.get(key);
  if (index) return index;

  const byPhase = new Map(board.phases.map((phase): [string, Placed[]] => [phase, []]));
  const cards: Card[] = [];
  const repeats: Card[] = [];
  for (const card of list) {
    if (boardForWorkItem(card) !== board.id) continue;
    cards.push(card);
    cardPhases(card, board.phases).forEach((phase, nth) => {
      byPhase.get(phase)?.push(placed(card, phase));
      if (nth > 0) repeats.push(card);
    });
  }
  index = {
    cards,
    phases: [...byPhase].map(([phase, entries]) => ({ phase, recent: entries.sort(byRecent) })),
    repeats,
  };
  boards.set(key, index);
  return index;
}

function ordered(held: PhaseCards, sort: BoardPhasesView['sort']): readonly Placed[] {
  if (sort === 'created-newest') return (held.newest ??= held.recent.toSorted(byCreation(-1)));
  if (sort === 'created-oldest') return (held.oldest ??= held.recent.toSorted(byCreation(1)));
  return held.recent;
}

/** Whether the view's search and filters keep a card; undefined when the view has none. */
function viewMatcher(view: BoardPhasesView): ((card: Card) => boolean) | undefined {
  const words = searchWords(view.q ?? '');
  const bySource = view.source.size > 0 || view.linearProject.size > 0;
  const byLabel = view.label.size > 0;
  const byPeople = BOARD_PERSON_FIELDS.some(field => view[field].size > 0);
  if (words.length === 0 && !bySource && !byLabel && !byPeople) return undefined;
  return card => {
    const facts = cardFacts(card);
    return (
      hasEveryWord(facts.text, words) &&
      (!bySource || matchesSourceFilters(facts, view)) &&
      (!byLabel || hasEveryLabel(facts.labels, view.label)) &&
      (!byPeople || matchesPeople(facts.relations, view))
    );
  };
}

const EVERY_CARD: ReadonlyArray<(entry: Placed) => boolean> = [() => true];

function stamp(card: Card): { id: string; changedAt: string | null } {
  return { id: card.id, changedAt: card.changedAt ? card.changedAt.toISOString() : null };
}

/**
 * The phases of `board` as `view` shows them to `userId`, read from the project's whole `list`.
 * A window for a phase the board does not have deepens nothing: a reader may still hold a
 * phase deeper after the board lost that phase, and keeps its board.
 */
export function boardPhases(
  list: readonly Card[],
  board: PhasesBoard,
  view: BoardPhasesView,
  userId: string,
): BoardPhases {
  const index = boardIndex(list, board);
  const matches = viewMatcher(view);
  // `recent-mine` is `recent` read twice: the cards the reader last moved here, then the others.
  const passes =
    view.sort === 'recent-mine'
      ? [(entry: Placed) => entry.by === userId, (entry: Placed) => entry.by !== userId]
      : EVERY_CARD;
  const item = view.item === undefined ? undefined : index.cards.find(card => card.id === view.item);
  const reached = item && (!matches || matches(item)) ? cardPhases(item, board.phases) : [];

  const listed = new Set<Card>();
  let matchingTotal = 0;
  const phases = index.phases.map(held => {
    const all = ordered(held, view.sort);
    const size = view.window.get(held.phase) ?? view.limit;
    // The phase lists down to the asked card, however deep it is.
    let awaited = reached.includes(held.phase) ? item : undefined;
    const cards: Card[] = [];
    let total = 0;
    scan: for (const pass of passes) {
      for (const entry of all) {
        if (!pass(entry) || (matches && !matches(entry.card))) continue;
        total += 1;
        if (cards.length < size || awaited) {
          cards.push(entry.card);
          listed.add(entry.card);
          if (entry.card === awaited) awaited = undefined;
        } else if (!matches) {
          // Nothing is filtered out, so the rest need not be read to count them.
          break scan;
        }
      }
    }
    if (!matches) total = all.length;
    matchingTotal += total;
    return { phase: held.phase, total, cards: cards.map(stamp) };
  });
  for (const card of index.repeats) {
    if (!matches || matches(card)) matchingTotal -= 1;
  }

  const relatedTo = relatedCardsIn(list);
  const related = new Set<Card>();
  for (const card of listed) {
    for (const other of relatedTo(card)) {
      if (!listed.has(other)) related.add(other);
    }
  }
  return {
    body: { phases, related: [...related].map(stamp), boardTotal: index.cards.length, matchingTotal },
    named: [...listed, ...related],
  };
}
