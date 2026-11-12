import type { Edge, Node } from '@xyflow/react';

import type { MapEventMove, MapPhase, MapTransition, MovesMap } from './movesMap';

export const PHASE_NODE = 'move-map-phase';
export const EVENT_NODE = 'move-map-event';
export const MOVE_EDGE = 'move-map-edge';
export const GUTTER_NODE = 'move-map-gutter';

const PHASE_WIDTH = 280;
const ROW = 168;
const EVENT_WIDTH = 240;
/** Room between the event column and the phases for the curves joining them. */
const EVENT_GAP = 140;
const EVENT_ROW = 148;

/** How far right of the phases a move between phases `distance` apart bows. */
export function moveBow(distance: number): number {
  return 28 + 26 * distance;
}

/** What the map is tracing: one phase's moves, or one event move. */
export type MapFocus = { kind: 'phase'; id: string } | { kind: 'event'; id: string } | undefined;

export type PhaseNodeData = { entry: MapPhase; dimmed: boolean };
export type EventNodeData = { move: MapEventMove; dimmed: boolean };
export type MoveEdgeData =
  | { kind: 'transition'; transition: MapTransition; emphasis: Emphasis }
  | { kind: 'event'; emphasis: Emphasis };
export type Emphasis = 'active' | 'idle' | 'faint' | 'hidden' | 'dimmed';

export type PhaseNodeModel = Node<PhaseNodeData, typeof PHASE_NODE>;
export type EventNodeModel = Node<EventNodeData, typeof EVENT_NODE>;
export type MoveEdgeModel = Edge<MoveEdgeData, typeof MOVE_EDGE>;

/**
 * Phases down one column in board order with the moves between them curving on their right, and each event move in
 * a column on their left beside the phase it moves cards to. Board order is the story, so it's placed by hand rather
 * than by a layout engine that would reorder it around the cycles.
 */
export function movesLayout(map: MovesMap, focus: MapFocus) {
  const row = new Map(map.phases.map((entry, index) => [entry.phase.id, index]));
  const tracedPhase = focus?.kind === 'phase' ? focus.id : undefined;
  const tracedEvent = focus?.kind === 'event' ? map.eventMoves.find(move => move.route.id === focus.id) : undefined;
  const phaseLit = (id: string) =>
    !focus ||
    id === tracedPhase ||
    id === tracedEvent?.to ||
    map.transitions.some(transition => transition.from === tracedPhase && transition.to === id) ||
    (map.phases.find(entry => entry.phase.id === tracedPhase)?.anyPhase ?? false);

  const phaseNodes = map.phases.map(
    (entry, index): PhaseNodeModel => ({
      id: entry.phase.id,
      type: PHASE_NODE,
      position: { x: 0, y: index * ROW },
      width: PHASE_WIDTH,
      data: { entry, dimmed: !phaseLit(entry.phase.id) },
    }),
  );
  let nextFree = 0;
  const eventNodes = [...map.eventMoves]
    .sort((a, b) => (row.get(a.to) ?? 0) - (row.get(b.to) ?? 0))
    .map((move): EventNodeModel => {
      const y = Math.max((row.get(move.to) ?? 0) * ROW, nextFree);
      nextFree = y + EVENT_ROW;
      return {
        id: `event:${move.route.id}`,
        type: EVENT_NODE,
        position: { x: -(EVENT_WIDTH + EVENT_GAP), y },
        width: EVENT_WIDTH,
        data: { move, dimmed: focus !== undefined && tracedEvent !== move && tracedPhase !== move.to },
      };
    });

  const transitionEdges = map.transitions.map(
    (transition): MoveEdgeModel => ({
      id: transition.id,
      type: MOVE_EDGE,
      source: transition.from,
      target: transition.to,
      data: {
        kind: 'transition',
        transition,
        // Nearly every phase can reach nearly every other, so the moves stay faint until a phase is traced.
        emphasis: !focus ? 'faint' : transition.from === tracedPhase ? 'active' : 'hidden',
      },
    }),
  );
  const eventEdges = map.eventMoves.map(
    (move): MoveEdgeModel => ({
      id: `event:${move.route.id}->${move.to}`,
      type: MOVE_EDGE,
      source: `event:${move.route.id}`,
      target: move.to,
      data: {
        kind: 'event',
        emphasis: !focus ? 'idle' : tracedEvent === move || tracedPhase === move.to ? 'active' : 'dimmed',
      },
    }),
  );
  // The curves bow past the phases, which fitting the view to the nodes alone would cut off.
  const widestBow = Math.max(0, ...map.transitions.map(transition => moveBow(transition.distance)));
  const gutter = {
    id: 'gutter',
    type: GUTTER_NODE,
    position: { x: PHASE_WIDTH + widestBow, y: 0 },
    data: {},
    selectable: false,
    focusable: false,
  };
  return {
    nodes: [...phaseNodes, ...eventNodes, gutter],
    edges: [...transitionEdges, ...eventEdges],
  };
}
