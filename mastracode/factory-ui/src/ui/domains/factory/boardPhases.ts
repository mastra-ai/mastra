import type { BoardPhasesSnapshot } from '../../../hooks/useWorkItems';
import { itemAppearsInStage } from './boardStages';
import type { WorkItem } from './services/workItems';
import type { BoardStageId } from './stages';

/** What a board column shows of one phase, from one read of its view. */
export interface ShownPhase {
  /** The cards shown, in the view's order. */
  cards: WorkItem[];
  /** How many cards of the phase match the view, listed or not. */
  total: number;
  /** How many cards the server listed: what a deeper window is counted from. */
  listed: number;
  /** Whether the server listed every matching card, so nothing is left to load. */
  listedAll: boolean;
}

const NO_CARDS: WorkItem[] = [];

/**
 * The cards each phase shows. The server decided which cards the view lists and in what order.
 * Where a named card sits is read from the card itself, so a card moved in this tab leaves its
 * phase and tops the one it entered at once, before the next read lists it there. The asked card
 * tops each phase that holds it deeper than it is listed: it shows without the cards above it.
 */
export function shownBoardPhases(
  snapshot: BoardPhasesSnapshot | undefined,
  stages: ReadonlyArray<{ id: BoardStageId }>,
): ReadonlyMap<BoardStageId, ShownPhase> {
  const shown = new Map<BoardStageId, ShownPhase>();
  if (!snapshot) {
    for (const stage of stages) shown.set(stage.id, { cards: NO_CARDS, total: 0, listed: 0, listedAll: true });
    return shown;
  }
  const held = new Map(snapshot.workItems.map(card => [card.id, card]));
  const asked = snapshot.asked;
  // The cards the view places somewhere. An asked card the view leaves out is in no phase.
  const placed = new Set(snapshot.phases.flatMap(listed => listed.ids));
  if (asked && asked.phases.length > 0) placed.add(asked.id);
  for (const stage of stages) {
    const listed = snapshot.phases.find(candidate => candidate.phase === stage.id);
    const ids = new Set(listed?.ids);
    const sits = (id: string) => {
      const card = held.get(id);
      return card && itemAppearsInStage(card, stage.id, stages) ? [card] : [];
    };
    const stayed = [...ids].flatMap(sits);
    // Held by the phase below what it lists: its total counts the card already.
    const heldDeeper = asked !== undefined && asked.phases.includes(stage.id) && !ids.has(asked.id);
    const deeper = heldDeeper ? sits(asked.id) : [];
    const arrived = [...placed].filter(id => !ids.has(id) && !(heldDeeper && id === asked.id)).flatMap(sits);
    // The cards the total counted that have left the phase since: the listed ones, and the asked one.
    const left = ids.size - stayed.length + (heldDeeper ? 1 - deeper.length : 0);
    shown.set(stage.id, {
      cards: [...arrived, ...deeper, ...stayed],
      total: (listed?.total ?? 0) - left + arrived.length,
      listed: ids.size,
      listedAll: ids.size >= (listed?.total ?? 0),
    });
  }
  return shown;
}
