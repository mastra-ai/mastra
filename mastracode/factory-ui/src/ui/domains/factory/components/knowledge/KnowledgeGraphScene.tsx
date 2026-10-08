import { useEffect, useRef, useState } from 'react';
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

import type { KnowledgeGraphProps } from './KnowledgeGraph';
import { KnowledgeTruncationBanner as TruncationBanner } from './KnowledgeTruncationBanner';
export function KnowledgeGraphScene({
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
