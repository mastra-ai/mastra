import { ReactFlowProvider, useNodesState } from '@xyflow/react';
import type { EdgeProps, Node, NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { WorkflowConditionCard } from '../../cards/workflow-condition-card';
import { WorkflowStepCardView } from '../../cards/workflow-step-card-view';
import { WorkflowStepAction } from '../../controls/workflow-step-action';
import { WorkflowStepActions } from '../../controls/workflow-step-actions';
import { WORKFLOW_BOUNDARY_NODE_TYPE, WORKFLOW_DATA_EDGE_TYPE } from '../../graph/types';
import { WorkflowBoundaryNode } from '../../graph/workflow-boundary-node';
import { WorkflowDataEdgeView } from '../../graph/workflow-data-edge-view';
import { WorkflowGraphCanvas } from '../../graph/workflow-graph-canvas';
import { WorkflowNodeFrame } from '../../graph/workflow-node-frame';
import { sequentialNodes, sequentialEdges } from './fixtures';
import type { StoryConditionNode, StoryDataEdge, StoryStepNode } from './fixtures';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';

function StepNode({ data, selected }: NodeProps<StoryStepNode>) {
  const [nestedOpen, setNestedOpen] = useState(false);
  return (
    <WorkflowNodeFrame>
      <WorkflowStepCardView
        {...data.card}
        isSelected={selected}
        actionBar={
          data.nested ? (
            <WorkflowStepActions>
              <WorkflowStepAction action="nested" onSelect={() => setNestedOpen(true)} />
            </WorkflowStepActions>
          ) : undefined
        }
      />
      {data.nested && (
        <Dialog open={nestedOpen} onOpenChange={setNestedOpen}>
          <DialogContent className="w-full max-w-4xl">
            <DialogHeader>
              <DialogTitle>{data.card.label}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div style={{ height: 520 }}>
                <GraphExample nodes={sequentialNodes} edges={sequentialEdges} variant="nested" />
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
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
}: {
  nodes: Node[];
  edges: StoryDataEdge[];
  variant?: 'default' | 'nested';
}) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [focusNodeId, setFocusNodeId] = useState<string>();
  return (
    <ReactFlowProvider>
      <WorkflowGraphCanvas
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => setFocusNodeId(node.id)}
        focusNodeId={focusNodeId}
        variant={variant}
      />
    </ReactFlowProvider>
  );
}
