import { describe, expect, it, vi } from 'vitest';

import { withGraphStepId } from './processor-workflow-step';

describe('withGraphStepId', () => {
  it('derives workflow identity from the stored graph step', () => {
    const execute = vi.fn();
    const workflowStep = { id: 'processor:shared-instance', execute };

    expect(withGraphStepId(workflowStep, 'first')).toEqual({ id: 'processor:first', execute });
    expect(withGraphStepId(workflowStep, 'second')).toEqual({ id: 'processor:second', execute });
  });

  it('does not mutate the processor-derived workflow step', () => {
    const workflowStep = { id: 'processor:shared-instance', description: 'Shared processor' };

    withGraphStepId(workflowStep, 'graph-node');

    expect(workflowStep.id).toBe('processor:shared-instance');
  });
});
