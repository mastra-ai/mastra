import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ReactNode } from 'react';
import type { KnowledgeGraphNode, KnowledgeGraphPayload } from '../../services/knowledge';
import type { Arrivals } from './graphDiff';
import { KnowledgeGraphScene } from './KnowledgeGraphScene';
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

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphScene {...props} />
    </ReactFlowProvider>
  );
}
