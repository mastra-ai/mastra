import { describe, expect, it } from 'vitest';
import { dedupeStepRequests, rehydrateStepRequests } from './step-request-dedupe';

describe('step request dedupe', () => {
  const invariantRequest = { body: 'x'.repeat(10_000) };
  const makeSteps = (count: number, request: unknown = invariantRequest) =>
    Array.from({ length: count }, (_, i) => ({
      stepType: `step-${i}`,
      text: `t${i}`,
      request: { ...(request as any) },
    }));

  it('stores one copy of a request shared by every step and restores it per step', () => {
    const steps = makeSteps(13);
    const { steps: packed, requests } = dedupeStepRequests(steps);

    expect(requests).toHaveLength(1);
    expect(packed.every(s => !('request' in s))).toBe(true);

    const restored = rehydrateStepRequests(packed, requests);
    expect(restored).toEqual(steps);
  });

  it('shrinks the serialized snapshot instead of growing it with step count', () => {
    const steps = makeSteps(13);
    const before = JSON.stringify({ bufferedSteps: steps }).length;
    const { steps: packed, requests } = dedupeStepRequests(steps);
    const after = JSON.stringify({ bufferedSteps: packed, bufferedStepRequests: requests }).length;

    // 13 copies of a 10 KB body collapse to one; the rest is step scaffolding.
    expect(after).toBeLessThan(before / 10);
  });

  it('keeps distinct requests distinct', () => {
    const steps = [
      { stepType: 'a', request: { body: 'one' } },
      { stepType: 'b', request: { body: 'two' } },
      { stepType: 'c', request: { body: 'one' } },
    ];
    const { steps: packed, requests } = dedupeStepRequests(steps);

    expect(requests).toEqual([{ body: 'one' }, { body: 'two' }]);
    expect(rehydrateStepRequests(packed, requests)).toEqual(steps);
  });

  it('leaves the steps untouched when nothing is shared', () => {
    const steps = [
      { stepType: 'a', request: { body: 'one' } },
      { stepType: 'b', request: { body: 'two' } },
    ];
    const result = dedupeStepRequests(steps);

    expect(result.requests).toBeUndefined();
    expect(result.steps).toBe(steps);
  });

  it('leaves a single step alone', () => {
    const steps = makeSteps(1);
    const result = dedupeStepRequests(steps);

    expect(result.requests).toBeUndefined();
    expect(result.steps).toBe(steps);
  });

  it('reads back a snapshot written before dedupe existed', () => {
    const steps = makeSteps(3);
    // No request table: every step still carries its request inline.
    expect(rehydrateStepRequests(steps, undefined)).toBe(steps);
  });

  it('keeps a non-serializable request inline rather than dropping it', () => {
    const cyclic: any = { body: 'shared' };
    cyclic.self = cyclic;
    const steps = [
      { stepType: 'a', request: cyclic },
      { stepType: 'b', request: cyclic },
    ];

    const { steps: packed, requests } = dedupeStepRequests(steps);
    expect(requests).toBeUndefined();
    expect(packed[0]!.request).toBe(cyclic);
  });

  it('preserves steps that have no request at all', () => {
    const steps = [
      { stepType: 'a', request: { body: 'shared' } },
      { stepType: 'b' },
      { stepType: 'c', request: { body: 'shared' } },
    ];
    const { steps: packed, requests } = dedupeStepRequests(steps);

    expect(rehydrateStepRequests(packed, requests)).toEqual(steps);
  });
});
