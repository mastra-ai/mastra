import { Background, BackgroundVariant, ReactFlow, useNodesInitialized, useReactFlow, useStore } from '@xyflow/react';
import type { Edge, Node, ReactFlowProps } from '@xyflow/react';
import { useContext, useEffect, useId, useRef } from 'react';
import { WorkflowCanvasInsetContext, workflowFitOptions } from '../workflow-canvas-inset';
import { workflowCameraDuration } from './workflow-camera-duration';
import { WorkflowGraphGroups } from './workflow-graph-groups';
import type { WorkflowGraphGroup } from './workflow-graph-groups';
import { ZoomSlider } from './zoom-slider';
import { cn } from '@/utils/cn';
import '@xyflow/react/dist/style.css';

export type { WorkflowGraphGroup } from './workflow-graph-groups';

export interface WorkflowGraphCanvasProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> extends Pick<
  ReactFlowProps<NodeType, EdgeType>,
  'nodes' | 'edges' | 'nodeTypes' | 'edgeTypes' | 'onNodesChange' | 'onNodeClick'
> {
  focusNodeId?: string;
  variant?: 'default' | 'nested' | 'inline';
  groups?: WorkflowGraphGroup[];
}

export function WorkflowGraphCanvas<NodeType extends Node, EdgeType extends Edge>({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onNodeClick,
  focusNodeId,
  groups,
  variant = 'default',
}: WorkflowGraphCanvasProps<NodeType, EdgeType>) {
  const graphRef = useRef<HTMLDivElement>(null);
  const backgroundId = useId();
  const panelInset = useContext(WorkflowCanvasInsetContext);
  const leftInset = variant === 'default' ? panelInset : 0;
  const isInline = variant === 'inline';
  const { getNodes, setCenter, fitView } = useReactFlow<NodeType, EdgeType>();
  const nodesInitialized = useNodesInitialized();
  const canvasWidth = useStore(state => state.width);
  const canvasHeight = useStore(state => state.height);
  const hasCompactZoom = canvasWidth - leftInset < 560;
  const inlineNodeLayout = isInline
    ? JSON.stringify(
        nodes?.map(node => [
          node.id,
          node.position.x,
          node.position.y,
          node.measured?.width ?? node.width,
          node.measured?.height ?? node.height,
        ]),
      )
    : undefined;

  useEffect(() => {
    if (!canvasWidth || !canvasHeight || !nodesInitialized) return;
    if (variant === 'default') return;
    void fitView({ ...workflowFitOptions(leftInset, isInline), duration: 0 });
  }, [canvasWidth, canvasHeight, nodesInitialized, inlineNodeLayout, fitView, leftInset, isInline, variant]);

  useEffect(() => {
    if (!canvasWidth || !canvasHeight || !nodesInitialized || !focusNodeId) return;
    const focusNode = getNodes().find(node => node.id === focusNodeId);
    if (!focusNode) return;
    if (!graphRef.current?.contains(document.activeElement)) {
      graphRef.current?.focus({ preventScroll: true });
    }
    const width = focusNode.measured?.width ?? focusNode.width ?? 274;
    const height = focusNode.measured?.height ?? focusNode.height ?? 100;
    const duration = workflowCameraDuration();
    const exceedsVisibleWidth = canvasWidth > 0 && width > canvasWidth - leftInset - 80;
    const exceedsVisibleHeight = canvasHeight > 0 && height > canvasHeight - 104;
    if (exceedsVisibleWidth || exceedsVisibleHeight) {
      void fitView({ ...workflowFitOptions(leftInset), nodes: [{ id: focusNode.id }], duration });
      return;
    }
    void setCenter(focusNode.position.x + width / 2 - leftInset / 2, focusNode.position.y + height / 2, {
      duration,
      zoom: 1,
    });
  }, [canvasWidth, canvasHeight, nodesInitialized, focusNodeId, getNodes, setCenter, fitView, leftInset, isInline]);

  return (
    <div
      ref={graphRef}
      tabIndex={-1}
      data-testid="workflow-graph-viewport"
      className={cn('size-full outline-none', variant === 'nested' ? 'bg-surface1' : 'bg-surface2')}
    >
      <ReactFlow
        fitView={variant === 'default'}
        fitViewOptions={workflowFitOptions(leftInset)}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        panOnScroll={!isInline}
        panOnDrag={!isInline}
        zoomOnPinch={!isInline}
        zoomOnDoubleClick={!isInline}
        preventScrolling={!isInline}
        proOptions={isInline ? { hideAttribution: true } : undefined}
        zoomOnScroll={false}
        minZoom={0.1}
        maxZoom={4}
      >
        {!isInline && (
          <ZoomSlider
            position="top-right"
            className="m-2!"
            compact={hasCompactZoom}
            onFitView={() => fitView({ ...workflowFitOptions(leftInset), duration: workflowCameraDuration() })}
          />
        )}
        {groups && <WorkflowGraphGroups nodes={nodes ?? []} groups={groups} />}
        {!isInline && <Background id={backgroundId} variant={BackgroundVariant.Dots} gap={12} size={0.5} />}
      </ReactFlow>
    </div>
  );
}
