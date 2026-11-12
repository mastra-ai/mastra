import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { WorkflowGraphCanvas, WorkflowNodeFrame } from '@mastra/playground-ui/components/Workflow';
import { ReactFlowProvider, useStore } from '@xyflow/react';
import type { Dimensions, Edge, Node, NodeChange, NodeProps } from '@xyflow/react';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { boardConfigPath } from '../../boardConfig/boardConfigPaths';
import { EventMoveCard, PhaseCard } from './MapCards';
import { MoveEdge } from './MoveEdge';
import { EVENT_NODE, GUTTER_NODE, MOVE_EDGE, movesCanvasVariant, movesLayout, PHASE_NODE } from './movesLayout';
import type { EventNodeModel, MapFocus, PhaseNodeModel } from './movesLayout';
import { movesMap } from './movesMap';
import type { MovesMap } from './movesMap';

type MapContext = {
  factoryId: string;
  board: InstalledBoardInfo;
  /** Where the editor shows one move, for an event move to link to. */
  moveHref: (routeId: string) => string;
  trace: (focus: MapFocus) => void;
};

const MapContext = createContext<MapContext | undefined>(undefined);

function useMapContext(): MapContext {
  const context = useContext(MapContext);
  if (!context) throw new Error('A card moves map node rendered outside its map.');
  return context;
}

/** Hovering or focusing a card traces its moves; leaving it shows the whole board again. */
function TraceLink({
  to,
  focus,
  label,
  children,
}: {
  to: string;
  focus: MapFocus;
  label: string;
  children: ReactNode;
}) {
  const { trace } = useMapContext();
  return (
    <Link
      to={to}
      aria-label={label}
      className="focus-visible:outline-border-focus block rounded-xl focus-visible:outline-2"
      onPointerEnter={() => trace(focus)}
      onPointerLeave={() => trace(undefined)}
      onFocus={() => trace(focus)}
      onBlur={() => trace(undefined)}
    >
      {children}
    </Link>
  );
}

function PhaseNode({ data }: NodeProps<PhaseNodeModel>) {
  const { factoryId, board } = useMapContext();
  const { phase } = data.entry;
  return (
    <WorkflowNodeFrame>
      <TraceLink
        to={boardConfigPath(factoryId, board.id, phase.id)}
        focus={{ kind: 'phase', id: phase.id }}
        label={`Configure ${phase.name ?? phase.title}`}
      >
        <PhaseCard board={board} entry={data.entry} dimmed={data.dimmed} />
      </TraceLink>
    </WorkflowNodeFrame>
  );
}

function EventNode({ data }: NodeProps<EventNodeModel>) {
  const { board, moveHref } = useMapContext();
  return (
    <WorkflowNodeFrame>
      <TraceLink
        to={moveHref(data.move.route.id)}
        focus={{ kind: 'event', id: data.move.route.id }}
        label={`Edit ${data.move.route.name}`}
      >
        <EventMoveCard board={board} move={data.move} dimmed={data.dimmed} />
      </TraceLink>
    </WorkflowNodeFrame>
  );
}

/** Holds room for the curves right of the phases. */
function GutterNode() {
  return <div aria-hidden="true" className="size-px" />;
}

const NODE_TYPES = { [PHASE_NODE]: PhaseNode, [EVENT_NODE]: EventNode, [GUTTER_NODE]: GutterNode };
const EDGE_TYPES = { [MOVE_EDGE]: MoveEdge };

/** A board as a state machine: its phases in order, the moves between them, and the moves its issues trigger. */
export function CardMovesMap({
  factoryId,
  boardId,
  moveHref,
}: {
  factoryId: string;
  boardId: string;
  moveHref: (routeId: string) => string;
}) {
  const catalog = useBoardCatalog(factoryId);
  const routesQuery = useIntakeRoutesQuery(factoryId);
  if (catalog.isPending || routesQuery.isPending) {
    return (
      <Txt as="p" variant="caption" tone="muted" role="status">
        Loading card moves…
      </Txt>
    );
  }
  const error = catalog.error ?? routesQuery.error;
  if (error) return <Notice variant="destructive">{error.message}</Notice>;
  const board = catalog.data?.find(candidate => candidate.id === boardId);
  if (!board) return <Notice variant="destructive">This board isn’t installed.</Notice>;
  return (
    <MovesFlow
      factoryId={factoryId}
      board={board}
      map={movesMap(board, routesQuery.data?.intakeRoutes ?? [])}
      moveHref={moveHref}
    />
  );
}

