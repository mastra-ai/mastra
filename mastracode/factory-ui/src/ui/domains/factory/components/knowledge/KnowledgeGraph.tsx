import { Txt } from '@mastra/playground-ui/components/Txt';
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { KnowledgeGraphNode, KnowledgeGraphPayload } from '../../services/knowledge';
import type { Arrivals } from './graphDiff';
import { NO_FILTERS } from './graphModel';
import type { KnowledgeFlowEdge, KnowledgeGraphFilters } from './graphModel';
import { getMiniMapNodeColor, isKnowledgeNode, isRecordNode } from './knowledgeStyles';
import type { KnowledgeFlowNode } from './knowledgeStyles';
import {
  createKnowledgeScene,
  getVisibleKnowledgeIds,
  presentKnowledgeNodes,
  presentKnowledgeEdges,
} from './knowledgeScene';
import { KnowledgeGraphController } from './KnowledgeGraphController';
import { KnowledgeGraphControls } from './KnowledgeGraphControls';
import { KnowledgeGraphHover } from './KnowledgeGraphHover';
import type { KnowledgeHoverHandle } from './KnowledgeGraphHover';
import { knowledgeEdgeTypes } from './KnowledgeGraphLink';
import { knowledgeNodeTypes } from './KnowledgeGraphNodes';
import { KnowledgeGraphToolbar } from './KnowledgeGraphToolbar';
import './knowledge.css';

export interface KnowledgeGraphProps {
  payload: KnowledgeGraphPayload;
  arrivals?: Arrivals;
  focusedId?: string;
  focusedRecordId?: string;
  onNodeClick: (node: KnowledgeGraphNode) => void;
  onClearFocus: () => void;
  onEdgeClick: (edge: { source: string; target: string; recordId: string }) => void;
  children?: ReactNode;
}

function TruncationBanner({ payload }: { payload: KnowledgeGraphPayload }) {
  const parts: string[] = [];
  if (payload.truncated) parts.push(`showing the newest ${payload.nodes.length} nodes`);
  if (payload.outOfWindow.length > 0) parts.push(`${payload.outOfWindow.length} linked nodes outside the window`);
  if (payload.unresolvedCapped.count > 0) parts.push(`${payload.unresolvedCapped.count} links unresolved (capped)`);
  if (parts.length === 0) return null;
  return (
    <Txt
      as="p"
      variant="caption"
      tone="muted"
      data-testid="knowledge-truncation-banner"
      className="bg-card pointer-events-none absolute bottom-4 left-1/2 z-10 max-w-80 -translate-x-1/2 rounded-md px-3 py-1"
    >
      Partial view — {parts.join(' · ')}
    </Txt>
  );
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner {...props} />
    </ReactFlowProvider>
  );
}

function KnowledgeGraphInner({
  payload,
  arrivals,
  focusedId,
  focusedRecordId,
  onNodeClick,
  onClearFocus,
  onEdgeClick,
  children,
}: KnowledgeGraphProps) {
  const [filters, setFilters] = useState<KnowledgeGraphFilters>(NO_FILTERS);
  const [initialScene] = useState(() => {
    const scene = createKnowledgeScene(payload);
    const ids = getVisibleKnowledgeIds(payload, NO_FILTERS, focusedId);
    return {
      nodes: presentKnowledgeNodes(scene.nodes, ids, { nodeId: focusedId, recordId: focusedRecordId }, arrivals),
      edges: presentKnowledgeEdges(scene.edges, ids, focusedRecordId, arrivals),
    };
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<KnowledgeHoverHandle>(null);
  const visibleIds = getVisibleKnowledgeIds(payload, filters, focusedId);
  const nodesById = new Map(payload.nodes.map(node => [node.id, node]));

  return (
    <div
      ref={canvasRef}
      className="knowledge-canvas bg-background relative h-full w-full overflow-hidden"
      data-testid="knowledge-graph"
    >
      <ReactFlow<KnowledgeFlowNode, KnowledgeFlowEdge>
        defaultNodes={initialScene.nodes}
        defaultEdges={initialScene.edges}
        nodeTypes={knowledgeNodeTypes}
        edgeTypes={knowledgeEdgeTypes}
        minZoom={0.05}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        panOnScroll
        panOnScrollSpeed={1}
        zoomOnScroll={false}
        zoomOnPinch
        onNodeClick={(_, node) => {
          hoverRef.current?.hide();
          if (isRecordNode(node)) {
            const record = node.data.record;
            const [source = '', target = source] = record.nodeIds;
            onEdgeClick({ source, target, recordId: record.id });
          } else if (isKnowledgeNode(node)) onNodeClick(node.data.node);
        }}
        onPaneClick={onClearFocus}
        onEdgeClick={(_, edge) => {
          hoverRef.current?.hide();
          const source = edge.source.startsWith('record:') ? edge.target : edge.source;
          if (source.startsWith('record:')) return;
          onEdgeClick({ source, target: edge.target, recordId: edge.data?.recordId ?? '' });
        }}
        onNodeMouseEnter={(event, node) => {
          if (isRecordNode(node))
            hoverRef.current?.show({ kind: 'record', x: event.clientX, y: event.clientY, record: node });
          else if (isKnowledgeNode(node))
            hoverRef.current?.show({ kind: 'node', x: event.clientX, y: event.clientY, node });
        }}
        onNodeMouseLeave={() => hoverRef.current?.hide()}
        onEdgeMouseEnter={(event, edge) =>
          hoverRef.current?.show({ kind: 'edge', x: event.clientX, y: event.clientY, edge })
        }
        onEdgeMouseLeave={() => hoverRef.current?.hide()}
        onNodeDragStart={() => hoverRef.current?.hide()}
        onMoveStart={() => hoverRef.current?.hide()}
      >
        <KnowledgeGraphController
          payload={payload}
          arrivals={arrivals}
          filters={filters}
          focusedId={focusedId}
          focusedRecordId={focusedRecordId}
          canvasRef={canvasRef}
        />
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="var(--border-strong)" />
        <MiniMap<KnowledgeFlowNode>
          position="bottom-left"
          pannable
          zoomable
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
          nodeColor={getMiniMapNodeColor}
          nodeStrokeColor="transparent"
          nodeStrokeWidth={3}
          nodeBorderRadius={999}
          maskColor="var(--scrim)"
        />
        <KnowledgeGraphControls canvasRef={canvasRef} visibleIds={visibleIds} focusedId={focusedId} />
      </ReactFlow>
      <KnowledgeGraphToolbar payload={payload} filters={filters} onFiltersChange={setFilters} onSelect={onNodeClick}>
        {children}
      </KnowledgeGraphToolbar>
      <TruncationBanner payload={payload} />
      <KnowledgeGraphHover ref={hoverRef} nodesById={nodesById} />
    </div>
  );
}
