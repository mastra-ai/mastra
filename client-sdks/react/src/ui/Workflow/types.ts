import { SerializedStepFlowEntry, WorkflowStreamResult } from '@mastra/core/workflows';
import { Edge, Node } from '@xyflow/react';

export type WorkflowStatusType = 'running' | 'success' | 'failed' | 'suspended' | 'waiting' | 'idle';
export type WorkflowNode = Node<
  {
    step: SerializedStepFlowEntry;
    stepRun?: WorkflowStreamResult<any, any, any, any>['steps'][string];

    parentNodes?: WorkflowNode[];

    showParentHandle: boolean;
    isParentStepSuccessful: boolean;
    isLastStep: boolean;

    type?: StepMetadataType;
    nestedWorkflowNodes?: { nodes: WorkflowNode[]; edges: Edge[] };
  },
  'default' | 'group'
>;

export type StepMetadataType = 'conditional' | 'parallel' | 'waitForEvent' | 'loop' | 'foreach';

export type StepWithMetadata = SerializedStepFlowEntry & {
  condition?: string;
};
