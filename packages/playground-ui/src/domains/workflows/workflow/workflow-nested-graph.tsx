import { ReactFlow, MiniMap, Background, useNodesState, useEdgesState, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SerializedStepFlowEntry } from '@mastra/core/workflows';

import { constructNodesAndEdges } from './utils';
import { WorkflowConditionNode } from './workflow-condition-node';
import { WorkflowDefaultNode } from './workflow-default-node';
import { WorkflowAfterNode } from './workflow-after-node';
import { WorkflowLoopResultNode } from './workflow-loop-result-node';
import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/spinner';
import { WorkflowNestedNode } from './workflow-nested-node';
import { ZoomSlider } from './zoom-slider';

export function WorkflowNestedGraph({ stepGraph, open }: { stepGraph: SerializedStepFlowEntry[]; open: boolean }) {
  const { nodes: initialNodes, edges: initialEdges } = constructNodesAndEdges({
    stepGraph,
  });
  const [isMounted, setIsMounted] = useState(false);
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  const nodeTypes = {
    'default-node': WorkflowDefaultNode,
    'condition-node': WorkflowConditionNode,
    'after-node': WorkflowAfterNode,
    'loop-result-node': WorkflowLoopResultNode,
    'nested-node': WorkflowNestedNode,
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setIsMounted(true);
      }, 500); // Delay to ensure modal is fully rendered
    }
  }, [open]);

  return (
    <div className="w-full h-full relative bg-surface1">
      {isMounted ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
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
          <MiniMap pannable zoomable maskColor="#121212" bgColor="#171717" nodeColor="#2c2c2c" />
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
