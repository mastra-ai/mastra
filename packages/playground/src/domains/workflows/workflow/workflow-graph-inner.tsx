import type { GetWorkflowResponse } from '@mastra/client-js';
import { ReactFlow, Background, useNodesState, useEdgesState, BackgroundVariant, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useEffect, useRef } from 'react';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { constructNodesAndEdges } from './utils';
import { WorkflowSuspendedOverlay } from './workflow-suspended-overlay';
import { ZoomSlider } from './zoom-slider';

export interface WorkflowGraphInnerProps {
  workflow: {
    stepGraph: GetWorkflowResponse['stepGraph'];
  };
}

export function WorkflowGraphInner({ workflow }: WorkflowGraphInnerProps) {
  const { nodes: initialNodes, edges: initialEdges } = constructNodesAndEdges(workflow);
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);
  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({ edges });
  const { selectedStepId } = useWorkflowSelectedStep();
  const graphRef = useRef<HTMLDivElement>(null);
  const { getNodes, setCenter } = useReactFlow();

  useEffect(() => {
    if (!selectedStepId) {
      return;
    }

    const selectedNode = getNodes().find(node => {
      const nodeStepId = node.data?.stepId ?? node.data?.label;
      return nodeStepId === selectedStepId;
    });

    if (!selectedNode) {
      return;
    }

    graphRef.current?.focus({ preventScroll: true });

    const width = selectedNode.measured?.width ?? selectedNode.width ?? 274;
    const height = selectedNode.measured?.height ?? selectedNode.height ?? 100;

    void setCenter(selectedNode.position.x + width / 2, selectedNode.position.y + height / 2, {
      duration: 300,
      zoom: 1,
    });
  }, [getNodes, selectedStepId, setCenter]);

  return (
    <div
      ref={graphRef}
      tabIndex={-1}
      data-testid="workflow-graph-viewport"
      className="relative w-full h-full bg-surface2 outline-none"
    >
      <WorkflowSuspendedOverlay />
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{
          maxZoom: 1,
        }}
        minZoom={0.01}
        maxZoom={1}
      >
        <ZoomSlider position="bottom-left" />

        <Background variant={BackgroundVariant.Dots} gap={12} size={0.5} />
      </ReactFlow>
    </div>
  );
}
