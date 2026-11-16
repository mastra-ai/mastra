import type { BoardPhaseKind } from './define-board.js';

/**
 * The one rule for moving a busy card, shared by the server's transition service and the board UI:
 * while a run is in flight on the card, or queued for it, a person may not move it into a phase that
 * may start another run. Resting and terminal phases start nothing, so closing or parking a busy card
 * stays allowed.
 */
export const BUSY_CARD_MOVE_REFUSAL = "Another run can't start while this card is busy.";

/** An unknown phase may start a run, so it is held to the busy rule. */
export function phaseMayStartRun(kind: BoardPhaseKind | undefined): boolean {
  return kind !== 'resting' && kind !== 'terminal';
}
