import type { Edge, Node } from '@xyflow/react';

export const WORKFLOW_DATA_EDGE_TYPE = 'workflow-data-edge';
export const WORKFLOW_BOUNDARY_NODE_TYPE = 'workflow-boundary-node';

export interface WorkflowDataEdgeData {
  [key: string]: unknown;
  previousStepId?: string;
  nextStepId?: string;
  conditionNode?: boolean;
  boundaryPayload?: 'workflow-input' | 'workflow-output';
  edgeStatus?: 'success' | 'idle';
}

export type WorkflowDataEdgeModel = Edge<WorkflowDataEdgeData, typeof WORKFLOW_DATA_EDGE_TYPE>;

export type WorkflowBoundaryNodeData = {
  boundaryRole: 'start' | 'end';
  label: string;
};

export type WorkflowBoundaryNodeModel = Node<WorkflowBoundaryNodeData, typeof WORKFLOW_BOUNDARY_NODE_TYPE>;
