import type { Edge, Node } from '@xyflow/react';

import type { MapEventMove, MapPhase, MapTransition, MovesMap } from './movesMap';

export const PHASE_NODE = 'move-map-phase';
export const EVENT_NODE = 'move-map-event';
export const MOVE_EDGE = 'move-map-edge';
export const GUTTER_NODE = 'move-map-gutter';

const PHASE_WIDTH = 280;
/** Where a phase starts below the one above, unless that one's card is taller. */
const ROW = 168;
/** Space kept below a phase card, for the moves leaving and arriving at its middle. */
const PHASE_SPACING = 48;
const EVENT_WIDTH = 240;
/** Room between the event column and the phases for the curves joining them. */
const EVENT_GAP = 140;
const EVENT_ROW = 148;
const EVENT_SPACING = 16;

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
export function movesLayout(map: MovesMap, focus: MapFocus, heights: ReadonlyMap<string, number> = new Map()) {
  // Cards are placed by their measured height once the canvas has measured them, so a tall one never overlaps the next.
  const top = new Map<string, number>();
  let phaseY = 0;
  for (const entry of map.phases) {
    top.set(entry.phase.id, phaseY);
    phaseY += Math.max(ROW, (heights.get(entry.phase.id) ?? 0) + PHASE_SPACING);
  }
  const tracedPhase = focus?.kind === 'phase' ? focus.id : undefined;
  const tracedEvent = focus?.kind === 'event' ? map.eventMoves.find(move => move.route.id === focus.id) : undefined;
  const phaseLit = (id: string) =>
    !focus ||
    id === tracedPhase ||
    id === tracedEvent?.to ||
    map.transitions.some(transition => transition.from === tracedPhase && transition.to === id) ||
    (map.phases.find(entry => entry.phase.id === tracedPhase)?.anyPhase ?? false);

  const phaseNodes = map.phases.map(
    (entry): PhaseNodeModel => ({
      id: entry.phase.id,
      type: PHASE_NODE,
      position: { x: 0, y: top.get(entry.phase.id) ?? 0 },
      width: PHASE_WIDTH,
      data: { entry, dimmed: !phaseLit(entry.phase.id) },
    }),
  );
  let nextFree = 0;
  const eventNodes = [...map.eventMoves]
    .sort((a, b) => (top.get(a.to) ?? 0) - (top.get(b.to) ?? 0))
    .map((move): EventNodeModel => {
      const id = `event:${move.route.id}`;
      const y = Math.max(top.get(move.to) ?? 0, nextFree);
      nextFree = y + Math.max(EVENT_ROW, (heights.get(id) ?? 0) + EVENT_SPACING);
      return {
        id,
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
  const eventEmphasis = (move: MapEventMove): Emphasis => {
    // A switched-off move never runs, so its link stays dim like its card.
    if (!move.route.enabled) return 'dimmed';
    if (!focus) return 'idle';
    return tracedEvent === move || tracedPhase === move.to ? 'active' : 'dimmed';
  };
  const eventEdges = map.eventMoves.map(
    (move): MoveEdgeModel => ({
      id: `event:${move.route.id}->${move.to}`,
      type: MOVE_EDGE,
      source: `event:${move.route.id}`,
      target: move.to,
      data: { kind: 'event', emphasis: eventEmphasis(move) },
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

/** Below this scale the cards are too small to read, so the map lets people zoom and drag around it instead. */
export const PAN_ZOOM_BELOW = 0.6;
/** The padding the inline canvas fits the map with, on each side. */
const FIT_PADDING = 20;

type Placed = { position: { x: number; y: number }; width?: number; measured?: { width?: number; height?: number } };

/** The scale the inline canvas fits these nodes into a `width` by `height` canvas at; never above 1. */
export function fitScale(nodes: readonly Placed[], width: number, height: number): number {
  if (nodes.length === 0) return 1;
  const right = (node: Placed) => node.position.x + (node.measured?.width ?? node.width ?? 0);
  const bottom = (node: Placed) => node.position.y + (node.measured?.height ?? 0);
  const spanX = Math.max(...nodes.map(right)) - Math.min(...nodes.map(node => node.position.x));
  const spanY = Math.max(...nodes.map(bottom)) - Math.min(...nodes.map(node => node.position.y));
  const fits = [spanX > 0 ? (width - 2 * FIT_PADDING) / spanX : 1, spanY > 0 ? (height - 2 * FIT_PADDING) / spanY : 1];
  return Math.min(1, ...fits);
}

/**
 * The canvas a map fits in: inline (fit to the box, page scroll untouched) while its cards stay readable, and
 * the pannable canvas with a zoom slider once fitting would shrink them below `PAN_ZOOM_BELOW`. Unmeasured, inline.
 */
export function movesCanvasVariant(nodes: readonly Placed[], width: number, height: number): 'inline' | 'default' {
  if (!width || !height) return 'inline';
  return fitScale(nodes, width, height) < PAN_ZOOM_BELOW ? 'default' : 'inline';
}
