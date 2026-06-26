// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedWorkflowStep } from './types';
import { WorkflowStepFactory } from './WorkflowStepFactory';

afterEach(() => {
  cleanup();
});

const successResult = {
  status: 'success',
  payload: { value: 'input' },
  output: { value: 'output' },
  startedAt: 1,
  endedAt: 2,
} as const;

const makeStep = (): Extract<ResolvedWorkflowStep, { kind: 'step' }> => {
  const step = { id: 'start', description: 'Start step' };

  return {
    kind: 'step',
    id: 'start',
    step,
    flow: { type: 'step', step },
    result: successResult,
    workflowStatus: 'success',
  };
};

const makeVariantStep = (kind: ResolvedWorkflowStep['kind']): ResolvedWorkflowStep => {
  const step = { id: kind, description: `${kind} description` };

  switch (kind) {
    case 'map-step':
      return {
        kind,
        id: kind,
        step: { ...step, mapConfig: 'return input' },
        flow: { type: 'step', step: { ...step, mapConfig: 'return input' } },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'agent-step':
      return {
        kind,
        id: kind,
        flow: { type: 'agent', id: kind, agentId: 'writer-agent' },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'tool-step':
      return {
        kind,
        id: kind,
        flow: { type: 'tool', id: kind, toolId: 'double-tool' },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'foreach-step':
      return {
        kind,
        id: kind,
        step,
        flow: { type: 'foreach', step, opts: { concurrency: 2 } },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'parallel-step':
      return {
        kind,
        id: kind,
        step,
        flow: { type: 'parallel', steps: [{ type: 'step', step }] },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'conditional':
      return {
        kind,
        id: kind,
        step,
        flow: {
          type: 'conditional',
          steps: [{ type: 'step', step }],
          serializedConditions: [{ id: 'when-1', fn: 'true' }],
        },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'loop-step':
      return {
        kind,
        id: kind,
        step,
        flow: { type: 'loop', step, serializedCondition: { id: 'loop-1', fn: 'true' }, loopType: 'dountil' },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'sleep-step':
      return {
        kind,
        id: kind,
        step,
        flow: { type: 'sleep', id: kind, duration: 1000 },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'sleep-until-step':
      return {
        kind,
        id: kind,
        step,
        flow: { type: 'sleepUntil', id: kind, date: new Date(0) },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'nested-workflow-step':
      return {
        kind,
        id: kind,
        step: { ...step, component: 'WORKFLOW', serializedStepFlow: [{ type: 'step', step }] },
        flow: { type: 'step', step },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'unknown-step':
      return {
        kind,
        id: kind,
        step,
        flow: { type: 'step', step },
        result: successResult,
        workflowStatus: 'success',
      };
    case 'step':
      return makeStep();
  }
};

describe('WorkflowStepFactory', () => {
  it('renders a regular step with only the Step renderer', () => {
    const step: ResolvedWorkflowStep = makeStep();
    const calls = {
      Step: vi.fn(),
    };

    render(
      <WorkflowStepFactory
        step={step}
        Step={props => {
          calls.Step(props);
          return (
            <div data-testid="step">
              {props.step?.id ?? props.id}:{props.result?.status}
            </div>
          );
        }}
      />,
    );

    expect(screen.getByTestId('step').textContent).toBe('start:success');
    expect(calls.Step).toHaveBeenCalledTimes(1);
    expect(calls.Step).toHaveBeenCalledWith(expect.objectContaining({ kind: 'step', result: step.result }));
  });

  it.each([
    ['map-step', 'MapStep'],
    ['agent-step', 'AgentStep'],
    ['tool-step', 'ToolStep'],
    ['foreach-step', 'ForEachStep'],
    ['parallel-step', 'ParallelStep'],
    ['conditional', 'Conditional'],
    ['loop-step', 'LoopStep'],
    ['sleep-step', 'SleepStep'],
    ['sleep-until-step', 'SleepUntilStep'],
    ['nested-workflow-step', 'NestedWorkflowStep'],
    ['unknown-step', 'UnknownStep'],
  ] as const)('renders %s with only the %s renderer', (kind, rendererName) => {
    const step = makeVariantStep(kind);
    const calls = {
      Step: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      MapStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      AgentStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      ToolStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      ForEachStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      ParallelStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      Conditional: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      LoopStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      SleepStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      SleepUntilStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      NestedWorkflowStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
      UnknownStep: vi.fn<(props: ResolvedWorkflowStep) => void>(),
    };

    render(
      <WorkflowStepFactory
        step={step}
        Step={props => {
          calls.Step(props);
          return <div data-testid="Step">{props.kind}</div>;
        }}
        MapStep={props => {
          calls.MapStep(props);
          return <div data-testid="MapStep">{props.kind}</div>;
        }}
        AgentStep={props => {
          calls.AgentStep(props);
          return <div data-testid="AgentStep">{props.kind}</div>;
        }}
        ToolStep={props => {
          calls.ToolStep(props);
          return <div data-testid="ToolStep">{props.kind}</div>;
        }}
        ForEachStep={props => {
          calls.ForEachStep(props);
          return <div data-testid="ForEachStep">{props.kind}</div>;
        }}
        ParallelStep={props => {
          calls.ParallelStep(props);
          return <div data-testid="ParallelStep">{props.kind}</div>;
        }}
        Conditional={props => {
          calls.Conditional(props);
          return <div data-testid="Conditional">{props.kind}</div>;
        }}
        LoopStep={props => {
          calls.LoopStep(props);
          return <div data-testid="LoopStep">{props.kind}</div>;
        }}
        SleepStep={props => {
          calls.SleepStep(props);
          return <div data-testid="SleepStep">{props.kind}</div>;
        }}
        SleepUntilStep={props => {
          calls.SleepUntilStep(props);
          return <div data-testid="SleepUntilStep">{props.kind}</div>;
        }}
        NestedWorkflowStep={props => {
          calls.NestedWorkflowStep(props);
          return <div data-testid="NestedWorkflowStep">{props.kind}</div>;
        }}
        UnknownStep={props => {
          calls.UnknownStep(props);
          return <div data-testid="UnknownStep">{props.kind}</div>;
        }}
      />,
    );

    expect(screen.getByTestId(rendererName).textContent).toBe(kind);
    Object.entries(calls).forEach(([name, call]) => {
      if (name === rendererName) {
        expect(call).toHaveBeenCalledTimes(1);
        expect(call).toHaveBeenCalledWith(expect.objectContaining({ kind }));
      } else {
        expect(call).not.toHaveBeenCalled();
      }
    });
  });
});
