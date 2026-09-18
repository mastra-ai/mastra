import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '../index';
import { computeScheduleDefinitionHash } from './definition-hash';

const step = (id: string) =>
  createStep({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: async () => ({}),
  }) as any;

const buildWorkflow = (stepIds: string[]) => {
  const wf = createWorkflow({
    id: 'hash-wf',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  });
  let chain: any = wf;
  for (const id of stepIds) chain = chain.then(step(id));
  chain.commit();
  return wf;
};

describe('computeScheduleDefinitionHash', () => {
  it('is stable across separately-built instances of the same graph', () => {
    // This is the property the fence depends on: the schedule row is hashed by
    // one process at reconcile time and compared by another at fire time. If
    // two identical builds hashed differently, every fire would be refused.
    const a = computeScheduleDefinitionHash(buildWorkflow(['one', 'two']).serializedStepGraph);
    const b = computeScheduleDefinitionHash(buildWorkflow(['one', 'two']).serializedStepGraph);

    expect(a).toBeDefined();
    expect(a).toBe(b);
  });

  it('is stable across repeated calls on the same graph', () => {
    const graph = buildWorkflow(['one']).serializedStepGraph;

    expect(computeScheduleDefinitionHash(graph)).toBe(computeScheduleDefinitionHash(graph));
  });

  it('changes when a step is added', () => {
    // The #19169 scenario: the current build inserts a gate step ahead of the
    // side effect, and the stale build must not hash the same.
    const before = computeScheduleDefinitionHash(buildWorkflow(['side-effect']).serializedStepGraph);
    const after = computeScheduleDefinitionHash(buildWorkflow(['gate', 'side-effect']).serializedStepGraph);

    expect(before).not.toBe(after);
  });

  it('changes when step order changes', () => {
    const forward = computeScheduleDefinitionHash(buildWorkflow(['one', 'two']).serializedStepGraph);
    const reversed = computeScheduleDefinitionHash(buildWorkflow(['two', 'one']).serializedStepGraph);

    expect(forward).not.toBe(reversed);
  });

  it('produces a short hex digest', () => {
    expect(computeScheduleDefinitionHash(buildWorkflow(['one']).serializedStepGraph)).toMatch(/^[0-9a-f]{16}$/);
  });

  describe('fail-open cases', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty array', []],
      ['an empty object', {}],
    ])('returns undefined for %s so unfenced schedules keep firing', (_label, input) => {
      expect(computeScheduleDefinitionHash(input)).toBeUndefined();
    });

    it('returns undefined for a non-serializable graph', () => {
      const circular: any = { steps: [] };
      circular.self = circular;

      expect(computeScheduleDefinitionHash(circular)).toBeUndefined();
    });
  });
});
