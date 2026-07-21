import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { ResolvedWorkflowStep } from '@mastra/react';
import type { Node } from '@xyflow/react';
import type { Condition } from './utils';

export const WORKFLOW_STEP_NODE_TYPE = 'workflow-step-node';
export const WORKFLOW_BOUNDARY_NODE_TYPE = 'workflow-boundary-node';

export type WorkflowStepNodeData = {
  label: string;
  workflowStep: ResolvedWorkflowStep;
  stepId?: string;
  description?: string;
  withoutTopHandle?: boolean;
  withoutBottomHandle?: boolean;
  stepGraph?: SerializedStepFlowEntry[];
  mapConfig?: string;
  duration?: number;
  date?: Date;
  isParallel?: boolean;
  canSuspend?: boolean;
  isForEach?: boolean;
  isLarge?: boolean;
  metadata?: Record<string, unknown>;
  nodeRole?: 'step' | 'condition';
  conditions?: Condition[];
  previousStepId?: string;
  nextStepId?: string;
};

export type WorkflowStepNode = Node<WorkflowStepNodeData, typeof WORKFLOW_STEP_NODE_TYPE>;

export type WorkflowBoundaryNodeData = {
  label: 'Start' | 'End';
  boundaryRole: 'start' | 'end';
};

export type WorkflowBoundaryNode = Node<WorkflowBoundaryNodeData, typeof WORKFLOW_BOUNDARY_NODE_TYPE>;

export const resolveWorkflowGraphStep = (flow: SerializedStepFlowEntry): ResolvedWorkflowStep => {
  switch (flow.type) {
    case 'step':
      if (flow.step.component === 'WORKFLOW') {
        return {
          kind: 'nested-workflow-step',
          id: flow.step.id,
          step: flow.step,
          flow,
        };
      }

      // Back-compat: older serialized graphs encoded `.map()` as a `step` entry
      // carrying a `mapConfig`. Newer graphs use the dedicated `mapping` entry.
      if (flow.step.mapConfig) {
        return {
          kind: 'map-step',
          id: flow.step.id,
          step: flow.step,
          flow: flow as never,
        };
      }

      return {
        kind: 'step',
        id: flow.step.id,
        step: flow.step,
        flow,
      };
    case 'agent':
      return {
        kind: 'agent-step',
        id: flow.id,
        flow,
      };
    case 'tool':
      return {
        kind: 'tool-step',
        id: flow.id,
        flow,
      };
    case 'mapping':
      return {
        kind: 'map-step',
        id: flow.id,
        flow,
      };
    case 'foreach': {
      const inner = flow.step;
      const innerStep = inner.type === 'step' ? inner.step : ({ id: inner.id } as never);
      return {
        kind: 'foreach-step',
        id: innerStep.id,
        step: innerStep,
        flow,
      };
    }
    case 'parallel':
      return {
        kind: 'parallel-step',
        id: 'parallel',
        flow,
      };
    case 'conditional':
      return {
        kind: 'conditional',
        id: flow.serializedConditions[0]?.id ?? 'conditional',
        flow,
      };
    case 'loop':
      return {
        kind: 'loop-step',
        id: flow.step.id,
        step: flow.step,
        flow,
      };
    case 'sleep':
      return {
        kind: 'sleep-step',
        id: flow.id,
        flow,
      };
    case 'sleepUntil':
      return {
        kind: 'sleep-until-step',
        id: flow.id,
        flow,
      };
    case 'workflow':
      return {
        kind: 'nested-workflow-step',
        id: flow.id,
        step: { id: flow.workflowId, component: 'WORKFLOW' } as never,
        flow,
      };
  }
};
