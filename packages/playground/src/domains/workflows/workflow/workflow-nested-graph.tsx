import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { WorkflowGraphCanvas } from '@mastra/playground-ui/components/Workflow';
import { useNodesState, useEdgesState } from '@xyflow/react';

import { useEffect, useState } from 'react';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { constructNodesAndEdges } from './utils';
import type { WorkflowGraphEdge, WorkflowGraphNode } from './utils';

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
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <div className="bg-surface1 relative h-full w-full">
      {isMounted ? (
        <WorkflowGraphCanvas
          variant="nested"
          nodes={nodes}
          edges={styledEdges}
          edgeTypes={edgeTypes}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  );
}
