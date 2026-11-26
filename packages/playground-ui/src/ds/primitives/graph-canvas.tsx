import { ReactFlow } from '@xyflow/react';
import type { Edge, Node, ReactFlowProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphCanvasBackground } from './graph-canvas-background';

type GraphCanvasProps<NodeType extends Node, EdgeType extends Edge> = Omit<
  ReactFlowProps<NodeType, EdgeType>,
  'panOnScroll' | 'panOnDrag' | 'zoomOnPinch' | 'zoomOnDoubleClick' | 'preventScrolling'
> & {
  /** Inline previews leave gestures to the surrounding page. */
  interactive?: boolean;
};

export function GraphCanvas<NodeType extends Node, EdgeType extends Edge>({
  interactive = true,
  zoomOnScroll = false,
  children,
  ...props
}: GraphCanvasProps<NodeType, EdgeType>) {
  return (
    <ReactFlow
      {...props}
      panOnScroll={interactive && !zoomOnScroll}
      panOnDrag={interactive}
      zoomOnScroll={interactive && zoomOnScroll}
      zoomOnPinch={interactive}
      zoomOnDoubleClick={interactive}
      preventScrolling={interactive}
    >
      {children}
      {interactive && <GraphCanvasBackground />}
    </ReactFlow>
  );
}
