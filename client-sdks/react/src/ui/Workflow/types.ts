import { SerializedStepFlowEntry, WorkflowStreamResult } from '@mastra/core/workflows';
import { Node } from '@xyflow/react';

export type WorkflowStatusType = 'running' | 'success' | 'failed' | 'suspended' | 'waiting' | 'idle';
export type WorkflowNode = Node<
  {
    step: SerializedStepFlowEntry;
    stepRun?: WorkflowStreamResult<any, any, any, any>['steps'][string];
    workflowResult: WorkflowStreamResult<any, any, any, any>;

    parentNodes?: WorkflowNode[];

    showParentHandle: boolean;
    isParentStepSuccessful: boolean;
    isLastStep: boolean;

    type?: StepMetadataType;
    nestedStepGraph?: SerializedStepFlowEntry[];
  },
  'default' | 'group'
>;

export type StepMetadataType = 'conditional' | 'parallel' | 'waitForEvent' | 'loop' | 'foreach';

export type StepWithMetadata = SerializedStepFlowEntry & {
  condition?: string;
};
