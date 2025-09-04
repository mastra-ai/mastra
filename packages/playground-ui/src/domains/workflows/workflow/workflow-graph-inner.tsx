import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GetWorkflowResponse } from '@mastra/client-js';

import { constructNodesAndEdges } from './utils';
import { WorkflowConditionNode } from './workflow-condition-node';
import { DefaultNode, WorkflowDefaultNode } from './workflow-default-node';
import { WorkflowAfterNode } from './workflow-after-node';
import { WorkflowLoopResultNode } from './workflow-loop-result-node';
import { NestedNode, WorkflowNestedNode } from './workflow-nested-node';
import { ZoomSlider } from './zoom-slider';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowSendEventFormProps } from './workflow-run-event-form';

export interface WorkflowGraphInnerProps {
  workflow: {
    stepGraph: GetWorkflowResponse['stepGraph'];
  };
  onShowTrace?: ({ runId, stepName }: { runId: string; stepName: string }) => void;
  onSendEvent?: WorkflowSendEventFormProps['onSendEvent'];
}

export function WorkflowGraphInner({ workflow, onShowTrace, onSendEvent }: WorkflowGraphInnerProps) {
  const { nodes: initialNodes, edges: initialEdges } = constructNodesAndEdges(workflow);
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);
  const { steps, runId } = useCurrentRun();

  const nodeTypes = {
    'default-node': (props: NodeProps<DefaultNode>) => (
      <WorkflowDefaultNode onShowTrace={onShowTrace} onSendEvent={onSendEvent} {...props} />
    ),
    'condition-node': WorkflowConditionNode,
    'after-node': WorkflowAfterNode,
    'loop-result-node': WorkflowLoopResultNode,
    'nested-node': (props: NodeProps<NestedNode>) => (
      <WorkflowNestedNode onShowTrace={onShowTrace} onSendEvent={onSendEvent} {...props} />
    ),
  };

  return (
    <div className="w-full h-full bg-surface1">
      <ReactFlow
        nodes={nodes}
        edges={edges.map(e => ({
          ...e,
          style: {
            ...e.style,
            stroke:
              steps[e.data?.previousStepId as string]?.status === 'success' && steps[e.data?.nextStepId as string]
                ? '#22c55e'
                : e.data?.conditionNode &&
                    !steps[e.data?.previousStepId as string] &&
                    Boolean(steps[e.data?.nextStepId as string]?.status)
                  ? '#22c55e'
                  : undefined,
          },
        }))}
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
        <MiniMap pannable zoomable maskColor="#121212" bgColor="#171717" nodeColor="#2c2c2c" />
        <Background variant={BackgroundVariant.Dots} gap={12} size={0.5} />
      </ReactFlow>
    </div>
  );
}
