import type { IntakeEvaluator, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import { resolveIntake, resolveIntakePlacement } from './intake-routing.js';
import type { BoardRegistry } from './registry.js';
import { effectiveBoard, moveCardToBoard } from './relocate.js';

export type RerouteMove = { item: Card; fromBoard: string; toBoard: string; toPhase: string; routeId: string };

/**
 * A card nobody has worked yet: it sits alone in its board's first phase with no session on it.
 * Only such cards follow a change to the intake routes; anything further along stays put.
 */
function untouched(item: Card, registry: BoardRegistry): boolean {
  const board = registry.get(effectiveBoard(item));
  if (!board) return false;
  return item.stages.length === 1 && item.stages[0] === board.initialPhase && Object.keys(item.sessions).length === 0;
}

/**
 * Which untouched cards the routes, as they stand, would file on a different board. Each lands at
 * the start of its new board. A card no route places stays where it is. Under `intake-order` the
 * boards are asked in `order`, as a new arrival would be.
 */
export function planReroute(
  routes: readonly StoredIntakeRouteRecord[],
  items: readonly Card[],
  registry: BoardRegistry,
  intake: { evaluator: IntakeEvaluator; order: readonly string[] } = { evaluator: 'route-list', order: [] },
): RerouteMove[] {
  const moves: RerouteMove[] = [];
  for (const item of items) {
    if (!untouched(item, registry)) continue;
    const placement = placementOf(routes, item, registry, intake);
    if (!placement) continue;
    const fromBoard = effectiveBoard(item);
    if (placement.board === fromBoard) continue;
    const target = registry.get(placement.board)!;
    moves.push({ item, fromBoard, toBoard: placement.board, toPhase: target.initialPhase, routeId: placement.routeId });
  }
  return moves;
}

function placementOf(
  routes: readonly StoredIntakeRouteRecord[],
  item: Card,
  registry: BoardRegistry,
  intake: { evaluator: IntakeEvaluator; order: readonly string[] },
): { board: string; routeId: string } | undefined {
  if (intake.evaluator === 'route-list') return resolveIntakePlacement(routes, cardRuleFacts(item), registry);
  const resolution = resolveIntake({ ...intake, routes, facts: cardRuleFacts(item), registry });
  return resolution.outcome === 'placed' && resolution.routeId !== null
    ? { board: resolution.board, routeId: resolution.routeId }
    : undefined;
}

/** How many cards a plan moves from each board to each other board. */
export function summarizeReroute(
  moves: readonly RerouteMove[],
): { fromBoard: string; toBoard: string; count: number }[] {
  const counts = new Map<string, { fromBoard: string; toBoard: string; count: number }>();
  for (const { fromBoard, toBoard } of moves) {
    const key = `${fromBoard}\u0000${toBoard}`;
    const entry = counts.get(key) ?? { fromBoard, toBoard, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()];
}

export async function applyReroute({
  moves,
  workItems,
  registry,
  userId,
}: {
  moves: readonly RerouteMove[];
  workItems: Pick<WorkItemsStorage, 'update' | 'supersedeDecisionsForWorkItem'>;
  registry: BoardRegistry;
  userId: string;
}): Promise<{ moved: number; skipped: number }> {
  let moved = 0;
  let skipped = 0;
  for (const move of moves) {
    const result = await moveCardToBoard({
      workItems,
      boardRegistry: registry,
      userId,
      item: move.item,
      targetBoard: move.toBoard,
      targetStage: move.toPhase,
    });
    if (result === 'moved') moved += 1;
    else skipped += 1;
  }
  return { moved, skipped };
}
