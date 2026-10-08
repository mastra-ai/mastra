import { Txt } from '@mastra/playground-ui/components/Txt';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { KnowledgeGraphNode, KnowledgeGraphPayload } from '../../services/knowledge';
import type { Arrivals } from './graphDiff';
import { NO_FILTERS } from './graphModel';
import type { KnowledgeGraphFilters } from './graphModel';
import { KnowledgeGraphCanvas } from './KnowledgeGraphCanvas';
import { KnowledgeGraphPresentation } from './KnowledgeGraphPresentation';
import { createKnowledgeScene, getVisibleKnowledgeIds, getKnowledgeArrivalScene } from './knowledgeScene';
import { KnowledgeGraphController } from './KnowledgeGraphController';
import { KnowledgeGraphControls } from './KnowledgeGraphControls';
import { KnowledgeGraphHover } from './KnowledgeGraphHover';
import type { KnowledgeHoverHandle } from './KnowledgeGraphHover';
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
  const [initialScene] = useState(() => getKnowledgeArrivalScene(createKnowledgeScene(payload), arrivals));
  const events = useRef({ onNodeClick, onClearFocus, onEdgeClick });
  useEffect(() => {
    events.current = { onNodeClick, onClearFocus, onEdgeClick };
  }, [onNodeClick, onClearFocus, onEdgeClick]);
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
      <KnowledgeGraphCanvas scene={initialScene} events={events} hoverRef={hoverRef} />
      <KnowledgeGraphPresentation
        canvasRef={canvasRef}
        payload={payload}
        filters={filters}
        focusedId={focusedId}
        focusedRecordId={focusedRecordId}
      />
      <KnowledgeGraphController
        payload={payload}
        arrivals={arrivals}
        filters={filters}
        focusedId={focusedId}
        canvasRef={canvasRef}
      />
      <KnowledgeGraphControls canvasRef={canvasRef} visibleIds={visibleIds} focusedId={focusedId} />
      <KnowledgeGraphToolbar payload={payload} filters={filters} onFiltersChange={setFilters} onSelect={onNodeClick}>
        {children}
      </KnowledgeGraphToolbar>
      <TruncationBanner payload={payload} />
      <KnowledgeGraphHover ref={hoverRef} nodesById={nodesById} />
    </div>
  );
}
