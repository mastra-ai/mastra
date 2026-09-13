import { Background, BackgroundVariant, ReactFlow, useReactFlow } from '@xyflow/react';
import type { Edge, Node, ReactFlowProps } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef } from 'react';
import { ZoomSlider } from './zoom-slider';
import '@xyflow/react/dist/style.css';

export interface WorkflowGraphCanvasProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> extends Pick<
  ReactFlowProps<NodeType, EdgeType>,
  'nodes' | 'edges' | 'nodeTypes' | 'edgeTypes' | 'onNodesChange' | 'onNodeClick'
> {
  focusNodeId?: string;
  variant?: 'default' | 'nested';
}

export function WorkflowGraphCanvas<NodeType extends Node, EdgeType extends Edge>({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onNodeClick,
  focusNodeId,
  variant = 'default',
}: WorkflowGraphCanvasProps<NodeType, EdgeType>) {
  const graphRef = useRef<HTMLDivElement>(null);
  const { getNodes, setCenter } = useReactFlow<NodeType, EdgeType>();
  const focusOnNode = useEffectEvent((nodeId: string) => {
    const focusNode = getNodes().find(node => node.id === nodeId);
    if (!focusNode) return;
    graphRef.current?.focus({ preventScroll: true });
    const width = focusNode.measured?.width ?? focusNode.width ?? 274;
    const height = focusNode.measured?.height ?? focusNode.height ?? 100;
    void setCenter(focusNode.position.x + width / 2, focusNode.position.y + height / 2, {
      duration: 300,
      zoom: 1,
    });
  });

  useEffect(() => {
    if (focusNodeId) focusOnNode(focusNodeId);
  }, [focusNodeId, nodes]);

  return (
    <div
      ref={graphRef}
      tabIndex={-1}
      data-testid="workflow-graph-viewport"
      className={variant === 'nested' ? 'bg-surface1 size-full outline-none' : 'bg-surface2 size-full outline-none'}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.01}
        maxZoom={1}
      >
        <ZoomSlider position="bottom-left" />
        <Background
          variant={variant === 'nested' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          gap={12}
          size={0.5}
          color={variant === 'nested' ? 'var(--border1)' : undefined}
        />
      </ReactFlow>
    </div>
  );
}
