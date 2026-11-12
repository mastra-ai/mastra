import type { BoardColumnsSnapshot } from '../../../hooks/useWorkItems';
import { itemAppearsInStage } from './boardStages';
import type { WorkItem } from './services/workItems';
import type { BoardStageId } from './stages';

/** What a board column shows of one read of its view. */
export interface ShownBoardColumn {
  /** The listed cards, in the view's order. */
  cards: WorkItem[];
  /** How many cards of the column match the view, listed or not. */
  total: number;
  /** Whether the server listed every matching card, so nothing is left to load. */
  listedAll: boolean;
}

const NO_CARDS: WorkItem[] = [];

/**
 * The cards each column shows. The server decided which cards the view lists and in what order.
 * Where a listed card sits is read from the card itself, so a card moved in this tab leaves its
 * column and tops the one it entered at once, before the next read lists it there.
 */
export function shownBoardColumns(
  snapshot: BoardColumnsSnapshot | undefined,
  stages: ReadonlyArray<{ id: BoardStageId }>,
): ReadonlyMap<BoardStageId, ShownBoardColumn> {
  const shown = new Map<BoardStageId, ShownBoardColumn>();
  if (!snapshot) {
    for (const stage of stages) shown.set(stage.id, { cards: NO_CARDS, total: 0, listedAll: true });
    return shown;
  }
  const held = new Map(snapshot.workItems.map(card => [card.id, card]));
  const listed = new Set(snapshot.columns.flatMap(column => column.ids));
  for (const stage of stages) {
    const column = snapshot.columns.find(candidate => candidate.stage === stage.id);
    const ids = new Set(column?.ids);
    const sits = (id: string) => {
      const card = held.get(id);
      return card && itemAppearsInStage(card, stage.id, stages) ? [card] : [];
    };
    const stayed = [...ids].flatMap(sits);
    const arrived = [...listed].filter(id => !ids.has(id)).flatMap(sits);
    shown.set(stage.id, {
      cards: [...arrived, ...stayed],
      total: (column?.total ?? 0) - (ids.size - stayed.length) + arrived.length,
      listedAll: ids.size >= (column?.total ?? 0),
    });
  }
  return shown;
}
