import type { GetWorkflowResponse } from '@mastra/client-js';
import type { NodeProps } from '@xyflow/react';
import { ReactFlow, Background, useNodesState, useEdgesState, BackgroundVariant, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useEffect, useMemo, useRef } from 'react';
import { useCurrentRun } from '../context/use-current-run';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { constructNodesAndEdges } from './utils';
import { WorkflowAfterNode } from './workflow-after-node';
import { WorkflowConditionNode } from './workflow-condition-node';
import type { DefaultNode } from './workflow-default-node';
import { WorkflowDefaultNode } from './workflow-default-node';
import { WorkflowLoopResultNode } from './workflow-loop-result-node';
import type { NestedNode } from './workflow-nested-node';
import { WorkflowNestedNode } from './workflow-nested-node';
import { WorkflowSuspendedOverlay } from './workflow-suspended-overlay';
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
  const { steps } = useCurrentRun();
  const { selectedStepId } = useWorkflowSelectedStep();
  const graphRef = useRef<HTMLDivElement>(null);
  const { getNodes, setCenter } = useReactFlow();

  useEffect(() => {
    if (!selectedStepId) {
      return;
    }

    const selectedNode = getNodes().find(node => {
      const nodeStepId = node.data?.stepId ?? node.data?.label;
      return nodeStepId === selectedStepId;
    });

    if (!selectedNode) {
      return;
    }

    graphRef.current?.focus({ preventScroll: true });

    const width = selectedNode.measured?.width ?? selectedNode.width ?? 274;
    const height = selectedNode.measured?.height ?? selectedNode.height ?? 100;

    void setCenter(selectedNode.position.x + width / 2, selectedNode.position.y + height / 2, {
      duration: 300,
      zoom: 1,
    });
  }, [getNodes, selectedStepId, setCenter]);

  const stepsFlow = useMemo(() => {
    return initialEdges.reduce(
      (acc, edge) => {
        if (edge.data) {
          const stepId = edge.data.nextStepId as string;
          const prevStepId = edge.data.previousStepId as string;

          return {
            ...acc,
            [stepId]: [...new Set([...(acc[stepId] || []), prevStepId])],
          };
        }

        return acc;
      },
      {} as Record<string, string[]>,
    );
  }, [initialEdges]);

  const nodeTypes = {
    'default-node': (props: NodeProps<DefaultNode>) => <WorkflowDefaultNode {...props} stepsFlow={stepsFlow} />,
    'condition-node': WorkflowConditionNode,
    'after-node': WorkflowAfterNode,
    'loop-result-node': WorkflowLoopResultNode,
    'nested-node': (props: NodeProps<NestedNode>) => <WorkflowNestedNode {...props} stepsFlow={stepsFlow} />,
  };

  return (
    <div
      ref={graphRef}
      tabIndex={-1}
      data-testid="workflow-graph-viewport"
      className="relative w-full h-full bg-surface2 outline-none"
    >
      <WorkflowSuspendedOverlay />
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

        <Background variant={BackgroundVariant.Dots} gap={12} size={0.5} />
      </ReactFlow>
    </div>
  );
}
