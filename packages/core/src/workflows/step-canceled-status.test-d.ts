import { describe, expectTypeOf, it } from 'vitest';
import type { SerializedStepResult, StepCanceled, StepResult, WorkflowStepStatus } from './types';

describe('canceled step status contract', () => {
  it('includes "canceled" in WorkflowStepStatus', () => {
    const status: WorkflowStepStatus = 'canceled';
    expectTypeOf(status).toMatchTypeOf<WorkflowStepStatus>();
    expectTypeOf<'canceled'>().toMatchTypeOf<WorkflowStepStatus>();
  });

  it('allows a bare canceled result to be a StepResult without casts', () => {
    const bare = { status: 'canceled' } as const;
    expectTypeOf(bare).toMatchTypeOf<StepResult<any, any, any, any>>();
    expectTypeOf(bare).toMatchTypeOf<SerializedStepResult<any, any, any, any>>();
  });

  it('allows a fully-populated canceled result to be a StepResult without casts', () => {
    const full: StepCanceled<any, any, any, any> = {
      status: 'canceled',
      payload: { foo: 'bar' },
      output: { result: 1 },
      startedAt: 1,
      endedAt: 2,
    };
    expectTypeOf(full).toMatchTypeOf<StepResult<any, any, any, any>>();
  });

  it('exposes "canceled" as a member of the StepResult status union', () => {
    expectTypeOf<Extract<StepResult<any, any, any, any>['status'], 'canceled'>>().toEqualTypeOf<'canceled'>();
  });
});
