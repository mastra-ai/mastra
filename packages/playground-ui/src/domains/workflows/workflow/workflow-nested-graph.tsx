import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { contructNodesAndEdges } from './utils';
import { WorkflowConditionNode } from './workflow-condition-node';
import { WorkflowDefaultNode } from './workflow-default-node';
import { WorkflowAfterNode } from './workflow-after-node';
import { WorkflowLoopResultNode } from './workflow-loop-result-node';
import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/spinner';

export function WorkflowNestedGraph({
  stepGraph,
  stepSubscriberGraph,
  open,
}: {
  stepGraph: any;
  stepSubscriberGraph: any;
  open: boolean;
}) {
  const { nodes: initialNodes, edges: initialEdges } = contructNodesAndEdges({
    stepGraph: stepGraph,
    stepSubscriberGraph: stepSubscriberGraph,
  });
  const [isMounted, setIsMounted] = useState(false);
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  const nodeTypes = {
    'default-node': WorkflowDefaultNode,
    'condition-node': WorkflowConditionNode,
    'after-node': WorkflowAfterNode,
    'loop-result-node': WorkflowLoopResultNode,
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setIsMounted(true);
      }, 500); // Delay to ensure modal is fully rendered
    }
  }, [open]);

  return (
    <div className="w-full h-full relative">
      {isMounted ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ maxZoom: 0.85 }}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
        >
          <Controls />
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
