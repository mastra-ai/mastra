import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { ReactFlow, Background, useNodesState, useEdgesState, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useEffect, useState } from 'react';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { constructNodesAndEdges } from './utils';
import type { WorkflowGraphEdge, WorkflowGraphNode } from './utils';
import { ZoomSlider } from './zoom-slider';

export interface WorkflowNestedGraphProps {
  stepGraph: SerializedStepFlowEntry[];
  open: boolean;
  workflowName: string;
}

export function WorkflowNestedGraph({ stepGraph, open, workflowName }: WorkflowNestedGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = constructNodesAndEdges({
    stepGraph,
  });
  const [isMounted, setIsMounted] = useState(false);
  const [nodes, _, onNodesChange] = useNodesState<WorkflowGraphNode>(initialNodes);
  const [edges] = useEdgesState<WorkflowGraphEdge>(initialEdges);
  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({ edges, workflowName, stepGraph });

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setIsMounted(true);
      }, 500); // Delay to ensure modal is fully rendered
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <div className="w-full h-full relative bg-surface1">
      {isMounted ? (
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{
            maxZoom: 1,
          }}
          minZoom={0.01}
          maxZoom={1}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
        >
          <ZoomSlider position="bottom-left" />
          <Background variant={BackgroundVariant.Lines} gap={12} size={0.5} />
        </ReactFlow>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  );
}
