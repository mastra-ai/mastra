import { MarkerType, ReactFlow } from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';

import { linkedNodes, MAP_COLUMNS, PROBLEM_MAP_EDGES, PROBLEM_MAP_GROUPS, placeNodes } from './problemMap';
import type { MapColumn, MapNodeId } from './problemMapNodes';
import { PROBLEM_MAP_NODES } from './problemMapNodes';
import { ProblemMapCard, ProblemMapLabel } from './ProblemMapCard';
import type { ProblemCardNode, ProblemLabelNode } from './ProblemMapCard';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 76;
const COLUMN_GAP = 56;
const ROW_HEIGHT = 88;
const GROUP_HEADER = 44;
const TOP = 32;
const MAP_WIDTH = MAP_COLUMNS.length * NODE_WIDTH + (MAP_COLUMNS.length - 1) * COLUMN_GAP;

const nodeTypes = { card: ProblemMapCard, label: ProblemMapLabel };

function columnX(column: MapColumn): number {
  return MAP_COLUMNS.findIndex(entry => entry.column === column) * (NODE_WIDTH + COLUMN_GAP);
}

function rowY(row: number, group: number): number {
  return TOP + (group + 1) * GROUP_HEADER + row * ROW_HEIGHT;
}

const GROUP_FIRST_ROWS = PROBLEM_MAP_GROUPS.map((_, index) =>
  PROBLEM_MAP_GROUPS.slice(0, index).reduce((rows, group) => rows + group.rows.length, 0),
);
const TOTAL_ROWS = PROBLEM_MAP_GROUPS.reduce((rows, group) => rows + group.rows.length, 0);
const MAP_HEIGHT = rowY(TOTAL_ROWS, PROBLEM_MAP_GROUPS.length - 1);

const COLUMN_LABELS: ProblemLabelNode[] = MAP_COLUMNS.map(({ column, title }) => ({
  id: `column-${column}`,
  type: 'label',
  position: { x: columnX(column), y: 0 },
  data: { text: title, kind: 'column' },
}));

const GROUP_LABELS: ProblemLabelNode[] = PROBLEM_MAP_GROUPS.map((group, index) => ({
  id: `group-${index}`,
  type: 'label',
  position: { x: 0, y: rowY(GROUP_FIRST_ROWS[index] ?? 0, index) - GROUP_HEADER },
  width: MAP_WIDTH,
  height: GROUP_HEADER - 12,
  data: { text: group.title, kind: 'group' },
}));

const CARDS: ProblemCardNode[] = placeNodes().map(placed => ({
  id: placed.id,
  type: 'card',
  position: { x: columnX(placed.node.column), y: rowY(placed.row, placed.group) },
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
  data: { placed },
}));

const FADE = { transition: 'opacity 150ms' };

function flowEdges(linked: Set<MapNodeId> | null): Edge[] {
  return PROBLEM_MAP_EDGES.map(edge => {
    const lit = linked !== null && linked.has(edge.source) && linked.has(edge.target);
    const color = lit ? 'var(--foreground)' : 'var(--border-strong)';
    return {
      ...edge,
      zIndex: lit ? 1 : 0,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: {
        ...FADE,
        stroke: color,
        strokeWidth: lit ? 2 : 1,
        strokeDasharray: PROBLEM_MAP_NODES[edge.target].open ? '4 4' : undefined,
        opacity: linked === null || lit ? 1 : 0.2,
      },
    };
  });
}

function isMapNodeId(id: string): id is MapNodeId {
  return id in PROBLEM_MAP_NODES;
}

export function ProblemMapCanvas() {
  const [hovered, setHovered] = useState<MapNodeId | null>(null);
  const linked = useMemo(() => (hovered === null ? null : linkedNodes(hovered)), [hovered]);
  const cards = useMemo(
    () =>
      CARDS.map(card => ({
        ...card,
        style: { ...FADE, opacity: linked === null || linked.has(card.data.placed.id) ? 1 : 0.3 },
      })),
    [linked],
  );
  const edges = useMemo(() => flowEdges(linked), [linked]);

  return (
    <div className="overflow-x-auto">
      <div style={{ width: MAP_WIDTH + 2, height: MAP_HEIGHT }}>
        <ReactFlow
          nodes={[...COLUMN_LABELS, ...GROUP_LABELS, ...cards]}
          edges={edges}
          onNodeMouseEnter={(_, node) => setHovered(isMapNodeId(node.id) ? node.id : null)}
          onNodeMouseLeave={() => setHovered(null)}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 1, y: 0, zoom: 1 }}
          minZoom={1}
          maxZoom={1}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        />
      </div>
    </div>
  );
}
