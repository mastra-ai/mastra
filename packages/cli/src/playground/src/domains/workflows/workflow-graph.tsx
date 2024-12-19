import { Workflow } from '@mastra/core';
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

function WorkflowGraph({ workflow }: { workflow: Workflow }) {
  const { nodes: initialNodes, edges: initialEdges } = contructNodesAndEdges(workflow);
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  const nodeTypes = {
    'default-node': WorkflowDefaultNode,
    'condition-node': WorkflowConditionNode,
  };

  return (
    <div className="w-full h-full">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} fitView>
        <Controls />
        <MiniMap pannable zoomable maskColor="#121212" bgColor="#171717" nodeColor="#2c2c2c" />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

export default WorkflowGraph;
