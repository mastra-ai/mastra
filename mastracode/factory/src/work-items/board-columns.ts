/**
 * What one board view shows: for each phase of the board, the cards a reader lists and how many
 * match. The columns route answers with it, and the browser's tests run it in place of the server,
 * so it reads plain values only.
 */

import { boardForWorkItem } from '../boards/semantics.js';
import type { WorkItemColumnsQuery, WorkItemColumnsResponse } from '../routes/contracts.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardFacts } from './card-facts.js';
import { hasEveryLabel } from './card-labels.js';
import { BOARD_PERSON_FIELDS, matchesPeople } from './card-people.js';
import { matchesSourceFilters } from './card-source-filters.js';
import { relatedCardsIn } from './list-related-cards.js';
import { hasEveryWord, searchWords } from './search-words.js';

/** The board whose columns are read: its id and its phases in declaration order. */
export interface ColumnsBoard {
  id: string;
  phases: readonly string[];
}

/** The view, as the columns route parses it. `cards` is the route's own: bodies are not computed here. */
export type ColumnsView = Omit<WorkItemColumnsQuery, 'board' | 'cards'>;

export interface WorkItemColumns {
  /** The answer, without what only the route knows: session states and card bodies. */
  body: Pick<WorkItemColumnsResponse, 'columns' | 'related' | 'boardTotal' | 'matchingTotal'>;
  /** Every card `body` names, the listed ones first. */
  named: Card[];
}

/** A card in one column. */
interface Placed {
  card: Card;
  /** When the card last entered the column; when it was created, for a card the column holds without an entry. */
  at: string;
  /** Who made that entry. */
  by: string | undefined;
}

interface Column {
  stage: string;
  /** Latest entry first. */
  recent: Placed[];
  newest?: Placed[];
  oldest?: Placed[];
}

interface BoardColumns {
  /** The board's cards, each once. */
  cards: Card[];
  columns: Column[];
  /** A card once for each column it is in beyond its first. */
  repeats: Card[];
}

// One index per list version and board: `listShared` returns the same array until a card changes.
const boardsByList = new WeakMap<readonly Card[], Map<string, BoardColumns>>();

/** The columns that show the card: each of the board's phases it is in, or the first one when it is in none. */
function cardColumns(card: Card, phases: readonly string[]): readonly string[] {
  const held = phases.filter(phase => card.stages.includes(phase));
  return held.length > 0 ? held : phases.slice(0, 1);
}

function placed(card: Card, stage: string): Placed {
  let latest: Card['stageHistory'][number] | undefined;
  for (const entry of card.stageHistory) {
    if (entry.stage === stage && (!latest || entry.enteredAt > latest.enteredAt)) latest = entry;
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

function boardColumns(list: readonly Card[], board: ColumnsBoard): BoardColumns {
  let boards = boardsByList.get(list);
  if (!boards) boardsByList.set(list, (boards = new Map()));
  // The phases are part of the key: an edited board keeps its id.
  const key = [board.id, ...board.phases].join('\n');
  let index = boards.get(key);
  if (index) return index;

  const byStage = new Map(board.phases.map((stage): [string, Placed[]] => [stage, []]));
  const cards: Card[] = [];
  const repeats: Card[] = [];
  for (const card of list) {
    if (boardForWorkItem(card) !== board.id) continue;
    cards.push(card);
    cardColumns(card, board.phases).forEach((stage, nth) => {
      byStage.get(stage)?.push(placed(card, stage));
      if (nth > 0) repeats.push(card);
    });
  }
  index = {
    cards,
    columns: [...byStage].map(([stage, column]) => ({ stage, recent: column.sort(byRecent) })),
    repeats,
  };
  boards.set(key, index);
  return index;
}

function ordered(column: Column, sort: ColumnsView['sort']): readonly Placed[] {
  if (sort === 'created-newest') return (column.newest ??= column.recent.toSorted(byCreation(-1)));
  if (sort === 'created-oldest') return (column.oldest ??= column.recent.toSorted(byCreation(1)));
  return column.recent;
}

/** Whether the view's search and filters keep a card; undefined when the view has none. */
function viewMatcher(view: ColumnsView): ((card: Card) => boolean) | undefined {
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
 * The columns of `board` as `view` shows them to `userId`, read from the project's whole `list`.
 * A window for a stage the board has no phase for deepens nothing: a reader may still hold a
 * column deeper after the board lost that phase, and keeps its board.
 */
export function workItemColumns(
  list: readonly Card[],
  board: ColumnsBoard,
  view: ColumnsView,
  userId: string,
): WorkItemColumns {
  const index = boardColumns(list, board);
  const matches = viewMatcher(view);
  // `recent-mine` is `recent` read twice: the cards the reader last moved here, then the others.
  const passes =
    view.sort === 'recent-mine'
      ? [(entry: Placed) => entry.by === userId, (entry: Placed) => entry.by !== userId]
      : EVERY_CARD;
  const item = view.item === undefined ? undefined : index.cards.find(card => card.id === view.item);
  const reached = item && (!matches || matches(item)) ? cardColumns(item, board.phases) : [];

  const listed = new Set<Card>();
  let matchingTotal = 0;
  const columns = index.columns.map(column => {
    const all = ordered(column, view.sort);
    const size = view.window.get(column.stage) ?? view.limit;
    // The column lists down to the asked card, however deep it is.
    let awaited = reached.includes(column.stage) ? item : undefined;
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
    return { stage: column.stage, total, cards: cards.map(stamp) };
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
    body: { columns, related: [...related].map(stamp), boardTotal: index.cards.length, matchingTotal },
    named: [...listed, ...related],
  };
}
