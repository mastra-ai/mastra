import { ReactFlowProvider, useNodesState, useReactFlow } from '@xyflow/react';
import type { EdgeProps, Node, NodeProps } from '@xyflow/react';
import { WorkflowConditionCard } from '../../cards/condition/workflow-condition-card';
import { WorkflowStepCardView } from '../../cards/step/workflow-step-card-view';
import { WORKFLOW_BOUNDARY_NODE_TYPE, WORKFLOW_DATA_EDGE_TYPE } from '../../graph/types';
import { WorkflowBoundaryNode } from '../../graph/workflow-boundary-node';
import { WorkflowDataEdgeView } from '../../graph/workflow-data-edge-view';
import { WorkflowGraphCanvas } from '../../graph/workflow-graph-canvas';
import type { WorkflowGraphCanvasProps } from '../../graph/workflow-graph-canvas';
import { WorkflowNodeFrame } from '../../graph/workflow-node-frame';
import { sequentialNodes, sequentialEdges } from './fixtures';
import type { StoryConditionNode, StoryDataEdge, StoryStepNode } from './fixtures';

function StepNode({ id, data, selected }: NodeProps<StoryStepNode>) {
  const { setNodes } = useReactFlow();
  return (
    <WorkflowNodeFrame>
      <WorkflowStepCardView
        {...data.card}
        isSelected={selected}
        onSelect={() => setNodes(nodes => nodes.map(node => ({ ...node, selected: node.id === id })))}
        initiallyOpen={data.card.initiallyOpen ?? data.card.isForEach}
        body={
          data.nested ? <GraphExample nodes={sequentialNodes} edges={sequentialEdges} variant="inline" /> : undefined
        }
      />
    </WorkflowNodeFrame>
  );
}

function ConditionNode({ data }: NodeProps<StoryConditionNode>) {
  return (
    <WorkflowNodeFrame>
      <WorkflowConditionCard conditions={data.conditions} />
    </WorkflowNodeFrame>
  );
}

function DataEdge(props: EdgeProps<StoryDataEdge>) {
  return <WorkflowDataEdgeView {...props} output={props.data?.output} />;
}

const nodeTypes = { step: StepNode, condition: ConditionNode, [WORKFLOW_BOUNDARY_NODE_TYPE]: WorkflowBoundaryNode };
const edgeTypes = { [WORKFLOW_DATA_EDGE_TYPE]: DataEdge };

export function GraphExample({
  nodes: initialNodes,
  edges,
  variant,
  groups,
}: {
  nodes: Node[];
  edges: StoryDataEdge[];
  variant?: WorkflowGraphCanvasProps['variant'];
  groups?: WorkflowGraphCanvasProps['groups'];
}) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const focusNodeId = nodes.find(node => node.selected)?.id;
  return (
    <ReactFlowProvider>
      <WorkflowGraphCanvas
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        focusNodeId={variant === 'inline' ? undefined : focusNodeId}
        variant={variant}
        groups={groups}
      />
    </ReactFlowProvider>
  );
}
