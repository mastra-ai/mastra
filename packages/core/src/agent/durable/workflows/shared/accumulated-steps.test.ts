import { describe, expect, it, vi } from 'vitest';
import { readAccumulatedSteps, storeAccumulatedSteps } from './accumulated-steps';

describe('readAccumulatedSteps', () => {
  it('reads the step records from workflow state when the run keeps them there', () => {
    expect(readAccumulatedSteps({ accumulatedSteps: [{ text: 'state' }] }, { accumulatedSteps: [] })).toEqual([
      { text: 'state' },
    ]);
  });

  it('falls back to the step payload for runs that never seeded them into state', () => {
    expect(readAccumulatedSteps({ messageListState: {} }, { accumulatedSteps: [{ text: 'payload' }] })).toEqual([
      { text: 'payload' },
    ]);
    expect(readAccumulatedSteps(undefined, {})).toEqual([]);
  });
});

describe('storeAccumulatedSteps', () => {
  it('writes to workflow state, keeping its other fields, and returns nothing for the payload', async () => {
    const setState = vi.fn(async () => {});
    const steps = [{ text: 'one' }, { text: 'two' }];

    const fields = await storeAccumulatedSteps(
      { state: { messageListState: 'transcript', accumulatedSteps: [{ text: 'one' }] }, setState },
      steps,
    );

    expect(fields).toEqual({});
    expect(setState).toHaveBeenCalledWith({ messageListState: 'transcript', accumulatedSteps: steps });
  });

  it('returns the records for the step payload when state does not track them', async () => {
    const setState = vi.fn(async () => {});
    const steps = [{ text: 'one' }];

    expect(await storeAccumulatedSteps({ state: { messageListState: 'transcript' }, setState }, steps)).toEqual({
      accumulatedSteps: steps,
    });
    expect(setState).not.toHaveBeenCalled();
  });
});
