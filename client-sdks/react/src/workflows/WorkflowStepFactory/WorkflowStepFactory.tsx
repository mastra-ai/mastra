import { memo } from 'react';
import type { ReactNode } from 'react';
import type { ResolvedWorkflowStep, WorkflowStepRenderers } from './types';

export interface WorkflowStepFactoryProps<
  TStep extends ResolvedWorkflowStep = ResolvedWorkflowStep,
> extends WorkflowStepRenderers<TStep> {
  step: TStep;
}

const renderUnknown = <TStep extends ResolvedWorkflowStep>(
  step: TStep,
  UnknownStep?: WorkflowStepRenderers<TStep>['UnknownStep'],
): ReactNode => UnknownStep?.(step) ?? null;

const WorkflowStepFactoryComponent = <TStep extends ResolvedWorkflowStep>({
  step,
  Step,
  MapStep,
  AgentStep,
  ToolStep,
  ForEachStep,
  ParallelStep,
  Conditional,
  LoopStep,
  SleepStep,
  SleepUntilStep,
  NestedWorkflowStep,
  UnknownStep,
}: WorkflowStepFactoryProps<TStep>) => {
  switch (step.kind) {
    case 'step':
      return <>{Step?.(step as Extract<TStep, { kind: 'step' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'map-step':
      return <>{MapStep?.(step as Extract<TStep, { kind: 'map-step' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'agent-step':
      return <>{AgentStep?.(step as Extract<TStep, { kind: 'agent-step' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'tool-step':
      return <>{ToolStep?.(step as Extract<TStep, { kind: 'tool-step' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'foreach-step':
      return <>{ForEachStep?.(step as Extract<TStep, { kind: 'foreach-step' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'parallel-step':
      return (
        <>{ParallelStep?.(step as Extract<TStep, { kind: 'parallel-step' }>) ?? renderUnknown(step, UnknownStep)}</>
      );
    case 'conditional':
      return <>{Conditional?.(step as Extract<TStep, { kind: 'conditional' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'loop-step':
      return <>{LoopStep?.(step as Extract<TStep, { kind: 'loop-step' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'sleep-step':
      return <>{SleepStep?.(step as Extract<TStep, { kind: 'sleep-step' }>) ?? renderUnknown(step, UnknownStep)}</>;
    case 'sleep-until-step':
      return (
        <>
          {SleepUntilStep?.(step as Extract<TStep, { kind: 'sleep-until-step' }>) ?? renderUnknown(step, UnknownStep)}
        </>
      );
    case 'nested-workflow-step':
      return (
        <>
          {NestedWorkflowStep?.(step as Extract<TStep, { kind: 'nested-workflow-step' }>) ??
            renderUnknown(step, UnknownStep)}
        </>
      );
    default:
      return <>{renderUnknown(step, UnknownStep)}</>;
  }
};

export const WorkflowStepFactory = memo(WorkflowStepFactoryComponent) as typeof WorkflowStepFactoryComponent;
