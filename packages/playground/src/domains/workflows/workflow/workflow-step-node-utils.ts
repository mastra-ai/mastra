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

type SerializedStepInner = Extract<SerializedStepFlowEntry, { type: 'step' }>['step'];
export type SerializedStepLike = Pick<SerializedStepInner, 'id' | 'description' | 'component'> &
  Partial<Pick<SerializedStepInner, 'serializedStepFlow' | 'mapConfig' | 'canSuspend' | 'metadata'>>;

/**
 * `foreach.step` / `loop.step` is a `SerializedSingleStepEntry`
 * (agent | tool | step | mapping | workflow). For the `type: 'step'` variant,
 * forward the wrapped step directly; for declarative variants, synthesize a
 * step-like shim carrying the fields downstream rendering reads
 * (`description`, `mapConfig`, `component`, `serializedStepFlow`). Entry-only
 * fields like `agentId`/`toolId` stay available on the resolved `flow`.
 */
export const unwrapInnerEntry = (
  inner: Extract<SerializedStepFlowEntry, { type: 'foreach' }>['step'],
): SerializedStepLike => {
  if (inner.type === 'step') return inner.step;
  if (inner.type === 'workflow') {
    return {
      id: inner.id,
      description: inner.description,
      component: 'WORKFLOW',
      serializedStepFlow: inner.serializedStepFlow,
    };
  }
  if (inner.type === 'mapping') {
    return { id: inner.id, description: undefined, component: undefined, mapConfig: inner.mapConfig };
  }
  return { id: inner.id, description: inner.description, component: undefined };
};

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
          flow,
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
      const innerStep = unwrapInnerEntry(flow.step);
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
    case 'loop': {
      const innerStep = unwrapInnerEntry(flow.step);
      return {
        kind: 'loop-step',
        id: innerStep.id,
        step: innerStep,
        flow,
      };
    }
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
        step: {
          // Use the declared call-site id, consistent with unwrapInnerEntry and
          // collectGraphStepFlags; the registry key stays available as flow.workflowId.
          id: flow.id,
          description: flow.description,
          component: 'WORKFLOW',
          serializedStepFlow: flow.serializedStepFlow,
        } as never,
        flow,
      };
  }
};
