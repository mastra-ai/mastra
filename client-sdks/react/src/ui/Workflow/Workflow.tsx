import { Background, Controls, Edge, NodeTypes, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react';
import { useEffect } from 'react';
import { DefaultNode } from './custom-nodes';
import { WorkflowStreamResult } from '@mastra/core/workflows';
import { GetWorkflowResponse } from '@mastra/client-js';
import { buildNodes } from './utils/build-nodes';
import { WorkflowNode } from './types';
import { positionWorkflowNodes } from './utils/position-nodes';

export const DefaultNodeTypes: NodeTypes = {
  default: DefaultNode,
};

export interface WorkflowProps {
  nodeTypes?: NodeTypes;
  workflow: GetWorkflowResponse;
  workflowResult: WorkflowStreamResult<any, any, any, any>;
}

export const Workflow = ({ nodeTypes = DefaultNodeTypes, workflowResult, workflow }: WorkflowProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const nextNodes = buildNodes(workflow.stepGraph, workflowResult);
    const nextLayoutedNodes = positionWorkflowNodes(nextNodes.nodes, nextNodes.edges);

    setNodes(nextLayoutedNodes.nodes);
    setEdges(nextLayoutedNodes.edges);
  }, [workflowResult, workflow.stepGraph]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      nodeTypes={nodeTypes}
      minZoom={0.01}
      maxZoom={1}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
};
