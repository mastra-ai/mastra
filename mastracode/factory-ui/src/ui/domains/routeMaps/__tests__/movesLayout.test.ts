import { describe, expect, it } from 'vitest';

import { workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { movesLayout } from '../moves/movesLayout';
import type { MoveEdgeModel } from '../moves/movesLayout';
import { movesMap } from '../moves/movesMap';
import { seededRoutes } from './fixtures';

const routes = seededRoutes();

function emphasisByEdge(edges: MoveEdgeModel[]) {
  return Object.fromEntries(edges.map(edge => [edge.id, edge.data?.emphasis]));
}

describe('movesLayout', () => {
  const map = movesMap(workBoardInfo, routes);

  it('keeps every move between phases faint until a phase is traced', () => {
    const edges = emphasisByEdge(movesLayout(map, undefined).edges);

    const between = map.transitions.map(transition => edges[transition.id]);
    expect(between.length).toBeGreaterThan(0);
    expect(new Set(between)).toEqual(new Set(['faint']));
    // The moves an issue triggers stay readable: there are few, and each has its own card.
    const triggered = map.eventMoves.map(move => edges[`event:${move.route.id}->${move.to}`]);
    expect(triggered.length).toBeGreaterThan(0);
    expect(new Set(triggered)).toEqual(new Set(['idle']));
  });

  it("shows only the traced phase's moves", () => {
    const edges = emphasisByEdge(movesLayout(map, { kind: 'phase', id: 'planning' }).edges);

    const fromPlanning = map.transitions.filter(transition => transition.from === 'planning');
    expect(fromPlanning.map(transition => transition.to)).toEqual(['intake', 'triage', 'execute', 'done', 'canceled']);
    for (const transition of map.transitions) {
      expect(edges[transition.id]).toBe(transition.from === 'planning' ? 'active' : 'hidden');
    }
  });
});
