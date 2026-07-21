import type {
  SerializedStep,
  SerializedStepFlowEntry,
  SerializedStepResult,
  StepResult,
  WorkflowRunStatus,
} from '@mastra/core/workflows';
import type { ReactNode } from 'react';

export type WorkflowStepResult =
  StepResult<unknown, unknown, unknown, unknown> | SerializedStepResult<unknown, unknown, unknown, unknown>;

export type ResolvedWorkflowStepBase<
  TKind extends string,
  TFlow extends SerializedStepFlowEntry = SerializedStepFlowEntry,
  TResult extends WorkflowStepResult = WorkflowStepResult,
> = {
  kind: TKind;
  id: string;
  step?: SerializedStep;
  flow: TFlow;
  result?: TResult;
  workflowStatus?: WorkflowRunStatus;
};

export type ResolvedWorkflowRegularStep = ResolvedWorkflowStepBase<
  'step',
  Extract<SerializedStepFlowEntry, { type: 'step' }>
>;

export type ResolvedWorkflowMapStep = ResolvedWorkflowStepBase<
  'map-step',
  Extract<SerializedStepFlowEntry, { type: 'step' }>
>;

export type ResolvedWorkflowForEachStep = ResolvedWorkflowStepBase<
  'foreach-step',
  Extract<SerializedStepFlowEntry, { type: 'foreach' }>
>;

export type ResolvedWorkflowParallelStep = ResolvedWorkflowStepBase<
  'parallel-step',
  Extract<SerializedStepFlowEntry, { type: 'parallel' }>
>;

export type ResolvedWorkflowConditionalStep = ResolvedWorkflowStepBase<
  'conditional',
  Extract<SerializedStepFlowEntry, { type: 'conditional' }>
>;

export type ResolvedWorkflowLoopStep = ResolvedWorkflowStepBase<
  'loop-step',
  Extract<SerializedStepFlowEntry, { type: 'loop' }>
>;

export type ResolvedWorkflowSleepStep = ResolvedWorkflowStepBase<
  'sleep-step',
  Extract<SerializedStepFlowEntry, { type: 'sleep' }>
>;

export type ResolvedWorkflowSleepUntilStep = ResolvedWorkflowStepBase<
  'sleep-until-step',
  Extract<SerializedStepFlowEntry, { type: 'sleepUntil' }>
>;

export type ResolvedWorkflowNestedWorkflowStep = ResolvedWorkflowStepBase<
  'nested-workflow-step',
  Extract<SerializedStepFlowEntry, { type: 'step' }>
>;

export type ResolvedWorkflowUnknownStep = ResolvedWorkflowStepBase<'unknown-step'>;

export type ResolvedWorkflowStep =
  | ResolvedWorkflowRegularStep
  | ResolvedWorkflowMapStep
  | ResolvedWorkflowForEachStep
  | ResolvedWorkflowParallelStep
  | ResolvedWorkflowConditionalStep
  | ResolvedWorkflowLoopStep
  | ResolvedWorkflowSleepStep
  | ResolvedWorkflowSleepUntilStep
  | ResolvedWorkflowNestedWorkflowStep
  | ResolvedWorkflowUnknownStep;

export type WorkflowStepRenderer<TStep extends ResolvedWorkflowStep> = (step: TStep) => ReactNode;

export type WorkflowStepRenderers<TStep extends ResolvedWorkflowStep = ResolvedWorkflowStep> = {
  Step?: WorkflowStepRenderer<Extract<TStep, { kind: 'step' }>>;
  MapStep?: WorkflowStepRenderer<Extract<TStep, { kind: 'map-step' }>>;
  ForEachStep?: WorkflowStepRenderer<Extract<TStep, { kind: 'foreach-step' }>>;
  ParallelStep?: WorkflowStepRenderer<Extract<TStep, { kind: 'parallel-step' }>>;
  Conditional?: WorkflowStepRenderer<Extract<TStep, { kind: 'conditional' }>>;
  LoopStep?: WorkflowStepRenderer<Extract<TStep, { kind: 'loop-step' }>>;
  SleepStep?: WorkflowStepRenderer<Extract<TStep, { kind: 'sleep-step' }>>;
  SleepUntilStep?: WorkflowStepRenderer<Extract<TStep, { kind: 'sleep-until-step' }>>;
  NestedWorkflowStep?: WorkflowStepRenderer<Extract<TStep, { kind: 'nested-workflow-step' }>>;
  UnknownStep?: WorkflowStepRenderer<TStep>;
};
