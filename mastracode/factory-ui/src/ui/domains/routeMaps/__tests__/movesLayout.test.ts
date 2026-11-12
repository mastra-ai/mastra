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

  it('keeps a switched-off move dim, even when its phase is traced', () => {
    const off = routes.map(route => (route.id === 'closed-completed' ? { ...route, enabled: false } : route));
    const withOff = movesMap(workBoardInfo, off);
    const id = 'event:closed-completed->done';

    expect(emphasisByEdge(movesLayout(withOff, undefined).edges)[id]).toBe('dimmed');
    expect(emphasisByEdge(movesLayout(withOff, { kind: 'phase', id: 'done' }).edges)[id]).toBe('dimmed');
    expect(emphasisByEdge(movesLayout(withOff, { kind: 'event', id: 'closed-completed' }).edges)[id]).toBe('dimmed');
  });

  it('groups event moves beside the phase they lead to, in the order they are checked within each group', () => {
    // However the moves arrive, each group reads in check order.
    const shuffled = { ...map, eventMoves: [...map.eventMoves].reverse() };
    const placed = movesLayout(shuffled, undefined)
      .nodes.flatMap(node => ('move' in node.data ? [{ move: node.data.move, y: node.position.y }] : []))
      .sort((a, b) => a.y - b.y)
      .map(({ move }) => move);

    const phaseOrder = map.phases.map(entry => entry.phase.id);
    const groups = phaseOrder.map(phase => placed.filter(move => move.to === phase).map(move => move.position));
    for (const positions of groups) expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // Groups follow the phases top to bottom.
    const targets = placed.map(move => phaseOrder.indexOf(move.to));
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(groups.filter(positions => positions.length > 1).length).toBeGreaterThan(0);
  });

  it('starts each card below the measured height of the one above, so tall cards never overlap', () => {
    const tops = (heights?: Map<string, number>) =>
      Object.fromEntries(movesLayout(map, undefined, heights).nodes.map(node => [node.id, node.position.y]));
    const fixed = tops();
    const tall = tops(new Map([['intake', 400]]));

    // Unmeasured, phases sit a row apart; a taller Intake pushes every phase below it down.
    expect(fixed.triage - fixed.intake).toBe(168);
    expect(tall.triage - tall.intake).toBe(448);
    expect(tall.planning - tall.triage).toBe(168);

    const events = map.eventMoves.map(move => `event:${move.route.id}`);
    const sameRow = events.filter(id => fixed[id] !== undefined).sort((a, b) => fixed[a] - fixed[b]);
    const [first, second] = sameRow;
    const tallEvent = tops(new Map([[first, 300]]));
    expect(tallEvent[second] - tallEvent[first]).toBeGreaterThanOrEqual(316);
  });
});