function MovesFlow({
  factoryId,
  board,
  map,
  moveHref,
}: {
  factoryId: string;
  board: InstalledBoardInfo;
  map: MovesMap;
  moveHref: (routeId: string) => string;
}) {
  const [focus, setFocus] = useState<MapFocus>();
  // The canvas only fits the map once every card is measured, and it reports sizes back as node changes.
  const [sizes, setSizes] = useState<ReadonlyMap<string, Dimensions>>(new Map());
  const heights = new Map([...sizes].map(([id, size]) => [id, size.height]));
  const layout = movesLayout(map, focus, heights);
  const nodes = layout.nodes.map(node => ({ ...node, measured: sizes.get(node.id) }));
  const edges = layout.edges;
  const measure = (changes: NodeChange[]) => {
    const measured = changes.flatMap(change =>
      change.type === 'dimensions' && change.dimensions ? [[change.id, change.dimensions] as const] : [],
    );
    if (measured.length > 0) setSizes(current => new Map([...current, ...measured]));
  };
  const context: MapContext = { factoryId, board, moveHref, trace: setFocus };

  return (
    <MapContext.Provider value={context}>
      <div className="@container flex flex-col gap-3">
        <Txt as="p" variant="caption" tone="muted" className="hidden @min-[48rem]:block">
          Phases run top to bottom, with the moves between them on the right and the moves an issue or pull request
          triggers on the left. Hover a phase to see every move out of it, including the ones that finish a card.
        </Txt>
        {map.eventMoves.length > 0 && (
          <Txt as="p" variant="caption" tone="muted">
            A move’s number is the order moves are checked in; the first that matches wins.
          </Txt>
        )}
        <div
          className="border-border hidden overflow-hidden rounded-xl border @min-[48rem]:block"
          style={{ height: Math.min(1100, Math.max(map.phases.length * 150, map.eventMoves.length * 150) + 80) }}
        >
          <ReactFlowProvider>
            <MovesCanvas nodes={nodes} edges={edges} onNodesChange={measure} />
          </ReactFlowProvider>
        </div>
        <MovesList factoryId={factoryId} board={board} map={map} moveHref={moveHref} />
      </div>
    </MapContext.Provider>
  );
}

/** The canvas, fit to its box while the cards stay readable, pannable and zoomable once they wouldn't. */
function MovesCanvas({
  nodes,
  edges,
  onNodesChange,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
}) {
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  const variant = movesCanvasVariant(nodes, width, height);
  return (
    // Studio's inline canvas hides React Flow's attribution; the pannable one doesn't, so hide it here too.
    <div className="size-full [&_[class*=attribution]]:hidden" data-canvas-variant={variant}>
      <WorkflowGraphCanvas
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        variant={variant}
      />
    </div>
  );
}

/** The same map as a list, for screens too narrow for the canvas. */
function MovesList({
  factoryId,
  board,
  map,
  moveHref,
}: {
  factoryId: string;
  board: InstalledBoardInfo;
  map: MovesMap;
  moveHref: (routeId: string) => string;
}) {
  return (
    <div className="flex flex-col gap-6 @min-[48rem]:hidden">
      <ol aria-label="Phases" className="flex flex-col gap-2">
        {map.phases.map(entry => (
          <li key={entry.phase.id}>
            <Link to={boardConfigPath(factoryId, board.id, entry.phase.id)} className="block rounded-xl">
              <PhaseCard board={board} entry={entry} />
            </Link>
          </li>
        ))}
      </ol>
      {map.eventMoves.length > 0 && (
        <ul aria-label="Moves when an issue changes" className="flex flex-col gap-2">
          {map.eventMoves.map(move => (
            <li key={move.route.id}>
              <Link to={moveHref(move.route.id)} className="block rounded-xl">
                <EventMoveCard board={board} move={move} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
