import type { GetWorkflowResponse } from '@mastra/client-js';
import { ReactFlow, Background, useNodesState, useEdgesState, BackgroundVariant, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useEffectEvent, useRef } from 'react';

import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';

import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { useSuspendedStepKey, useWaitingStepKey } from './use-workflow-trigger';
import { constructNodesAndEdges, findFocusNode } from './utils';
import type { WorkflowGraphEdge, WorkflowGraphNode } from './utils';
import { ZoomSlider } from './zoom-slider';

export interface WorkflowGraphInnerProps {
  workflow: {
    stepGraph: GetWorkflowResponse['stepGraph'];
  };
}

export function WorkflowGraphInner({ workflow }: WorkflowGraphInnerProps) {
  const { nodes: initialNodes, edges: initialEdges } = constructNodesAndEdges(workflow);
  const [nodes, _, onNodesChange] = useNodesState<WorkflowGraphNode>(initialNodes);
  const [edges] = useEdgesState<WorkflowGraphEdge>(initialEdges);
  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({ edges });

  const graphRef = useRef<HTMLDivElement>(null);
  const { selectedStepId } = useWorkflowSelectedStep();
  const waitingStepKey = useWaitingStepKey();
  const suspendedStepKey = useSuspendedStepKey();
  const { getNodes, setCenter } = useReactFlow();

  // An explicit timeline selection always wins; otherwise center the step the run
  // is currently waiting on: the next step of a paused (per-step/debug) run, or
  // the suspended step of a run awaiting human input (which follows along as a
  // resume advances the run to the next suspended step).
  const focusStepId = selectedStepId ?? waitingStepKey ?? suspendedStepKey;

  const focusOnStep = useEffectEvent((stepId: string) => {
    const focusNode = findFocusNode(getNodes(), stepId);
    if (!focusNode) return;
    graphRef.current?.focus({ preventScroll: true });
    const width = focusNode.measured?.width ?? focusNode.width ?? 274;
    const height = focusNode.measured?.height ?? focusNode.height ?? 100;
    void setCenter(focusNode.position.x + width / 2, focusNode.position.y + height / 2, {
      duration: 300,
      zoom: 1,
    });
  });

  // Re-run when the node state settles. On the first paint (e.g. landing on a
  // paused :runId page) React Flow has not registered/measured its nodes yet, so
  // the initial attempt finds nothing and no-ops. React Flow then emits the layout
  // pass through onNodesChange, which updates `nodes` and lets this effect retry
  // against the now-available nodes. focusOnStep is idempotent for a settled target.
  useEffect(() => {
    if (!focusStepId) return;
    focusOnStep(focusStepId);
  }, [focusStepId, nodes]);

  return (
    <div
      ref={graphRef}
      tabIndex={-1}
      data-testid="workflow-graph-viewport"
      className="w-full h-full bg-surface2 outline-none"
    >
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        edgeTypes={edgeTypes}
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
