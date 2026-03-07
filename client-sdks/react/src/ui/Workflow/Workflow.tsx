import {
  Background,
  Controls,
  Edge,
  NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useEffect } from 'react';
import { WorkflowStreamResult } from '@mastra/core/workflows';
import { GetWorkflowResponse } from '@mastra/client-js';
import { DefaultNode } from './custom-nodes';
import { buildNodes } from './utils/build-nodes';
import { WorkflowNode } from './types';
import { positionWorkflowNodes } from './utils/position-nodes';

export const DefaultNodeTypes: NodeTypes = {
  default: DefaultNode,
};

export interface WorkflowProps {
  nodeTypes?: NodeTypes;
  workflow: Pick<GetWorkflowResponse, 'stepGraph'>;
  workflowResult: WorkflowStreamResult<any, any, any, any>;
  /** Parent step ID for nested workflows. Used to correctly map step results from workflowResult.steps */
  parentStepId?: string;
}

/**
 * Workflow component that renders a workflow graph with support for nested workflows.
 * Nested workflows automatically open in a dialog when clicked.
 */
export const Workflow = ({ nodeTypes = DefaultNodeTypes, workflowResult, workflow, parentStepId }: WorkflowProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const nextNodes = buildNodes(workflow.stepGraph, workflowResult, parentStepId);
    const positionedNodes = positionWorkflowNodes(nextNodes.nodes, nextNodes.edges);

    setNodes(positionedNodes.nodes);
    setEdges(positionedNodes.edges);
  }, [workflowResult, workflow.stepGraph, parentStepId, setNodes, setEdges]);

  return (
    <ReactFlowProvider>
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
    </ReactFlowProvider>
  );
};
