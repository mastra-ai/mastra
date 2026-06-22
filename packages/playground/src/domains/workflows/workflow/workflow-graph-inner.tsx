import type { GetWorkflowResponse } from '@mastra/client-js';
import { ReactFlow, Background, useNodesState, useEdgesState, BackgroundVariant, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useRef } from 'react';

import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';

import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { useWaitingStepKey } from './use-workflow-trigger';
import { constructNodesAndEdges } from './utils';
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

  const graphRef = useRef<HTMLDivElement>(null);
  const { selectedStepId } = useWorkflowSelectedStep();
  const waitingStepKey = useWaitingStepKey();
  const { getNodes, setCenter } = useReactFlow();

  // An explicit timeline selection always wins; otherwise, in step-by-step (debug)
  // mode, fall back to centering the step the paused run is waiting to run next.
  const focusStepId = selectedStepId ?? waitingStepKey;

  useEffect(() => {
    if (!focusStepId) return;
    const focusNode = getNodes().find(node => {
      const nodeStepId = node.data?.stepId ?? node.data?.label;
      return nodeStepId === focusStepId;
    });
    if (!focusNode) return;
    graphRef.current?.focus({ preventScroll: true });
    const width = focusNode.measured?.width ?? focusNode.width ?? 274;
    const height = focusNode.measured?.height ?? focusNode.height ?? 100;
    void setCenter(focusNode.position.x + width / 2, focusNode.position.y + height / 2, {
      duration: 300,
      zoom: 1,
    });
  }, [getNodes, focusStepId, setCenter]);

  return (
    <div
      ref={graphRef}
      tabIndex={-1}
      data-testid="workflow-graph-viewport"
      className="w-full h-full bg-surface2 outline-none"
    >
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
