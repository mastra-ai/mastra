import type { LegacyWorkflow } from '@mastra/core/workflows/legacy';
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

import { contructLegacyNodesAndEdges, WStep } from './utils';
import { WorkflowConditionNode } from './workflow-condition-node';
import { WorkflowDefaultNode } from './workflow-default-node';
import { WorkflowAfterNode } from './workflow-after-node';
import { WorkflowLoopResultNode } from './workflow-loop-result-node';
import { LegacyWorkflowNestedNode } from './legacy-workflow-nested-node';

export function LegacyWorkflowGraphInner({ workflow }: { workflow: LegacyWorkflow }) {
  const { nodes: initialNodes, edges: initialEdges } = contructLegacyNodesAndEdges({
    stepGraph: workflow.serializedStepGraph || workflow.stepGraph,
    stepSubscriberGraph: workflow.serializedStepSubscriberGraph || workflow.stepSubscriberGraph,
    steps: workflow.steps as WStep,
  });
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  const nodeTypes = {
    'default-node': WorkflowDefaultNode,
    'condition-node': WorkflowConditionNode,
    'after-node': WorkflowAfterNode,
    'loop-result-node': WorkflowLoopResultNode,
    'nested-node': LegacyWorkflowNestedNode,
  };

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{
          maxZoom: 0.85,
        }}
      >
        <Controls />
        <MiniMap pannable zoomable maskColor="#121212" bgColor="#171717" nodeColor="#2c2c2c" />
        <Background variant={BackgroundVariant.Dots} gap={12} size={0.5} />
      </ReactFlow>
    </div>
  );
}
